/**
 * Narrow P2 Edge-only tip-comparison exemption for interim CI.
 * Source/build, Account Security, SQL/RLS and real local Auth/TOTP/Edge still
 * run. Explicit full Level B/P8 remains mandatory for final acceptance.
 */
const EDGE_SOURCES = new Set([
  "supabase/functions/integration-runtime/index.ts",
  "supabase/functions/integration-runtime/mfa.mjs",
]);
const ALLOWED = new Set([...EDGE_SOURCES, "tests/integration-runtime.test.mjs"]);
export function isIsolatedP2EdgeChange({ eventName, subject, tipFiles }) {
  return eventName === "pull_request"
    && /\[(?:p2-edge|p2-security)\]/i.test(subject || "")
    && !/\[level-b\]/i.test(subject || "")
    && Array.isArray(tipFiles)
    && tipFiles.length > 0
    && tipFiles.every((file) => ALLOWED.has(file))
    && tipFiles.some((file) => EDGE_SOURCES.has(file));
}
