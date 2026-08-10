/**
 * Validates password complexity based on security standards:
 * - Minimum 12 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number (0-9)
 * - At least one symbol or special character (non-alphanumeric)
 *
 * @param password The raw password string to validate
 * @returns An error message string if invalid, or null if the password meets all requirements
 */
export function validatePasswordComplexity(password: string): string | null {
  if (password.length < 12) {
    return "Password must be at least 12 characters in length.";
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
