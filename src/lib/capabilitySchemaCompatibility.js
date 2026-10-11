// When a pre-S3 database has not received the expiry migration, a new
// preview cannot safely infer delegated capability expiry from old grant rows.
// Let the person's ordinary profile load while failing CLOSED on client-side
// capability-driven features. Server-side RLS and RPC checks remain authoritative.
export function isMissingCapabilityExpiryColumn(error) {
  if (!error || error.code !== "42703") return false;
  const message = String(error.message || "");
  return /\bcapability_grants\.expires_at\b/i.test(message)
    && /\bdoes not exist\b/i.test(message);
}

export function resolveCapabilityGrantRead({ data, error }) {
  if (!error) return { grants: data || [], capabilitySchemaReady: true, error: null };
  if (isMissingCapabilityExpiryColumn(error)) {
    return { grants: [], capabilitySchemaReady: false, error: null };
  }
  return { grants: [], capabilitySchemaReady: false, error };
}


/**
 * Pre-S3 compatibility only: consult the CURRENT database's signed-in-user
 * authority function to avoid blindly treating unversioned grants as active.
 * This never creates/extends/changes a grant and never overrides server RLS.
 * The server must approve every returned capability and requested unit scope.
 * Any read or RPC error leaves ALL delegated capabilities disabled.
 */
export async function readServerVerifiedLegacyGrants(supabase, profileId, orgId) {
  if (!profileId || !orgId) return { grants: [], verificationComplete: false };
  const { data, error } = await supabase.from("capability_grants")
    .select("id,capability,scope_unit_id,granted_at")
    .eq("profile_id", profileId)
    .eq("org_id", orgId)
    .is("revoked_at", null);
  if (error) return { grants: [], verificationComplete: false };

  const candidates = Array.isArray(data) ? data : [];
  if (!candidates.length) return { grants: [], verificationComplete: true };
  const results = await Promise.all(candidates.map(async (grant) => {
    try {
      const { data: allowed, error: failure } = await supabase.rpc("app_has_capability", {
        p_capability: grant.capability,
        p_unit_id: grant.scope_unit_id || null,
      });
      return failure ? { grant: null, checkFailed: true }
        : { grant: allowed === true ? grant : null, checkFailed: false };
    } catch {
      return { grant: null, checkFailed: true };
    }
  }));
  // A partial check result cannot establish a complete capability picture:
  // deny all grants rather than silently accepting the successful subset.
  if (results.some((result) => result.checkFailed)) {
    return { grants: [], verificationComplete: false };
  }
  return {
    grants: results.map((result) => result.grant).filter(Boolean),
    verificationComplete: true,
  };
}
