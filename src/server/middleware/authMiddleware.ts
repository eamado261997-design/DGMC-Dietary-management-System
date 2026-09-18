import jwt from "jsonwebtoken";
import { Person } from "../../types.js";
import { logger } from "../utils/logger.js";
import { isMysqlConnected, query, getPoolStats } from "../mysql.js";
import { isSqliteConnected, getSqliteDb } from "../sqlite.js";
import { readDatabase } from "../db.js";
import { decryptPerson } from "../encryption.js";
import { inspectJwtToken } from "../auth.js";

const JWT_SECRET = process.env.JWT_SECRET || "dgmc_dietary_secret_jwt_key_9501";

export interface AuthDiagnosticMetrics {
  totalAuthRequests: number;
  cacheHits: number;
  inFlightDeduplications: number;
  dbLookups: number;
  tokenExpiredErrors: number;
  tokenInvalidErrors: number;
  dbExceptions: number;
  userNotFoundOrInactive: number;
  lastAuthError?: {
    timestamp: string;
    path: string;
    reason: string;
    message: string;
  };
}

const metrics: AuthDiagnosticMetrics = {
  totalAuthRequests: 0,
  cacheHits: 0,
  inFlightDeduplications: 0,
  dbLookups: 0,
  tokenExpiredErrors: 0,
  tokenInvalidErrors: 0,
  dbExceptions: 0,
  userNotFoundOrInactive: 0
};

export function getAuthDiagnostics(): AuthDiagnosticMetrics {
  return { ...metrics };
}

/**
 * Short-lived user authentication cache item.
 * Caches authenticated active user records for 15 seconds to prevent
 * connection pool exhaustion and race conditions from simultaneous parallel requests.
 */
interface CachedAuthUser {
  user: Person;
  expiresAt: number;
}

const authUserCache = new Map<number, CachedAuthUser>();
const inFlightAuthResolutions = new Map<number, Promise<Person | null>>();

// Maximum cache entries to prevent memory leaks
const MAX_CACHE_ENTRIES = 1000;
const AUTH_CACHE_TTL_MS = 15000; // 15 seconds

/**
 * Clears or invalidates cached user authorization state.
 * Call this when a user's role, status, or credentials change.
 */
export function invalidateUserAuthCache(userId?: number): void {
  if (userId !== undefined) {
    authUserCache.delete(userId);
  } else {
    authUserCache.clear();
  }
}

/**
 * Verifies JWT token with clock tolerance and detailed exception diagnosis.
 */
export function verifyTokenWithDiagnostics(token: string): {
  decoded: any | null;
  error?: string;
  errorType?: string;
} {
  const inspection = inspectJwtToken(token);
  if (inspection.isValid) {
    return { decoded: inspection.decoded };
  }
  return {
    decoded: null,
    error: inspection.errorMessage || "Token validation failed",
    errorType: inspection.errorName || (inspection.isExpired ? "TokenExpiredError" : "JsonWebTokenError")
  };
}

/**
 * Resolves a person by ID from the active database engine with retry and fallback.
 */
async function fetchUserFromStorage(userId: number, requestPath: string): Promise<Person | null> {
  metrics.dbLookups++;

  // 1. Primary path: MySQL (with single retry for transient pool/connection drops)
  if (isMysqlConnected()) {
    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      try {
        const rows = await query<any>(
          "SELECT p.*, d.name AS department_name FROM people p LEFT JOIN departments d ON p.department_id = d.id WHERE p.id = ? AND p.is_active = 1",
          [userId]
        );

        if (rows && rows.length > 0) {
          const u = rows[0];
          return {
            ...u,
            is_active: u.is_active === 1 || u.is_active === true,
            department_id: u.department_id !== null && u.department_id !== undefined ? Number(u.department_id) : undefined,
            managed_department_id: u.managed_department_id !== null && u.managed_department_id !== undefined ? Number(u.managed_department_id) : undefined,
            department_name: u.department_name || undefined
          };
        }
        return null;
      } catch (sqlErr: any) {
        metrics.dbExceptions++;
        const isTransient = 
          sqlErr.code === "PROTOCOL_CONNECTION_LOST" ||
          sqlErr.code === "ECONNRESET" ||
          sqlErr.code === "ETIMEDOUT" ||
          sqlErr.code === "ER_CON_COUNT_ERROR";

        if (isTransient && attempts === 1) {
          logger.warn(`[AuthMiddleware] Transient MySQL error on auth lookup for user ${userId} [${requestPath}]: ${sqlErr.message}. Retrying...`);
          await new Promise(res => setTimeout(res, 50));
          continue;
        }

        logger.error(`[AuthMiddleware] MySQL exception during user auth resolution [${requestPath}]: ${sqlErr.message}`, {
          userId,
          code: sqlErr.code,
          errno: sqlErr.errno,
          sqlState: sqlErr.sqlState,
          poolStats: getPoolStats(),
          path: requestPath
        });
        break; // Drop through to SQLite / Memory fallback
      }
    }
  }

  // 2. Fallback path: SQLite
  if (isSqliteConnected()) {
    try {
      const sdb = getSqliteDb();
      if (sdb) {
        const row: any = sdb.prepare(
          "SELECT p.*, d.name AS department_name FROM people p LEFT JOIN departments d ON p.department_id = d.id WHERE p.id = ? AND p.is_active = 1"
        ).get(userId);

        if (row) {
          const decrypted = decryptPerson(row);
          return {
            ...decrypted,
            is_active: true,
            department_id: row.department_id !== null ? Number(row.department_id) : undefined,
            managed_department_id: row.managed_department_id !== null ? Number(row.managed_department_id) : undefined,
            department_name: row.department_name || undefined
          };
        }
      }
    } catch (sqliteErr: any) {
      logger.warn(`[AuthMiddleware] SQLite fallback lookup failed for user ${userId}: ${sqliteErr.message}`);
    }
  }

  // 3. Fallback path: In-memory/JSON store
  try {
    const db = readDatabase();
    const match = (db.people || []).find((p: any) => p.id === userId && p.is_active);
    if (match) {
      const dMatch = match.department_id ? db.departments?.find((d: any) => Number(d.id) === Number(match.department_id)) : null;
      return {
        ...match,
        department_name: dMatch ? dMatch.name : undefined
      };
    }
  } catch (memErr: any) {
    logger.warn(`[AuthMiddleware] Memory fallback lookup failed for user ${userId}: ${memErr.message}`);
  }

  return null;
}

