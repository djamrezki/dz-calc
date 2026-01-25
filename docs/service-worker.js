const CACHE_NAME = "aljiz-v2"; // bump version so users get the new SW

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/assets/maskable-512.png",
  "/assets/apple-touch-icon-180.png",
  "/assets/cookies.css",
  "/assets/cookies.js",
  "/salaire-net-algerie/styles.css",
  "/salaire-net-algerie/app.js",
  "/visa-france-cout/styles.css",
  "/visa-france-cout/app.js",
  "/calcul-zakat-dzd/styles.css",
  "/calcul-zakat-dzd/app.js",
  "/salaire-net-algerie/",
  "/visa-france-cout/",
  "/calcul-zakat-dzd/"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

function isAnalyticsHost(hostname) {
  return (
    hostname === "www.google-analytics.com" ||
    hostname === "google-analytics.com" ||
    hostname.endsWith(".google-analytics.com") ||
    hostname === "www.googletagmanager.com" ||
    hostname === "googletagmanager.com" ||
    hostname.endsWith(".googletagmanager.com") ||
    hostname.endsWith(".doubleclick.net") ||
    hostname === "region1.google-analytics.com"
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Never touch analytics/tag requests (GET/POST/anything)
  if (isAnalyticsHost(url.hostname)) {
    return; // let the browser handle it normally
  }

  // 2) Don't handle non-GET (keeps SW from interfering with POSTs)
  if (req.method !== "GET") return;

  // 3) Only cache same-origin requests (avoid caching third-party assets)
  if (url.origin !== self.location.origin) {
    return;
  }

  const accept = req.headers.get("accept") || "";
  const isHTML = accept.includes("text/html");

  // Network-first for HTML
  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only cache successful basic (same-origin) responses
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Cache-first for static
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      if (cached) {
        event.waitUntil(fetchPromise);
        return cached;
      }

      return fetchPromise;
    })
  );
});
