// When a pre-S3 database has not received the expiry migration, a new
// preview cannot safely infer delegated capability expiry from old grant rows.
// Let the person's ordinary profile load while failing CLOSED on client-side
// capability-driven features. Server-side RLS and RPC checks remain authoritative.
export function isMissingCapabilityExpiryColumn(error) {
  if (!error || !["42703", "PGRST204"].includes(error.code)) return false;
  const message = String(error.message || "");
  return /capability_grants(?:\."?|"?)\.?"?expires_at"?/i.test(message)
    && /(?:does not exist|could not find|not found)/i.test(message);
}

export function resolveCapabilityGrantRead({ data, error }) {
  if (!error) return { grants: data || [], capabilitySchemaReady: true, error: null };
  if (isMissingCapabilityExpiryColumn(error)) {
    return { grants: [], capabilitySchemaReady: false, error: null };
  }
  return { grants: [], capabilitySchemaReady: false, error };
}
