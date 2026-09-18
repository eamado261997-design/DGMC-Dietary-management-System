/**
 * Returns the base URL for API requests.
 * Uses VITE_API_BASE_URL if configured, otherwise returns empty string
 * so requests naturally target relative paths (/api/...) on the same origin.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const customBase = (import.meta as any).env?.VITE_API_BASE_URL;
    if (customBase) {
      const trimmed = customBase.replace(/\/$/, '');
      try {
        const parsed = new URL(trimmed, window.location.href);
        // If the configured base targets localhost, 127.0.0.1, or the same host,
        // use relative path so requests automatically match the window protocol and port (:3000)
        if (
          parsed.hostname === 'localhost' || 
          parsed.hostname === '127.0.0.1' || 
          parsed.hostname === window.location.hostname
        ) {
          return '';
        }
        return trimmed;
      } catch {
        return '';
      }
    }
    // Return empty string to allow browser relative path resolution (/api/...)
    // This works seamlessly across local dev (Vite), PM2 cluster behind Nginx, and cloud preview environments.
    return '';
  }
  return '';
}
