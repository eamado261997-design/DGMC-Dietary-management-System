const CACHE_NAME = 'dgmc-static-cache-v2';
const PRE_CACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/assets/dgmc_logo.png',
  '/assets/pwa_icon.jpg'
];

// Install Event: Pre-cache core offline assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of PRE_CACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch {
          // Skip optional pre-cache assets
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-first for assets & HTML, bypass for API
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

  // 3. Network-first with cache fallback for HTML navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('/');
        if (cached) return cached;
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
    );
    return;
  }

  // 4. For hashed static assets: Network with cache fallback
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone).catch(() => {});
        }).catch(() => {});
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response('/* Asset Offline */', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    })
  );
});