export interface AuthResult {
  authenticated: boolean;
  user: Person | null;
  reason?: string;
  errorDetails?: string;
}

/**
 * Authoritative request authentication middleware handler.
 * Performs token extraction, signature verification, in-flight query deduplication,
 * and database resolution with comprehensive error capture.
 */
export async function authenticateRequest(
  headers: Record<string, any>,
  requestPath: string,
  method: string
): Promise<AuthResult> {
  metrics.totalAuthRequests++;

  const authHeader = headers["authorization"] || headers["Authorization"];
  console.log(`[AuthMiddleware] Incoming request [${method} ${requestPath}] - Auth Header presence: ${!!authHeader}, Content snippet: ${authHeader ? (typeof authHeader === 'string' ? authHeader.substring(0, 15) + '...' : 'non-string') : 'none'}`);
  
  if (!authHeader || typeof authHeader !== "string") {
    return { authenticated: false, user: null, reason: "NO_AUTH_HEADER" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { authenticated: false, user: null, reason: "INVALID_AUTH_SCHEME" };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { authenticated: false, user: null, reason: "EMPTY_BEARER_TOKEN" };
  }

  // Verify JWT signature & expiration
  const { decoded, error, errorType } = verifyTokenWithDiagnostics(token);
  if (!decoded || !decoded.id) {
    if (errorType === "TokenExpiredError") {
      metrics.tokenExpiredErrors++;
      logger.warn(`[AuthMiddleware] Token expired for [${method} ${requestPath}]: ${error}`, {
        path: requestPath,
        method,
        errorType,
        error
      });
    } else {
      metrics.tokenInvalidErrors++;
      logger.warn(`[AuthMiddleware] Invalid token for [${method} ${requestPath}]: ${errorType} - ${error}`, {
        path: requestPath,
        method,
        errorType,
        error
      });
    }

    metrics.lastAuthError = {
      timestamp: new Date().toISOString(),
      path: requestPath,
      reason: errorType || "TOKEN_VERIFICATION_FAILED",
      message: error || "Token invalid"
    };

    return {
      authenticated: false,
      user: null,
      reason: errorType || "TOKEN_INVALID",
      errorDetails: error
    };
  }

  const userId = Number(decoded.id);

  // Check short-lived cache (prevents DB contention during burst client requests)
  const cached = authUserCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    metrics.cacheHits++;
    return { authenticated: true, user: cached.user };
  }

  // Check in-flight promise deduplication
  // If multiple concurrent requests arrive with the same user token, they share the single in-flight resolution
  let resolutionPromise = inFlightAuthResolutions.get(userId);
  if (resolutionPromise) {
    metrics.inFlightDeduplications++;
  } else {
    resolutionPromise = fetchUserFromStorage(userId, requestPath).finally(() => {
      inFlightAuthResolutions.delete(userId);
    });
    inFlightAuthResolutions.set(userId, resolutionPromise);
  }

  let user: Person | null = null;
  try {
    user = await resolutionPromise;
  } catch (fetchErr: any) {
    logger.error(`[AuthMiddleware] Unexpected failure awaiting user auth resolution [${requestPath}]: ${fetchErr.message}`, {
      userId,
      path: requestPath,
      stack: fetchErr.stack
    });
  }

  if (!user) {
    metrics.userNotFoundOrInactive++;
    logger.warn(`[AuthMiddleware] Active user record not found for userId ${userId} [${method} ${requestPath}]`, {
      userId,
      path: requestPath,
      method
    });
    return {
      authenticated: false,
      user: null,
      reason: "USER_NOT_FOUND_OR_INACTIVE",
      errorDetails: `User ID ${userId} does not exist or has been deactivated.`
    };
  }

  // Save to short-lived cache
  if (authUserCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = authUserCache.keys().next().value;
    if (firstKey !== undefined) authUserCache.delete(firstKey);
  }
  authUserCache.set(userId, {
    user,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS
  });

  return {
    authenticated: true,
    user
  };
}
