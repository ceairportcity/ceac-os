/* CEAC security-first service worker. Business/API data is never cached. */
const VERSION = "ceac-shell-v1";
const SHELL_CACHE = `${VERSION}-static`;
const DOCUMENT_CACHE = `${VERSION}-documents`;
const OFFLINE_URL = "/offline.html";
const INSTALL_FILES = [OFFLINE_URL, "/manifest.webmanifest", "/ceac-icon-192.png", "/ceac-icon-512.png", "/apple-touch-icon.png"];

function isSensitiveOrApi(url) {
  return url.hostname.endsWith(".supabase.co") ||
    url.hostname.includes("supabase") ||
    /^\/(auth|rest|realtime|storage|functions)\//.test(url.pathname) ||
    /\/api\//.test(url.pathname);
}

function isStaticAsset(request, url) {
  return url.origin === self.location.origin &&
    ["script", "style", "font", "image", "manifest"].includes(request.destination);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(INSTALL_FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, DOCUMENT_CACHE].includes(key)).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (isSensitiveOrApi(url) || url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(DOCUMENT_CACHE);
          await cache.put("/", response.clone());
        }
        return response;
      } catch {
        return (await caches.match("/")) || (await caches.match(OFFLINE_URL));
      }
    })());
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});
