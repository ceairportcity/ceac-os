import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const signIn = readFileSync(new URL("../src/screens/SignIn.jsx", import.meta.url), "utf8");
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
});

test("Stage 1 does not activate the Google-only universal gate", () => {
  assert.doesNotMatch(app, /MandatoryMfaGate/);
  assert.doesNotMatch(app, /ceac_google_mfa_eligible/);
});

test("Stage 2 Google and universal AAL2 work remains preserved", () => {
  assert.match(googleGate, /MandatoryMfaGate/);
  assert.match(googleMigration, /ceac_session_is_google/);
  assert.match(googleMigration, /ceac_google_mfa_eligible/);
  assert.match(googleMigration, /aal2/i);
});
