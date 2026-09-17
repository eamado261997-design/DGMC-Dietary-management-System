/**
 * Returns the base URL for API requests.
 * Uses VITE_API_BASE_URL if configured, otherwise returns empty string
 * so requests naturally target relative paths (/api/...) on the same origin.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const customBase = (import.meta as any).env?.VITE_API_BASE_URL;
    if (customBase) {
      return customBase.replace(/\/$/, '');
    }
    // Return empty string to allow browser relative path resolution (/api/...)
    // This works seamlessly across local dev (Vite), PM2 cluster behind Nginx, and cloud preview environments.
    return '';
  }
  return '';
}
