import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const signIn = readFileSync(new URL("../src/screens/SignIn.jsx", import.meta.url), "utf8");
const accountPassword = readFileSync(new URL("../src/screens/AccountPassword.jsx", import.meta.url), "utf8");
const privilegedGate = readFileSync(new URL("../src/components/PrivilegedMfaGate.jsx", import.meta.url), "utf8");
const googleGate = readFileSync(new URL("../src/components/MandatoryMfaGate.jsx", import.meta.url), "utf8");
const googleMigration = readFileSync(
  new URL("../supabase/migrations/20261012172718_google_oauth_aal2_enforcement.sql", import.meta.url),
  "utf8",
);

test("Stage 1 uses the existing email and password sign-in", () => {
  assert.match(signIn, /signInWithPassword/);
  assert.match(signIn, /type=\{showPassword \? "text" : "password"\}/);
  assert.doesNotMatch(signIn, /signInWithOAuth/);
});

test("Stage 1 preserves password recovery and account activation", () => {
  assert.match(signIn, /resetPasswordForEmail/);
  assert.match(signIn, /authRedirect\("\/reset-password"\)/);
  assert.match(app, /authPath === "\/activate"/);
  assert.match(app, /authPath === "\/reset-password"/);
  assert.match(app, /AccountPassword/);
  assert.match(accountPassword, /const description = hasSession/);
  assert.match(accountPassword, /A current CEAC invitation link is required/);
  assert.match(accountPassword, /A current CEAC recovery link is required/);
});

test("Stage 1 does not activate the Google-only universal gate", () => {
  assert.doesNotMatch(app, /MandatoryMfaGate/);
  assert.doesNotMatch(app, /ceac_google_mfa_eligible/);
});

test("Stage 1 retains the applied privileged-only TOTP and AAL2 gate", () => {
  // Stage 1 is still the default without the explicit P9/Auth cutover flag.
  // The future universal TOTP gate must never activate by merely loading Stage 2 source.
  assert.match(app, /const ActiveMfaGate = import\.meta\.env\.VITE_STAGE2_UNIVERSAL_AAL2 === "true"/);
  assert.match(app, /\? Stage2UniversalMfaGate : PrivilegedMfaGate/);
  assert.match(app, /<ActiveMfaGate me=\{me\} onVerified=\{boot\}>/);
  assert.match(privilegedGate, /privileged_mfa_required/);
  assert.match(privilegedGate, /isPrivilegedIdentity\(me\)/);
  assert.match(privilegedGate, /getAuthenticatorAssuranceLevel/);
  assert.match(privilegedGate, /state === "enroll" \|\| state === "challenge"/);
  assert.doesNotMatch(privilegedGate, /ceac_google_mfa_eligible/);
});

test("Stage 2 Google and universal AAL2 work remains preserved", () => {
  assert.match(googleGate, /MandatoryMfaGate/);
  assert.match(googleMigration, /ceac_session_is_google/);
  assert.match(googleMigration, /ceac_google_mfa_eligible/);
  assert.match(googleMigration, /aal2/i);
});
