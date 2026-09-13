'use strict';
const CACHE = 'oly-revision6-v2';
const ASSETS = [
  './index.html',
  './styles.css',
  './manifest.json',
  './icon.svg',
  './js/program.js',
  './js/model.js',
  './js/app.js',
  './js/sync.js',
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('oly-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request,
    url = new URL(req.url),
    scope = new URL(self.registration.scope);
  if (
    req.method !== 'GET' ||
    url.origin !== scope.origin ||
    !url.pathname.startsWith(scope.pathname)
  )
    return;
  event.respondWith(
    fetch(req)
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(req, response.clone());
        }
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE),
          hit = await cache.match(req);
        if (hit) return hit;
        if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
        return Response.error();
      }),
  );
});
