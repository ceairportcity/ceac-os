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


/* CEAC background notifications reuse this existing service worker.
 * Never trust a URL supplied in a push payload: open the authenticated Updates
 * screen and let CEAC resolve record access after the user signs in.
 */
const pushNotificationId = (value) => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const pushText = (value, limit) => typeof value === "string"
  ? value.replace(/[\\u0000-\\u001f\\u007f]/g, " ").trim().slice(0, limit) : "";

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  if (!pushNotificationId(payload?.notificationId)) return;
  // This content has already been privacy-filtered by the authorised server.
  const title = pushText(payload.title, 100) || "CEAC";
  const body = pushText(payload.body, 180) || "A new update is ready in CEAC.";
  event.waitUntil(self.registration.showNotification(title, {
    body, tag: "ceac-" + payload.notificationId,
    icon: "/ceac-icon-192.png", badge: "/ceac-icon-192.png",
    data: { notificationId: payload.notificationId },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (!pushNotificationId(event.notification?.data?.notificationId)) return;
  const destination = new URL("/?tab=messages&updates=1", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const active = windows.find(client => {
      try { return new URL(client.url).origin === self.location.origin; } catch { return false; }
    });
    if (active) {
      await active.navigate(destination);
      await active.focus();
    } else {
      await self.clients.openWindow(destination);
    }
  })());
});
