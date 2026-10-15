const UPDATE_EVENT = "ceac:pwa-update-ready";

export function registerCeacServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  async function register() {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

      function announceWaitingWorker() {
        if (!registration.waiting) return;
        window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { registration } }));
      }

      announceWaitingWorker();
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) announceWaitingWorker();
        });
      });

      window.addEventListener("online", () => registration.update().catch(() => {}));
    } catch (error) {
      console.warn("CEAC app installation support could not start.", error);
    }
  }

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

export const CEAC_PWA_UPDATE_EVENT = UPDATE_EVENT;
