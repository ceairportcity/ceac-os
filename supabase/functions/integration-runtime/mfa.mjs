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
