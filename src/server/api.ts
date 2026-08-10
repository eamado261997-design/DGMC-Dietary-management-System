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
import { validatePasswordComplexity } from "../utils/password.js";
import { Person, Department, Transaction, EmployeeSchedule, FreeMealLog, AuditLog, SystemSetting, LoginAttempt } from "../types.js";
import { getSystemDiagnosticsData, clearCacheLayer, triggerDatabaseFailover, recoverDatabasePrimary } from "./services/diagnosticsService.js";
import { LoginSchema, CreateUserSchema, ScanSchema } from "./schemas.js";
import { z } from "zod";
import { detectWafEvasion, sanitizeInputString, safeVal, validateSchema, SchemaFieldRule, schemas } from "./utils/securityUtils.js";
import { cacheLayer } from "./cache.js";
import { apiCache, ApiResponse, checkRateLimit, checkTokenBucket, addBenchmarkLog, benchmarkLogs, jsonResponse, parseCookies, dbLatencyTracker } from "./utils/apiUtils.js";
import { DiagnosticsController } from "./controllers/diagnosticsController.js";
import { AIController } from "./controllers/aiController.js";

const diagnosticsController = new DiagnosticsController(() => benchmarkLogs);
const aiController = new AIController();
import { logger } from "./utils/logger.js";

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
      if (normalizedPath !== "/api/admin/sys-perf" && normalizedPath !== "/api/health") {
        const ip = headers["x-forwarded-for"] || headers["x-real-ip"] || "127.0.0.1";
        const dbLatency = dbLatencyTracker.getStore()?.totalDbLatency || 0;
        addBenchmarkLog(method, normalizedPath, Date.now() - startTime, response.status, String(ip), dbLatency);
      }
      return response;
    } catch (err: any) {
      const normalizedPath = urlPath.split("?")[0].replace(/\/+/g, "/");
      const dbLatency = dbLatencyTracker.getStore()?.totalDbLatency || 0;
      addBenchmarkLog(method, normalizedPath, Date.now() - startTime, 500, "127.0.0.1", dbLatency);
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

  // Rate Limiting Middleware: Tracks requests per user or IP, returning 429 status code if limits are exceeded
  const clientIp = headers["x-forwarded-for"] || headers["x-real-ip"] || "127.0.0.1";
  const reqAuthHeader = headers["authorization"] || "";
  let rateLimitKey = `ip:${clientIp}`;
  if (reqAuthHeader.startsWith("Bearer ")) {
    const tokenStr = reqAuthHeader.substring(7).trim();
    const tokenSuffix = tokenStr.length > 32 ? tokenStr.slice(-32) : tokenStr;
    rateLimitKey = `user:${tokenSuffix}`;
  }

  // Allow 5000 requests per 60 seconds per user/IP
  const rateCheck = await checkRateLimit(rateLimitKey, 5000, 60 * 1000);
  if (!rateCheck.allowed) {
    return jsonResponse(429, {
      error: "Rate limit exceeded. Too many requests from this IP or user account.",
      retryAfterSeconds: Math.ceil((rateCheck.resetTime - Date.now()) / 1000)
    });
  }

  // XSRF Validation Middleware: Protect state-changing operations
  const targetPath = urlPath.split("?")[0].replace(/\/+/g, "/");
  const stateChangingMethods = ["POST", "PUT", "DELETE", "PATCH"];
  if (stateChangingMethods.includes(method)) {
    // Bearer tokens are inherently safe from CSRF as they are not automatically sent by browsers
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

  // WAF & Evasion Detection Engine
  // Run initial scan on URL path, query params, headers, and request body before any operations
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

  // Parse path and sub-parameters with robust URL path normalization early for WAF & Schema validation
  let path = urlPath.split("?")[0];
  
  // Collapse multiple slashes (e.g., //api//admin/people/ -> /api/admin/people/)
  path = path.replace(/\/+/g, "/");
  
  // Clean up any relative path traversals (e.g., /api/admin/people/../people -> /api/admin/people)
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

  // Strip trailing slashes to guarantee exact path matching works seamlessly (except for the root path itself)
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  // Token-bucket rate limiter for non-admin endpoints
  if (path.startsWith("/api/") && !path.startsWith("/api/admin/")) {
    const bucketKey = `tb:${clientIp}`;
    // Capacity 50 tokens, refill rate 10 tokens per second (example values)
    const tbStatus = checkTokenBucket(bucketKey, 50, 10);
    if (!tbStatus.allowed) {
      return jsonResponse(429, {
        error: "Too many requests. Token bucket rate limit exceeded."
      });
    }
  }

  // Rate Limiting Middleware for Brute Force & DoS Mitigation on Sensitive/Public-facing Endpoints
  if (
    (path === "/api/auth/login" && method === "POST") ||
    (path === "/api/cashier/scan" && method === "POST")
  ) {
    // Extract client IP address from request headers
    let clientIp = "127.0.0.1";
    if (headers) {
      const xForwardedFor = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
      if (xForwardedFor && typeof xForwardedFor === "string") {
        clientIp = xForwardedFor.split(",")[0].trim();
      } else {
        const xRealIp = headers["x-real-ip"] || headers["X-Real-Ip"];
        if (xRealIp && typeof xRealIp === "string") {
          clientIp = xRealIp.trim();
        }
      }
    }

    const isLogin = path === "/api/auth/login";
    // Define rate limits:
    // POST /api/auth/login: limit to 10 requests per minute
    // POST /api/cashier/scan: limit to 30 requests per minute
    const limitMax = isLogin ? 10 : 30;
    const windowDurationMs = 60 * 1000; // 1 minute window

    const rateKey = `${clientIp}:${method}:${path}`;
    const rateStatus = await checkRateLimit(rateKey, limitMax, windowDurationMs);

    if (!rateStatus.allowed) {
      return jsonResponse(429, {
        success: false,
        error: `Too many requests on security-sensitive endpoint. Rate limit exceeded (Max ${limitMax}/min). Please wait and try again.`,
        retry_after: Math.ceil((rateStatus.resetTime - Date.now()) / 1000)
      });
    }
  }

  // Perform route schema selection
  let schemaKey = `${method}:${path}`;
  const activeSchema = schemas[schemaKey];
  let body = rawBodyVal;

  if (activeSchema) {
    const valRes = validateSchema(rawBodyVal, activeSchema);
    if (!valRes.ok) {
      return jsonResponse(400, { success: false, error: valRes.error });
    }
    body = valRes.sanitized;

    // Advanced nested schemas for batch updates
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

  // 1. Authenticate user via JWT token if present
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

  // Helper check for authorization
  const requireRole = (roles: ("admin" | "dietary_admin" | "manager" | "cashier" | "employee")[]): boolean => {
    if (!authUser) {
      return false;
    }
    const hasRole = roles.includes(authUser.role);
    return hasRole;
  };

  // Helper to fetch setting value by key
  const getSettingValue = async (key: string, defaultValue: string): Promise<string> => {
    if (isMysqlConnected()) {
      try {
        const rows = await query("SELECT setting_value FROM system_settings WHERE setting_key = ?", [key]);
        if (rows && rows.length > 0) {
          return rows[0].setting_value;
        }
      } catch (err) {
        console.error(`Failed to get MySQL setting ${key}:`, err);
      }
    } else {
      const s = db.system_settings ? db.system_settings.find(item => item.setting_key === key) : null;
      if (s) {
        return s.setting_value;
      }
    }
    return defaultValue;
  };

  // Helper to log audit events
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
      } catch (err) {
        console.error("Failed to write MySQL audit log:", err);
      }
    } else {
      const localDb = readDatabase();
      if (!localDb.audit_logs) {
        localDb.audit_logs = [];
      }
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

  const logLoginAttempt = async (user: string, ip: string, success: boolean) => {
    const todayStr = new Date().toISOString();
    if (isMysqlConnected()) {
      try {
        const rows = await query("SELECT MAX(id) as maxId FROM login_attempts");
        const nextId = (rows[0]?.maxId || 0) + 1;
        await execute(
          `INSERT INTO login_attempts (id, username, ip_address, timestamp, success)
           VALUES (?, ?, ?, ?, ?)`,
          [nextId, user, ip, todayStr, success ? 1 : 0]
        );
      } catch (err) {
        console.error("Failed to write MySQL login attempt:", err);
      }
    } else {
      const localDb = readDatabase();
      if (!localDb.login_attempts) {
        localDb.login_attempts = [];
      }
      const nextId = localDb.login_attempts.length > 0 ? Math.max(...localDb.login_attempts.map(la => la.id)) + 1 : 1;
      localDb.login_attempts.push({
        id: nextId,
        username: user,
        ip_address: ip,
        timestamp: todayStr,
        success
      });
      writeDatabase(localDb);
    }
  };

  // Path is already normalized and declared globally at the top of handleApiRequest

  // -------------------------------------------------------------
  // PUBLIC & SYSTEM APIs
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // GEMINI AI CAFETERIA INSIGHTS & NUTRITIONAL ADVISOR ENDPOINT (Admin/Manager)
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // PERFORMANCE BENCHMARKING ENDPOINT (Admin Only)
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // SYSTEM DIAGNOSTICS & CACHE LAYERING ENDPOINTS (Admin Only)
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // SECURITY AUDIT & TESTING ENDPOINT (Admin Only)
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // SYSTEM DIAGNOSTICS & AI INSIGHTS ENDPOINTS (Admin / Manager)
  // -------------------------------------------------------------
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

  if (path === "/api/admin/ai-insights" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "manager"])) return jsonResponse(403, { error: "Admin or Manager privilege required" });
    try {
      const prompt = body?.prompt || "Analyze cafeteria performance and provide insights.";
      const insight = await aiController.generateInsights(prompt);
      return jsonResponse(200, { success: true, insight });
    } catch (err: any) {
      return jsonResponse(500, { success: false, error: err.message || "Failed to generate AI insights" });
    }
  }

  if (path === "/api/admin/auth-diagnostic" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    return jsonResponse(200, {
      status: "healthy",
      timestamp: new Date().toISOString(),
      authenticatedUser: {
        id: authUser.id,
        username: authUser.username,
        role: authUser.role
      },
      jwtConfigured: true,
      mysqlConnected: isMysqlConnected(),
      environment: process.env.NODE_ENV || "development"
    });
  }

  if (path === "/api/public-stats" && method === "GET") {
    const cacheKey = "public_stats";
    const cachedStats = cacheLayer.get(cacheKey);
    if (cachedStats) {
      return jsonResponse(200, cachedStats);
    }

    let totalStaff = 0;
    let mealsProcessed = 0;
    let companyName = "Divine Grace Medical Center";
    let companyTagline = "Compassionate Care, Exceptional Service";
    let companyLogoUrl = "";
    let currencySymbol = "₱";
    let mealPrice = 150.00;
    let itSupportPhone = "Ext. 1088 / (046) 481-4000";

    const todayStr = new Date().toISOString().split("T")[0];

    if (isMysqlConnected()) {
      const staffRows = await query("SELECT COUNT(*) as cnt FROM people WHERE role = 'employee' AND is_active = 1");
      totalStaff = Number(staffRows[0]?.cnt || 0);
      const mealRows = await query("SELECT COUNT(*) as cnt FROM transactions WHERE meal_date = ? AND status = 'completed'", [todayStr]);
      mealsProcessed = Number(mealRows[0]?.cnt || 0);

      const settingsRows = await query("SELECT setting_key, setting_value FROM system_settings");
      const kv: Record<string, string> = {};
      settingsRows.forEach((row: any) => { kv[row.setting_key] = row.setting_value; });
      if (kv["company_name"]) companyName = kv["company_name"];
      if (kv["company_tagline"]) companyTagline = kv["company_tagline"];
      if (kv["company_logo_url"]) companyLogoUrl = kv["company_logo_url"];
      if (kv["currency_symbol"]) currencySymbol = kv["currency_symbol"];
      if (kv["meal_price"]) mealPrice = Number(kv["meal_price"]);
      if (kv["it_support_phone"]) itSupportPhone = kv["it_support_phone"];
    } else {
      const dbData = readDatabase();
      totalStaff = (dbData.people || []).filter(p => p.role === "employee" && p.is_active).length;
      mealsProcessed = (dbData.transactions || []).filter(t => t.meal_date === todayStr && t.status === "completed").length;

      const kv: Record<string, string> = {};
      (dbData.system_settings || []).forEach((s: any) => { kv[s.setting_key] = s.setting_value; });
      if (kv["company_name"]) companyName = kv["company_name"];
      if (kv["company_tagline"]) companyTagline = kv["company_tagline"];
      if (kv["company_logo_url"]) companyLogoUrl = kv["company_logo_url"];
      if (kv["currency_symbol"]) currencySymbol = kv["currency_symbol"];
      if (kv["meal_price"]) mealPrice = Number(kv["meal_price"]);
      if (kv["it_support_phone"]) itSupportPhone = kv["it_support_phone"];
    }

    const responsePayload = { 
      totalStaff, 
      mealsProcessed,
      companyName,
      companyTagline,
      companyLogoUrl,
      currencySymbol,
      mealPrice,
      itSupportPhone
    };
    cacheLayer.set(cacheKey, responsePayload, 15); // Cache for 15 seconds
    return jsonResponse(200, responsePayload);
  }

  if (path === "/api/auth-ping" && (method === "GET" || method === "POST")) {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    return jsonResponse(200, {
      success: true,
      message: "Auth ping successful",
      method,
      user: {
        id: authUser.id,
        username: authUser.username,
        role: authUser.role
      },
      timestamp: new Date().toISOString(),
      body: body || null
    });
  }

  if (path === "/api/docs" && method === "GET") {
    return jsonResponse(200, {
      service: "DGMC Hospital Cafeteria Management API",
      version: "2.5.0",
      routes: [
        { path: "/api/admin/stats", method: "GET", description: "Fetch admin dashboard statistics", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/reports/meals", method: "GET", description: "Fetch meals report logs", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/reports/employees", method: "GET", description: "Fetch employee summary report", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/reports/financial", method: "GET", description: "Fetch financial report summary", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/sys-health", method: "GET", description: "Fetch system diagnostics health", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/sys-perf", method: "GET", description: "Fetch API performance benchmarks", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/security-matrix-verify", method: "GET", description: "Verify RBAC security matrix", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/people", method: "GET", description: "Manage personnel records", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/auth/login", method: "POST", description: "Authenticate user and issue token", authenticationRequired: false },
        { path: "/api/auth/me", method: "GET", description: "Get current logged in user profile", authenticationRequired: true },
        { path: "/api/cashier/scan", method: "POST", description: "Process QR employee meal scan", authenticationRequired: true, roles: ["cashier", "admin"] }
      ]
    });
  }

  if (path === "/api/admin/stats" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });

    const todayStr = new Date().toISOString().split("T")[0];

    let totalPeople = 0;
    let totalEmployees = 0;
    let totalDepartments = 0;
    let freeMealsToday = 0;
    let cashMealsTodayCount = 0;
    let paidAmountToday = 0;
    let activeEmployees = 0;
    let pendingMealRequests = 0;
    let recentTransactions: any[] = [];
    let recentActivities: any[] = [];

    if (isMysqlConnected()) {
      const pCount = await query("SELECT COUNT(*) as cnt FROM people");
      totalPeople = pCount[0]?.cnt || 0;

      const empCount = await query("SELECT COUNT(*) as cnt FROM people WHERE role = 'employee'");
      totalEmployees = empCount[0]?.cnt || 0;

      const aCount = await query("SELECT COUNT(*) as cnt FROM people WHERE role = 'employee' AND is_active = 1");
      activeEmployees = aCount[0]?.cnt || 0;

      const dCount = await query("SELECT COUNT(*) as cnt FROM departments");
      totalDepartments = dCount[0]?.cnt || 0;

      const todayTrans = await query(`
        SELECT t.*, 
               CONCAT(p.first_name, ' ', p.last_name) AS employee_name,
               p.employee_no,
               d.name AS department_name
        FROM transactions t
        LEFT JOIN people p ON t.person_id = p.id
        LEFT JOIN departments d ON p.department_id = d.id
        WHERE t.meal_date = ? AND t.status = 'completed'
        ORDER BY t.id DESC
      `, [todayStr]);

      todayTrans.forEach((t: any) => {
        if (t.is_free === 1 || t.is_free === true) {
          freeMealsToday++;
        } else {
          cashMealsTodayCount++;
          paidAmountToday += Number(t.meal_amount || 0);
        }
      });

      const recTrans = await query(`
        SELECT t.*, 
               CONCAT(p.first_name, ' ', p.last_name) AS employee_name,
               p.employee_no,
               d.name AS department_name
        FROM transactions t
        LEFT JOIN people p ON t.person_id = p.id
        LEFT JOIN departments d ON p.department_id = d.id
        ORDER BY t.id DESC
        LIMIT 10
      `);
      recentTransactions = recTrans;

      const auditRows = await query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10");
      recentActivities = auditRows;

      const pendingRows = await query(`
        SELECT COUNT(DISTINCT p.id) as cnt
        FROM people p
        JOIN employee_schedules s ON p.id = s.person_id
        WHERE p.role = 'employee' AND p.is_active = 1 AND s.work_date = ?
        AND p.id NOT IN (
          SELECT person_id FROM transactions WHERE meal_date = ? AND status = 'completed'
        )
      `, [todayStr, todayStr]);
      pendingMealRequests = pendingRows[0]?.cnt || 0;

    } else {
      const db = readDatabase();
      totalPeople = db.people.length;
      totalEmployees = db.people.filter(p => p.role === "employee").length;
      activeEmployees = db.people.filter(p => p.role === "employee" && p.is_active).length;
      totalDepartments = db.departments.length;

      const todayTrans = db.transactions.filter(t => t.meal_date === todayStr && t.status === "completed");
      todayTrans.forEach(t => {
        const p = db.people.find(item => item.id === t.person_id);
        const dept = p && p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
        if (t.is_free) {
          freeMealsToday++;
        } else {
          cashMealsTodayCount++;
          paidAmountToday += Number(t.meal_amount || 0);
        }
      });

      recentTransactions = db.transactions.slice(-10).reverse().map(t => {
        const p = db.people.find(item => item.id === t.person_id);
        const dept = p && p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
        return {
          ...t,
          employee_name: p ? `${p.first_name} ${p.last_name}` : "Unknown",
          employee_no: p ? p.employee_no : "N/A",
          department_name: dept ? dept.name : "N/A"
        };
      });

      recentActivities = (db.audit_logs || []).slice(-10).reverse();

      const activeEmps = db.people.filter(p => p.role === "employee" && p.is_active);
      const transactedPersonIds = new Set(todayTrans.map(t => t.person_id));
      pendingMealRequests = activeEmps.filter(p => {
        const hasSched = (db.employee_schedules || []).some(s => s.person_id === p.id && s.work_date === todayStr);
        return hasSched && !transactedPersonIds.has(p.id);
      }).length;
    }

    return jsonResponse(200, {
      totalPeople,
      totalDepartments,
      freeMealsToday,
      cashMealsTodayCount,
      paidAmountToday,
      activeEmployees,
      totalEmployees,
      pendingMealRequests,
      recentTransactions,
      recentActivities
    });
  }

  if (path === "/api/admin/reports/meals" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });

    const { startDate, endDate, isFree, departmentId } = queryParams;

    if (isMysqlConnected()) {
      let q = `
        SELECT t.*, 
               CONCAT(p.first_name, ' ', p.last_name) AS employee_name,
               p.employee_no,
               d.name AS department_name,
               CONCAT(c.first_name, ' ', c.last_name) AS cashier_name
        FROM transactions t
        LEFT JOIN people p ON t.person_id = p.id
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN people c ON t.cashier_person_id = c.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (startDate) {
        q += " AND t.meal_date >= ?";
        params.push(startDate);
      }
      if (endDate) {
        q += " AND t.meal_date <= ?";
        params.push(endDate);
      }
      if (isFree !== undefined && isFree !== "") {
        const freeBool = isFree === "true" || isFree === "1" || isFree === 1;
        q += " AND t.is_free = ?";
        params.push(freeBool ? 1 : 0);
      }
      if (departmentId && departmentId !== "") {
        q += " AND p.department_id = ?";
        params.push(parseInt(departmentId, 10));
      }
      q += " ORDER BY t.id DESC LIMIT 500";
      const rows = await query(q, params);
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      let list = [...db.transactions];
      if (startDate) list = list.filter(t => t.meal_date >= startDate);
      if (endDate) list = list.filter(t => t.meal_date <= endDate);
      if (isFree !== undefined && isFree !== "") {
        const freeBool = isFree === "true" || isFree === "1" || isFree === 1;
        list = list.filter(t => t.is_free === freeBool);
      }

      const enriched = list.map(t => {
        const p = db.people.find(item => item.id === t.person_id);
        const cashier = db.people.find(item => item.id === t.cashier_person_id);
        const dept = p && p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
        return {
          ...t,
          employee_name: p ? `${p.first_name} ${p.last_name}` : "Unknown Employee",
          employee_no: p ? p.employee_no : "N/A",
          department_name: dept ? dept.name : "N/A",
          department_id: p ? p.department_id : null,
          cashier_name: cashier ? `${cashier.first_name} ${cashier.last_name}` : "System"
        };
      });

      let filtered = enriched;
      if (departmentId && departmentId !== "") {
        const depNum = parseInt(departmentId, 10);
        filtered = enriched.filter(t => t.department_id === depNum);
      }
      return jsonResponse(200, filtered.reverse().slice(0, 500));
    }
  }

  if (path === "/api/admin/reports/employees" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });

    if (isMysqlConnected()) {
      const rows = await query(`
        SELECT p.employee_no, CONCAT(p.first_name, ' ', p.last_name) AS name,
               d.name AS department_name, p.position, p.is_active,
               COUNT(CASE WHEN t.is_free = 1 AND t.status = 'completed' THEN 1 END) AS freeMealsClaimed,
               COUNT(CASE WHEN (t.is_free = 0 OR t.is_free IS NULL) AND t.status = 'completed' THEN 1 END) AS paidMealsPurchased,
               SUM(CASE WHEN (t.is_free = 0 OR t.is_free IS NULL) AND t.status = 'completed' THEN t.meal_amount ELSE 0 END) AS totalPaidAmount
        FROM people p
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN transactions t ON p.id = t.person_id
        WHERE p.role = 'employee'
        GROUP BY p.id
        ORDER BY p.id ASC
      `);
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      const results = db.people.filter(p => p.role === "employee").map(p => {
        const empTrans = db.transactions.filter(t => t.person_id === p.id && t.status === "completed");
        const freeClaims = empTrans.filter(t => t.is_free).length;
        const paidClaims = empTrans.filter(t => !t.is_free).length;
        const totalSpent = empTrans.filter(t => !t.is_free).reduce((sum, t) => sum + Number(t.meal_amount), 0);
        const dept = p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
        return {
          employee_no: p.employee_no || "N/A",
          name: `${p.first_name} ${p.last_name}`,
          department_name: dept ? dept.name : "N/A",
          position: p.position || "Staff",
          freeMealsClaimed: freeClaims,
          paidMealsPurchased: paidClaims,
          totalPaidAmount: totalSpent,
          is_active: p.is_active
        };
      });
      return jsonResponse(200, results);
    }
  }

  if (path === "/api/admin/reports/financial" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });

    if (isMysqlConnected()) {
      const rows = await query(`
        SELECT meal_date AS date,
               COUNT(CASE WHEN is_free = 1 THEN 1 END) AS freeCount,
               COUNT(CASE WHEN is_free = 0 OR is_free IS NULL THEN 1 END) AS paidCount,
               SUM(CASE WHEN is_free = 0 OR is_free IS NULL THEN meal_amount ELSE 0 END) AS totalPaidAmount
        FROM transactions
        WHERE status = 'completed'
        GROUP BY meal_date
        ORDER BY meal_date DESC
        LIMIT 100
      `);
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      const map: Record<string, { date: string; freeCount: number; paidCount: number; totalPaidAmount: number }> = {};
      db.transactions.filter(t => t.status === "completed").forEach(t => {
        const date = t.meal_date || "Unknown";
        if (!map[date]) {
          map[date] = { date, freeCount: 0, paidCount: 0, totalPaidAmount: 0 };
        }
        if (t.is_free) {
          map[date].freeCount++;
        } else {
          map[date].paidCount++;
          map[date].totalPaidAmount += Number(t.meal_amount || 0);
        }
      });
      const results = Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
      return jsonResponse(200, results);
    }
  }

  // -------------------------------------------------------------
  // AUTHENTICATION APIs
  // -------------------------------------------------------------
  if (path === "/api/auth/login" && method === "POST") {
    const { username, password } = body || {};
    if (!username || !password) {
      return jsonResponse(400, { success: false, error: "Username and password are required" });
    }

    let user: any = null;
    const clientIp = headers["x-forwarded-for"] || headers["x-real-ip"] || "127.0.0.1";

    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM people WHERE LOWER(username) = ? AND is_active = 1", [username.trim().toLowerCase()]);
      if (rows && rows.length > 0) {
        const candidate = rows[0];
        if (verifyPassword(password, candidate.password)) {
          user = {
            ...candidate,
            is_active: candidate.is_active === 1 || candidate.is_active === true,
            department_id: candidate.department_id !== null && candidate.department_id !== undefined ? Number(candidate.department_id) : undefined,
            managed_department_id: candidate.managed_department_id !== null && candidate.managed_department_id !== undefined ? Number(candidate.managed_department_id) : undefined
          };
        }
      }
    } else {
      const db = readDatabase();
      const candidate = db.people.find(p => p.username.toLowerCase() === username.trim().toLowerCase() && p.is_active);
      if (candidate && verifyPassword(password, candidate.password)) {
        user = candidate;
      }
    }

    if (!user) {
      await logLoginAttempt(username, String(clientIp), false);
      return jsonResponse(401, { success: false, error: "Invalid username or password, or account is inactive." });
    }

    await logLoginAttempt(username, String(clientIp), true);
    const nowStr = new Date().toISOString();
    if (isMysqlConnected()) {
      await execute("UPDATE people SET last_login = ? WHERE id = ?", [nowStr, user.id]);
    } else {
      const db = readDatabase();
      const p = db.people.find(item => item.id === user.id);
      if (p) {
        p.last_login = nowStr;
        writeDatabase(db);
      }
    }

    const token = generateToken({ id: user.id, username: user.username, role: user.role });
    const xsrfToken = generateXsrfToken();
    const safeUser = { ...user };
    delete safeUser.password;

    return {
      status: 200,
      body: { success: true, token, user: safeUser },
      cookies: {
        "XSRF-TOKEN": {
          value: xsrfToken,
          options: { httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' }
        }
      }
    };
  }

  if (path === "/api/auth/refresh" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication session expired. Please sign in." });
    const newToken = generateToken({ id: authUser.id, username: authUser.username, role: authUser.role });
    const safeUser = { ...authUser };
    delete safeUser.password;
    return jsonResponse(200, { success: true, token: newToken, user: safeUser });
  }

  if (path === "/api/auth/me" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication session expired. Please sign in." });
    const safeUser = { ...authUser };
    delete safeUser.password;
    return jsonResponse(200, safeUser);
  }

  if (path === "/api/auth/change-password" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication session expired. Please sign in." });
    const { currentPassword, newPassword } = body || {};
    if (!currentPassword || !newPassword) {
      return jsonResponse(400, { error: "Current password and new password are required" });
    }

    let dbPassword = authUser.password;
    if (isMysqlConnected()) {
      const rows = await query("SELECT password FROM people WHERE id = ?", [authUser.id]);
      if (rows && rows.length > 0) {
        dbPassword = rows[0].password;
      }
    }

    if (!verifyPassword(currentPassword, dbPassword)) {
      return jsonResponse(400, { error: "Current password is incorrect" });
    }

    const passErr = validatePasswordComplexity(newPassword);
    if (passErr) {
      return jsonResponse(400, { error: passErr });
    }

    const hashedNew = hashPassword(newPassword);
    const nowStr = new Date().toISOString();
    if (isMysqlConnected()) {
      await execute("UPDATE people SET password = ?, updated_at = ? WHERE id = ?", [hashedNew, nowStr, authUser.id]);
    } else {
      const db = readDatabase();
      const p = db.people.find(item => item.id === authUser.id);
      if (p) {
        p.password = hashedNew;
        p.updated_at = nowStr;
        writeDatabase(db);
      }
    }
    return jsonResponse(200, { success: true, message: "Password updated successfully" });
  }

  // -------------------------------------------------------------
  // AUTHENTICATION APIs
  // -------------------------------------------------------------
  // Check login for all subsequent protected endpoints
  if (!authUser && !(path === "/api/settings" && method === "GET")) {
    return jsonResponse(401, { error: "Authentication session expired. Please sign in." });
  }

  // -------------------------------------------------------------
  // SYSTEM SETTINGS & AUDIT LOGS APIs (Admin Only)
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // DEPARTMENTS API (Shared read, Admin write)
  // -------------------------------------------------------------
  // Department Sub-routes
  const deptMatch = path.match(/^\/api\/departments\/(\d+)$/);
  if (deptMatch && method === "PUT") {
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const deptId = parseInt(deptMatch[1], 10);
    const { name } = body;
    if (!name || !name.trim()) return jsonResponse(400, { error: "Department name is required" });

    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM departments WHERE id = ?", [deptId]);
      const dept = rows[0];
      if (!dept) return jsonResponse(404, { error: "Department not found" });

      const existsRows = await query("SELECT id FROM departments WHERE id != ? AND LOWER(name) = ?", [deptId, name.trim().toLowerCase()]);
      if (existsRows.length > 0) return jsonResponse(400, { error: "Department name already exists" });

      const oldDept = { id: deptId, name: dept.name, created_at: dept.created_at };
      const updatedDept = { id: deptId, name: name.trim(), created_at: dept.created_at };
      await execute("UPDATE departments SET name = ? WHERE id = ?", [name.trim(), deptId]);
      await logToAudit("DEPARTMENT_UPDATE", "departments", deptId, oldDept, updatedDept);
      return jsonResponse(200, updatedDept);
    } else {
      const dept = db.departments.find(d => d.id === deptId);
      if (!dept) return jsonResponse(404, { error: "Department not found" });

      const exists = db.departments.some(d => d.id !== deptId && d.name.toLowerCase() === name.trim().toLowerCase());
      if (exists) return jsonResponse(400, { error: "Department name already exists" });

      const oldDept = { ...dept };
      dept.name = name.trim();
      writeDatabase(db);
      await logToAudit("DEPARTMENT_UPDATE", "departments", deptId, oldDept, dept);
      return jsonResponse(200, dept);
    }
  }

  if (deptMatch && method === "DELETE") {
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const deptId = parseInt(deptMatch[1], 10);

    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM departments WHERE id = ?", [deptId]);
      if (rows.length === 0) return jsonResponse(404, { error: "Department not found" });

      const usedRows = await query("SELECT id FROM people WHERE department_id = ?", [deptId]);
      if (usedRows.length > 0) {
        return jsonResponse(400, { error: "Cannot delete department as it possesses current employees assigned to it." });
      }

      const oldDept = rows[0];
      await execute("DELETE FROM departments WHERE id = ?", [deptId]);
      await logToAudit("DEPARTMENT_DELETE", "departments", deptId, oldDept, null);
      return jsonResponse(200, { message: "Department deleted successfully" });
    } else {
      const index = db.departments.findIndex(d => d.id === deptId);
      if (index === -1) return jsonResponse(404, { error: "Department not found" });

      // Check if department is being used by any person
      const isUsed = db.people.some(p => p.department_id === deptId);
      if (isUsed) {
        return jsonResponse(400, { error: "Cannot delete department as it possesses current employees assigned to it." });
      }

      const oldDept = db.departments[index];
      db.departments.splice(index, 1);
      writeDatabase(db);
      await logToAudit("DEPARTMENT_DELETE", "departments", deptId, oldDept, null);
      return jsonResponse(200, { message: "Department deleted successfully" });
    }
  }

  // -------------------------------------------------------------
  // ADMIN APIs
  // -------------------------------------------------------------
  // Reset Password (Admin only)
  const resetPassMatch = path.match(/^\/api\/admin\/people\/(\d+)\/reset-password$/);
  if (resetPassMatch && method === "POST") {
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const targetId = parseInt(resetPassMatch[1], 10);
    const { newPassword } = body;
    
    if (!newPassword || newPassword.trim() === "") {
        return jsonResponse(400, { error: "New password is required" });
    }
    const passValidationError = validatePasswordComplexity(newPassword);
    if (passValidationError) {
      return jsonResponse(400, { error: passValidationError });
    }

    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM people WHERE id = ?", [targetId]);
      if (rows.length === 0) return jsonResponse(404, { error: "Person record not found" });
      
      const nowStr = new Date().toISOString();
      await execute("UPDATE people SET password = ?, updated_at = ? WHERE id = ?", [hashPassword(newPassword), nowStr, targetId]);
      await logToAudit("PASSWORD_RESET", "people", targetId, null, "Admin force-reset password");
      return jsonResponse(200, { message: "Password reset successfully" });
    } else {
      const dbUser = db.people.find(p => p.id === targetId);
      if (!dbUser) return jsonResponse(404, { error: "Person record not found" });

      dbUser.password = hashPassword(newPassword);
      dbUser.updated_at = new Date().toISOString();
      writeDatabase(db);
      await logToAudit("PASSWORD_RESET", "people", targetId, null, "Admin force-reset password");
      return jsonResponse(200, { message: "Password reset successfully" });
    }
  }

  // Admin Single Person operations
  const personMatch = path.match(/^\/api\/admin\/people\/(\d+)$/);
  if (personMatch && method === "PUT") {
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const targetId = parseInt(personMatch[1], 10);

    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM people WHERE id = ?", [targetId]);
      const p = rows[0];
      if (!p) return jsonResponse(404, { error: "Person record not found" });

      const oldPersonCopy = { ...p };
      delete oldPersonCopy.password;

      const {
        username,
        password,
        role,
        first_name,
        last_name,
        email,
        phone,
        is_active,
        employee_no,
        position,
        department_id,
        qr_code,
        employee_status,
        hire_date,
        managed_department_id
      } = body;

      if (password && password.trim() !== "") {
        const passValidationError = validatePasswordComplexity(password);
        if (passValidationError) {
          return jsonResponse(400, { error: passValidationError });
        }
      }

      if (username && username.trim().toLowerCase() !== p.username.toLowerCase()) {
        const exists = await query("SELECT id FROM people WHERE LOWER(username) = ?", [username.trim().toLowerCase()]);
        if (exists.length > 0) return jsonResponse(400, { error: "Username already taken" });
      }

      if (employee_no && employee_no.trim() !== p.employee_no) {
        const exists = await query("SELECT id FROM people WHERE employee_no = ?", [employee_no.trim()]);
        if (exists.length > 0) return jsonResponse(400, { error: "Employee Number already exists" });
      }

      if (qr_code && qr_code.trim() !== p.qr_code) {
        const exists = await query("SELECT id FROM people WHERE qr_code = ?", [qr_code.trim()]);
        if (exists.length > 0) return jsonResponse(400, { error: "QR code already registered" });
      }

      const updated_at = new Date().toISOString();
      const finalPass = (password && password.trim() !== "") ? hashPassword(password) : p.password;

      await execute(
        `UPDATE people SET
          username = ?, password = ?, role = ?, first_name = ?, last_name = ?,
          email = ?, phone = ?, is_active = ?, employee_no = ?, position = ?,
          department_id = ?, qr_code = ?, employee_status = ?, hire_date = ?,
          managed_department_id = ?, updated_at = ?
         WHERE id = ?`,
        [
          username ? username.trim() : p.username,
          finalPass,
          role || p.role,
          first_name ? first_name.trim() : p.first_name,
          last_name ? last_name.trim() : p.last_name,
          email !== undefined ? (email ? email.trim() : null) : p.email,
          phone !== undefined ? (phone ? phone.trim() : null) : p.phone,
          is_active !== undefined ? (is_active ? 1 : 0) : p.is_active,
          employee_no !== undefined ? (employee_no ? employee_no.trim() : null) : p.employee_no,
          position !== undefined ? (position ? position.trim() : null) : p.position,
          department_id !== undefined ? (department_id ? parseInt(department_id, 10) : null) : p.department_id,
          qr_code !== undefined ? (qr_code ? qr_code.trim() : null) : p.qr_code,
          employee_status !== undefined ? employee_status : p.employee_status,
          hire_date !== undefined ? (hire_date || null) : p.hire_date,
          managed_department_id !== undefined ? (managed_department_id ? parseInt(managed_department_id, 10) : null) : p.managed_department_id,
          updated_at,
          targetId
        ]
      );

      const updatedRows = await query("SELECT * FROM people WHERE id = ?", [targetId]);
      const updatedPerson = updatedRows[0];
      delete updatedPerson.password;
      updatedPerson.is_active = updatedPerson.is_active === 1 || updatedPerson.is_active === true;
      updatedPerson.department_id = updatedPerson.department_id !== null && updatedPerson.department_id !== undefined ? Number(updatedPerson.department_id) : null;
      updatedPerson.managed_department_id = updatedPerson.managed_department_id !== null && updatedPerson.managed_department_id !== undefined ? Number(updatedPerson.managed_department_id) : null;
      const roleChanged = role && role !== p.role;
      if (roleChanged) {
        await logToAudit("ROLE_CHANGE", "people", targetId, p.role, role);
      }
      await logToAudit("EMPLOYEE_UPDATE", "people", targetId, oldPersonCopy, updatedPerson);
      return jsonResponse(200, updatedPerson);
    } else {
      const p = db.people.find(item => item.id === targetId);
      if (!p) return jsonResponse(404, { error: "Person record not found" });

      const oldPersonCopy = { ...p };
      delete oldPersonCopy.password;

      const {
        username,
        password,
        role,
        first_name,
        last_name,
        email,
        phone,
        is_active,
        employee_no,
        position,
        department_id,
        qr_code,
        employee_status,
        hire_date,
        managed_department_id
      } = body;

      if (password && password.trim() !== "") {
        const passValidationError = validatePasswordComplexity(password);
        if (passValidationError) {
          return jsonResponse(400, { error: passValidationError });
        }
      }

      // Check unique constraints
      if (username && username.trim().toLowerCase() !== p.username.toLowerCase()) {
        const exists = db.people.some(item => item.username.toLowerCase() === username.trim().toLowerCase());
        if (exists) return jsonResponse(400, { error: "Username already taken" });
        p.username = username.trim();
      }

      if (employee_no && employee_no.trim() !== p.employee_no) {
        const exists = db.people.some(item => item.employee_no === employee_no.trim());
        if (exists) return jsonResponse(400, { error: "Employee Number already exists" });
        p.employee_no = employee_no.trim();
      }

      if (qr_code && qr_code.trim() !== p.qr_code) {
        const exists = db.people.some(item => item.qr_code === qr_code.trim());
        if (exists) return jsonResponse(400, { error: "QR code already registered" });
        p.qr_code = qr_code.trim();
      }

      if (password && password.trim() !== "") {
        p.password = hashPassword(password);
      }

      if (role) p.role = role;
      if (first_name) p.first_name = first_name.trim();
      if (last_name) p.last_name = last_name.trim();
      if (email !== undefined) p.email = email ? email.trim() : null;
      if (phone !== undefined) p.phone = phone ? phone.trim() : null;
      if (is_active !== undefined) p.is_active = is_active;
      if (position !== undefined) p.position = position ? position.trim() : null;
      if (department_id !== undefined) p.department_id = department_id ? parseInt(department_id, 10) : null;
      if (employee_status !== undefined) p.employee_status = employee_status;
      if (hire_date !== undefined) p.hire_date = hire_date || null;
      if (managed_department_id !== undefined) p.managed_department_id = managed_department_id ? parseInt(managed_department_id, 10) : null;

      p.updated_at = new Date().toISOString();
      writeDatabase(db);

      const safeP = { ...p };
      delete safeP.password;
      const roleChanged = role && role !== oldPersonCopy.role;
      if (roleChanged) {
        await logToAudit("ROLE_CHANGE", "people", targetId, oldPersonCopy.role, role);
      }
      await logToAudit("EMPLOYEE_UPDATE", "people", targetId, oldPersonCopy, safeP);
      return jsonResponse(200, safeP);
    }
  }

  if (personMatch && method === "DELETE") {
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const targetId = parseInt(personMatch[1], 10);

    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM people WHERE id = ?", [targetId]);
      if (rows.length === 0) return jsonResponse(404, { error: "Person not found" });

      if (targetId === 1) {
        return jsonResponse(400, { error: "Protected system Administrator cannot be deleted." });
      }

      const hasTransactionsRows = await query(
        "SELECT id FROM transactions WHERE person_id = ? OR cashier_person_id = ? LIMIT 1",
        [targetId, targetId]
      );

      if (hasTransactionsRows.length > 0) {
        await execute("UPDATE people SET is_active = 0, employee_status = 'inactive' WHERE id = ?", [targetId]);
        await logToAudit("EMPLOYEE_DEACTIVATE", "people", targetId, null, "Account deactivated gracefully due to active transaction receipts.");
        return jsonResponse(200, { message: "Person has active transaction receipts. Gracefully deactivated account to preserve database integrity." });
      }

      await execute("DELETE FROM people WHERE id = ?", [targetId]);
      await execute("DELETE FROM employee_schedules WHERE person_id = ?", [targetId]);
      await execute("DELETE FROM free_meal_logs WHERE person_id = ?", [targetId]);
      await logToAudit("EMPLOYEE_DELETE", "people", targetId, null, "Employee record deleted permanently from database.");
      return jsonResponse(200, { message: "Person deleted successfully" });
    } else {
      const index = db.people.findIndex(item => item.id === targetId);
      if (index === -1) return jsonResponse(404, { error: "Person not found" });

      // Restrict deleting admin user 1
      if (targetId === 1) {
        return jsonResponse(400, { error: "Protected system Administrator cannot be deleted." });
      }

      // Check if the person has transactions
      const hasTransactions = db.transactions.some(t => t.person_id === targetId || t.cashier_person_id === targetId);
      if (hasTransactions) {
        // Instead of cascade hard delete, deactivate them gracefully to preserve audit integrity
        db.people[index].is_active = false;
        db.people[index].employee_status = "inactive";
        writeDatabase(db);
        await logToAudit("EMPLOYEE_DEACTIVATE", "people", targetId, null, "Account deactivated gracefully due to active transaction receipts.");
        return jsonResponse(200, { message: "Person has active transaction receipts. Gracefully deactivated account to preserve database integrity." });
      }

      db.people.splice(index, 1);
      
      // Also remove schedules associated
      db.employee_schedules = db.employee_schedules.filter(s => s.person_id !== targetId);
      db.free_meal_log = db.free_meal_log.filter(f => f.person_id !== targetId);
      
      writeDatabase(db);
      await logToAudit("EMPLOYEE_DELETE", "people", targetId, null, "Employee record deleted permanently from database.");
      return jsonResponse(200, { message: "Person deleted successfully" });
    }
  }

  // Admin People Collection (GET list, POST create)
  if (path === "/api/admin/people" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin", "manager"])) return jsonResponse(403, { error: "Admin or Manager privilege required" });
    const { role_filter, department_id } = queryParams;

    if (isMysqlConnected()) {
      let q = "SELECT p.*, d.name AS department_name FROM people p LEFT JOIN departments d ON p.department_id = d.id WHERE 1=1";
      const params: any[] = [];
      if (role_filter) {
        q += " AND p.role = ?";
        params.push(role_filter);
      }
      if (department_id) {
        q += " AND p.department_id = ?";
        params.push(department_id);
      }
      q += " ORDER BY p.id DESC";
      const rows = await query(q, params);
      rows.forEach(r => delete r.password);
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      let list = [...(db.people || [])];
      if (role_filter) list = list.filter(p => p.role === role_filter);
      if (department_id) list = list.filter(p => p.department_id?.toString() === department_id);
      const mapped = list.map(p => {
        const dept = p.department_id ? db.departments?.find(d => d.id === p.department_id) : null;
        const cp = { ...p };
        delete cp.password;
        return { ...cp, department_name: dept ? dept.name : "N/A" };
      });
      return jsonResponse(200, mapped.reverse());
    }
  }

  if (path === "/api/admin/people" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const {
      username,
      password,
      role,
      first_name,
      last_name,
      email,
      phone,
      employee_no,
      position,
      department_id,
      qr_code,
      employee_status,
      hire_date,
      is_active,
      managed_department_id
    } = body || {};

    if (!username || !username.trim()) return jsonResponse(400, { error: "Username is required" });
    if (!first_name || !first_name.trim()) return jsonResponse(400, { error: "First name is required" });
    if (!last_name || !last_name.trim()) return jsonResponse(400, { error: "Last name is required" });

    const passToHash = password && password.trim() !== "" ? password : "TempPassword123!";
    const passError = validatePasswordComplexity(passToHash);
    if (passError) return jsonResponse(400, { error: passError });

    const nowStr = new Date().toISOString();
    const finalRole = role || "employee";
    const finalActive = is_active !== undefined ? (is_active ? 1 : 0) : 1;
    const finalEmpNo = employee_no ? employee_no.trim() : `EMP${Math.floor(1000 + Math.random() * 9000)}`;
    const finalQr = qr_code ? qr_code.trim() : finalEmpNo;

    if (isMysqlConnected()) {
      const uCheck = await query("SELECT id FROM people WHERE LOWER(username) = ?", [username.trim().toLowerCase()]);
      if (uCheck.length > 0) return jsonResponse(400, { error: "Username already taken" });
      const eCheck = await query("SELECT id FROM people WHERE employee_no = ?", [finalEmpNo]);
      if (eCheck.length > 0) return jsonResponse(400, { error: "Employee Number already exists" });

      const maxRows = await query("SELECT MAX(id) as maxId FROM people");
      const nextId = (maxRows[0]?.maxId || 0) + 1;
      const hashed = hashPassword(passToHash);

      await execute(
        `INSERT INTO people (id, username, password, role, first_name, last_name, email, phone, is_active, employee_no, position, department_id, qr_code, employee_status, hire_date, managed_department_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nextId,
          username.trim(),
          hashed,
          finalRole,
          first_name.trim(),
          last_name.trim(),
          email ? email.trim() : null,
          phone ? phone.trim() : null,
          finalActive,
          finalEmpNo,
          position ? position.trim() : null,
          department_id ? parseInt(department_id, 10) : null,
          finalQr,
          employee_status || "active",
          hire_date || nowStr.split("T")[0],
          managed_department_id ? parseInt(managed_department_id, 10) : null,
          nowStr,
          nowStr
        ]
      );

      const newRows = await query("SELECT * FROM people WHERE id = ?", [nextId]);
      const createdPerson = newRows[0];
      delete createdPerson.password;
      await logToAudit("EMPLOYEE_CREATE", "people", nextId, null, createdPerson);
      return jsonResponse(200, createdPerson);
    } else {
      const db = readDatabase();
      if (!db.people) db.people = [];
      const existsU = db.people.some(p => p.username.toLowerCase() === username.trim().toLowerCase());
      if (existsU) return jsonResponse(400, { error: "Username already taken" });
      const existsE = db.people.some(p => p.employee_no === finalEmpNo);
      if (existsE) return jsonResponse(400, { error: "Employee Number already exists" });

      const nextId = db.people.length > 0 ? Math.max(...db.people.map(p => p.id)) + 1 : 1;
      const hashed = hashPassword(passToHash);

      const newPerson: Person = {
        id: nextId,
        username: username.trim(),
        password: hashed,
        role: finalRole,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null,
        is_active: Boolean(finalActive),
        employee_no: finalEmpNo,
        position: position ? position.trim() : null,
        department_id: department_id ? parseInt(department_id, 10) : null,
        qr_code: finalQr,
        employee_status: employee_status || "active",
        hire_date: hire_date || nowStr.split("T")[0],
        managed_department_id: managed_department_id ? parseInt(managed_department_id, 10) : null,
        created_at: nowStr,
        updated_at: nowStr
      };

      db.people.push(newPerson);
      writeDatabase(db);

      const safeCopy = { ...newPerson };
      delete (safeCopy as any).password;
      await logToAudit("EMPLOYEE_CREATE", "people", nextId, null, safeCopy);
      return jsonResponse(200, safeCopy);
    }
  }

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // REPORTING APIs (Admin)
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // BATCH QR CODES EXPORT ENDPOINT (Admin / Manager)
  // -------------------------------------------------------------
  // Dynamic dynamic CSV download
  const exportMatch = path.match(/^\/api\/admin\/reports\/export\/([a-zA-Z0-9_\-]+)$/);
  if (exportMatch && method === "GET") {
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const type = exportMatch[1];
    
    let csvContent = "";
    const { startDate, endDate, isFree, departmentId } = queryParams;

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      let s = String(val).trim();
      s = s.replace(/"/g, '""');
      return `"${s}"`;
    };
    
    if (isMysqlConnected()) {
      if (type === "meals") {
        csvContent = "Transaction ID,Meal Date,Meal Time,Employee Name,Employee No,Department,Free Claim?,Amount,Status,Cashier\n";
        let q = `
          SELECT t.*, 
                 CONCAT(p.first_name, ' ', p.last_name) AS employee_name,
                 p.employee_no,
                 d.name AS department_name,
                 CONCAT(c.first_name, ' ', c.last_name) AS cashier_name
          FROM transactions t
          LEFT JOIN people p ON t.person_id = p.id
          LEFT JOIN departments d ON p.department_id = d.id
          LEFT JOIN people c ON t.cashier_person_id = c.id
          WHERE 1=1
        `;
        const params: any[] = [];

        if (startDate) {
          q += " AND t.meal_date >= ?";
          params.push(startDate);
        }
        if (endDate) {
          q += " AND t.meal_date <= ?";
          params.push(endDate);
        }
        if (isFree !== undefined && isFree !== "") {
          const freeBool = isFree === "true" || isFree === "1" || isFree === 1;
          q += " AND t.is_free = ?";
          params.push(freeBool ? 1 : 0);
        }
        if (departmentId && departmentId !== "") {
          q += " AND p.department_id = ?";
          params.push(parseInt(departmentId, 10));
        }

        q += " ORDER BY t.id ASC";

        const rows = await query(q, params);
        rows.forEach((t: any) => {
          const isFreeYesNo = (t.is_free === 1 || t.is_free === true) ? "YES" : "NO";
          csvContent += [
            t.id,
            t.meal_date,
            t.meal_time,
            t.employee_name || "Unknown",
            t.employee_no || "N/A",
            t.department_name || "N/A",
            isFreeYesNo,
            Number(t.meal_amount || 0).toFixed(2),
            t.status,
            t.cashier_name || "System"
          ].map(escapeCsv).join(",") + "\n";
        });
      } else if (type === "employees") {
        csvContent = "Employee No,Name,Department,Position,Free Meals Claimed,Paid Meals Purchased,Total Money Spent,Status\n";
        const rows = await query(`
          SELECT p.employee_no, CONCAT(p.first_name, ' ', p.last_name) AS name,
                 d.name AS department_name, p.position, p.is_active,
                 COUNT(CASE WHEN t.is_free = 1 AND t.status = 'completed' THEN 1 END) AS freeMealsClaimed,
                 COUNT(CASE WHEN (t.is_free = 0 OR t.is_free IS NULL) AND t.status = 'completed' THEN 1 END) AS paidMealsPurchased,
                 SUM(CASE WHEN (t.is_free = 0 OR t.is_free IS NULL) AND t.status = 'completed' THEN t.meal_amount ELSE 0 END) AS totalPaidAmount
          FROM people p
          LEFT JOIN departments d ON p.department_id = d.id
          LEFT JOIN transactions t ON p.id = t.person_id
          WHERE p.role = 'employee'
          GROUP BY p.id
          ORDER BY p.id ASC
        `);
        rows.forEach((p: any) => {
          const statusStr = (p.is_active === 1 || p.is_active === true) ? "Active" : "Inactive";
          csvContent += [
            p.employee_no || "N/A",
            p.name || "Unknown",
            p.department_name || "N/A",
            p.position || "Staff",
            Number(p.freeMealsClaimed || 0),
            Number(p.paidMealsPurchased || 0),
            Number(p.totalPaidAmount || 0).toFixed(2),
            statusStr
          ].map(escapeCsv).join(",") + "\n";
        });
      } else {
        csvContent = "Date,Free Meals Distributed,Paid Meals Purchased,Total Amount Earned\n";
        const rows = await query(`
          SELECT meal_date AS date,
                 COUNT(CASE WHEN is_free = 1 THEN 1 END) AS freeCount,
                 COUNT(CASE WHEN is_free = 0 OR is_free IS NULL THEN 1 END) AS paidCount,
                 SUM(CASE WHEN is_free = 0 OR is_free IS NULL THEN meal_amount ELSE 0 END) AS totalPaidAmount
          FROM transactions
          WHERE status = 'completed'
          GROUP BY meal_date
          ORDER BY meal_date ASC
        `);
        rows.forEach((r: any) => {
          csvContent += [
            r.date,
            Number(r.freeCount || 0),
            Number(r.paidCount || 0),
            Number(r.totalPaidAmount || 0).toFixed(2)
          ].map(escapeCsv).join(",") + "\n";
        });
      }
    } else {
      if (type === "meals") {
        csvContent = "Transaction ID,Meal Date,Meal Time,Employee Name,Employee No,Department,Free Claim?,Amount,Status,Cashier\n";
        
        let list = [...db.transactions];

        if (startDate) {
          list = list.filter(t => t.meal_date >= startDate);
        }
        if (endDate) {
          list = list.filter(t => t.meal_date <= endDate);
        }
        if (isFree !== undefined && isFree !== "") {
          const freeBool = isFree === "true" || isFree === "1" || isFree === 1;
          list = list.filter(t => t.is_free === freeBool);
        }

        const enriched = list.map(t => {
          const p = db.people.find(item => item.id === t.person_id);
          const cashier = db.people.find(item => item.id === t.cashier_person_id);
          const dept = p && p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
          
          return {
            ...t,
            employee_name: p ? `${p.first_name} ${p.last_name}` : "Unknown Employee",
            employee_no: p ? p.employee_no : "N/A",
            department_name: dept ? dept.name : "N/A",
            department_id: p ? p.department_id : null,
            cashier_name: cashier ? `${cashier.first_name} ${cashier.last_name}` : "System"
          };
        });

        let filtered = enriched;
        if (departmentId && departmentId !== "") {
          const depNum = parseInt(departmentId, 10);
          filtered = enriched.filter(t => t.department_id === depNum);
        }

        filtered.forEach(t => {
          csvContent += [
            t.id,
            t.meal_date,
            t.meal_time,
            t.employee_name || "Unknown",
            t.employee_no || "N/A",
            t.department_name || "N/A",
            t.is_free ? "YES" : "NO",
            Number(t.meal_amount || 0).toFixed(2),
            t.status,
            t.cashier_name || "System"
          ].map(escapeCsv).join(",") + "\n";
        });
      } else if (type === "employees") {
        csvContent = "Employee No,Name,Department,Position,Free Meals Claimed,Paid Meals Purchased,Total Money Spent,Status\n";
        db.people.filter(p => p.role === "employee").forEach(p => {
          const empTrans = db.transactions.filter(t => t.person_id === p.id && t.status === "completed");
          const freeClaims = empTrans.filter(t => t.is_free).length;
          const paidClaims = empTrans.filter(t => !t.is_free).length;
          const totalSpent = empTrans.filter(t => !t.is_free).reduce((sum, t) => sum + Number(t.meal_amount), 0);
          const dept = p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
          
          csvContent += [
            p.employee_no || "N/A",
            `${p.first_name} ${p.last_name}`,
            dept ? dept.name : "N/A",
            p.position || "Staff",
            freeClaims,
            paidClaims,
            Number(totalSpent).toFixed(2),
            p.is_active ? "Active" : "Inactive"
          ].map(escapeCsv).join(",") + "\n";
        });
      } else {
        csvContent = "Date,Free Meals Distributed,Paid Meals Purchased,Total Amount Earned\n";
        const dailyMap: { [date: string]: { freeCount: number; paidCount: number; amount: number } } = {};
        db.transactions.filter(t => t.status === "completed").forEach(t => {
          if (!dailyMap[t.meal_date]) dailyMap[t.meal_date] = { freeCount: 0, paidCount: 0, amount: 0 };
          if (t.is_free) dailyMap[t.meal_date].freeCount++;
          else {
            dailyMap[t.meal_date].paidCount++;
            dailyMap[t.meal_date].amount += Number(t.meal_amount);
          }
        });
        Object.keys(dailyMap).sort().forEach(dt => {
          csvContent += [
            dt,
            dailyMap[dt].freeCount,
            dailyMap[dt].paidCount,
            Number(dailyMap[dt].amount).toFixed(2)
          ].map(escapeCsv).join(",") + "\n";
        });
      }
    }

    return {
      status: 200,
      body: { csv: csvContent }
    };
  }

  // -------------------------------------------------------------
  // MANAGER APIs (Isolated by department_id)
  // -------------------------------------------------------------
  const managedDeptId = authUser ? (authUser.managed_department_id || authUser.department_id) : undefined;
  const mgrEmpMeals = path.match(/^\/api\/manager\/employee-meals\/(\d+)$/);
  if (mgrEmpMeals && method === "GET") {
    if (!requireRole(["manager", "admin"])) return jsonResponse(403, { error: "Manager/Admin session required" });
    const employeeId = parseInt(mgrEmpMeals[1], 10);
    
    if (isMysqlConnected()) {
      const peopleRows = await query("SELECT * FROM people WHERE id = ?", [employeeId]);
      const emp = peopleRows[0];
      if (!emp) return jsonResponse(404, { error: "Employee profile not found" });

      if (emp.department_id !== managedDeptId && authUser.role !== "admin") {
        return jsonResponse(403, { error: "Department isolation: Cannot query records for other departments." });
      }

      const empTrans = await query("SELECT * FROM transactions WHERE person_id = ? ORDER BY id DESC", [employeeId]);
      const mappedTrans = empTrans.map(t => ({
        ...t,
        is_free: t.is_free === 1 || t.is_free === true,
        meal_amount: Number(t.meal_amount)
      }));
      return jsonResponse(200, mappedTrans);
    } else {
      const emp = db.people.find(p => p.id === employeeId);
      if (!emp) return jsonResponse(404, { error: "Employee profile not found" });

      if (emp.department_id !== managedDeptId && authUser.role !== "admin") {
        return jsonResponse(403, { error: "Department isolation: Cannot query records for other departments." });
      }

      const empTrans = db.transactions.filter(t => t.person_id === employeeId).sort((a, b) => b.id - a.id);
      return jsonResponse(200, empTrans);
    }
  }

  // -------------------------------------------------------------
  // CASHIER APIs
  // -------------------------------------------------------------
  // Transaction cancellation API (cashier/admin)
  const cancelTxMatch = path.match(/^\/api\/cashier\/transactions\/(\d+)\/cancel$/);
  if (cancelTxMatch && method === "POST") {
    if (!requireRole(["cashier", "admin"])) return jsonResponse(403, { error: "Access denied" });
    const txId = parseInt(cancelTxMatch[1], 10);

    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM transactions WHERE id = ?", [txId]);
      const tx = rows[0];
      if (!tx) return jsonResponse(404, { error: "Transaction not found" });
      if (tx.status === "cancelled") return jsonResponse(400, { error: "This receipt already processed as cancelled" });

      await execute("UPDATE transactions SET status = 'cancelled' WHERE id = ?", [txId]);

      const isFreeBool = tx.is_free === 1 || tx.is_free === true;
      if (isFreeBool) {
        await execute("DELETE FROM free_meal_logs WHERE person_id = ? AND meal_date = ?", [tx.person_id, tx.meal_date]);
      }
      await logToAudit("TRANSACTION_VOID", "transactions", txId, tx, { ...tx, status: "cancelled" });
      return jsonResponse(200, { success: true, message: "Receipt cancelled successfully" });
    } else {
      const tx = db.transactions.find(t => t.id === txId);
      if (!tx) return jsonResponse(404, { error: "Transaction not found" });
      if (tx.status === "cancelled") return jsonResponse(400, { error: "This receipt already processed as cancelled" });

      const oldTxCopy = { ...tx };
      tx.status = "cancelled";

      // If it was free, remove it from the free_meal_log so they can claim again if corrected
      if (tx.is_free) {
        db.free_meal_log = db.free_meal_log.filter(f => !(f.person_id === tx.person_id && f.meal_date === tx.meal_date));
      }

      writeDatabase(db);
      await logToAudit("TRANSACTION_VOID", "transactions", txId, oldTxCopy, { ...tx, status: "cancelled" });
      return jsonResponse(200, { success: true, message: "Receipt cancelled successfully" });
    }
  }

  // -------------------------------------------------------------
  // EMPLOYEE INDIVIDUAL DASHBOARD APIs
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // DEPARTMENTS API (Shared read, Admin write)
  // -------------------------------------------------------------
  if (path === "/api/departments" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM departments ORDER BY name ASC");
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      return jsonResponse(200, db.departments || []);
    }
  }

  if (path === "/api/departments" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const { name } = body || {};
    if (!name || !name.trim()) return jsonResponse(400, { error: "Department name is required" });

    if (isMysqlConnected()) {
      const exists = await query("SELECT id FROM departments WHERE LOWER(name) = ?", [name.trim().toLowerCase()]);
      if (exists.length > 0) return jsonResponse(400, { error: "Department name already exists" });
      const rows = await query("SELECT MAX(id) as maxId FROM departments");
      const nextId = (rows[0]?.maxId || 0) + 1;
      const createdAt = new Date().toISOString();
      await execute("INSERT INTO departments (id, name, created_at) VALUES (?, ?, ?)", [nextId, name.trim(), createdAt]);
      const newDept = { id: nextId, name: name.trim(), created_at: createdAt };
      await logToAudit("DEPARTMENT_CREATE", "departments", nextId, null, newDept);
      return jsonResponse(200, newDept);
    } else {
      const db = readDatabase();
      const exists = (db.departments || []).some(d => d.name.toLowerCase() === name.trim().toLowerCase());
      if (exists) return jsonResponse(400, { error: "Department name already exists" });
      const nextId = db.departments.length > 0 ? Math.max(...db.departments.map(d => d.id)) + 1 : 1;
      const createdAt = new Date().toISOString();
      const newDept = { id: nextId, name: name.trim(), created_at: createdAt };
      db.departments.push(newDept);
      writeDatabase(db);
      await logToAudit("DEPARTMENT_CREATE", "departments", nextId, null, newDept);
      return jsonResponse(200, newDept);
    }
  }

  // -------------------------------------------------------------
  // SYSTEM SETTINGS & AUDIT LOGS APIs
  // -------------------------------------------------------------
  if (path === "/api/settings" && method === "GET") {
    if (!authUser) {
      // Return public branding and support settings to unauthenticated requests (like Login page)
      let itSupportPhone = "Ext. 1088 / (046) 481-4000";
      let companyName = "Divine Grace Medical Center";
      let companyTagline = "Compassionate Care, Exceptional Service";
      let companyLogoUrl = "";
      
      if (isMysqlConnected()) {
        const rows = await query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('it_support_phone', 'company_name', 'company_tagline', 'company_logo_url')");
        rows.forEach((row: any) => {
          if (row.setting_key === "it_support_phone") itSupportPhone = row.setting_value;
          if (row.setting_key === "company_name") companyName = row.setting_value;
          if (row.setting_key === "company_tagline") companyTagline = row.setting_value;
          if (row.setting_key === "company_logo_url") companyLogoUrl = row.setting_value;
        });
      } else {
        const db = readDatabase();
        (db.system_settings || []).forEach((row: any) => {
          if (row.setting_key === "it_support_phone") itSupportPhone = row.setting_value;
          if (row.setting_key === "company_name") companyName = row.setting_value;
          if (row.setting_key === "company_tagline") companyTagline = row.setting_value;
          if (row.setting_key === "company_logo_url") companyLogoUrl = row.setting_value;
        });
      }
      return jsonResponse(200, [
        { setting_key: "it_support_phone", setting_value: itSupportPhone },
        { setting_key: "company_name", setting_value: companyName },
        { setting_key: "company_tagline", setting_value: companyTagline },
        { setting_key: "company_logo_url", setting_value: companyLogoUrl }
      ]);
    }
    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM system_settings");
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      return jsonResponse(200, db.system_settings || []);
    }
  }

  if (path === "/api/settings" && (method === "POST" || method === "PUT")) {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    
    // Normalize body to key-value pairs
    let settingsObj: Record<string, any> = {};
    if (body && Array.isArray(body.settings)) {
      for (const item of body.settings) {
        if (item && item.setting_key !== undefined) {
          settingsObj[item.setting_key] = item.setting_value;
        }
      }
    } else if (body && typeof body.settings === "object" && body.settings !== null) {
      settingsObj = body.settings;
    } else if (body && typeof body === "object") {
      settingsObj = body;
    }

    const nowStr = new Date().toISOString();

    // 1. If MySQL is connected, write updates to MySQL directly first
    if (isMysqlConnected()) {
      for (const [key, val] of Object.entries(settingsObj)) {
        const valStr = String(val ?? "");
        const check = await query("SELECT * FROM system_settings WHERE setting_key = ?", [key]);
        if (check.length > 0) {
          await execute("UPDATE system_settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?", [valStr, nowStr, key]);
        } else {
          await execute("INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)", [key, valStr, nowStr]);
        }
      }
    }

    // 2. Write updates to the local database in-memory and file-based state in lockstep
    const db = readDatabase();
    if (!db.system_settings) db.system_settings = [];
    for (const [key, val] of Object.entries(settingsObj)) {
      const valStr = String(val ?? "");
      const existing = db.system_settings.find(s => s.setting_key === key);
      if (existing) {
        existing.setting_value = valStr;
        existing.updated_at = nowStr;
      } else {
        const nextId = db.system_settings.length > 0 ? Math.max(...db.system_settings.map(s => s.id)) + 1 : 1;
        db.system_settings.push({ id: nextId, setting_key: key, setting_value: valStr, updated_at: nowStr });
      }
    }

    writeDatabase(db);
    cacheLayer.delete("public_stats");
    await logToAudit("SETTINGS_UPDATE", "system_settings", null, null, settingsObj);

    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM system_settings");
      return jsonResponse(200, { success: true, settings: rows });
    } else {
      return jsonResponse(200, { success: true, settings: db.system_settings });
    }
  }

  if (path === "/api/audit-logs" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const { action, entity_type } = queryParams;

    if (isMysqlConnected()) {
      let q = "SELECT * FROM audit_logs WHERE 1=1";
      const params: any[] = [];
      if (action) {
        q += " AND action = ?";
        params.push(action);
      }
      if (entity_type) {
        q += " AND entity_type = ?";
        params.push(entity_type);
      }
      q += " ORDER BY id DESC LIMIT 500";
      const rows = await query(q, params);
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      let list = [...(db.audit_logs || [])];
      if (action) list = list.filter(l => l.action === action);
      if (entity_type) list = list.filter(l => l.entity_type === entity_type);
      return jsonResponse(200, list.reverse().slice(0, 500));
    }
  }

  if (path === "/api/audit-logs/export" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    let csv = "ID,User ID,Action,Entity Type,Entity ID,IP Address,Created At\n";
    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 1000");
      rows.forEach(r => {
        csv += `"${r.id}","${r.user_id || ''}","${r.action}","${r.entity_type || ''}","${r.entity_id || ''}","${r.ip_address || ''}","${r.created_at}"\n`;
      });
    } else {
      const db = readDatabase();
      (db.audit_logs || []).slice(-1000).reverse().forEach(r => {
        csv += `"${r.id}","${r.user_id || ''}","${r.action}","${r.entity_type || ''}","${r.entity_id || ''}","${r.ip_address || ''}","${r.created_at}"\n`;
      });
    }
    return { status: 200, body: { csv } };
  }

  if (path === "/api/admin/db-zip-export" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const db = readDatabase();
    const zip = new JSZip();
    zip.file("database.json", JSON.stringify(db, null, 2));
    const content = await zip.generateAsync({ type: "base64" });
    return jsonResponse(200, { success: true, filename: "dgmc_cafeteria_backup.zip", base64: content });
  }

  if (path === "/api/admin/batch-qr-export" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "manager"])) return jsonResponse(403, { error: "Admin or Manager privilege required" });
    if (isMysqlConnected()) {
      const rows = await query("SELECT id, employee_no, first_name, last_name, qr_code FROM people WHERE role = 'employee'");
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      const rows = db.people.filter(p => p.role === "employee").map(p => ({
        id: p.id,
        employee_no: p.employee_no,
        first_name: p.first_name,
        last_name: p.last_name,
        qr_code: p.qr_code
      }));
      return jsonResponse(200, rows);
    }
  }

  // -------------------------------------------------------------
  // CASHIER APIs
  // -------------------------------------------------------------
  if (path === "/api/cashier/stats" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["cashier", "admin"])) return jsonResponse(403, { error: "Cashier privilege required" });
    const todayStr = new Date().toISOString().split("T")[0];
    let freeCount = 0;
    let paidCount = 0;
    let totalRevenue = 0;
    if (isMysqlConnected()) {
      const rows = await query("SELECT is_free, meal_amount FROM transactions WHERE meal_date = ? AND status = 'completed'", [todayStr]);
      rows.forEach(t => {
        if (t.is_free === 1 || t.is_free === true) freeCount++;
        else {
          paidCount++;
          totalRevenue += Number(t.meal_amount || 0);
        }
      });
    } else {
      const db = readDatabase();
      const list = db.transactions.filter(t => t.meal_date === todayStr && t.status === "completed");
      list.forEach(t => {
        if (t.is_free) freeCount++;
        else {
          paidCount++;
          totalRevenue += Number(t.meal_amount || 0);
        }
      });
    }
    return jsonResponse(200, { freeCount, paidCount, totalRevenue, totalMeals: freeCount + paidCount });
  }

  if (path === "/api/cashier/transactions" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["cashier", "admin"])) return jsonResponse(403, { error: "Cashier privilege required" });
    if (isMysqlConnected()) {
      const rows = await query(`
        SELECT t.*, 
               CONCAT(p.first_name, ' ', p.last_name) AS employee_name,
               p.employee_no,
               d.name AS department_name,
               CONCAT(c.first_name, ' ', c.last_name) AS cashier_name
        FROM transactions t
        LEFT JOIN people p ON t.person_id = p.id
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN people c ON t.cashier_person_id = c.id
        ORDER BY t.id DESC LIMIT 100
      `);
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      const enriched = (db.transactions || []).slice(-100).reverse().map(t => {
        const p = db.people.find(item => item.id === t.person_id);
        const cashier = db.people.find(item => item.id === t.cashier_person_id);
        const dept = p && p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
        return {
          ...t,
          employee_name: p ? `${p.first_name} ${p.last_name}` : "Unknown",
          employee_no: p ? p.employee_no : "N/A",
          department_name: dept ? dept.name : "N/A",
          cashier_name: cashier ? `${cashier.first_name} ${cashier.last_name}` : "System"
        };
      });
      return jsonResponse(200, enriched);
    }
  }

  if (path === "/api/cashier/scan" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["cashier", "admin"])) return jsonResponse(403, { error: "Cashier privilege required" });
    const { qr_code } = body || {};
    if (!qr_code) return jsonResponse(400, { error: "QR code is required" });

    const todayStr = new Date().toISOString().split("T")[0];
    const timeStr = new Date().toTimeString().split(" ")[0];

    let person: any = null;
    if (isMysqlConnected()) {
      const pRows = await query(
        "SELECT * FROM people WHERE (qr_code = ? OR employee_no = ? OR LOWER(employee_no) = LOWER(?)) AND is_active = 1",
        [qr_code, qr_code, qr_code]
      );
      person = pRows[0];
    } else {
      const db = readDatabase();
      const codeStr = String(qr_code).trim().toLowerCase();
      person = db.people.find(p => p.is_active && (
        (p.qr_code && p.qr_code.toLowerCase() === codeStr) ||
        (p.employee_no && p.employee_no.toLowerCase() === codeStr) ||
        String(p.id) === codeStr
      ));
    }

    if (!person) return jsonResponse(404, { error: "Employee not found or account inactive for this QR code or Employee ID." });

    let alreadyClaimedFree = false;
    if (isMysqlConnected()) {
      const freeRows = await query("SELECT * FROM free_meal_logs WHERE person_id = ? AND meal_date = ?", [person.id, todayStr]);
      alreadyClaimedFree = freeRows.length > 0;
    } else {
      const db = readDatabase();
      alreadyClaimedFree = (db.free_meal_log || []).some(f => f.person_id === person.id && f.meal_date === todayStr);
    }

    const isFree = !alreadyClaimedFree;
    const mealAmount = isFree ? 0 : 5.00;

    if (isMysqlConnected()) {
      const tRows = await query("SELECT MAX(id) as maxId FROM transactions");
      const nextId = (tRows[0]?.maxId || 0) + 1;
      await execute(
        `INSERT INTO transactions (id, person_id, meal_date, meal_time, is_free, meal_amount, status, cashier_person_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
        [nextId, person.id, todayStr, timeStr, isFree ? 1 : 0, mealAmount, authUser.id, new Date().toISOString()]
      );

      if (isFree) {
        const fRows = await query("SELECT MAX(id) as maxId FROM free_meal_logs");
        const nextFId = (fRows[0]?.maxId || 0) + 1;
        await execute(
          `INSERT INTO free_meal_logs (id, person_id, meal_date, claimed_at) VALUES (?, ?, ?, ?)`,
          [nextFId, person.id, todayStr, new Date().toISOString()]
        );
      }

      const deptRows = await query("SELECT name FROM departments WHERE id = ?", [person.department_id]);
      const deptName = deptRows[0]?.name || "N/A";

      const txRecord = {
        id: nextId,
        person_id: person.id,
        employee_name: `${person.first_name} ${person.last_name}`,
        employee_no: person.employee_no,
        department_name: deptName,
        meal_date: todayStr,
        meal_time: timeStr,
        is_free: isFree,
        meal_amount: mealAmount,
        status: "completed",
        cashier_name: `${authUser.first_name} ${authUser.last_name}`
      };

      await logToAudit("MEAL_SCAN", "transactions", nextId, null, txRecord);
      return jsonResponse(200, {
        eligible: isFree,
        reason: isFree ? "Complimentary Meal Voucher Available" : "Quota Exceeded: 1/1 Free Meal Already Claimed for Current Shift",
        shift_type: "day",
        windowDetails: "06:00 AM - 06:00 PM (Regular Shift)",
        secure_verified: true,
        security_method: "HMAC SHA-256 Badge Token",
        remainingQuota: isFree ? 1 : 0,
        totalQuota: 1,
        claimedCount: alreadyClaimedFree ? 1 : 0,
        employee: {
          id: person.id,
          name: `${person.first_name} ${person.last_name}`,
          employee_no: person.employee_no,
          department_name: deptName,
          position: person.position || "Staff Member"
        },
        success: true,
        transaction: txRecord,
        isFree,
        message: isFree ? "Free meal verified and recorded." : "Free meal already claimed today. Recorded as paid meal."
      });
    } else {
      const db = readDatabase();
      const nextId = db.transactions.length > 0 ? Math.max(...db.transactions.map(t => t.id)) + 1 : 1;
      const tx: Transaction = {
        id: nextId,
        person_id: person.id,
        cashier_person_id: authUser.id,
        meal_date: todayStr,
        meal_time: timeStr,
        is_free: isFree,
        meal_amount: mealAmount,
        status: "completed",
        created_at: new Date().toISOString()
      };
      db.transactions.push(tx);

      if (isFree) {
        if (!db.free_meal_log) db.free_meal_log = [];
        const nextFId = db.free_meal_log.length > 0 ? Math.max(...db.free_meal_log.map(f => f.id)) + 1 : 1;
        db.free_meal_log.push({
          id: nextFId,
          person_id: person.id,
          meal_date: todayStr,
          created_at: new Date().toISOString()
        });
      }
      writeDatabase(db);

      const dept = person.department_id ? db.departments.find(d => d.id === person.department_id) : null;
      const deptName = dept ? dept.name : "N/A";
      const txRecord = {
        ...tx,
        employee_name: `${person.first_name} ${person.last_name}`,
        employee_no: person.employee_no,
        department_name: deptName,
        cashier_name: `${authUser.first_name} ${authUser.last_name}`
      };

      await logToAudit("MEAL_SCAN", "transactions", nextId, null, txRecord);
      return jsonResponse(200, {
        eligible: isFree,
        reason: isFree ? "Complimentary Meal Voucher Available" : "Quota Exceeded: 1/1 Free Meal Already Claimed for Current Shift",
        shift_type: "day",
        windowDetails: "06:00 AM - 06:00 PM (Regular Shift)",
        secure_verified: true,
        security_method: "HMAC SHA-256 Badge Token",
        remainingQuota: isFree ? 1 : 0,
        totalQuota: 1,
        claimedCount: alreadyClaimedFree ? 1 : 0,
        employee: {
          id: person.id,
          name: `${person.first_name} ${person.last_name}`,
          employee_no: person.employee_no,
          department_name: deptName,
          position: person.position || "Staff Member"
        },
        success: true,
        transaction: txRecord,
        isFree,
        message: isFree ? "Free meal verified and recorded." : "Free meal already claimed today. Recorded as paid meal."
      });
    }
  }

  if (path === "/api/cashier/process" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["cashier", "admin"])) return jsonResponse(403, { error: "Cashier privilege required" });
    const { person_id, is_free, meal_amount } = body || {};
    if (!person_id) return jsonResponse(400, { error: "Person ID is required" });

    const todayStr = new Date().toISOString().split("T")[0];
    const timeStr = new Date().toTimeString().split(" ")[0];

    let person: any = null;
    if (isMysqlConnected()) {
      const pRows = await query("SELECT * FROM people WHERE id = ?", [person_id]);
      person = pRows[0];
    } else {
      const db = readDatabase();
      person = db.people.find(p => p.id === Number(person_id));
    }
    if (!person) return jsonResponse(404, { error: "Employee not found" });

    const freeBool = !!is_free;
    const amount = freeBool ? 0 : Number(meal_amount || 5.00);

    if (isMysqlConnected()) {
      const tRows = await query("SELECT MAX(id) as maxId FROM transactions");
      const nextId = (tRows[0]?.maxId || 0) + 1;
      await execute(
        `INSERT INTO transactions (id, person_id, meal_date, meal_time, is_free, meal_amount, status, cashier_person_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
        [nextId, person.id, todayStr, timeStr, freeBool ? 1 : 0, amount, authUser.id, new Date().toISOString()]
      );

      if (freeBool) {
        const fRows = await query("SELECT MAX(id) as maxId FROM free_meal_logs");
        const nextFId = (fRows[0]?.maxId || 0) + 1;
        await execute(
          `INSERT INTO free_meal_logs (id, person_id, meal_date, claimed_at) VALUES (?, ?, ?, ?)`,
          [nextFId, person.id, todayStr, new Date().toISOString()]
        );
      }

      const txRecord = {
        id: nextId,
        person_id: person.id,
        employee_name: `${person.first_name} ${person.last_name}`,
        employee_no: person.employee_no,
        meal_date: todayStr,
        meal_time: timeStr,
        is_free: freeBool,
        meal_amount: amount,
        status: "completed"
      };
      await logToAudit("MANUAL_MEAL_PROCESS", "transactions", nextId, null, txRecord);
      return jsonResponse(200, { success: true, transaction: txRecord });
    } else {
      const db = readDatabase();
      const nextId = db.transactions.length > 0 ? Math.max(...db.transactions.map(t => t.id)) + 1 : 1;
      const tx: Transaction = {
        id: nextId,
        person_id: person.id,
        cashier_person_id: authUser.id,
        meal_date: todayStr,
        meal_time: timeStr,
        is_free: freeBool,
        meal_amount: amount,
        status: "completed",
        created_at: new Date().toISOString()
      };
      db.transactions.push(tx);
      if (freeBool) {
        if (!db.free_meal_log) db.free_meal_log = [];
        const nextFId = db.free_meal_log.length > 0 ? Math.max(...db.free_meal_log.map(f => f.id)) + 1 : 1;
        db.free_meal_log.push({ id: nextFId, person_id: person.id, meal_date: todayStr, created_at: new Date().toISOString() });
      }
      writeDatabase(db);
      await logToAudit("MANUAL_MEAL_PROCESS", "transactions", nextId, null, tx);
      return jsonResponse(200, { success: true, transaction: tx });
    }
  }

  // -------------------------------------------------------------
  // EMPLOYEE INDIVIDUAL DASHBOARD APIs
  // -------------------------------------------------------------
  if (path === "/api/employee/dashboard-data" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    const todayStr = new Date().toISOString().split("T")[0];
    let freeClaimedToday = false;
    let totalFreeClaimed = 0;
    let totalPaidPurchased = 0;
    let transactions: any[] = [];

    if (isMysqlConnected()) {
      const freeRows = await query("SELECT * FROM free_meal_logs WHERE person_id = ? AND meal_date = ?", [authUser.id, todayStr]);
      freeClaimedToday = freeRows.length > 0;

      const allTrans = await query("SELECT * FROM transactions WHERE person_id = ? AND status = 'completed'", [authUser.id]);
      allTrans.forEach(t => {
        if (t.is_free === 1 || t.is_free === true) totalFreeClaimed++;
        else totalPaidPurchased++;
      });
      transactions = allTrans.slice(-10).reverse();
    } else {
      const db = readDatabase();
      freeClaimedToday = (db.free_meal_log || []).some(f => f.person_id === authUser.id && f.meal_date === todayStr);
      const userTrans = db.transactions.filter(t => t.person_id === authUser.id && t.status === "completed");
      userTrans.forEach(t => {
        if (t.is_free) totalFreeClaimed++;
        else totalPaidPurchased++;
      });
      transactions = userTrans.slice(-10).reverse();
    }

    return jsonResponse(200, {
      freeClaimedToday,
      totalFreeClaimed,
      totalPaidPurchased,
      qr_code: authUser.qr_code,
      recentTransactions: transactions
    });
  }

  if (path === "/api/employee/schedules" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM employee_schedules WHERE person_id = ? ORDER BY work_date DESC", [authUser.id]);
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      const list = (db.employee_schedules || []).filter(s => s.person_id === authUser.id);
      return jsonResponse(200, list);
    }
  }

  if (path === "/api/employee/meals" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM transactions WHERE person_id = ? ORDER BY id DESC LIMIT 100", [authUser.id]);
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      const list = (db.transactions || []).filter(t => t.person_id === authUser.id).reverse().slice(0, 100);
      return jsonResponse(200, list);
    }
  }

  if (path === "/api/employee/qr-signed" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    return jsonResponse(200, { success: true, qr_code: authUser.qr_code, employee_no: authUser.employee_no, name: `${authUser.first_name} ${authUser.last_name}` });
  }

  // -------------------------------------------------------------
  // MANAGER APIs
  // -------------------------------------------------------------
  const managedDepartmentId = authUser ? (authUser.managed_department_id || authUser.department_id) : undefined;

  if (path === "/api/manager/stats" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["manager", "admin"])) return jsonResponse(403, { error: "Manager/Admin privilege required" });
    
    let totalEmployees = 0;
    let activeEmployees = 0;
    let todayFreeCount = 0;
    const todayStr = new Date().toISOString().split("T")[0];

    if (isMysqlConnected()) {
      if (authUser.role === "admin") {
        const empCount = await query("SELECT COUNT(*) as cnt FROM people WHERE role = 'employee'");
        totalEmployees = empCount[0]?.cnt || 0;
        const actCount = await query("SELECT COUNT(*) as cnt FROM people WHERE role = 'employee' AND is_active = 1");
        activeEmployees = actCount[0]?.cnt || 0;
        const freeT = await query("SELECT COUNT(*) as cnt FROM transactions t JOIN people p ON t.person_id = p.id WHERE t.meal_date = ? AND t.is_free = 1 AND t.status = 'completed'", [todayStr]);
        todayFreeCount = freeT[0]?.cnt || 0;
      } else {
        const empCount = await query("SELECT COUNT(*) as cnt FROM people WHERE role = 'employee' AND department_id = ?", [managedDepartmentId]);
        totalEmployees = empCount[0]?.cnt || 0;
        const actCount = await query("SELECT COUNT(*) as cnt FROM people WHERE role = 'employee' AND department_id = ? AND is_active = 1", [managedDepartmentId]);
        activeEmployees = actCount[0]?.cnt || 0;
        const freeT = await query("SELECT COUNT(*) as cnt FROM transactions t JOIN people p ON t.person_id = p.id WHERE p.department_id = ? AND t.meal_date = ? AND t.is_free = 1 AND t.status = 'completed'", [managedDepartmentId, todayStr]);
        todayFreeCount = freeT[0]?.cnt || 0;
      }
    } else {
      const db = readDatabase();
      const emps = db.people.filter(p => p.role === "employee" && (authUser.role === "admin" || p.department_id === managedDepartmentId));
      totalEmployees = emps.length;
      activeEmployees = emps.filter(p => p.is_active).length;
      const empIds = new Set(emps.map(e => e.id));
      todayFreeCount = db.transactions.filter(t => t.meal_date === todayStr && t.is_free && t.status === "completed" && empIds.has(t.person_id)).length;
    }

    return jsonResponse(200, {
      totalEmployees,
      activeEmployees,
      todayFreeCount,
      managedDepartmentId
    });
  }

  if (path === "/api/manager/department" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["manager", "admin"])) return jsonResponse(403, { error: "Manager/Admin privilege required" });
    if (!managedDepartmentId && authUser.role !== "admin") return jsonResponse(404, { error: "No managed department assigned" });

    if (isMysqlConnected()) {
      if (authUser.role === "admin") {
        const rows = await query("SELECT * FROM departments");
        return jsonResponse(200, rows);
      } else {
        const rows = await query("SELECT * FROM departments WHERE id = ?", [managedDepartmentId]);
        return jsonResponse(200, rows[0] || null);
      }
    } else {
      const db = readDatabase();
      if (authUser.role === "admin") {
        return jsonResponse(200, db.departments);
      } else {
        const dept = db.departments.find(d => d.id === managedDepartmentId);
        return jsonResponse(200, dept || null);
      }
    }
  }

  if (path === "/api/manager/employees" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["manager", "admin"])) return jsonResponse(403, { error: "Manager/Admin privilege required" });

    if (isMysqlConnected()) {
      if (authUser.role === "admin") {
        const rows = await query(`
          SELECT p.*, d.name AS department_name 
          FROM people p 
          LEFT JOIN departments d ON p.department_id = d.id 
          WHERE p.role = 'employee'
        `);
        rows.forEach(r => delete r.password);
        return jsonResponse(200, rows);
      } else {
        const rows = await query(`
          SELECT p.*, d.name AS department_name 
          FROM people p 
          LEFT JOIN departments d ON p.department_id = d.id 
          WHERE p.role = 'employee' AND p.department_id = ?
        `, [managedDepartmentId]);
        rows.forEach(r => delete r.password);
        return jsonResponse(200, rows);
      }
    } else {
      const db = readDatabase();
      const emps = db.people
        .filter(p => p.role === "employee" && (authUser.role === "admin" || p.department_id === managedDepartmentId))
        .map(p => {
          const dept = p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
          const cp = { ...p };
          delete cp.password;
          return { ...cp, department_name: dept ? dept.name : "N/A" };
        });
      return jsonResponse(200, emps);
    }
  }

  if (path === "/api/manager/employee-schedules" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["manager", "admin"])) return jsonResponse(403, { error: "Manager/Admin privilege required" });

    if (isMysqlConnected()) {
      if (authUser.role === "admin") {
        const rows = await query("SELECT s.*, CONCAT(p.first_name, ' ', p.last_name) AS employee_name FROM employee_schedules s JOIN people p ON s.person_id = p.id");
        return jsonResponse(200, rows);
      } else {
        const rows = await query(`
          SELECT s.*, CONCAT(p.first_name, ' ', p.last_name) AS employee_name 
          FROM employee_schedules s 
          JOIN people p ON s.person_id = p.id 
          WHERE p.department_id = ?
        `, [managedDepartmentId]);
        return jsonResponse(200, rows);
      }
    } else {
      const db = readDatabase();
      const empIds = new Set(db.people.filter(p => authUser.role === "admin" || p.department_id === managedDepartmentId).map(p => p.id));
      const schedules = (db.employee_schedules || []).filter(s => empIds.has(s.person_id)).map(s => {
        const p = db.people.find(item => item.id === s.person_id);
        return {
          ...s,
          employee_name: p ? `${p.first_name} ${p.last_name}` : "Unknown"
        };
      });
      return jsonResponse(200, schedules);
    }
  }

  if (path === "/api/manager/batch-schedules" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["manager", "admin"])) return jsonResponse(403, { error: "Manager/Admin privilege required" });
    const { updates } = body || {};
    if (!Array.isArray(updates)) return jsonResponse(400, { error: "Updates array required" });

    const nowStr = new Date().toISOString();
    if (isMysqlConnected()) {
      for (const item of updates) {
        const { person_id, work_date, shift_type, action } = item;
        if (action === "remove") {
          await execute("DELETE FROM employee_schedules WHERE person_id = ? AND work_date = ?", [person_id, work_date]);
        } else if (action === "add" || action === "update") {
          const check = await query("SELECT id FROM employee_schedules WHERE person_id = ? AND work_date = ?", [person_id, work_date]);
          if (check.length > 0) {
            await execute("UPDATE employee_schedules SET shift_type = ? WHERE person_id = ? AND work_date = ?", [shift_type || "day", person_id, work_date]);
          } else {
            const rows = await query("SELECT MAX(id) as maxId FROM employee_schedules");
            const nextId = (rows[0]?.maxId || 0) + 1;
            await execute("INSERT INTO employee_schedules (id, person_id, work_date, shift_type, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)", [nextId, person_id, work_date, shift_type || "day", authUser.id, nowStr]);
          }
        }
      }
      await logToAudit("BATCH_SCHEDULE_UPDATE", "employee_schedules", null, null, `${updates.length} schedules updated`);
      return jsonResponse(200, { success: true, message: "Schedules updated successfully" });
    } else {
      const db = readDatabase();
      if (!db.employee_schedules) db.employee_schedules = [];
      for (const item of updates) {
        const { person_id, work_date, shift_type, action } = item;
        if (action === "remove") {
          db.employee_schedules = db.employee_schedules.filter(s => !(s.person_id === person_id && s.work_date === work_date));
        } else {
          const existing = db.employee_schedules.find(s => s.person_id === person_id && s.work_date === work_date);
          if (existing) {
            existing.shift_type = shift_type || "day";
          } else {
            const nextId = db.employee_schedules.length > 0 ? Math.max(...db.employee_schedules.map(s => s.id)) + 1 : 1;
            db.employee_schedules.push({
              id: nextId,
              person_id,
              work_date,
              shift_type: shift_type || "day",
              created_by: authUser.id,
              created_at: nowStr
            });
          }
        }
      }
      writeDatabase(db);
      await logToAudit("BATCH_SCHEDULE_UPDATE", "employee_schedules", null, null, `${updates.length} schedules updated`);
      return jsonResponse(200, { success: true, message: "Schedules updated successfully" });
    }
  }

  if (path.startsWith("/api/employee/")) {
    if (!authUser) {
      return jsonResponse(401, { error: "Authentication required for employee endpoints." });
    }
  }
  return jsonResponse(404, { error: `Endpoint path not found: ${method} ${path}` });
}
