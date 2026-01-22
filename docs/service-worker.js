const CACHE_NAME = "aljiz-v1";

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

  // calculators entry points (adjust if filenames differ)
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

// Network-first for HTML, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const accept = req.headers.get("accept") || "";
  const isHTML = accept.includes("text/html");

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok) {
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
