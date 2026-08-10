import crypto from "crypto";

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
