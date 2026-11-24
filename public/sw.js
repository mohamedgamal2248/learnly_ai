/* Learnly AI service worker: fast repeat visits, lessons you opened stay available offline. */
const VERSION = "ln-v3";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const DATA = `${VERSION}-data`;
const OFFLINE_API = /^\/api\/en\/(lesson|catalog)$/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(["/", "/learn", "/icon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Lessons and the lesson list: network first; when offline, the last copy that was opened (only successful, per-user, on this device).
  if (OFFLINE_API.test(url.pathname)) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(DATA).then((c) => c.put(req, copy)); }
      return res;
    }).catch(async () => (await caches.match(req)) || Response.error()));
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  // Hashed build files, icons and the pre-made English audio never change: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/audio/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.open(STATIC).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Pages: network first, cached copy when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(req, copy)); }
      return res;
    }).catch(async () => (await caches.match(req)) || (await caches.match("/")) || Response.error()));
  }
});

// Never keep one person's lessons for the next person on the same phone.
self.addEventListener("message", (e) => { if (e.data === "clear-data") caches.delete(DATA); });
