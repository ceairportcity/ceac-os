/* The physical phone, rather than Safari's effective layout viewport, owns
 * the CEAC handset presentation. A Home Screen app can restore with a stale or
 * desktop-sized viewport after zoom, multitasking and app updates. */
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

export function installPhonePresentation(environment = window) {
  const root = environment.document.documentElement;
  const sync = () => {
    const {phone, width} = phonePresentationMetrics(environment);
    root.classList.toggle("ceac-physical-phone", phone);
    if (phone && width != null) root.style.setProperty("--ceac-phone-visible-width", `${width}px`);
    else root.style.removeProperty("--ceac-phone-visible-width");
  };
  sync();
  environment.addEventListener("resize", sync, {passive: true});
  environment.addEventListener("orientationchange", sync, {passive: true});
  environment.addEventListener("pageshow", sync);
  environment.visualViewport?.addEventListener?.("resize", sync, {passive: true});
}
