export function verifiedMfaFactors(data = {}) {
  const groups = ["totp", "phone", "webauthn"];
  return groups.flatMap((kind) =>
    (Array.isArray(data?.[kind]) ? data[kind] : [])
      .filter((factor) => factor?.status === "verified")
      .map((factor) => ({ ...factor, factor_type: factor.factor_type || kind }))
  );
}

export function decideMfaAccess({
  currentLevel,
  nextLevel,
  currentAuthenticationMethods = [],
  factors,
  privileged = false,
  enforcementEnabled = false,
} = {}) {
  const verified = verifiedMfaFactors(factors);
  const totp = verified.find((factor) => factor.factor_type === "totp");
  const sessionUsedTotp = (Array.isArray(currentAuthenticationMethods) ? currentAuthenticationMethods : [])
    .some((entry) => entry === "totp" || entry?.method === "totp");

  if (privileged && enforcementEnabled) {
    if (!totp) {
      if (verified.length > 0) {
        return { state: "unsupported-factor", reason: "privileged_totp_required", factor: verified[0] || null };
      }
      return { state: "enroll", reason: "privileged_mfa_required", factor: null };
    }

    if (currentLevel === "aal2" && sessionUsedTotp) {
      return { state: "allow", reason: "session_totp_aal2", factor: totp };
    }

    return {
      state: "challenge",
      reason: currentLevel === "aal2"
        ? "privileged_totp_session_required"
        : "privileged_factor_requires_step_up",
      factor: totp,
    };
  }

  if (currentLevel === "aal2") {
    return { state: "allow", reason: "session_already_aal2", factor: null };
  }

  if (nextLevel === "aal2" || verified.length > 0) {
    if (totp) {
      return { state: "challenge", reason: "verified_factor_requires_step_up", factor: totp };
    }
    return { state: "unsupported-factor", reason: "verified_factor_requires_step_up", factor: verified[0] || null };
  }

  return { state: "allow", reason: "mfa_not_required", factor: null };
}

export function isPrivilegedIdentity(me) {
  if (!me) return false;
  if (me.is_admin || me.is_exec) return true;

  const memberships = Array.isArray(me.memberships) ? me.memberships : [];
  if (me.role === "manager" || me.role === "sub_team_lead") return true;
  if (memberships.some((membership) =>
    membership?.role === "manager" || membership?.role === "sub_team_lead"
  )) return true;

  if (Array.isArray(me.led_sub_team_ids) && me.led_sub_team_ids.length > 0) return true;

  return Array.isArray(me.capability_grants)
    && me.capability_grants.some((grant) => grant && !grant.revoked_at && grant.capability);
}
