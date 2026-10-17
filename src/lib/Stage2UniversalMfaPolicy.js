/**
 * Stage 2 provider-neutral, all-role TOTP/AAL2 policy.
 * Pure decision function. Production/Auth/DB enforcement remains separately
 * gated: frontend assurance alone is NOT an authorisation boundary.
 *
 * Supabase JWT fields: aal and amr[].method (including 'totp').
 * Claims MUST come from a verified token, not user-editable metadata.
 */
export function decideUniversalTotpAccess({ session, assurance, factors, claims } = {}) {
  if (!session?.user?.id) return { state: "signed_out", reason: "session_required" };
  if (!claims || claims.sub !== session.user.id || claims.role !== "authenticated") {
    return { state: "denied", reason: "verified_identity_mismatch" };
  }
  const totp = Array.isArray(factors?.totp)
    ? factors.totp.find((factor) => factor?.status === "verified" && factor.factor_type === "totp")
    : null;
  if (!totp) return { state: "enroll", reason: "verified_totp_required" };

  const methods = Array.isArray(claims.amr) ? claims.amr : [];
  const usedTotp = methods.some((entry) => entry && entry.method === "totp");
  if (assurance?.currentLevel === "aal2" && claims.aal === "aal2" && usedTotp) {
    return { state: "allow", reason: "verified_totp_aal2", factor: null };
  }
  return { state: "challenge", reason: "fresh_totp_challenge_required", factor: totp };
}

/**
 * A new login/device requires TOTP. A verified AAL2 session may continue
 * normally through token refresh; a password-recovery session is a new
 * Auth context that MUST be rechecked before any protected workspace renders.
 * No client-side "skip MFA" clock exists.
 */
export function shouldRecheckUniversalTotp(authEvent) {
  return ["SIGNED_IN", "SIGNED_OUT", "MFA_CHALLENGE_VERIFIED", "USER_UPDATED", "TOKEN_REFRESHED", "PASSWORD_RECOVERY"]
    .includes(authEvent);
}
