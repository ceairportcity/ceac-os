import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideUniversalTotpAccess, shouldRecheckUniversalTotp } from "../src/lib/Stage2UniversalMfaPolicy.js";

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
  assert.equal(shouldRecheckUniversalTotp("PASSWORD_RECOVERY"), false);
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
  assert.match(source, /factors\.length > 0 && level !== "aal2"/);
  assert.match(source, /setSelectedFactorId\(event\.target\.value\)/);
});
