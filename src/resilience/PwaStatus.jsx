import { useEffect, useState } from "react";
import { CEAC_PWA_UPDATE_EVENT } from "./registerServiceWorker";

const LAST_ONLINE_KEY = "ceac:last-online-at";

function readableTime(value) {
  if (!value) return "Not recorded";
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return "Not recorded";
  }
}

export default function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [lastOnline, setLastOnline] = useState(() => localStorage.getItem(LAST_ONLINE_KEY));
  const [waiting, setWaiting] = useState(null);

  useEffect(() => {
    function markOnline() {
      const now = new Date().toISOString();
      localStorage.setItem(LAST_ONLINE_KEY, now);
      setLastOnline(now);
      setOnline(true);
    }
    function markOffline() { setOnline(false); }
    function updateReady(event) { setWaiting(event.detail?.registration?.waiting || null); }

    if (navigator.onLine) markOnline();
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    window.addEventListener(CEAC_PWA_UPDATE_EVENT, updateReady);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
      window.removeEventListener(CEAC_PWA_UPDATE_EVENT, updateReady);
    };
  }, []);

  useEffect(() => {
    if (!waiting || !("serviceWorker" in navigator)) return undefined;
    let reloading = false;
    const reload = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reload);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", reload);
  }, [waiting]);

  if (!online) return <aside className="ceac-pwa-status is-offline" role="status" aria-live="polite">
    <div>
      <strong>Offline</strong>
      <span>The CEAC app shell is available. Live records and authorised actions need a secure connection.</span>
      <small>Last connected: {readableTime(lastOnline)}</small>
    </div>
  </aside>;

  if (waiting) return <aside className="ceac-pwa-status is-update" role="status" aria-live="polite">
    <div>
      <strong>CEAC update ready</strong>
      <span>Reload to use the latest accepted app version.</span>
    </div>
    <button type="button" onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}>Reload CEAC</button>
  </aside>;

  return null;
}
