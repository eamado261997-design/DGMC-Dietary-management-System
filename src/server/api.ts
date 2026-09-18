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
import {
  LoginSchema,
  CreateUserSchema,
  UpdateUserSchema,
  ChangePasswordSchema,
  ResetPasswordSchema,
  DepartmentSchema,
  UpdateDepartmentSchema,
  EmployeeSchema,
  ScheduleSchema,
  ToggleScheduleSchema,
  BatchScheduleItemSchema,
  BatchScheduleSchema,
  ScanSchema,
  CashierProcessSchema,
  DecryptFieldSchema,
  SettingsUpdateSchema,
  LogoUploadSchema
} from "./schemas.js";
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
import { authenticateRequest, getAuthDiagnostics } from "./middleware/authMiddleware.js";
import { logger } from "./utils/logger.js";
import { GoogleGenAI } from "@google/genai";
import {
  AppError,
  DatabaseConstraintError,
  DuplicateKeyError,
  ForeignKeyViolationError,
  NotNullConstraintError,
  CheckConstraintError,
  DataLengthConstraintError,
  DatabaseLockError,
  DatabaseConnectionError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  mapDatabaseError
} from "./errors.js";

export {
  AppError,
  DatabaseConstraintError,
  DuplicateKeyError,
  ForeignKeyViolationError,
  NotNullConstraintError,
  CheckConstraintError,
  DataLengthConstraintError,
  DatabaseLockError,
  DatabaseConnectionError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  mapDatabaseError
};

export type UserRole = "admin" | "dietary_admin" | "manager" | "cashier" | "employee";

export interface AuthorizationGuardResult {
  authorized: boolean;
  statusCode: number;
  code?: string;
  error?: string;
  requiredRoles?: UserRole[];
  path?: string;
  userRole?: string;
}

/**
 * Authorization guard: verifies the user's role from the session/token against
 * the requested API endpoint path and HTTP method. Rejects with 401 Unauthorized
 * if unauthenticated or 403 Forbidden if the user lacks the required privileges.
 */
