import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error("Missing local Supabase credentials.");
}

const orgId = "10000000-0000-4000-8000-000000000001";
const unitId = "20000000-0000-4000-8000-000000000001";
const managerEmail = "manager@ceac.local.test";
const employeeEmail = "rpc.employee@ceac.local.test";

function client(key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const service = client(serviceKey);
const manager = client(anonKey);

const managerLink = await service.auth.admin.generateLink({
  type: "magiclink",
  email: managerEmail,
});
assert.equal(managerLink.error, null, managerLink.error?.message);
assert.ok(managerLink.data?.properties?.hashed_token, "Manager verification token was not generated.");

const managerSession = await manager.auth.verifyOtp({
  token_hash: managerLink.data.properties.hashed_token,
  type: "magiclink",
});
assert.equal(managerSession.error, null, managerSession.error?.message);
assert.ok(managerSession.data.session, "Manager session was not established.");

const invitation = await manager.rpc("create_pending_invitation", {
  p_email: employeeEmail,
  p_full_name: "RPC Employee",
  p_unit_id: unitId,
  p_role: "staff",
});
assert.equal(invitation.error, null, invitation.error?.message);
assert.equal(invitation.data?.org_id, orgId);
assert.equal(invitation.data?.email, employeeEmail);
assert.equal(invitation.data?.unit_id, unitId);
assert.equal(invitation.data?.role, "staff");
assert.equal(invitation.data?.revoked_at, null);

const created = await service.auth.admin.createUser({
  email: employeeEmail,
  email_confirm: false,
});
assert.equal(created.error, null, created.error?.message);
assert.ok(created.data.user, "Invited Auth user was not created.");

const pendingProfile = await service
  .from("profiles")
  .select("id,org_id,email,active")
  .eq("id", created.data.user.id)
  .single();
assert.equal(pendingProfile.error, null, pendingProfile.error?.message);
assert.equal(pendingProfile.data.org_id, orgId);
assert.equal(pendingProfile.data.email, employeeEmail);

const employeeLink = await service.auth.admin.generateLink({
  type: "magiclink",
  email: employeeEmail,
});
assert.equal(employeeLink.error, null, employeeLink.error?.message);
assert.ok(employeeLink.data?.properties?.hashed_token, "Employee activation token was not generated.");

const employee = client(anonKey);
const employeeSession = await employee.auth.verifyOtp({
  token_hash: employeeLink.data.properties.hashed_token,
  type: "magiclink",
});
assert.equal(employeeSession.error, null, employeeSession.error?.message);
assert.ok(employeeSession.data.session, "Employee activation session was not established.");

const orgAuthority = await employee.rpc("app_org_id");
assert.equal(orgAuthority.error, null, orgAuthority.error?.message);
assert.equal(orgAuthority.data, orgId, "Confirmed invited employee did not receive CEAC organisation bootstrap.");

const membership = await employee
  .from("unit_memberships")
  .select("unit_id,role")
  .eq("profile_id", created.data.user.id)
  .single();
assert.equal(membership.error, null, membership.error?.message);
assert.equal(membership.data.unit_id, unitId);
assert.equal(membership.data.role, "staff");

await employee.auth.signOut({ scope: "local" });
await manager.auth.signOut({ scope: "local" });

console.log("Real CEAC invitation RPC acceptance passed: People authority -> Staff invite -> activation -> organisation/unit bootstrap.");
