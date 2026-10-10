import { decideMfaAccess, isPrivilegedIdentity } from "./mfaPolicy";

export { isPrivilegedIdentity };

export function resolveMfaGate({
  assurance,
  factors,
  me,
  privilegedMfaEnforced = false,
} = {}) {
  return decideMfaAccess({
    currentLevel: assurance?.currentLevel,
    nextLevel: assurance?.nextLevel,
    currentAuthenticationMethods: assurance?.currentAuthenticationMethods,
    factors,
    privileged: isPrivilegedIdentity(me),
    enforcementEnabled: privilegedMfaEnforced,
  });
}
