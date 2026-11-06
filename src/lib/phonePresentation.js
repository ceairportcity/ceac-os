/* Physical handsets must never inherit a desktop workspace when WebKit
 * restores a standalone PWA using its legacy wide layout viewport.
 * See WebKit bug 262207 (reported active in 2026). */
const validWidth = value => Number.isFinite(value) && value >= 240 && value <= 5000;

export function phonePresentationMetrics(environment) {
  const screen = environment.screen || {};
  const navigator = environment.navigator || {};
  const screenWidth = Number(screen.width);
  const screenHeight = Number(screen.height);
  const shortSide = Math.min(screenWidth, screenHeight);
  const agent = String(navigator.userAgent || "");
  const knownPhone = /iPhone|iPod|Android.+Mobile/i.test(agent);
  const touch = Number(navigator.maxTouchPoints || 0) > 0;
  const physicalPhone = knownPhone || (touch && validWidth(shortSide) && shortSide <= 600);
  const widths = [screenWidth, Number(environment.innerWidth), Number(environment.visualViewport?.width)]
    .filter(validWidth);
  return {
    phone: physicalPhone,
    width: physicalPhone && widths.length ? Math.round(Math.min(...widths)) : null,
  };
}

export function needsPhoneViewportRepair(environment, metrics = phonePresentationMetrics(environment)) {
  if (!metrics.phone || !metrics.width) return false;
  const layoutWidth = Number(environment.innerWidth);
  const screenWidth = Number(environment.screen?.width);
  if (!validWidth(layoutWidth)) return false;
  // A wide layout on a physically narrow screen is the WebKit PWA resume bug.
  // Do not treat pinch zoom (which changes visualViewport.width) as a bug.
  return validWidth(screenWidth) && layoutWidth > screenWidth + 80;
}

export function installPhonePresentation(environment = window) {
  const root = environment.document.documentElement;
  let repairing = false;
  let attempts = 0;
  const sync = () => {
    const metrics = phonePresentationMetrics(environment);
    root.classList.toggle("ceac-physical-phone", metrics.phone);
    if (metrics.phone && metrics.width != null)
      root.style.setProperty("--ceac-phone-visible-width", `${metrics.width}px`);
    else root.style.removeProperty("--ceac-phone-visible-width");

    if (!needsPhoneViewportRepair(environment, metrics)) {
      if (!repairing) attempts = 0;
      return;
    }
    if (repairing || attempts >= 2) return;
    const viewport = environment.document.querySelector('meta[name="viewport"]');
    if (!viewport) return;
    attempts++;
    repairing = true;
    const original = viewport.getAttribute("content") || "width=device-width, initial-scale=1, viewport-fit=cover";
    // Force WebKit to recalculate CSS media breakpoints rather than merely
    // shrinking the desktop layout. Restore safe-area behaviour immediately.
    viewport.setAttribute("content", `width=${Math.round(Number(environment.screen.width))}, initial-scale=1`);
    environment.setTimeout(() => {
      viewport.setAttribute("content", original);
      repairing = false;
      sync();
    }, 70);
  };
  sync();
  environment.addEventListener("resize", sync, {passive:true});
  environment.addEventListener("orientationchange", sync, {passive:true});
  environment.addEventListener("pageshow", sync);
  environment.document.addEventListener("visibilitychange", () => {
    if (!environment.document.hidden) sync();
  });
  environment.visualViewport?.addEventListener?.("resize", sync, {passive:true});
}
