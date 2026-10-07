export function isPrivilegedIdentity(me) {
  return Boolean(
    me?.is_admin
    || me?.is_exec
    || (Array.isArray(me?.capability_grants) && me.capability_grants.length > 0)
  );
}

export function requiresMfaChallenge(assurance) {
  return Boolean(
    assurance?.currentLevel !== "aal2"
    && assurance?.nextLevel === "aal2"
  );
}

export function resolveMfaGate({ assurance, me, privilegedMfaEnforced = false }) {
  if (requiresMfaChallenge(assurance)) return "challenge";

  if (
    privilegedMfaEnforced
    && isPrivilegedIdentity(me)
    && !(
      assurance?.currentLevel === "aal2"
      && assurance?.nextLevel === "aal2"
    )
  ) {
    return "blocked";
  }

  return "allow";
}
