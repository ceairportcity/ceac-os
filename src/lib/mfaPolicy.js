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
  factors,
  privileged = false,
  enforcementEnabled = false,
} = {}) {
  if (currentLevel === "aal2") {
    return { state: "allow", reason: "session_already_aal2", factor: null };
  }

  const verified = verifiedMfaFactors(factors);
  const totp = verified.find((factor) => factor.factor_type === "totp");

  if (nextLevel === "aal2" || verified.length > 0) {
    if (totp) {
      return { state: "challenge", reason: "verified_factor_requires_step_up", factor: totp };
    }
    return { state: "unsupported-factor", reason: "verified_factor_requires_step_up", factor: verified[0] || null };
  }

  if (privileged && enforcementEnabled) {
    return { state: "enroll", reason: "privileged_mfa_required", factor: null };
  }

  return { state: "allow", reason: "mfa_not_required", factor: null };
}

export function isPrivilegedIdentity(me) {
  if (!me) return false;
  if (me.is_admin || me.is_exec) return true;
  return Array.isArray(me.capability_grants)
    && me.capability_grants.some((grant) => grant && !grant.revoked_at && grant.capability);
}
