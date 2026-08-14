import { MIN_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH_LIMITS } from "../constants/security.js";

export { MIN_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH_LIMITS };
export const DEFAULT_MIN_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH;

/**
 * Validates password complexity based on security standards:
 * - Minimum required characters (configurable via System Settings, defaults to MIN_PASSWORD_LENGTH)
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number (0-9)
 * - At least one symbol or special character (non-alphanumeric)
 *
 * @param password The raw password string to validate
 * @param minLength Minimum character length requirement (defaults to MIN_PASSWORD_LENGTH)
 * @returns An error message string if invalid, or null if the password meets all requirements
 */
export function validatePasswordComplexity(
  password: string,
  minLength: number = MIN_PASSWORD_LENGTH
): string | null {
  const reqLength = Math.max(1, minLength);
  if (password.length < reqLength) {
    return `Password must be at least ${reqLength} characters in length.`;
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter (mixed case).";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter (mixed case).";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return "Password must contain at least one symbol or special character (e.g., !@#$%^&*).";
  }
  return null;
}
