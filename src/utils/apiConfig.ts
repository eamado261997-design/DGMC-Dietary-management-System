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

// In-flight Promise deduplication and memory cache to eliminate redundant network chaining
const inFlightRequests = new Map<string, Promise<any>>();
const shortCache = new Map<string, { data: any; exp: number }>();

/**
 * Deduplicated fetch for idempotent public data (public stats, system branding)
 */
export async function fetchDeduplicated<T = any>(endpoint: string, ttlMs: number = 15000): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const fullUrl = `${baseUrl}${endpoint}`;

  // Check short in-memory cache
  const cached = shortCache.get(fullUrl);
  if (cached && cached.exp > Date.now()) {
    return cached.data;
  }

  // Return existing in-flight promise if one is already pending
  if (inFlightRequests.has(fullUrl)) {
    return inFlightRequests.get(fullUrl)!;
  }

  // Consume early window pre-fetch if available from index.html <head>
  if (typeof window !== 'undefined') {
    if (endpoint === '/api/public-stats' && (window as any).__INITIAL_PUBLIC_STATS__) {
      const earlyPromise = (window as any).__INITIAL_PUBLIC_STATS__;
      (window as any).__INITIAL_PUBLIC_STATS__ = null;
      inFlightRequests.set(fullUrl, earlyPromise);
      return earlyPromise.then((data: any) => {
        if (data) shortCache.set(fullUrl, { data, exp: Date.now() + ttlMs });
        return data;
      }).finally(() => {
        inFlightRequests.delete(fullUrl);
      });
    }
  }

  const fetchPromise = fetch(fullUrl)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      shortCache.set(fullUrl, { data, exp: Date.now() + ttlMs });
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(fullUrl);
    });

  inFlightRequests.set(fullUrl, fetchPromise);
  return fetchPromise;
}

