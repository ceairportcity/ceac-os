import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const signIn = read("src/screens/SignIn.jsx");
const app = read("src/App.jsx");
const gate = read("src/components/MandatoryMfaGate.jsx");
const setup = read("src/components/AccountMfaSetup.jsx");
const migration = read("supabase/migrations/20261012172718_google_oauth_aal2_enforcement.sql");

test("interactive sign-in is Google OAuth only", () => {
  assert.match(signIn, /signInWithOAuth/);
  assert.match(signIn, /provider:\s*["']google["']/);
  assert.doesNotMatch(signIn, /signInWithPassword|signInWithOtp|resetPasswordForEmail/);
  assert.doesNotMatch(signIn, /type=["']password["']/);
});

test("new Auth users require Google plus a live CEAC invitation", () => {
  assert.match(migration, /create or replace function public\.ceac_before_user_created\(event jsonb\)/i);
  assert.match(migration, /candidate_provider <> 'google'/);
  assert.match(migration, /from public\.pending_invitations i/i);
  assert.match(migration, /i\.resolved_at is null/);
  assert.match(migration, /i\.revoked_at is null/);
  assert.match(migration, /i\.expires_at > now\(\)/);
  assert.match(migration, /grant execute on function public\.ceac_before_user_created\(jsonb\) to supabase_auth_admin/i);
  assert.match(migration, /revoke all on function public\.ceac_before_user_created\(jsonb\) from public, anon, authenticated/i);
});

test("signed-out visitors reach sign-in and every AAL2 session rechecks CEAC admission", () => {
  assert.match(app, new RegExp("<MandatoryMfaGate>\\s*<AuthenticatedApp\\s*/>\\s*</MandatoryMfaGate>", "s"));
  assert.doesNotMatch(app, /AccountPassword|\/activate|\/reset-password/);
  assert.match(gate, /useRef/);
  assert.match(gate, /refreshGeneration\.current/);
  assert.match(gate, /getSession/);
  assert.match(gate, /if \(!sessionData\?\.session\)/);
  assert.match(gate, /state === "signed-out" \|\| state === "allowed"/);
  assert.match(gate, /getAuthenticatorAssuranceLevel/);
  assert.match(gate, /rpc\("ceac_google_mfa_eligible"\)/);
  assert.match(gate, /if \(eligible !== true\)/);
  assert.match(gate, /setState\(data\?\.currentLevel === "aal2" \? "allowed" : "enroll"\)/);
  assert.ok(
    gate.indexOf('rpc("ceac_google_mfa_eligible")') <
      gate.indexOf('setState(data?.currentLevel === "aal2"'),
    "active CEAC eligibility must be checked before any AAL2 session is allowed",
  );
  assert.match(gate, /state === "enroll" && <AccountMfaSetup onVerified=\{refresh\}/);
  assert.match(gate, /not linked to an active CEAC profile/);
});

test("successful authenticator verification refreshes the application gate", () => {
  assert.match(setup, /export default function AccountMfaSetup\(\{ onVerified \}\)/);
  assert.match(setup, /await refresh\(\);\s*onVerified\?\.\(\);/s);
});

test("pre-MFA admission discloses only eligibility for the preserved active identity", () => {
  assert.match(migration, /create or replace function public\.ceac_google_mfa_eligible\(\)/i);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /p\.id = auth\.uid\(\)/);
  assert.match(migration, /p\.active/);
  assert.match(migration, /lower\(p\.email\) = lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/);
  assert.match(migration, /request_path = 'rpc\/ceac_google_mfa_eligible'/);
  assert.match(migration, /current_user = 'authenticated'/);
  assert.match(migration, /revoke all on function public\.ceac_google_mfa_eligible\(\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.ceac_google_mfa_eligible\(\) to authenticated/i);
  assert.doesNotMatch(
    migration,
    /app_metadata' -> 'providers'/,
    "a linked Google identity must not be mistaken for the provider used by this session",
  );
  const aal2Function = migration
    .split("create or replace function public.ceac_session_is_google_aal2()")[1]
    ?.split("comment on function public.ceac_session_is_google_aal2()")[0] || "";
  assert.match(
    aal2Function,
    /ceac_google_mfa_eligible\(\)/,
    "every AAL2 authorization decision must recheck the active preserved CEAC identity",
  );
});

test("database and Storage require active CEAC identity plus Google OAuth and TOTP AAL2", () => {
  for (const required of ["aal2", "oauth", "totp", "google"]) {
    assert.match(migration, new RegExp(required, "i"));
  }
  assert.match(migration, /alter role authenticator set pgrst\.db_pre_request/);
  assert.match(migration, /create policy [\s\S]* on storage\.objects[\s\S]* as restrictive/i);
  assert.match(migration, /ceac_require_google_aal2/);
  assert.match(migration, /current_user not in \('anon', 'authenticated'\)/);
  const exception = migration.match(/if current_user = 'authenticated'[\s\S]*?return;[\s\S]*?end if;/i)?.[0] || "";
  assert.match(exception, /request_path = 'rpc\/ceac_google_mfa_eligible'/);
  assert.match(exception, /ceac_session_is_google\(\)/);
  assert.doesNotMatch(exception, /storage|profiles|select|insert|update|delete/i);
});
