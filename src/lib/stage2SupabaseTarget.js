/**
 * Stage 2 deployment isolation guard — accident prevention, not an Auth/RLS
 * authority. Production access is always decided by the provider and server.
 * The Stage 1 email/password application deliberately retains its existing
 * fallback and remains unaffected when the Stage 2 cutover flag is OFF.
 */
export function assertStage2SupabaseTarget({
  enabled = false, configuredUrl, configuredKey, stage1Url,
} = {}) {
  if (!enabled) return;
  if (typeof configuredUrl !== "string" || !configuredUrl.trim()
    || typeof configuredKey !== "string" || !configuredKey.trim()) {
    throw new Error("Stage 2 requires an explicit isolated Supabase URL and publishable key; Stage 1 production fallback is prohibited.");
  }

  let target, stage1;
  try {
    target = new URL(configuredUrl.trim());
    stage1 = new URL(stage1Url);
  } catch {
    throw new Error("Stage 2 Supabase target URL is invalid; deployment is blocked.");
  }
  if (target.hostname === stage1.hostname) {
    throw new Error("Stage 2 cannot connect to the original Stage 1 Supabase project before an authorised migration/cutover.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
  if ((!local && (target.protocol !== "https:" || !target.hostname.endsWith(".supabase.co")))
      || (local && target.protocol !== "http:")
      || target.username || target.password || target.search || target.hash
      || (target.pathname !== "/" && target.pathname !== "")) {
    throw new Error("Stage 2 needs an explicitly configured, isolated local Supabase or HTTPS Supabase project endpoint.");
  }
}
