import test from "node:test";
import assert from "node:assert/strict";
import { invitationEmailConflicts, isPlausibleInvitationEmail } from "../src/lib/invitationSafety.js";

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
