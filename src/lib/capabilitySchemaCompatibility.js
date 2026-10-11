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
