/* CEAC security-first service worker. Business/API data is never cached. */
const VERSION = "ceac-shell-v2-iphone";
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
  ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit) : "";

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  if (!pushNotificationId(payload?.notificationId)) return;
  // This content has already been privacy-filtered by the authorised server.
  const title = pushText(payload.notification?.title || payload.title, 100) || "CEAC";
  const body = pushText(payload.notification?.body || payload.body, 180) || "A new update is ready in CEAC.";
  event.waitUntil(Promise.all([self.clients.matchAll({type:"window"}).then(windows=>{
    for(const client of windows)client.postMessage?.({type:"CEAC_PUSH_RECEIVED"});
  }),self.registration.showNotification(title, {
    body, tag: pushText(payload.tag,180) || "ceac-" + payload.notificationId,
    icon: "/ceac-icon-192.png", badge: "/ceac-icon-192.png",
    data: { notificationId: payload.notificationId, path: payload.path },
  }), Number.isInteger(payload.unreadCount) && self.navigator && "setAppBadge" in self.navigator ? (payload.unreadCount > 0 ? self.navigator.setAppBadge(payload.unreadCount) : self.navigator.clearAppBadge()).catch(()=>{}) : Promise.resolve()]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (!pushNotificationId(event.notification?.data?.notificationId)) return;
  const destination = safePushDestination(event.notification.data.path);
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

// Only locally recognised, same-origin destinations are accepted. Source records
// are checked again by the signed-in application's RLS before displaying content.
function safePushDestination(path) {
 const fallback=new URL("/?tab=messages&updates=1",self.location.origin).href;
 try {
  if(typeof path!=="string" || !path.startsWith("/?"))return fallback;
  const url=new URL(path,self.location.origin);
  const tab=url.searchParams.get("tab");
  const allowed={messages:["memo","room","updates"],work:["item","routineDate"],home:["meeting"],me:["reminder"],"personal-calendar":["date","event"],attendance:["leave"]};
  if(!allowed[tab] || url.origin!==self.location.origin)return fallback;
  for(const [key,value] of url.searchParams){
   if(key==="tab")continue;
   if(!allowed[tab].includes(key))return fallback;
   if(["date","routineDate"].includes(key) ? !/^\d{4}-\d{2}-\d{2}$/.test(value) : key==="updates" ? value!=="1" : !pushNotificationId(value))return fallback;
  }
  return url.href;
 }catch{return fallback;}
}
