import { supabase } from "./supabase";

// Only a staff member's deliberate button press may request browser permission.
// Web Push is optional; in-app notices remain available without it.
let lastSubscriptionBearer = null; // RAM only; never store a JWT with device keys.
const endpoint = () => new URL("/functions/v1/ceac-web-push", supabase.supabaseUrl).href;
const toBytes = value => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));

export function pushSupport() {
  if (typeof window === "undefined" || !window.isSecureContext ||
      !("serviceWorker" in navigator) || !("PushManager" in window) ||
      !("Notification" in window)) return "unavailable";
  const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (appleMobile && !(navigator.standalone || window.matchMedia("(display-mode: standalone)").matches))
    return "install_required";
  return "supported";
}

async function pushRequest(action, method = "GET", body) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Please sign in again to manage device notifications.");
  const requestUrl = new URL(endpoint());
  requestUrl.searchParams.set("action", action);
  const response = await fetch(requestUrl, {
    method,
    headers: { Authorization: `Bearer ${data.session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  let result;
  try { result = await response.json(); } catch { result = {}; }
  if (!response.ok) throw new Error(result.message || "Device notifications are unavailable. Try again later.");
  if (action === "subscribe") lastSubscriptionBearer = data.session.access_token;
  if (action === "unsubscribe") lastSubscriptionBearer = null;
  return result;
}

export async function loadPushConfiguration() {
  if (pushSupport() !== "supported") return null;
  const registration = await navigator.serviceWorker.ready;
  const result = await pushRequest("config");
  if (!result.enabled || !/^[A-Za-z0-9_-]{80,120}$/.test(result.publicKey || "")) return null;
  const subscription = await registration.pushManager.getSubscription();
  const serverStatus = subscription ? await pushRequest("status", "POST",
    { endpoint: subscription.endpoint }) : { enabled:false, preview:false };
  return { publicKey: result.publicKey, registration,
    subscription: serverStatus.enabled ? subscription : null,
    preview: serverStatus.preview === true };
}

export async function enableDevicePush(config, showPreview = false) {
  if (!config?.registration || !config.publicKey) throw new Error("Device notifications are not ready.");
  // requestPermission stays in the direct user action path, never an effect.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Enable them in your device settings.");
  let current = await config.registration.pushManager.getSubscription();
  // A browser may still carry a subscription from an earlier signed-in
  // account or a rotated VAPID key. Never reuse an unverified binding.
  if (current) {
    const key = current.options?.applicationServerKey;
    const actual = key ? new Uint8Array(key) : null;
    const expected = toBytes(config.publicKey);
    const sameKey = actual?.length === expected.length &&
      actual.every((byte,index) => byte === expected[index]);
    if (!config.subscription || !sameKey) {
      await current.unsubscribe();
      current = null;
    }
  }
  let subscription = current;
  if (!subscription) {
    subscription = await config.registration.pushManager.subscribe({
      userVisibleOnly: true, applicationServerKey: toBytes(config.publicKey),
    });
  }
  try {
    await pushRequest("subscribe", "POST", { subscription: subscription.toJSON(), showPreview: showPreview === true });
  } catch (error) {
    // An unregistered fresh subscription must not stay attached to a previous
    // CEAC account by accident.
    if (!current) await subscription.unsubscribe().catch(() => {});
    throw error;
  }
  return subscription;
}

export async function disableDevicePush() {
  if (pushSupport() !== "supported") return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  // Revoke server-side before unsubscribing locally when a session exists.
  try { await pushRequest("unsubscribe", "POST", { endpoint: subscription.endpoint }); }
  finally { await subscription.unsubscribe().catch(() => {}); }
}

// Called on account changes: never keep a browser subscription active for the
// preceding signed-in staff member. Remote expiry also cleans stale endpoints.
export async function disconnectDevicePushOnSignOut(previousAccessToken = null) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) { lastSubscriptionBearer = null; return; }
  const token = previousAccessToken || lastSubscriptionBearer;
  lastSubscriptionBearer = null;
  if (token) {
    // Best-effort server revocation is independent from clearing this device.
    try { await fetch(endpoint() + "?action=unsubscribe", {
      method:"POST",headers:{Authorization:"Bearer " + token,"Content-Type":"application/json"},
      body:JSON.stringify({endpoint:subscription.endpoint}),cache:"no-store",
    }); } catch { /* Unsubscribed browser will retire on the next provider expiry. */ }
  }
  await subscription.unsubscribe().catch(() => {});
}
