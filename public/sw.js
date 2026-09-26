/* TraceLab service worker: public offline fallback + immutable build assets only. */
const CACHE = "trace-public-v2";
const SHELL = ["/offline", "/manifest.webmanifest"];

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
  // Authenticated pages, auth flows and APIs may contain user/team data and are never cached.
  if (url.pathname.startsWith("/app") || url.pathname.startsWith("/auth") || url.pathname.startsWith("/join") || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.open(CACHE).then(async (c) => (await c.match(req)) || fetch(req).then((r) => (c.put(req, r.clone()), r))));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .catch(async () => (await caches.match("/offline")) || Response.error()),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "sync-outbox") self.clients.matchAll().then((cs) => cs.forEach((c) => c.postMessage("sync-outbox")));
  if (event.data === "clear-private-data") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    );
  }
});
