import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideUniversalTotpAccess, shouldRecheckUniversalTotp, hasSignedTotpAssurance } from "../src/lib/Stage2UniversalMfaPolicy.js";

const user = { id: "53e591aa-e33c-4bca-94f0-4f5b6d5e7319" };
const session = { user };
const factor = { id: "factor-1", factor_type: "totp", status: "verified" };
const claims = (aal, methods = []) => ({ sub: user.id, role: "authenticated", aal, amr: methods.map((method) => ({ method })) });
const judge = (aal, methods, factors = { totp: [factor] }) =>
  decideUniversalTotpAccess({ session, assurance: { currentLevel: aal }, factors, claims: claims(aal, methods) });

test("valid newly signed-in password session must pass its TOTP challenge", () => {
  assert.equal(judge("aal1", ["password"]).state, "challenge");
  assert.equal(judge("aal1", ["oauth"]).state, "challenge");
});

test("all active roles must enroll TOTP if no verified TOTP exists", () => {
  assert.equal(judge("aal1", ["password"], { totp: [] }).state, "enroll");
  assert.equal(judge("aal2", ["password", "phone"], { phone: [{status:"verified"}] }).state, "enroll");
});

test("verified signed-in session with TOTP AMR and AAL2 may continue normally", () => {
  assert.equal(judge("aal2", ["password", "totp"]).state, "allow");
  assert.equal(judge("aal2", ["oauth", "totp"]).state, "allow");
});

test("AAL2 via non-TOTP method or stale claims cannot substitute for authenticator code", () => {
  assert.equal(judge("aal2", ["password", "otp"]).state, "challenge");
  assert.equal(decideUniversalTotpAccess({session,assurance:{currentLevel:"aal2"},factors:{totp:[factor]},claims:claims("aal1",["totp"])}).state,"challenge");
  assert.equal(judge("aal1", ["password", "totp"]).state,"challenge");
});

test("missing session, forged identity or wrong role never grants access", () => {
  assert.equal(decideUniversalTotpAccess({}).state, "signed_out");
  assert.equal(decideUniversalTotpAccess({ session, assurance:{currentLevel:"aal2"}, factors:{totp:[factor]}, claims:{...claims("aal2",["totp"]),sub:"someone-else"} }).state, "denied");
  assert.equal(decideUniversalTotpAccess({ session, assurance:{currentLevel:"aal2"}, factors:{totp:[factor]}, claims:{...claims("aal2",["totp"]),role:"service_role"} }).state, "denied");
});

test("token refresh triggers verification without inventing a new login or grace clock", () => {
  assert.equal(shouldRecheckUniversalTotp("TOKEN_REFRESHED"), true);
  assert.equal(shouldRecheckUniversalTotp("SIGNED_IN"), true);
  assert.equal(shouldRecheckUniversalTotp("MFA_CHALLENGE_VERIFIED"), true);
  assert.equal(shouldRecheckUniversalTotp("PASSWORD_RECOVERY"), true,
    "A password-recovery session cannot inherit previously authorised workspace visibility");
});

test("non-TOTP entries inside the TOTP factor collection cannot stand in for a verified authenticator", () => {
  const wrongFactor = { id: "phone-incorrectly-categorised", factor_type: "phone", status: "verified" };
  assert.equal(judge("aal2", ["password", "totp"], { totp: [wrongFactor] }).state, "enroll");
  assert.equal(judge("aal1", ["password"], { totp: [wrongFactor] }).state, "enroll");
  assert.equal(judge("aal2", ["password", "totp"], { totp: [wrongFactor, factor] }).state, "allow");
  assert.equal(judge("aal2", ["password", "totp"], { totp: [{ ...factor, status: "unverified" }] }).state, "enroll");
});

