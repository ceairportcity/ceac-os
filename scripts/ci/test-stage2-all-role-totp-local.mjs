// Real GoTrue TOTP provider + signed JWT + RLS/RPC integration on disposable Supabase.
// Run only after the isolated Staff authenticator browser acceptance has enrolled Staff.
// This file MUST NOT be pointed at hosted Supabase or run with a production service key.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

assert.equal(process.env.SUPABASE_URL, "http://127.0.0.1:54321", "Only isolated loopback Supabase is permitted");
for (const name of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID", "SUPABASE_DB_URL", "DATABASE_URL"]) {
  assert.ok(!process.env[name], "Unexpected remote database credential: " + name);
}
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ROLE_FIXTURE_PASSWORD } = process.env;
assert.ok(SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY && ROLE_FIXTURE_PASSWORD, "Missing disposable test fixtures");
assert.notEqual(SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY);
const orgId = "10000000-0000-4000-8000-000000000010";
const roleEmails = [
  ["Manager", "manager@ceac.local.test"],
  ["Second-unit Manager", "managerb@ceac.local.test"],
  ["Administration/HR", "admin@ceac.local.test"],
  ["Executive", "exec@ceac.local.test"],
  ["Other-unit Staff", "other@ceac.local.test"],
  ["Volunteer", "sameunit@ceac.local.test"],
];
const create = (key) => createClient(SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const service = create(SUPABASE_SERVICE_ROLE_KEY);
const sessions = [];
let switched = false;

function fromBase32(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let value = 0, bits = 0;
  const bytes = [];
  for (const char of secret.toUpperCase().replace(/\s|=/g, "")) {
    const digit = alphabet.indexOf(char);
    assert.ok(digit >= 0, "Invalid local test authenticator key");
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  return Buffer.from(bytes);
}
function codeFor(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac("sha1", fromBase32(secret)).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
async function sessionLevel(client, label, expected) {
  const result = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (result.error) throw result.error;
  assert.equal(result.data.currentLevel, expected, label + " must have " + expected);
  return result.data;
}
async function signIn(client, email) {
  const result = await client.auth.signInWithPassword({ email, password: ROLE_FIXTURE_PASSWORD });
  if (result.error) throw result.error;
  assert.ok(result.data.session?.access_token, "Real password session missing");
}
async function orgIdentity(client, label) {
  const response = await client.rpc("app_org_id");
  if (response.error) throw new Error(label + " app_org_id failed: " + response.error.message);
  return response.data;
}

try {
  const initial = await service.from("organisations")
    .select("universal_totp_required").eq("id", orgId).single();
  if (initial.error) throw initial.error;
  assert.equal(initial.data.universal_totp_required, false, "Local-only owner cutover must start OFF");

  for (const [label, email] of roleEmails) {
    const client = create(SUPABASE_ANON_KEY);
    sessions.push(client);
    await signIn(client, email);
    await sessionLevel(client, label + " fresh sign-in", "aal1");
    const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "CEAC isolated acceptance" });
    if (enrolled.error) throw enrolled.error;
    const factorId = enrolled.data.id;
    const secret = enrolled.data.totp?.secret;
    assert.ok(factorId && secret, "Local-only TOTP enrollment was not available");
    const challenge = await client.auth.mfa.challenge({ factorId });
    if (challenge.error) throw challenge.error;
    const verified = await client.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: codeFor(secret) });
    if (verified.error) throw verified.error;
    await sessionLevel(client, label + " verified authenticator", "aal2");
    const claims = await client.auth.getClaims();
    if (claims.error) throw claims.error;
    assert.equal(claims.data.claims.aal, "aal2", label + " signed JWT must be AAL2");
    assert.ok(claims.data.claims.amr?.some((item) => item.method === "totp"), label + " must have signed TOTP AMR");
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    await sessionLevel(client, label + " token refresh", "aal2");
  }

  // Turn on the universal policy ONLY in this disposable local organisation.
  // A real, provider-issued AAL2/TOTP JWT must restore the existing RPC scope.
  const enabled = await service.from("organisations")
    .update({ universal_totp_required: true }).eq("id", orgId).select("id").single();
  if (enabled.error) throw enabled.error;
  switched = true;
  for (let i = 0; i < sessions.length; i += 1) {
    assert.equal(await orgIdentity(sessions[i], roleEmails[i][0] + " AAL2"), orgId,
      roleEmails[i][0] + " signed TOTP must restore only its own org authority");
  }

  // A separate password login remains AAL1, even after prior verified sessions.
  // Staff was enrolled by the real browser ceremony immediately before this test.
  for (const [label, email] of [["Staff", "staff@ceac.local.test"], ...roleEmails]) {
    const newLogin = create(SUPABASE_ANON_KEY);
    sessions.push(newLogin);
    await signIn(newLogin, email);
    const assurance = await sessionLevel(newLogin, label + " new login", "aal1");
    assert.equal(assurance.nextLevel, "aal2", label + " must require another authenticator challenge");
    assert.equal(await orgIdentity(newLogin, label + " unverified login"), null,
      label + " AAL1 must not get existing SECURITY DEFINER org authority");
  }
  console.log("PASS local-only real provider TOTP, AAL2, refresh continuity and AAL1 RPC denial: Staff + 6 role/organisation fixtures.");
} finally {
  if (switched) {
    const reset = await service.from("organisations").update({ universal_totp_required: false }).eq("id", orgId);
    if (reset.error) throw new Error("Could not restore disposable local MFA flag: " + reset.error.message);
  }
  await Promise.all(sessions.map((client) => client.auth.signOut().catch(() => {})));
}
