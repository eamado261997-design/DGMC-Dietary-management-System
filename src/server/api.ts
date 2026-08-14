import {
  readDatabase,
  writeDatabase,
  hashPassword,
  verifyPassword,
  verifyToken,
  generateToken
} from "./db.js";
import { generateXsrfToken, validateXsrfToken } from "./auth.js";
import { isMysqlConnected, query, execute } from "./mysql.js";
import { encryptDeterministic, getSensitivePersonFieldsEncrypted, decrypt } from "./encryption.js";
import JSZip from "jszip";
import { MIN_PASSWORD_LENGTH } from "../constants/security.js";
import { validatePasswordComplexity, DEFAULT_MIN_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH_LIMITS } from "../utils/password.js";
import { Person, Department, Transaction, EmployeeSchedule, FreeMealLog, AuditLog, SystemSetting, LoginAttempt } from "../types.js";
import { getSystemDiagnosticsData, clearCacheLayer, triggerDatabaseFailover, recoverDatabasePrimary } from "./services/diagnosticsService.js";
import { LoginSchema, CreateUserSchema, ScanSchema } from "./schemas.js";
import { z } from "zod";
import { detectWafEvasion, sanitizeInputString, safeVal, validateSchema, SchemaFieldRule, schemas } from "./utils/securityUtils.js";
import { cacheLayer } from "./cache.js";
import { apiCache, ApiResponse, checkRateLimit, checkTokenBucket, addBenchmarkLog, benchmarkLogs, jsonResponse, parseCookies, dbLatencyTracker } from "./utils/apiUtils.js";
import { DiagnosticsController } from "./controllers/diagnosticsController.js";
import { handleAuthRoutes } from "./routes/auth.js";
import { handleAdminRoutes } from "./routes/admin.js";
import { handleEmployeeRoutes } from "./routes/employees.js";
import { handleTransactionRoutes } from "./routes/transactions.js";
import { handleDepartmentRoutes } from "./routes/departments.js";
import { handleSettingsRoutes } from "./routes/settings.js";
import { logger } from "./utils/logger.js";
import { GoogleGenAI } from "@google/genai";

const diagnosticsController = new DiagnosticsController(() => benchmarkLogs);

export async function handleApiRequest(
  method: string,
  urlPath: string,
  rawBody: any,
  headers: any,
  rawQueryParams: any = {}
): Promise<ApiResponse> {
  const startTime = Date.now();
  return dbLatencyTracker.run({ totalDbLatency: 0 }, async () => {
    try {
      const response = await _handleApiRequest(method, urlPath, rawBody, headers, rawQueryParams);
      const normalizedPath = urlPath.split("?")[0].replace(/\/+/g, "/");
      const isAllowedPath = normalizedPath.startsWith("/api/admin/") || 
                            normalizedPath.startsWith("/api/employee/") || 
                            normalizedPath.startsWith("/api/transactions/");
      const isExcludedPath = normalizedPath === "/api/admin/sys-health" || 
                             normalizedPath === "/api/admin/sys-perf" || 
                             normalizedPath.startsWith("/api/admin/sys-health/") || 
                             normalizedPath.startsWith("/api/admin/sys-perf/");
      const shouldLogBenchmark = isAllowedPath && !isExcludedPath;
      
      if (shouldLogBenchmark) {
        const ip = headers["x-forwarded-for"] || headers["x-real-ip"] || "127.0.0.1";
        const dbLatency = dbLatencyTracker.getStore()?.totalDbLatency || 0;
        addBenchmarkLog(method, normalizedPath, Date.now() - startTime, response.status, String(ip), dbLatency);
      }
      return response;
    } catch (err: any) {
      const normalizedPath = urlPath.split("?")[0].replace(/\/+/g, "/");
      const dbLatency = dbLatencyTracker.getStore()?.totalDbLatency || 0;
      const errMsg = err?.message || String(err);
      const errStack = err?.stack || "";
      
      logger.error(`[API Server Exception] [${method} ${normalizedPath}]: ${errMsg}`, {
        method,
        path: normalizedPath,
        error: errMsg,
        stack: errStack
      });

      const isAllowedPath = normalizedPath.startsWith("/api/admin/") || 
                            normalizedPath.startsWith("/api/employee/") || 
                            normalizedPath.startsWith("/api/transactions/");
      const isExcludedPath = normalizedPath === "/api/admin/sys-health" || 
                             normalizedPath === "/api/admin/sys-perf" || 
                             normalizedPath.startsWith("/api/admin/sys-health/") || 
                             normalizedPath.startsWith("/api/admin/sys-perf/");
      const shouldLogBenchmark = isAllowedPath && !isExcludedPath;
      
      if (shouldLogBenchmark) {
        addBenchmarkLog(
          method,
          normalizedPath,
          Date.now() - startTime,
          500,
          "127.0.0.1",
          dbLatency,
          errMsg,
          errStack
        );
      }
      throw err;
    }
  });
}

