import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dgmc_dietary_secret_jwt_key_9501";

/**
 * Inspects a JWT token and logs detailed diagnostic information regarding
 * expiration, signature validity, and payload contents.
 */
export function inspectJwtToken(token: string): {
  isValid: boolean;
  isExpired: boolean;
  signatureFailed: boolean;
  decoded: any | null;
  errorName?: string;
  errorMessage?: string;
} {
  if (!token) {
    console.warn("[AuthDiagnostics] Token inspection called with empty or null token");
    return { isValid: false, isExpired: false, signatureFailed: false, decoded: null, errorMessage: "Empty token" };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      clockTolerance: 15
    });
    console.log("[AuthDiagnostics] JWT verification SUCCESS:", {
      userId: (decoded as any)?.id,
      username: (decoded as any)?.username,
      role: (decoded as any)?.role,
      exp: (decoded as any)?.exp ? new Date((decoded as any).exp * 1000).toISOString() : "none"
    });
    return { isValid: true, isExpired: false, signatureFailed: false, decoded };
  } catch (err: any) {
    const errorName = err.name || "JsonWebTokenError";
    const errorMessage = err.message || String(err);
    const isExpired = errorName === "TokenExpiredError";
    const signatureFailed = errorName === "JsonWebTokenError" || errorMessage.includes("signature");

    console.error(`[AuthDiagnostics] JWT verification FAILED [${errorName}]:`, {
      errorName,
      errorMessage,
      isExpired,
      signatureFailed,
      tokenSnippet: token.length > 20 ? `${token.substring(0, 10)}...${token.substring(token.length - 10)}` : token
    });

    return {
      isValid: false,
      isExpired,
      signatureFailed,
      decoded: null,
      errorName,
      errorMessage
    };
  }
}

/**
 * Generates a cryptographically secure XSRF token.
 * 
 * @returns A 64-character hex string (256 bits of entropy)
 */
export function generateXsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Validates if the provided token matches the expected token.
 * Uses a constant-time comparison to prevent timing attacks.
 * 
 * @param providedToken - The token from the request header
 * @param expectedToken - The token from the session/cookie
 * @returns boolean
 */
export function validateXsrfToken(providedToken: string, expectedToken: string): boolean {
  if (!providedToken || !expectedToken) return false;
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedToken),
      Buffer.from(expectedToken)
    );
  } catch (err) {
    return false;
  }
}

