// Signed, provider-verified JWT claims gate for privileged Edge actions.
// This is defence in depth, not a substitute for server-side verified-factor
// existence, active profiles, tenant RLS and capability checks.
export function hasVerifiedTotpAal2(claims, expectedUserId) {
  return typeof expectedUserId === "string" && expectedUserId.length > 0
    && claims?.sub === expectedUserId
    && claims?.role === "authenticated"
    && claims?.aal === "aal2"
    && Array.isArray(claims.amr)
    && claims.amr.some((entry) => entry?.method === "totp");
}

/**
 * Shared Edge entry guard: cap incoming POST JSON before invoking user Auth,
 * worker credential checks or any privileged provider RPC. Accept only JSON
 * objects. No unbounded req.json() or reliance on a truthful Content-Length.
 * NULL means invalid or oversized; {} means empty valid payload.
 */
export const MAX_INTEGRATION_BODY_BYTES = 32 * 1024;

export async function readBoundedActionBody(request) {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > MAX_INTEGRATION_BODY_BYTES) {
    return null;
  }
  if (!request.body) return {};
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let raw = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_INTEGRATION_BODY_BYTES) {
        // Reject immediately without cancelling the request stream. In the
        // local Edge HTTP gateway, a cancelled request body may prevent a
        // response from being sent, causing a 150s upstream 504 instead of
        // the application's intended 400. Never read more than the fixed cap.
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
