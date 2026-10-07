import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) throw new Error("Missing local Supabase credentials.");

const orgId = "10000000-0000-4000-8000-000000000001";
const unitId = "20000000-0000-4000-8000-000000000001";
const bootstrapEmail = "manager@ceac.local.test";
const employeeEmail = "new.employee@ceac.local.test";
const expiredInviteEmail = "expired.invite@ceac.local.test";
const revokedInviteEmail = "revoked.invite@ceac.local.test";
const initialPassword = "CEAC-local-test-2026!";
const recoveredPassword = "CEAC-local-recovered-2026!";

function client(key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
const anon = client(anonKey);
const service = client(serviceKey);

async function createAndVerifyMagicLink(email) {
  const created = await service.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  assert.equal(created.error, null, created.error?.message);
  assert.ok(created.data.user, `Auth user was not created for ${email}`);

  const magic = await service.auth.admin.generateLink({ type: "magiclink", email });
  assert.equal(magic.error, null, magic.error?.message);
  assert.ok(magic.data?.properties?.hashed_token, "Magic-link token was not generated.");

  const verified = await anon.auth.verifyOtp({
    token_hash: magic.data.properties.hashed_token,
    type: "magiclink",
  });
  assert.equal(verified.error, null, verified.error?.message);
  assert.ok(verified.data.session, `Session was not established for ${email}`);
  return verified.data.user;
}

// Bootstrap the first local CEAC authority through the real invite-only trigger.
// The workflow creates a test-only invitation with invited_by temporarily nullable.
const bootstrapUser = await createAndVerifyMagicLink(bootstrapEmail);

let profile = await service.from("profiles").select("id,org_id,email").eq("id", bootstrapUser.id).single();
assert.equal(profile.error, null, profile.error?.message);
assert.equal(profile.data.org_id, orgId);

let membership = await service.from("unit_memberships").select("id,unit_id,role").eq("profile_id", bootstrapUser.id).single();
assert.equal(membership.error, null, membership.error?.message);
assert.equal(membership.data.unit_id, unitId);

const adminPromote = await service.from("profiles").update({ is_admin: true }).eq("id", bootstrapUser.id);
assert.equal(adminPromote.error, null, adminPromote.error?.message);
const managerPromote = await service.from("unit_memberships").update({ role: "manager" }).eq("id", membership.data.id);
assert.equal(managerPromote.error, null, managerPromote.error?.message);

const peopleGrant = await service.from("capability_grants").insert({
  org_id: orgId,
  profile_id: bootstrapUser.id,
  capability: "people.manage",
  granted_by: bootstrapUser.id,
  grant_reason: "Account security integration fixture",
});
assert.equal(peopleGrant.error, null, peopleGrant.error?.message);

// Expired invitation: Auth creation must be rejected by the invite-only trigger.
const expiredInvite = await service.from("pending_invitations").insert({
  org_id: orgId,
  email: expiredInviteEmail,
  full_name: "Expired Invite",
  unit_id: unitId,
  role: "staff",
  invited_by: bootstrapUser.id,
  expires_at: new Date(Date.now() - 60000).toISOString(),
});
assert.equal(expiredInvite.error, null, expiredInvite.error?.message);

const expiredCreate = await service.auth.admin.createUser({
  email: expiredInviteEmail,
  email_confirm: false,
});
assert.ok(expiredCreate.error, "Expired invitation unexpectedly created an Auth user.");
const expiredProfile = await service.from("profiles").select("id").eq("email", expiredInviteEmail).maybeSingle();
assert.equal(expiredProfile.error, null, expiredProfile.error?.message);
assert.equal(expiredProfile.data, null, "Expired invitation unexpectedly created a CEAC profile.");

// Revocation after an unconfirmed account exists must remove application authority,
// even if an activation link was generated before revocation.
const revokedInvite = await service.from("pending_invitations").insert({
  org_id: orgId,
  email: revokedInviteEmail,
  full_name: "Revoked Invite",
  unit_id: unitId,
  role: "staff",
  invited_by: bootstrapUser.id,
  expires_at: new Date(Date.now() + 86400000).toISOString(),
}).select("id").single();
assert.equal(revokedInvite.error, null, revokedInvite.error?.message);

const unconfirmed = await service.auth.admin.createUser({
  email: revokedInviteEmail,
  email_confirm: false,
});
assert.equal(unconfirmed.error, null, unconfirmed.error?.message);
assert.ok(unconfirmed.data.user, "Unconfirmed invitation account was not created.");

const preRevocationLink = await service.auth.admin.generateLink({ type: "magiclink", email: revokedInviteEmail });
assert.equal(preRevocationLink.error, null, preRevocationLink.error?.message);
assert.ok(preRevocationLink.data?.properties?.hashed_token, "Activation token was not generated.");

const revokeInvite = await anon.rpc("admin_revoke_staff_invitation", {
  p_invitation_id: revokedInvite.data.id,
  p_reason: "Account security integration test",
});
assert.equal(revokeInvite.error, null, revokeInvite.error?.message);

const revokedProfile = await service.from("profiles").select("active").eq("id", unconfirmed.data.user.id).single();
assert.equal(revokedProfile.error, null, revokedProfile.error?.message);
assert.equal(revokedProfile.data.active, false, "Revoked unconfirmed profile remained active.");

const revokedClient = client(anonKey);
const activationAfterRevocation = await revokedClient.auth.verifyOtp({
  token_hash: preRevocationLink.data.properties.hashed_token,
  type: "magiclink",
});
if (!activationAfterRevocation.error) {
  assert.ok(activationAfterRevocation.data.session, "Activation returned neither an error nor a session.");
  const revokedAuthority = await revokedClient.rpc("app_org_id");
  assert.equal(revokedAuthority.error, null, revokedAuthority.error?.message);
  assert.equal(revokedAuthority.data, null, "Revoked account recovered CEAC organisation authority.");
  await revokedClient.auth.signOut({ scope: "local" });
}

await anon.auth.signOut();

// Create the employee invitation using trusted service authority in this local integration test.
// Live application clients use create_pending_invitation(), whose role matrix is separately rollback-tested.
const employeeInvite = await service.from("pending_invitations").insert({
  org_id: orgId,
  email: employeeEmail,
  full_name: "New Employee",
  unit_id: unitId,
  role: "staff",
  invited_by: bootstrapUser.id,
  expires_at: new Date(Date.now() + 86400000).toISOString(),
});
assert.equal(employeeInvite.error, null, employeeInvite.error?.message);

// Brand-new employee: invitation -> auth account -> first session.
const employee = await createAndVerifyMagicLink(employeeEmail);

profile = await anon.from("profiles")
  .select("id,org_id,full_name,email")
  .eq("id", employee.id)
  .single();
assert.equal(profile.error, null, profile.error?.message);
assert.equal(profile.data.org_id, orgId);
assert.equal(profile.data.full_name, "New Employee");
assert.equal(profile.data.email, employeeEmail);

membership = await anon.from("unit_memberships")
  .select("unit_id,role")
  .eq("profile_id", employee.id)
  .single();
assert.equal(membership.error, null, membership.error?.message);
assert.equal(membership.data.unit_id, unitId);
assert.equal(membership.data.role, "staff");

// Activation password -> ordinary password sign-in.
const setInitial = await anon.auth.updateUser({ password: initialPassword });
assert.equal(setInitial.error, null, setInitial.error?.message);
await anon.auth.signOut();

const passwordLogin = await anon.auth.signInWithPassword({ email: employeeEmail, password: initialPassword });
assert.equal(passwordLogin.error, null, passwordLogin.error?.message);
assert.ok(passwordLogin.data.session, "Password sign-in after activation failed.");
await anon.auth.signOut();

// Recovery link -> new password -> ordinary sign-in.
const recovery = await service.auth.admin.generateLink({ type: "recovery", email: employeeEmail });
assert.equal(recovery.error, null, recovery.error?.message);
assert.ok(recovery.data?.properties?.hashed_token, "Recovery token was not generated.");

const recoveredSession = await anon.auth.verifyOtp({
  token_hash: recovery.data.properties.hashed_token,
  type: "recovery",
});
assert.equal(recoveredSession.error, null, recoveredSession.error?.message);
assert.ok(recoveredSession.data.session, "Recovery session was not established.");

const setRecovered = await anon.auth.updateUser({ password: recoveredPassword });
assert.equal(setRecovered.error, null, setRecovered.error?.message);
await anon.auth.signOut();

const recoveredLogin = await anon.auth.signInWithPassword({ email: employeeEmail, password: recoveredPassword });
assert.equal(recoveredLogin.error, null, recoveredLogin.error?.message);
assert.ok(recoveredLogin.data.session, "Sign-in with recovered password failed.");

// Global sign-out revokes the affected refresh sessions. An already-issued access
// token can remain valid until expiry, so the durable assertion is refresh denial.
const otherDevice = client(anonKey);
const otherLogin = await otherDevice.auth.signInWithPassword({ email: employeeEmail, password: recoveredPassword });
assert.equal(otherLogin.error, null, otherLogin.error?.message);
assert.ok(otherLogin.data.session, "Second-device sign-in failed.");

const globalSignOut = await anon.auth.signOut({ scope: "global" });
assert.equal(globalSignOut.error, null, globalSignOut.error?.message);

const otherRefresh = await otherDevice.auth.refreshSession();
assert.ok(otherRefresh.error || !otherRefresh.data.session, "Globally signed-out session unexpectedly refreshed.");

console.log("Account security flow passed: invitation expiry/revocation -> activation -> password -> recovery -> password -> global refresh-session revocation.");
