/* Brevklar Service Worker — cache-first for static assets, network-first for API */

const CACHE = 'bk-v1';
const STATIC = [
  '/', '/scan', '/calendar',
  '/styles.css', '/scan.css',
  '/i18n.js', '/agencies.js', '/app.js', '/scan.js', '/calendar.js',
  '/help-menu.js', '/pwa.js', '/notifications.js', '/onboarding.js',
  '/manifest.json', '/icon-192.svg', '/icon-512.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(STATIC))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Always network for API and auth routes
  if (url.pathname.startsWith('/demo/') || url.pathname.startsWith('/documents') || url.pathname.startsWith('/auth')) {
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return response;
      });
    }).catch(() => {
      if (request.mode === 'navigate') return caches.match('/');
    }),
  );
});
