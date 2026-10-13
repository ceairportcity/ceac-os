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

test("the MFA gate wraps the authenticated application before protected loading", () => {
  assert.match(app, new RegExp("<MandatoryMfaGate>\\s*<AuthenticatedApp\\s*/>\\s*</MandatoryMfaGate>", "s"));
  assert.doesNotMatch(app, /AccountPassword|\/activate|\/reset-password/);
  assert.match(gate, /getAuthenticatorAssuranceLevel/);
  assert.match(gate, /currentLevel\s*===\s*["']aal2["']/);
  assert.match(gate, /AccountMfaSetup\s+onVerified=\{refresh\}/);
});

test("successful authenticator verification refreshes the application gate", () => {
  assert.match(setup, /export default function AccountMfaSetup\(\{ onVerified \}\)/);
  assert.match(setup, /await refresh\(\);\s*onVerified\?\.\(\);/s);
});

test("database and Storage require a Google OAuth plus TOTP AAL2 session", () => {
  for (const required of ["aal2", "oauth", "totp", "google"]) {
    assert.match(migration, new RegExp(required, "i"));
  }
  assert.match(migration, /alter role authenticator set pgrst\.db_pre_request/);
  assert.match(migration, /create policy [\s\S]* on storage\.objects[\s\S]* as restrictive/i);
  assert.match(migration, /ceac_require_google_aal2/);
  assert.match(migration, /current_user in \('anon', 'authenticated'\)/);
});
