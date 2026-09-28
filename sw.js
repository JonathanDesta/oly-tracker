const CACHE = "oly-groundup-v7-25-barbell-shrugs";
const FILES = [
  "./",
  "index.html",
  "styles.css",
  "icon.svg",
  "manifest.json",
  "src/app.js",
  "src/cloud-sync.js",
  "src/google-auth.js",
  "src/planner-feed.js",
  "src/planner-integration.js",
  "src/catalog.js",
  "src/calendar.js",
  "src/failure-policy.js",
  "src/dose.js",
  "src/duration.js",
  "src/timeline.js",
  "src/pacing.js",
  "src/timer-alerts.js",
  "src/load-progression.js",
  "src/push-alerts.js",
  "src/push-config.js",
  "src/routines.js",
  "src/prescription.js",
  "src/training.js",
  "src/review.js",
  "src/additions.js",
  "src/storage.js",
  "program/pages.json",
  "program/source.json",
  "program/revision-6.pdf",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(FILES.map((url) => new Request(url, { cache: "reload" }))),
      ),
  ),
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
    new URL(event.request.url).origin !== self.location.origin ||
    !new URL(event.request.url).pathname.startsWith(
      new URL("./", self.location.href).pathname,
    )
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

// Server-sent push wakes this worker even when no app window is open. Every
// received push produces a visible notification, as required by iOS.
self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Oly Tracker · timer finished", {
      body: "Your countdown has finished. Open Oly Tracker for the next step.",
      tag: "oly-timer",
      renotify: true,
      icon: new URL("icon.svg", self.registration.scope).href,
      data: { url: self.registration.scope },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find((window) =>
        window.url.startsWith(self.registration.scope),
      );
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: "TIMER_NOTIFICATION_OPENED" });
      } else await self.clients.openWindow(self.registration.scope);
    })(),
  );
});