async function _handleApiRequest(
  method: string,
  urlPath: string,
  rawBody: any,
  headers: any,
  rawQueryParams: any = {}
): Promise<ApiResponse> {
  let decoded: any = null;

  const clientIp = headers["x-forwarded-for"] || headers["x-real-ip"] || "127.0.0.1";
  const reqAuthHeader = headers["authorization"] || "";
  let rateLimitKey = `ip:${clientIp}`;
  if (reqAuthHeader.startsWith("Bearer ")) {
    const tokenStr = reqAuthHeader.substring(7).trim();
    const tokenSuffix = tokenStr.length > 32 ? tokenStr.slice(-32) : tokenStr;
    rateLimitKey = `user:${tokenSuffix}`;
  }

  const rateCheck = await checkRateLimit(rateLimitKey, 5000, 60 * 1000);
  if (!rateCheck.allowed) {
    return jsonResponse(429, {
      error: "Rate limit exceeded. Too many requests from this IP or user account.",
      retryAfterSeconds: Math.ceil((rateCheck.resetTime - Date.now()) / 1000)
    });
  }

  const targetPath = urlPath.split("?")[0].replace(/\/+/g, "/");
  const stateChangingMethods = ["POST", "PUT", "DELETE", "PATCH"];
  if (stateChangingMethods.includes(method)) {
    const hasBearer = reqAuthHeader.startsWith("Bearer ");
    const isAuthRequest = targetPath === "/api/auth/login" || targetPath === "/api/auth/refresh";

    if (!hasBearer && !isAuthRequest) {
      const cookies = parseCookies(headers["cookie"]);
      const xsrfTokenFromCookie = cookies["XSRF-TOKEN"];
      const xsrfTokenFromHeader = headers["x-xsrf-token"] || headers["X-XSRF-TOKEN"];

      if (!xsrfTokenFromCookie || !xsrfTokenFromHeader || !validateXsrfToken(xsrfTokenFromHeader, xsrfTokenFromCookie)) {
        return jsonResponse(403, {
          error: "Invalid or missing XSRF token",
          message: "Security validation failed. Please refresh your page and try again."
        });
      }
    }
  }

  const pathScan = detectWafEvasion(urlPath, "urlPath");
  if (!pathScan.ok) {
    return jsonResponse(400, { security_alert: true, error: pathScan.reason });
  }

  const queryScan = detectWafEvasion(rawQueryParams, "queryParams");
  if (!queryScan.ok) {
    return jsonResponse(400, { security_alert: true, error: queryScan.reason });
  }

  const bodyScan = detectWafEvasion(rawBody, "body");
  if (!bodyScan.ok) {
    return jsonResponse(400, { security_alert: true, error: bodyScan.reason });
  }

  const rawBodyVal = safeVal(rawBody, "body");
  const queryParams = safeVal(rawQueryParams, "queryParams");

  let path = urlPath.split("?")[0];
  path = path.replace(/\/+/g, "/");
  if (path.includes("..")) {
    const segments = path.split("/");
    const resolved: string[] = [];
    for (const seg of segments) {
      if (seg === "..") {
        resolved.pop();
      } else if (seg !== "." && seg !== "") {
        resolved.push(seg);
      }
    }
    path = "/" + resolved.join("/");
  }

  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  if (path.startsWith("/api/") && !path.startsWith("/api/admin/")) {
    const bucketKey = `tb:${clientIp}`;
    const tbStatus = checkTokenBucket(bucketKey, 50, 10);
    if (!tbStatus.allowed) {
      return jsonResponse(429, {
        error: "Too many requests. Token bucket rate limit exceeded."
      });
    }
  }

  if (
    (path === "/api/auth/login" && method === "POST") ||
    (path === "/api/cashier/scan" && method === "POST")
  ) {
    let clientIpAddr = "127.0.0.1";
    if (headers) {
      const xForwardedFor = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
      if (xForwardedFor && typeof xForwardedFor === "string") {
        clientIpAddr = xForwardedFor.split(",")[0].trim();
      } else {
        const xRealIp = headers["x-real-ip"] || headers["X-Real-Ip"];
        if (xRealIp && typeof xRealIp === "string") {
          clientIpAddr = xRealIp.trim();
        }
      }
    }

    const isLogin = path === "/api/auth/login";
    const limitMax = isLogin ? 10 : 30;
    const windowDurationMs = 60 * 1000;

    const rateKey = `${clientIpAddr}:${method}:${path}`;
    const rateStatus = await checkRateLimit(rateKey, limitMax, windowDurationMs);

    if (!rateStatus.allowed) {
      return jsonResponse(429, {
        success: false,
        error: `Too many requests on security-sensitive endpoint. Rate limit exceeded (Max ${limitMax}/min). Please wait and try again.`,
        retry_after: Math.ceil((rateStatus.resetTime - Date.now()) / 1000)
      });
    }
  }

  let schemaKey = `${method}:${path}`;
  const activeSchema = schemas[schemaKey];
  let body = rawBodyVal;

  if (activeSchema) {
    const valRes = validateSchema(rawBodyVal, activeSchema);
    if (!valRes.ok) {
      return jsonResponse(400, { success: false, error: valRes.error });
    }
    body = valRes.sanitized;

    if (schemaKey === "POST:/api/manager/batch-schedules" && Array.isArray(body.updates)) {
      for (let i = 0; i < body.updates.length; i++) {
        const item = body.updates[i];
        const itemRes = validateSchema(item, {
          person_id: { type: "number", required: true },
          work_date: { type: "string", required: true },
          shift_type: { type: "string", required: false, allowedValues: ["day", "night"] },
          action: { type: "string", required: true, allowedValues: ["add", "update", "remove"] }
        }, false);
        if (!itemRes.ok) {
          return jsonResponse(400, { success: false, error: `Schedule validation failure at index ${i}: ${itemRes.error}` });
        }
        body.updates[i] = itemRes.sanitized;
      }
    }
  }

  let authUser: Person | null = null;
  const authHeader = headers["authorization"] || headers["Authorization"];

  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    decoded = verifyToken(token);
    if (decoded) {
      if (isMysqlConnected()) {
        const rows = await query("SELECT * FROM people WHERE id = ? AND is_active = 1", [decoded.id]);
        if (rows && rows.length > 0) {
          const u = rows[0];
          authUser = {
            ...u,
            is_active: u.is_active === 1 || u.is_active === true,
            department_id: u.department_id !== null && u.department_id !== undefined ? Number(u.department_id) : undefined,
            managed_department_id: u.managed_department_id !== null && u.managed_department_id !== undefined ? Number(u.managed_department_id) : undefined
          };
        }
      } else {
        const db = readDatabase();
        authUser = db.people.find(p => p.id === decoded.id && p.is_active) || null;
      }
    }
  }

  const db = readDatabase();

  const requireRole = (roles: ("admin" | "dietary_admin" | "manager" | "cashier" | "employee")[]): boolean => {
    if (!authUser) return false;
    return roles.includes(authUser.role);
  };

  /**
   * Authorization guard utility: validates user roles against requested API endpoint paths.
   * Proactively prevents employees and unauthorized roles from reaching administrative or management routes.
   */
  const validateEndpointAuthorization = (requestPath: string, user: Person | null): { authorized: boolean; statusCode: number; error: string } => {
    const isPublicEndpoint = 
      requestPath === "/api/health" ||
      requestPath.startsWith("/api/health/") ||
      requestPath === "/api/public-stats" ||
      requestPath === "/api/auth/login" ||
      requestPath === "/api/auth/refresh";

    if (isPublicEndpoint) {
      return { authorized: true, statusCode: 200, error: "" };
    }

    // Public settings read fallback
    if (requestPath === "/api/settings" && method === "GET" && !user) {
      return { authorized: true, statusCode: 200, error: "" };
    }

    // All other endpoints require an authenticated user
    if (!user) {
      return {
        authorized: false,
        statusCode: 401,
        error: "Authentication required. Please provide a valid Bearer token."
      };
    }

    const role = user.role;

    // 1. Admin endpoints (/api/admin/*)
    if (requestPath.startsWith("/api/admin/")) {
      const isAllowedAdminRole = role === "admin" || role === "dietary_admin" || (requestPath === "/api/admin/ai-insights" && role === "manager");
      if (!isAllowedAdminRole) {
        return {
          authorized: false,
          statusCode: 403,
          error: `Access Denied: Role '${role}' is not authorized to access administrative routes.`
        };
      }
    }

    // 2. Manager endpoints (/api/manager/*)
    if (requestPath.startsWith("/api/manager/")) {
      const isAllowedManagerRole = role === "manager" || role === "admin";
      if (!isAllowedManagerRole) {
        return {
          authorized: false,
          statusCode: 403,
          error: `Access Denied: Role '${role}' is not authorized to access management routes.`
        };
      }
    }

    // 3. Cashier endpoints (/api/cashier/*)
    if (requestPath.startsWith("/api/cashier/")) {
      const isAllowedCashierRole = role === "cashier" || role === "admin";
      if (!isAllowedCashierRole) {
        return {
          authorized: false,
          statusCode: 403,
          error: `Access Denied: Role '${role}' is not authorized to access cashier routes.`
        };
      }
    }

    // 4. Employee restricted modification of system settings or departments
    if (requestPath.startsWith("/api/departments") && method !== "GET") {
      if (role !== "admin" && role !== "dietary_admin") {
        return {
          authorized: false,
          statusCode: 403,
          error: `Access Denied: Role '${role}' is not authorized to modify departments.`
        };
      }
    }

    if (requestPath.startsWith("/api/settings") && method !== "GET") {
      if (role !== "admin" && role !== "dietary_admin") {
        return {
          authorized: false,
          statusCode: 403,
          error: `Access Denied: Role '${role}' is not authorized to modify system settings.`
        };
      }
    }

    return { authorized: true, statusCode: 200, error: "" };
  };

  // Evaluate authorization guard before invoking domain route handlers
  const authGuardCheck = validateEndpointAuthorization(path, authUser);
  if (!authGuardCheck.authorized) {
    return jsonResponse(authGuardCheck.statusCode, {
      error: authGuardCheck.error,
      path,
      userRole: authUser?.role || "unauthenticated"
    });
  }

  const getSettingValue = async (key: string, defaultValue: string): Promise<string> => {
    if (isMysqlConnected()) {
      try {
        const rows = await query("SELECT setting_value FROM system_settings WHERE setting_key = ?", [key]);
        if (rows && rows.length > 0) return rows[0].setting_value;
      } catch (_err) {
        // Suppress MySQL setting retrieval error in production
      }
    } else {
      const s = db.system_settings ? db.system_settings.find(item => item.setting_key === key) : null;
      if (s) return s.setting_value;
    }
    return defaultValue;
  };

  const logToAudit = async (
    action: string,
    entity_type?: string,
    entity_id?: string | number | null,
    old_value?: any,
    new_value?: any
  ) => {
    const todayStr = new Date().toISOString();
    const ipAddress = headers["x-forwarded-for"] || headers["x-real-ip"] || "127.0.0.1";
    const userId = authUser ? authUser.id : null;
    const oldStr = old_value ? (typeof old_value === "object" ? JSON.stringify(old_value) : String(old_value)) : null;
    const newStr = new_value ? (typeof new_value === "object" ? JSON.stringify(new_value) : String(new_value)) : null;

    if (isMysqlConnected()) {
      try {
        const rows = await query("SELECT MAX(id) as maxId FROM audit_logs");
        const nextId = (rows[0]?.maxId || 0) + 1;
        await execute(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [nextId, userId, action, entity_type || null, entity_id ? String(entity_id) : null, oldStr, newStr, String(ipAddress), todayStr]
        );
      } catch (_err) {
        // Suppress MySQL audit log write error in production
      }
    } else {
      const localDb = readDatabase();
      if (!localDb.audit_logs) localDb.audit_logs = [];
      const nextId = localDb.audit_logs.length > 0 ? Math.max(...localDb.audit_logs.map(l => l.id)) + 1 : 1;
      localDb.audit_logs.push({
        id: nextId,
        user_id: userId || undefined,
        action,
        entity_type,
        entity_id: entity_id ? String(entity_id) : undefined,
        old_value: oldStr,
        new_value: newStr,
        ip_address: String(ipAddress),
        created_at: todayStr
      });
      writeDatabase(localDb);
    }
  };

  // -------------------------------------------------------------
  // DELEGATE TO MODULAR ROUTE HANDLERS
  // -------------------------------------------------------------
  const authRes = await handleAuthRoutes(method, path, body, headers, authUser);
  if (authRes) return authRes;

  const adminRes = await handleAdminRoutes(method, path, body, headers, authUser, queryParams, requireRole);
  if (adminRes) return adminRes;

  const employeeRes = await handleEmployeeRoutes(method, path, body, headers, authUser, queryParams, requireRole, logToAudit, getSettingValue);
  if (employeeRes) return employeeRes;

  const transactionRes = await handleTransactionRoutes(method, path, body, headers, authUser, requireRole, logToAudit);
  if (transactionRes) return transactionRes;

  const deptRes = await handleDepartmentRoutes(method, path, body, headers, authUser, requireRole, logToAudit);
  if (deptRes) return deptRes;

  const settingsRes = await handleSettingsRoutes(method, path, body, headers, authUser, queryParams, requireRole, logToAudit);
  if (settingsRes) return settingsRes;

  // -------------------------------------------------------------
  // HEALTH & SYSTEM DIAGNOSTICS ENDPOINTS
  // -------------------------------------------------------------
  if (path === "/api/health" && method === "GET") {
    let mysqlStatus = "disconnected";
    let dbType = "json_file";
    if (isMysqlConnected()) {
      try {
        await query("SELECT 1");
        mysqlStatus = "connected";
        dbType = "mysql";
      } catch (e) {
        mysqlStatus = "error";
      }
    }
    return jsonResponse(200, {
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: dbType,
      mysql: mysqlStatus
    });
  }

  if (path === "/api/admin/sys-health" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    let result: any = null;
    const mockReq = {} as any;
    const mockRes = {
      json: (data: any) => { result = data; },
      status: (code: number) => ({ json: (data: any) => { result = { error: data, status: code }; } })
    } as any;
    await diagnosticsController.getDiagnostics(mockReq, mockRes);
    return jsonResponse(200, result);
  }

  if (path === "/api/admin/sys-perf" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    let result: any = null;
    const mockReq = {} as any;
    const mockRes = {
      json: (data: any) => { result = data; },
      status: (code: number) => ({ json: (data: any) => { result = { error: data, status: code }; } })
    } as any;
    await diagnosticsController.getPerformanceBenchmarks(mockReq, mockRes);
    return jsonResponse(200, result);
  }

  if (path === "/api/admin/security-matrix-verify" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    let result: any = null;
    const mockReq = {} as any;
    const mockRes = {
      json: (data: any) => { result = data; },
      status: (code: number) => ({ json: (data: any) => { result = { error: data, status: code }; } })
    } as any;
    await diagnosticsController.verifySecurityMatrix(mockReq, mockRes);
    return jsonResponse(200, result);
  }

  if (path === "/api/admin/sys-health/cache/clear" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    let result: any = null;
    const mockReq = { body } as any;
    const mockRes = {
      json: (data: any) => { result = data; },
      status: (code: number) => ({ json: (data: any) => { result = { error: data, status: code }; } })
    } as any;
    await diagnosticsController.clearCache(mockReq, mockRes);
    return jsonResponse(200, result);
  }

  if (path === "/api/admin/sys-health/failover/trigger" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    let result: any = null;
    const mockReq = { body } as any;
    const mockRes = {
      json: (data: any) => { result = data; },
      status: (code: number) => ({ json: (data: any) => { result = { error: data, status: code }; } })
    } as any;
    await diagnosticsController.failover(mockReq, mockRes);
    return jsonResponse(200, result);
  }

  if (path === "/api/admin/sys-health/failover/recover" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    let result: any = null;
    const mockReq = { body } as any;
    const mockRes = {
      json: (data: any) => { result = data; },
      status: (code: number) => ({ json: (data: any) => { result = { error: data, status: code }; } })
    } as any;
    await diagnosticsController.recover(mockReq, mockRes);
    return jsonResponse(200, result);
  }

  // -------------------------------------------------------------
  // GEMINI AI ADVISOR ENDPOINT
  // -------------------------------------------------------------
  if (path === "/api/admin/ai-insights" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "manager"])) return jsonResponse(403, { error: "Admin or Manager privilege required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return jsonResponse(500, { error: "GEMINI_API_KEY is not configured on the server." });
    }

    const { prompt } = body || {};
    const todayStr = new Date().toISOString().split("T")[0];

    let totalMealsToday = 0;
    let freeMealsToday = 0;
    let paidMealsToday = 0;
    let totalRevenueToday = 0;

    if (isMysqlConnected()) {
      const rows = await query("SELECT is_free, meal_amount FROM transactions WHERE meal_date = ? AND status = 'completed'", [todayStr]);
      totalMealsToday = rows.length;
      rows.forEach(t => {
        if (t.is_free === 1 || t.is_free === true) freeMealsToday++;
        else {
          paidMealsToday++;
          totalRevenueToday += Number(t.meal_amount || 0);
        }
      });
    } else {
      const dbData = readDatabase();
      const todayTrans = dbData.transactions.filter(t => t.meal_date === todayStr && t.status === "completed");
      totalMealsToday = todayTrans.length;
      todayTrans.forEach(t => {
        if (t.is_free) freeMealsToday++;
        else {
          paidMealsToday++;
          totalRevenueToday += Number(t.meal_amount || 0);
        }
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `You are an expert hospital cafeteria operations and dietary nutrition AI advisor for Divine Grace Medical Center. Today is ${todayStr}. Current statistics: Total meals today: ${totalMealsToday} (Free: ${freeMealsToday}, Paid: ${paidMealsToday}), Revenue: ₱${totalRevenueToday.toFixed(2)}. Provide professional, concise, data-driven operational insights and menu recommendations.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt ? prompt : "Provide a comprehensive operational and nutritional summary for today's cafeteria service.",
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      return jsonResponse(200, {
        success: true,
        insight: response.text || "No AI insight generated."
      });
    } catch (aiErr: any) {
      const errMsg = aiErr?.message || String(aiErr);
      if (errMsg.includes("resource_exhausted") || errMsg.includes("quota") || errMsg.includes("429")) {
        return jsonResponse(429, { 
          error: "Gemini API quota exceeded. You have reached your current usage limits. Please check your plan and billing details or try again later.",
          details: errMsg
        });
      }
      return jsonResponse(500, { error: `Failed to generate AI insights: ${errMsg}` });
    }
  }

  return jsonResponse(404, { error: `Endpoint path not found: ${method} ${path}` });
}
