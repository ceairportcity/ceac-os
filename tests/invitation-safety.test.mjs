import test from "node:test";
import assert from "node:assert/strict";
import { findRecoverableInvitation, invitationEmailConflicts, isPlausibleInvitationEmail, invitationDeliveryMessage } from "../src/lib/invitationSafety.js";

test("invitation duplicate guard normalizes email case and spaces", () => {
  assert.deepEqual(invitationEmailConflicts(" Existing@ceac.org ",
    [{ email: "existing@ceac.org" }], []),
    { accountExists: true, invitationPending: false });
});

test("outstanding invitation is blocked without pretending an account exists", () => {
  assert.deepEqual(invitationEmailConflicts("new@ceac.org", [],
    [{ email: " New@CEAC.org ", activation_state: "pending", revoked_at: null }]),
    { accountExists: false, invitationPending: true });
});

test("revoked and verified invitations never block a new request on their own", () => {
  assert.deepEqual(invitationEmailConflicts("fresh@ceac.org", [],
    [{ email: "fresh@ceac.org", activation_state: "pending", revoked_at: "2026-10-11T00:00:00Z" },
      { email: "fresh@ceac.org", activation_state: "verified", revoked_at: null }]),
    { accountExists: false, invitationPending: false });
});

test("expired invitations do not falsely block HR re-invitation", () => {
  assert.deepEqual(invitationEmailConflicts("staff@ceac.org", [],
    [{ email: "staff@ceac.org", activation_state: "expired", revoked_at: null }]),
    { accountExists: false, invitationPending: false });
  assert.deepEqual(invitationEmailConflicts("staff@ceac.org", [],
    [{ email: "staff@ceac.org", activation_state: "expired" },
      { email: "staff@ceac.org", activation_state: "pending" }]),
    { accountExists: false, invitationPending: true });
});

test("a verified invitation does not cancel a separately active existing profile", () => {
  assert.deepEqual(invitationEmailConflicts("user@ceac.org",
    [{ email: "user@ceac.org", active: false }],
    [{ email: "user@ceac.org", activation_state: "verified" }]),
    { accountExists: true, invitationPending: false });
});

test("missing and corrupted read rows cannot invent an email conflict", () => {
  assert.deepEqual(invitationEmailConflicts(""), { accountExists: false, invitationPending: false });
  assert.deepEqual(invitationEmailConflicts("new@example.org", null, [null, {}, { email: 4 }]),
    { accountExists: false, invitationPending: false });
});

test("invalid, missing, whitespace and overlong emails are blocked before recording", () => {
  for (const email of [null, "", "admin", "admin@", "@church.org", "admin@church", "a b@church.org", "x@ y.org", "a".repeat(255) + "@church.org"]) {
    assert.equal(isPlausibleInvitationEmail(email), false, String(email));
  }
  assert.equal(isPlausibleInvitationEmail(" staff@ceac.org "), true);
  assert.equal(isPlausibleInvitationEmail("staff+work@ceac.org"), true);
});

test("Auth invitation errors give actionable safe reasons without disclosing provider details",()=>{
 assert.match(invitationDeliveryMessage({code:"email_address_not_authorized"}),/not authorised/);
 assert.match(invitationDeliveryMessage({code:"over_email_send_rate_limit",status:429}),/limit/);
 assert.match(invitationDeliveryMessage({status:500,message:"secret key"}),/unavailable/);
 assert.doesNotMatch(invitationDeliveryMessage({message:"secret key"}),/secret key/);
});

test("existing unverified login offers a safe invitation resend without creating another account", () => {
  const active = { id: "pending-1", email: " Elizabeth@example.org ", activation_state: "awaiting_verification", revoked_at: null };
  assert.deepEqual(findRecoverableInvitation(" ELIZABETH@example.org ", [active]), active);
  const expired = { id: "expired-1", email: "elizabeth@example.org", activation_state: "expired", revoked_at: null };
  assert.deepEqual(findRecoverableInvitation("elizabeth@example.org", [expired]), expired);
  assert.equal(findRecoverableInvitation("elizabeth@example.org", [{ ...active, activation_state: "verified" }]), null);
  assert.equal(findRecoverableInvitation("elizabeth@example.org", [{ ...active, revoked_at: "2026-11-03T00:00:00Z" }]), null);
  assert.equal(findRecoverableInvitation("elizabeth@example.org", [{ ...active, id: null }]), null);
  assert.equal(findRecoverableInvitation("not-an-email", [active]), null);
});
