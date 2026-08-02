// ShareRide Service Worker
// ⚠️ Bump CACHE_VERSION on EVERY deploy. This is what forces installed
// PWAs (and Chrome tabs) to pick up your new HTML/JS instead of serving
// a stale cached copy — this was the root cause of "works in Chrome /
// Incognito but the installed app shows an old or broken version".
const CACHE_VERSION = 'v1.0.1';
const CACHE_NAME = `shareride-${CACHE_VERSION}`;

// Only the app shell is cached. Supabase API calls are NEVER cached
// (handled below by the origin check), so data is always fresh.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // don't fail install if an optional asset (e.g. logo.png) is missing
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin (Supabase, fonts CDN, Tailwind CDN, unpkg) always goes
  // straight to the network — never intercepted or cached here.
  if (url.origin !== self.location.origin) return;

  // Network-first for the HTML shell: always try to fetch the latest
  // index.html first so a new deploy is visible immediately. Falls back
  // to cache only when offline.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets (manifest, icons) with a network
  // fallback that refreshes the cache in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// Lets the page force this worker to activate immediately after a new
// version has been installed (see registerServiceWorker() in index.html).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