export function checkEndpointAuthorization(
  method: string,
  requestPath: string,
  user: Person | null
): AuthorizationGuardResult {
  const normalizedMethod = (method || "GET").toUpperCase();
  const normalizedPath = (requestPath || "/").split("?")[0].replace(/\/+/g, "/");

  // 1. Public Endpoints (No authentication required)
  const isPublicEndpoint =
    normalizedPath === "/api/health" ||
    normalizedPath.startsWith("/api/health/") ||
    normalizedPath === "/api/public-stats" ||
    normalizedPath === "/api/docs" ||
    normalizedPath === "/api/auth/login" ||
    normalizedPath === "/api/auth/refresh";

  if (isPublicEndpoint) {
    return { authorized: true, statusCode: 200 };
  }

  // Public settings read fallback (allows unauthenticated UI to fetch hospital branding/support numbers)
  if (normalizedPath === "/api/settings" && normalizedMethod === "GET" && !user) {
    return { authorized: true, statusCode: 200 };
  }

  // 2. Authentication Check for All Protected Endpoints
  if (!user) {
    return {
      authorized: false,
      statusCode: 401,
      code: "UNAUTHORIZED",
      error: "Authentication required. Please provide a valid Bearer token.",
      path: normalizedPath,
      userRole: "unauthenticated"
    };
  }

  const role = user.role as UserRole;

  // 3. Super Admin Only Endpoints (Diagnostics, System Health, Performance Benchmarks, Failover)
  const isSuperAdminOnlyPath =
    normalizedPath === "/api/admin/sys-health" ||
    normalizedPath === "/api/admin/sys-perf" ||
    normalizedPath === "/api/admin/security-matrix-verify" ||
    normalizedPath.startsWith("/api/admin/sys-health/");

  if (isSuperAdminOnlyPath) {
    if (role !== "admin") {
      return {
        authorized: false,
        statusCode: 403,
        code: "FORBIDDEN",
        error: `Access Denied: Super Admin privilege required to access system diagnostics at '${normalizedPath}'.`,
        path: normalizedPath,
        userRole: role,
        requiredRoles: ["admin"]
      };
    }
    return { authorized: true, statusCode: 200 };
  }

  // 4. AI Insights Endpoint (Accessible by admin, dietary_admin, and manager)
  if (normalizedPath === "/api/admin/ai-insights") {
    const allowedRoles: UserRole[] = ["admin", "dietary_admin", "manager"];
    if (!allowedRoles.includes(role)) {
      return {
        authorized: false,
        statusCode: 403,
        code: "FORBIDDEN",
        error: `Access Denied: Role '${role}' is not authorized to access AI insights.`,
        path: normalizedPath,
        userRole: role,
        requiredRoles: allowedRoles
      };
    }
    return { authorized: true, statusCode: 200 };
  }

  // 5. General Admin Endpoints (/api/admin/* and /api/audit-logs/*)
  if (normalizedPath.startsWith("/api/admin/") || normalizedPath.startsWith("/api/audit-logs")) {
    let allowedRoles: UserRole[] = ["admin", "dietary_admin"];
    if (normalizedPath === "/api/admin/reports/meals") {
      allowedRoles = ["admin", "dietary_admin", "cashier", "manager"];
    }
    if (!allowedRoles.includes(role)) {
      return {
        authorized: false,
        statusCode: 403,
        code: "FORBIDDEN",
        error: `Access Denied: Role '${role}' is not authorized to access administrative route '${normalizedPath}'.`,
        path: normalizedPath,
        userRole: role,
        requiredRoles: allowedRoles
      };
    }
    return { authorized: true, statusCode: 200 };
  }

  // 6. Manager Endpoints (/api/manager/*)
  if (normalizedPath.startsWith("/api/manager/")) {
    const allowedRoles: UserRole[] = ["manager", "admin"];
    if (!allowedRoles.includes(role)) {
      return {
        authorized: false,
        statusCode: 403,
        code: "FORBIDDEN",
        error: `Access Denied: Role '${role}' is not authorized to access management route '${normalizedPath}'.`,
        path: normalizedPath,
        userRole: role,
        requiredRoles: allowedRoles
      };
    }
    return { authorized: true, statusCode: 200 };
  }

  // 7. Cashier Endpoints (/api/cashier/*)
  if (normalizedPath.startsWith("/api/cashier/")) {
    const allowedRoles: UserRole[] = ["cashier", "admin"];
    if (!allowedRoles.includes(role)) {
      return {
        authorized: false,
        statusCode: 403,
        code: "FORBIDDEN",
        error: `Access Denied: Role '${role}' is not authorized to access cashier route '${normalizedPath}'.`,
        path: normalizedPath,
        userRole: role,
        requiredRoles: allowedRoles
      };
    }
    return { authorized: true, statusCode: 200 };
  }

  // 8. Department Management Permissions
  if (normalizedPath.startsWith("/api/departments") && normalizedMethod !== "GET") {
    const allowedRoles: UserRole[] = ["admin", "dietary_admin"];
    if (!allowedRoles.includes(role)) {
      return {
        authorized: false,
        statusCode: 403,
        code: "FORBIDDEN",
        error: `Access Denied: Role '${role}' is not authorized to modify departments.`,
        path: normalizedPath,
        userRole: role,
        requiredRoles: allowedRoles
      };
    }
  }

  // 9. System Settings Modification Permissions
  if (normalizedPath.startsWith("/api/settings") && normalizedMethod !== "GET") {
    const allowedRoles: UserRole[] = ["admin", "dietary_admin"];
    if (!allowedRoles.includes(role)) {
      return {
        authorized: false,
        statusCode: 403,
        code: "FORBIDDEN",
        error: `Access Denied: Role '${role}' is not authorized to modify system settings.`,
        path: normalizedPath,
        userRole: role,
        requiredRoles: allowedRoles
      };
    }
  }

  // 10. Employee / Self-Service Endpoints (/api/employee/*)
  if (normalizedPath.startsWith("/api/employee/")) {
    const allowedRoles: UserRole[] = ["employee", "manager", "cashier", "dietary_admin", "admin"];
    if (!allowedRoles.includes(role)) {
      return {
        authorized: false,
        statusCode: 403,
        code: "FORBIDDEN",
        error: `Access Denied: Role '${role}' is not authorized to access employee portal routes.`,
        path: normalizedPath,
        userRole: role,
        requiredRoles: allowedRoles
      };
    }
  }

  return { authorized: true, statusCode: 200 };
}

/**
 * Registry of endpoint-specific request body schemas.
 * Maps HTTP method and route patterns to Zod schemas or field validation rules.
 */
