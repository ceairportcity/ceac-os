import assert from "node:assert/strict";
import test from "node:test";
import { decideMfaAccess, isPrivilegedIdentity, verifiedMfaFactors } from "../src/lib/mfaPolicy.js";
import { resolveMfaGate } from "../src/lib/mfaGate.js";

test("verified factor extraction ignores unverified factors", () => {
  const factors = verifiedMfaFactors({
    totp: [
      { id: "t1", status: "unverified" },
      { id: "t2", status: "verified" },
    ],
    phone: [{ id: "p1", status: "verified", factor_type: "phone" }],
  });
  assert.deepEqual(factors.map((factor) => factor.id), ["t2", "p1"]);
});

test("aal2 session is allowed without another challenge", () => {
  assert.equal(decideMfaAccess({
    currentLevel: "aal2",
    nextLevel: "aal2",
    currentAuthenticationMethods: [{ method: "totp" }],
    factors: { totp: [{ id: "t1", status: "verified" }] },
    privileged: true,
    enforcementEnabled: true,
  }).state, "allow");
});

test("privileged non-TOTP aal2 session is challenged for TOTP", () => {
  const decision = decideMfaAccess({
    currentLevel: "aal2",
    nextLevel: "aal2",
    currentAuthenticationMethods: [{ method: "otp" }],
    factors: { totp: [{ id: "t1", status: "verified" }] },
    privileged: true,
    enforcementEnabled: true,
  });
  assert.equal(decision.state, "challenge");
  assert.equal(decision.reason, "privileged_totp_session_required");
  assert.equal(decision.factor.id, "t1");
});

test("verified TOTP on aal1 requires challenge even before organisation enforcement", () => {
  const decision = decideMfaAccess({
    currentLevel: "aal1",
    nextLevel: "aal2",
    factors: { totp: [{ id: "t1", status: "verified" }] },
    privileged: false,
    enforcementEnabled: false,
  });
  assert.equal(decision.state, "challenge");
  assert.equal(decision.factor.id, "t1");
});

test("privileged aal1 user without a factor must enroll only when enforcement is enabled", () => {
  assert.equal(decideMfaAccess({
    currentLevel: "aal1",
    nextLevel: "aal1",
    factors: { totp: [] },
    privileged: true,
    enforcementEnabled: true,
  }).state, "enroll");

  assert.equal(decideMfaAccess({
    currentLevel: "aal1",
    nextLevel: "aal1",
    factors: { totp: [] },
    privileged: true,
    enforcementEnabled: false,
  }).state, "allow");
});

test("privileged aal2 session cannot bypass a missing required TOTP", () => {
  assert.equal(decideMfaAccess({
    currentLevel: "aal2",
    nextLevel: "aal2",
    factors: { totp: [] },
    privileged: true,
    enforcementEnabled: true,
  }).state, "enroll");
});

test("privileged enforcement does not accept a non-TOTP factor as the required method", () => {
  const decision = decideMfaAccess({
    currentLevel: "aal2",
    nextLevel: "aal2",
    factors: { phone: [{ id: "p1", status: "verified", factor_type: "phone" }] },
    privileged: true,
    enforcementEnabled: true,
  });
  assert.equal(decision.state, "unsupported-factor");
  assert.equal(decision.reason, "privileged_totp_required");
});


test("ordinary user is not forced to enroll by privileged-only enforcement", () => {
  assert.equal(decideMfaAccess({
    currentLevel: "aal1",
    nextLevel: "aal1",
    factors: {},
    privileged: false,
    enforcementEnabled: true,
  }).state, "allow");
});

test("verified unsupported factor never silently bypasses step-up", () => {
  assert.equal(decideMfaAccess({
    currentLevel: "aal1",
    nextLevel: "aal2",
    factors: { phone: [{ id: "p1", status: "verified", factor_type: "phone" }] },
    privileged: true,
    enforcementEnabled: true,
  }).state, "unsupported-factor");
});

test("privileged identity is based on authority, not job title", () => {
  assert.equal(isPrivilegedIdentity({ is_admin: true, capability_grants: [] }), true);
  assert.equal(isPrivilegedIdentity({ is_exec: true, capability_grants: [] }), true);
  assert.equal(isPrivilegedIdentity({
    is_admin: false,
    is_exec: false,
    job_title: "Director",
    capability_grants: [],
  }), false);
  assert.equal(isPrivilegedIdentity({
    is_admin: false,
    is_exec: false,
    capability_grants: [{ capability: "people.manage" }],
  }), true);
  assert.equal(isPrivilegedIdentity({
    is_admin: false,
    is_exec: false,
    memberships: [{ role: "manager" }],
    capability_grants: [],
  }), true);
  assert.equal(isPrivilegedIdentity({
    is_admin: false,
    is_exec: false,
    role: "sub_team_lead",
    capability_grants: [],
  }), true);
  assert.equal(isPrivilegedIdentity({
    is_admin: false,
    is_exec: false,
    led_sub_team_ids: ["sub-team-1"],
    capability_grants: [],
  }), true);
});

test("browser gate delegates to the canonical authority-based MFA policy", () => {
  const managerDecision = resolveMfaGate({
    assurance: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: [{ method: "password" }] },
    factors: {},
    me: { memberships: [{ role: "manager" }], capability_grants: [] },
    privilegedMfaEnforced: true,
  });
  assert.equal(managerDecision.state, "enroll");

  const leadDecision = resolveMfaGate({
    assurance: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [{ method: "password" }] },
    factors: { totp: [{ id: "t1", status: "verified" }] },
    me: { led_sub_team_ids: ["lane-1"], capability_grants: [] },
    privilegedMfaEnforced: false,
  });
  assert.equal(leadDecision.state, "challenge");

  const staffDecision = resolveMfaGate({
    assurance: { currentLevel: "aal1", nextLevel: "aal1" },
    factors: {},
    me: { role: "staff", memberships: [{ role: "staff" }], capability_grants: [] },
    privilegedMfaEnforced: true,
  });
  assert.equal(staffDecision.state, "allow");
});
