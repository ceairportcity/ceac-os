// Disposable, local-only TOTP AAL2 integration proof.
// This does not replace the owner-operated real-user MFA ceremony.
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.equal(url, "http://127.0.0.1:54321", "FAIL CLOSED: only isolated loopback Supabase allowed");
assert.ok(anon && service, "local-only Supabase test API keys required");
assert.notEqual(anon, service);

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `test-local-mfa-${randomBytes(12).toString("hex")}@ceac.local.test`;
const password = `${randomBytes(26).toString("base64url")}Aa1!`;
let uid;
let invitationId;
let failed = false;

function base32Decode(text) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bitBuffer = 0, bitLength = 0;
  const result = [];
  for (const char of text.toUpperCase().replace(/=+$/, "").replace(/\s/g, "")) {
    const n = alphabet.indexOf(char);
    assert.ok(n >= 0, "invalid local factor secret encoding");
    bitBuffer = (bitBuffer << 5) | n;
    bitLength += 5;
    if (bitLength >= 8) {
      bitLength -= 8;
      result.push((bitBuffer >> bitLength) & 255);
    }
  }
  return Buffer.from(result);
}
function totp(secret) {
  const counter = Math.floor(Date.now() / 30_000);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = digest[digest.length - 1] & 15;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}
try {
  // CEAC is invitation-only. Seed a disposable local invitation through
  // service-role authority, never bypass the application registration gate.
  const invitation = await admin.from("pending_invitations").insert({
    org_id: "10000000-0000-4000-8000-000000000010",
    email,
    full_name: "Ephemeral MFA Acceptance",
    unit_id: "20000000-0000-4000-8000-000000000011",
    role: "staff",
    invited_by: null,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }).select("id").single();
  if (invitation.error) throw invitation.error;
  invitationId = invitation.data.id;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  uid = created.data.user?.id;
  assert.ok(uid, "local-only test user not created");

  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  assert.ok(signed.data.session?.access_token, "local session missing");
  const first = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (first.error) throw first.error;
  assert.equal(first.data.currentLevel, "aal1", "fresh local test account must begin at AAL1");

  const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "CEAC isolated AAL2 verification" });
  if (enrolled.error) throw enrolled.error;
  const factorId = enrolled.data.id;
  const secret = enrolled.data.totp?.secret;
  assert.ok(factorId && secret, "local TOTP enrollment failed");

  const challenged = await client.auth.mfa.challenge({ factorId });
  if (challenged.error) throw challenged.error;
  assert.ok(challenged.data.id, "local TOTP challenge missing");
  const verified = await client.auth.mfa.verify({
    factorId, challengeId: challenged.data.id, code: totp(secret),
  });
  if (verified.error) throw verified.error;
  const second = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (second.error) throw second.error;
  assert.equal(second.data.currentLevel, "aal2", "verified TOTP must promote only local session to AAL2");
  const session = await client.auth.getSession();
  assert.equal(session.error, null);
  assert.ok(session.data.session?.access_token, "verified local session missing");
  console.log("PASS local-only TOTP AAL1 -> enroll -> challenge -> verify -> AAL2.");
} catch (err) {
  failed = true;
  console.error("FAIL local-only TOTP/AAL2 ceremony:", err?.message || String(err));
} finally {
  await client.auth.signOut().catch(() => {});
  if (uid) {
    const removed = await admin.auth.admin.deleteUser(uid);
    if (removed.error) {
      failed = true;
      console.error("FAIL local test account cleanup:", removed.error.message);
    }
  }
  if (invitationId) {
    const cleared = await admin.from("pending_invitations").delete().eq("id", invitationId);
    if (cleared.error) {
      failed = true;
      console.error("FAIL local invitation cleanup:", cleared.error.message);
    }
  }
}
if (failed) process.exitCode = 1;
