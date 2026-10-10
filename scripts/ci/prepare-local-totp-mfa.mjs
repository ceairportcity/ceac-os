// Local-only TOTP test fixture preparation. Never writes to hosted Supabase.
// This updates only the disposable Supabase CLI config *on the test host*.
// Restart the LOCAL Supabase stack afterward, preserving local test data.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, lstatSync } from "node:fs";
import { resolve } from "node:path";

assert.equal(process.env.SUPABASE_URL, "http://127.0.0.1:54321",
  "FAIL CLOSED: CEAC test-only local Supabase API URL required");
for (const name of ["DATABASE_URL", "SUPABASE_DB_URL", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID"]) {
  assert.ok(!process.env[name], `FAIL CLOSED: remote/unknown database credential ${name} present`);
}
const path = resolve(process.cwd(), "supabase/config.toml");
assert.ok(!lstatSync(path).isSymbolicLink(), "local config must not be a symlink");
let config = readFileSync(path, "utf8");
const header = "[auth.mfa.totp]";
assert.equal(config.split(header).length, 2, "exactly one local TOTP section is required");
const begin = config.indexOf(header) + header.length;
const end = config.indexOf("\n[", begin);
const original = config.slice(begin, end < 0 ? undefined : end);
for (const key of ["enroll_enabled", "verify_enabled"]) {
  const matcher = new RegExp(`^(${key}\\s*=\\s*)(true|false)\\s*$`, "gm");
  assert.equal([...original.matchAll(matcher)].length, 1, `one ${key} setting is required`);
}
const updated = original
  .replace(/^(enroll_enabled\s*=\s*)false\s*$/m, "$1true")
  .replace(/^(verify_enabled\s*=\s*)false\s*$/m, "$1true");
assert.match(updated, /^enroll_enabled\s*=\s*true\s*$/m);
assert.match(updated, /^verify_enabled\s*=\s*true\s*$/m);
config = config.slice(0, begin) + updated + (end < 0 ? "" : config.slice(end));
writeFileSync(path, config, { mode: 0o600 });
console.log("LOCAL_TOTP_CONFIGURATION_READY; restart disposable local Supabase, never production.");
