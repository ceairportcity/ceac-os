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
// Bound even the discard path: never buffer or consume an arbitrarily large
// unauthenticated request simply to satisfy an Edge gateway.
export const MAX_INTEGRATION_DRAIN_BYTES = 64 * 1024;

async function discardSmallDeclaredOversize(body) {
  if (!body) return;
  const reader = body.getReader();
  let discarded = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      discarded += value.byteLength;
      if (discarded > MAX_INTEGRATION_DRAIN_BYTES) break;
    }
  } catch {
    // The request is invalid regardless of a broken or disconnected stream.
  } finally {
    reader.releaseLock();
  }
}

export async function readBoundedActionBody(request) {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > MAX_INTEGRATION_BODY_BYTES) {
    // Local Supabase Edge gateways can hold a response open until the request
    // body reaches EOF. On modest, explicitly size-declared oversized JSON,
    // discard a bounded number of bytes (never accumulating/parsing data) so
    // the invalid request receives its intended 400 rather than a 150s 504.
    // Huge/unbounded streams still reject immediately without an unsafe drain.
    if (Number(declared) <= MAX_INTEGRATION_DRAIN_BYTES) {
      await discardSmallDeclaredOversize(request.body);
    }
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
