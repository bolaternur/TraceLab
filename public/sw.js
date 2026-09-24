/* TraceLab service worker: app-shell caching for offline capture. Never caches private media or API responses. */
const CACHE = "trace-shell-v1";
const SHELL = ["/app/capture", "/offline", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache API / private media
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.open(CACHE).then(async (c) => (await c.match(req)) || fetch(req).then((r) => (c.put(req, r.clone()), r))));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((r) => {
          if (url.pathname === "/app/capture") caches.open(CACHE).then((c) => c.put(req, r.clone()));
          return r;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/app/capture")) || (await caches.match("/offline")) || Response.error()),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "sync-outbox") self.clients.matchAll().then((cs) => cs.forEach((c) => c.postMessage("sync-outbox")));
});