export const endpointSchemas: Record<string, z.ZodType<any> | Record<string, SchemaFieldRule>> = {
  "POST:/api/auth/login": LoginSchema,
  "POST:/api/auth/change-password": ChangePasswordSchema,
  "POST:/api/departments": DepartmentSchema,
  "PUT:/api/departments/:id": UpdateDepartmentSchema,
  "POST:/api/admin/people": CreateUserSchema,
  "PUT:/api/admin/people/:id": UpdateUserSchema,
  "POST:/api/admin/people/:id/reset-password": ResetPasswordSchema,
  "POST:/api/admin/decrypt-field": DecryptFieldSchema,
  "POST:/api/manager/toggle-schedule": ToggleScheduleSchema,
  "POST:/api/manager/batch-schedules": BatchScheduleSchema,
  "POST:/api/cashier/scan": ScanSchema,
  "POST:/api/cashier/process": CashierProcessSchema,
  "PUT:/api/settings": SettingsUpdateSchema,
  "POST:/api/settings/logo": LogoUploadSchema
};

/**
 * Matches an incoming request method and path to its corresponding schema,
 * supporting both exact and parameterized path matching (e.g., :id).
 */
export function findEndpointSchema(
  method: string,
  path: string
): z.ZodType<any> | Record<string, SchemaFieldRule> | null {
  const directKey = `${method}:${path}`;
  if (endpointSchemas[directKey]) {
    return endpointSchemas[directKey];
  }
  if (schemas[directKey]) {
    return schemas[directKey];
  }

  // Check parameterized route patterns
  for (const [key, schema] of Object.entries(endpointSchemas)) {
    const [m, routePattern] = key.split(":");
    if (m !== method) continue;
    if (routePattern.includes(":")) {
      const regex = new RegExp("^" + routePattern.replace(/:[a-zA-Z0-9_]+/g, "[^/]+") + "$");
      if (regex.test(path)) {
        return schema;
      }
    }
  }

  for (const [key, schema] of Object.entries(schemas)) {
    const [m, routePattern] = key.split(":");
    if (m !== method) continue;
    if (routePattern.includes(":")) {
      const regex = new RegExp("^" + routePattern.replace(/:[a-zA-Z0-9_]+/g, "[^/]+") + "$");
      if (regex.test(path)) {
        return schema;
      }
    }
  }

  return null;
}

export interface ValidationResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  field?: string;
  details?: any;
}

/**
 * Schema validation helper: verifies that all required fields are present and properly typed
 * in API request bodies before passing them to the database service layer.
 * 
 * Supports both Zod schemas and declarative field rules with automatic sanitization.
 */
export function validateRequestBody<T = any>(
  body: any,
  schema: z.ZodType<T> | Record<string, SchemaFieldRule>,
  options: { allowExtraKeys?: boolean } = {}
): ValidationResult<T> {
  if (body === undefined || body === null) {
    return { ok: false, error: "Request payload is missing or empty" };
  }

  // 1. Zod Schema Validation
  if (schema && typeof (schema as any).safeParse === "function") {
    const result = (schema as z.ZodType<T>).safeParse(body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const fieldPath = firstIssue?.path && firstIssue.path.length > 0 ? firstIssue.path.join(".") : undefined;
      const errorMsg = firstIssue?.message || "Invalid request payload format";
      return {
        ok: false,
        error: fieldPath ? `${fieldPath}: ${errorMsg}` : errorMsg,
        field: fieldPath,
        details: result.error.issues
      };
    }
    return { ok: true, data: result.data };
  }

  // 2. Rule Dictionary Validation
  if (typeof schema === "object") {
    const result = validateSchema(body, schema as Record<string, SchemaFieldRule>, options.allowExtraKeys ?? true);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.sanitized };
  }

  return { ok: true, data: body };
}

/**
 * requestValidator helper: takes a schema object and the request body, verifying required fields
 * and types before passing data to services. Returns 400 Bad Request error response if validation fails.
 */
