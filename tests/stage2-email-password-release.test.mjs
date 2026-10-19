import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Current Stage 2 launch contract: keep the invitation-controlled password
// provider. Google and universal authenticator MFA are a SEPARATE later release.
const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const app = read("../src/App.jsx");
const login = read("../src/screens/SignIn.jsx");
const client = read("../src/lib/supabase.js");
const privileged = read("../src/components/PrivilegedMfaGate.jsx");
const historicalGoogle = read("../supabase/migrations/20261012172718_google_oauth_aal2_enforcement.sql");
const universal = read("../supabase/migrations/20261016170000_150_universal_totp_all_roles_stage2.sql");
const reconcile = read("../supabase/migrations/20261017010000_156_stage2_provider_neutral_auth_storage_reconciliation.sql");

test("Stage 2 release signs in with an existing CEAC email and password, not Google OAuth", () => {
  assert.match(login, /supabase\.auth\.signInWithPassword\(/);
  assert.match(login, /supabase\.auth\.resetPasswordForEmail\(/);
  assert.doesNotMatch(login, /signInWithOAuth|signInWithIdToken/);
  assert.match(app, /authPath === "\/activate"/);
  assert.match(app, /authPath === "\/reset-password"/);
});

test("Stage 2 universal MFA remains opt-in and off when the future cutover flag is unset", () => {
  assert.match(app, /const UNIVERSAL_TOTP_CUTOVER = import\.meta\.env\.VITE_STAGE2_UNIVERSAL_AAL2 === "true"/);
  assert.match(app, /const ActiveMfaGate = import\.meta\.env\.VITE_STAGE2_UNIVERSAL_AAL2 === "true"\s*\? Stage2UniversalMfaGate : PrivilegedMfaGate/);
  assert.match(privileged, /privileged_mfa_required/);
  assert.match(client, /enabled: import\.meta\.env\.VITE_STAGE2_UNIVERSAL_AAL2 === "true"/);
  assert.match(client, /persistSession: true, autoRefreshToken: true/);
});

test("future universal MFA migration is installed default-OFF and does not toggle organisations on", () => {
  assert.match(universal, /ADD COLUMN IF NOT EXISTS universal_totp_required boolean NOT NULL DEFAULT false/i);
  assert.doesNotMatch(universal, /SET universal_totp_required\s*=\s*true/i);
  assert.match(universal, /RESTRICTIVE FOR ALL TO authenticated/);
});

test("historical Google-only DB request hook is retired by the forward-only reconciliation", () => {
  assert.match(historicalGoogle, /ALTER ROLE authenticator SET pgrst\.db_pre_request/i);
  assert.match(reconcile, /ALTER ROLE authenticator RESET pgrst\.db_pre_request/i);
  assert.match(reconcile, /hook_count > 1/);
  assert.match(reconcile, /An unknown PostgREST pre-request hook is configured/);
  for (const policy of [
    "CEAC Google AAL2 read objects", "CEAC Google AAL2 insert objects",
    "CEAC Google AAL2 update objects", "CEAC Google AAL2 delete objects",
    "CEAC Google AAL2 read buckets",
  ]) assert.ok(reconcile.includes(`DROP POLICY IF EXISTS "${policy}"`), policy);
  assert.match(reconcile, /stage2_universal_totp_storage_gate/);
  assert.match(reconcile, /CREATE POLICY stage2_universal_totp_bucket_gate/);
});

test("disabled MFA does not bypass existing identity, role or tenant checks", () => {
  assert.match(client, /supabase\.auth\.getUser\(\)/);
  assert.match(client, /\.eq\("id", auth\.user\.id\)\.single\(\)/);
  assert.match(client, /if \(!p\.active\)/);
  assert.match(client, /readServerVerifiedLegacyGrants/);
  assert.match(client, /activeCapabilityGrants/);
  assert.match(reconcile, /WHERE p\.id=auth\.uid\(\)/);
  assert.match(reconcile, /p\.active/);
});
