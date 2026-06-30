// Network-first service worker.
// Online: always fetch the latest (so pushed updates reach the device immediately),
// and refresh the cache. Offline: fall back to the last cached copy.
const CACHE = 'oly-tracker-v9';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon.svg',
  './js/program.js',
  './js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // Only handle same-origin GETs; let everything else pass through.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        // Cache a fresh copy for offline use.
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        // Offline: serve cache, falling back to the app shell for navigations.
        caches.match(req).then(hit => hit || caches.match('./index.html'))
      )
  );
});
