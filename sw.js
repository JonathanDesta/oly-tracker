const CACHE = "oly-groundup-v7-12";
const FILES = [
  "./",
  "index.html",
  "styles.css",
  "icon.svg",
  "manifest.json",
  "src/app.js",
  "src/catalog.js",
  "src/duration.js",
  "src/timeline.js",
  "src/pacing.js",
  "src/routines.js",
  "src/prescription.js",
  "src/training.js",
  "src/review.js",
  "src/storage.js",
  "program/pages.json",
  "program/source.json",
  "program/revision-6.pdf",
];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES))),
);
// Do not force-activate over a running workout. New code activates on the next fresh visit.
self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE")
    event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("oly-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    caches
      .open(CACHE)
      .then(
        async (cache) =>
          (await cache.match(event.request, { ignoreSearch: true })) ||
          fetch(event.request),
      ),
  );
});