test("token refresh and sign out invalidate previously visible workspace before any asynchronous Auth call", () => {
  const gate = readFileSync(new URL("../src/components/Stage2UniversalMfaGate.jsx", import.meta.url), "utf8");
  assert.match(gate, /const refresh = useCallback\(async \(\) => \{/);
  assert.match(gate, /const currentGeneration = \+\+generation\.current;\s*\/\/[^\n]*\n[^\n]*\n\s*setState\("checking"\);/);
  assert.match(gate, /onAuthStateChange\(\(event\) => \{[\s\S]*?\+\+generation\.current;[\s\S]*?setState\("checking"\);[\s\S]*?setTimeout\(\(\) => refresh\(\), 0\);/);
  assert.doesNotMatch(gate, /preserveAllowed/, "an unchecked refreshed JWT may not inherit the old allow state");
  assert.match(gate, /if \(currentGeneration !== generation\.current\) return;/);
  assert.match(gate, /if \(state === "allow"\) return children;/);
});

test("verified backup authenticator can be selected without granting an unverified factor", () => {
  const source = readFileSync(new URL("../src/components/AccountMfaSetup.jsx", import.meta.url), "utf8");
  assert.match(source, /aria-label="Authenticator device"/);
  assert.match(source, /factor\.id === selectedFactorId/);
  assert.match(source, /CEAC backup authenticator/);
  assert.ok(source.includes("factors.length > 0 && !totpAssured"));
  assert.ok(source.includes("hasSignedTotpAssurance("));
  assert.match(source, /const needsStepUp = enrolled && !totpAssured;/);
  assert.ok(source.includes("const canAddBackup = enrolled && totpAssured && factors.length < 2;"));
  assert.match(source, /setSelectedFactorId\(event\.target\.value\)/);
});

test("verified backup confirmation survives the authentication gate remount", () => {
  const source = readFileSync(new URL("../src/components/AccountMfaSetup.jsx", import.meta.url), "utf8");
  assert.match(source, /statusReady && factors\.length > 1/);
  assert.match(source, /A backup authenticator is verified for this account/);
  assert.doesNotMatch(source, /localStorage\.setItem\(["'](?:mfa|aal2)/i,
    "UI confirmation may not become an MFA authority flag");
});

// Password reset links can establish a fresh provider session. The UI gate
// must clear earlier assurance immediately; only a fresh signed TOTP/AAL2
// result can restore the workspace.
test("password recovery is subject to the same fail-closed recheck as sign-in", () => {
  assert.equal(shouldRecheckUniversalTotp("PASSWORD_RECOVERY"), true);
  assert.equal(judge("aal1", ["recovery"]).state, "challenge");
  assert.equal(judge("aal1", ["recovery"], { totp: [] }).state, "enroll");
  assert.equal(judge("aal2", ["recovery", "totp"]).state, "allow");
});

test("non-TOTP AAL2 keeps the challenge visible and cannot unlock backup enrollment", () => {
  const assurance = { currentLevel: "aal2" };
  assert.equal(hasSignedTotpAssurance({ assurance, claims: claims("aal2", ["phone"]) }), false);
  assert.equal(hasSignedTotpAssurance({ assurance, claims: claims("aal2", ["otp"]) }), false);
  assert.equal(hasSignedTotpAssurance({ assurance, claims: claims("aal2", ["totp"]) }), true);
  assert.equal(hasSignedTotpAssurance({ assurance: { currentLevel: "aal1" }, claims: claims("aal2", ["totp"]) }), false);
  assert.equal(hasSignedTotpAssurance({ assurance, claims: { ...claims("aal2", ["totp"]), role: "service_role" } }), false);
  const source = readFileSync(new URL("../src/components/AccountMfaSetup.jsx", import.meta.url), "utf8");
  assert.ok(source.includes("supabase.auth.getClaims()"),
    "Authenticator UI must check signed session claims, not the assurance label alone");
  assert.match(source, /const needsStepUp = enrolled && !totpAssured;/);
  assert.match(source, /A password reset cannot bypass the required TOTP check/);
});

test("Stage 2 Auth bootstrap invalidates stale identity and personal session results", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /const bootEpoch = useRef\(0\);/);
  assert.match(source, /const requestEpoch = \+\+bootEpoch\.current;/);
  assert.match(source, /const isCurrent = \(\) => requestEpoch === bootEpoch\.current;/);
  assert.match(source, /if \(!authSession\) \{[\s\S]*?setMe\(null\);[\s\S]*?setSession\(null\);[\s\S]*?return;/);
  assert.match(source, /const m = await loadMe\(\);\s*if \(!isCurrent\(\)\) return;\s*const currentSession = m \? await openSession\(m\.org_id, m\.id\) : null;\s*if \(!isCurrent\(\)\) return;\s*[\s\S]*?setMe\(m\);\s*setSession\(currentSession\);/);
  assert.match(source, /catch \(error\) \{\s*if \(!isCurrent\(\)\) return;/);
  assert.match(source, /finally \{\s*if \(isCurrent\(\)\) setReady\(true\);/);
});
