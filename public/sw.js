const CACHE_NAME = 'dgmc-static-cache-v3';
const PRE_CACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/assets/dgmc-logo-U59A0q9C.png'
];

// Install Event: Pre-cache core offline assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of PRE_CACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch {
          // Skip optional pre-cache assets
        }
      }
    })
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
        return new Response('<!DOCTYPE html><html><head><meta charset="utf-8"><title>DGMC Offline</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>DGMC Hospital System</h2><p>Connecting to hospital network server...</p><button onclick="location.reload()" style="padding:10px 20px;font-size:16px;cursor:pointer;">Retry</button></body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
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
      return new Response('/* Asset Unavailable Offline */', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    })
  );
});
