const CACHE_NAME = 'dgmc-static-cache-v1';
const PRE_CACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/dgmc_logo.png',
  '/assets/pwa_icon.jpg'
];

// Install Event: Pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[Service Worker] Pre-caching core offline assets');
      for (const asset of PRE_CACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[Service Worker] Pre-cache skipped asset:', asset, err);
        }
      }
    }).then(() => self.skipWaiting())
      .catch((err) => console.warn('[Service Worker] Install error:', err))
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting obsolete cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Handle cache-first for static assets, network-only for APIs
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Exclude API requests from service worker caching
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Ignore non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 3. Stale-While-Revalidate strategy for static resources
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background to update cache
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse).catch(() => {});
            }).catch(() => {});
          }
        }).catch(() => {
          // Ignore offline errors on background sync
        });
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache).catch(() => {});
        }).catch(() => {});

        return networkResponse;
      }).catch(async (err) => {
        // Fallback for index.html when navigator is navigating offline
        if (event.request.mode === 'navigate') {
          const fallbackResponse = await caches.match('/');
          if (fallbackResponse) return fallbackResponse;
        }
        return new Response('Network unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' }),
        });
      });
    })
  );
});