export function requestValidator<T = any>(
  schema: z.ZodType<T> | Record<string, SchemaFieldRule>,
  body: any,
  options: { allowExtraKeys?: boolean } = {}
): { ok: true; data: T } | { ok: false; errorResponse: ApiResponse; error: string; field?: string; details?: any } {
  const result = validateRequestBody<T>(body, schema, options);
  if (!result.ok) {
    const errorResponse = jsonResponse(400, {
      success: false,
      statusCode: 400,
      code: "VALIDATION_ERROR",
      error: result.error || "Bad Request: validation failed",
      field: result.field,
      details: result.details
    });
    return {
      ok: false,
      errorResponse,
      error: result.error || "Bad Request: validation failed",
      field: result.field,
      details: result.details
    };
  }
  return { ok: true, data: result.data as T };
}


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
      // Map database constraints and exceptions to human-readable standard AppErrors
      const appError = mapDatabaseError(err);
      const normalizedPath = urlPath.split("?")[0].replace(/\/+/g, "/");
      const dbLatency = dbLatencyTracker.getStore()?.totalDbLatency || 0;
      const errMsg = appError.message;
      const errStack = err?.stack || "";
      
      logger.error(`[API Server Exception] [${method} ${normalizedPath}] [${appError.code} ${appError.statusCode}]: ${errMsg}`, {
        method,
        path: normalizedPath,
        code: appError.code,
        statusCode: appError.statusCode,
        field: appError.field,
        details: appError.details,
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
          appError.statusCode,
          String(headers["x-forwarded-for"] || headers["x-real-ip"] || "127.0.0.1"),
          dbLatency,
          errMsg,
          errStack
        );
      }
      return jsonResponse(appError.statusCode, appError.toJSON());
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

  // Resolve endpoint schema (supporting Zod and declarative field rules with parameterized path support)
  const activeSchema = findEndpointSchema(method, path);
  let body = rawBodyVal;

  if (activeSchema && ["POST", "PUT", "PATCH"].includes(method)) {
    const valRes = validateRequestBody(rawBodyVal, activeSchema);
    if (!valRes.ok) {
      return jsonResponse(400, {
        success: false,
        statusCode: 400,
        code: "VALIDATION_ERROR",
        error: valRes.error,
        field: valRes.field,
        details: valRes.details
      });
    }
    body = valRes.data;

    // Deep validation for batch schedules
    if (path === "/api/manager/batch-schedules" && method === "POST" && Array.isArray(body?.updates)) {
      for (let i = 0; i < body.updates.length; i++) {
        const item = body.updates[i];
        const itemRes = validateRequestBody(item, BatchScheduleItemSchema);
        if (!itemRes.ok) {
          return jsonResponse(400, {
            success: false,
            statusCode: 400,
            code: "VALIDATION_ERROR",
            error: `Schedule validation failure at index ${i}: ${itemRes.error}`,
            field: `updates.${i}.${itemRes.field || ""}`
          });
        }
        body.updates[i] = itemRes.data;
      }
    }
  }

  // Authenticate incoming request via dedicated, contention-free authentication middleware
  const authResult = await authenticateRequest(headers, path, method);
  const authUser: Person | null = authResult.user;

  const db = readDatabase();

  const requireRole = (roles: ("admin" | "dietary_admin" | "manager" | "cashier" | "employee")[]): boolean => {
    if (!authUser) return false;
    return roles.includes(authUser.role);
  };

  // Evaluate role-based endpoint authorization guard before passing request to domain handlers
  const authGuardCheck = checkEndpointAuthorization(method, path, authUser);
  if (!authGuardCheck.authorized) {
    const isUnauthMe = (path === "/api/auth/me" && method === "GET" && authResult.reason === "NO_AUTH_HEADER");
    if (!isUnauthMe) {
      logger.warn(`[AuthGuard] Access denied [${method} ${path}]: status ${authGuardCheck.statusCode}, reason: ${authResult.reason || 'unauthorized'}`, {
        method,
        path,
        statusCode: authGuardCheck.statusCode,
        reason: authResult.reason,
        error: authGuardCheck.error,
        userRole: authUser?.role || "unauthenticated"
      });
    }

    return jsonResponse(authGuardCheck.statusCode, {
      success: false,
      statusCode: authGuardCheck.statusCode,
      code: authGuardCheck.code || (authGuardCheck.statusCode === 401 ? "UNAUTHORIZED" : "FORBIDDEN"),
      error: authGuardCheck.error,
      path,
      userRole: authUser?.role || "unauthenticated",
      requiredRoles: authGuardCheck.requiredRoles,
      reason: authResult.reason,
      ...(authResult.errorDetails ? { details: authResult.errorDetails } : {})
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
  if (path === "/api/public-stats" && method === "GET") {
    const { getPublicStats } = await import("./routes/publicStats.js");
    const stats = await getPublicStats();
    return jsonResponse(200, stats, {
      "Cache-Control": "public, max-age=15, stale-while-revalidate=60"
    });
  }

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
      status: (code: number) => ({ json: (data: any) => { result = { error: data, status: code }; } }),
      setHeader: (_name: string, _val: string) => {}
    } as any;
    await diagnosticsController.getPerformanceBenchmarks(mockReq, mockRes);
    return jsonResponse(200, result, {
      "Cache-Control": "public, max-age=10"
    });
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
