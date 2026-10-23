import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rolePassword = process.env.ROLE_FIXTURE_PASSWORD;
if (!url || !serviceKey || !rolePassword) throw new Error("Missing local role-fixture environment.");

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const orgId = "10000000-0000-4000-8000-000000000010";
const unitA = "20000000-0000-4000-8000-000000000011";
const unitB = "20000000-0000-4000-8000-000000000012";

// Closure hardening fixtures: Test Unit B acts as Finance so the browser suite
// can prove the real multi-stage request authority path without bypassing RLS.
const financeUnit = await service.from("units").update({ handles_finance: true }).eq("id", unitB);
assert.equal(financeUnit.error, null, financeUnit.error?.message);

const financeRules = await service.from("finance_approval_rules").upsert({
  org_id: orgId,
  currency: "GHS",
  no_request_below_minor: 0,
  admin_limit_minor: 100000,
  finance_limit_minor: 1000000,
}, { onConflict: "org_id,currency" });
assert.equal(financeRules.error, null, financeRules.error?.message);

const users = [
  { id: "31000000-0000-4000-8000-000000000001", email: "staff@ceac.local.test", name: "Staff Fixture", unit: unitA, role: "staff" },
  { id: "31000000-0000-4000-8000-000000000002", email: "manager@ceac.local.test", name: "Manager Fixture", unit: unitA, role: "manager" },
  { id: "31000000-0000-4000-8000-000000000003", email: "admin@ceac.local.test", name: "Admin Fixture", unit: unitA, role: "staff", isAdmin: true },
  { id: "31000000-0000-4000-8000-000000000004", email: "exec@ceac.local.test", name: "Executive Fixture", unit: unitA, role: "staff", isExec: true },
  { id: "31000000-0000-4000-8000-000000000005", email: "other@ceac.local.test", name: "Other Unit Fixture", unit: unitB, role: "staff" },
  { id: "31000000-0000-4000-8000-000000000006", email: "sameunit@ceac.local.test", name: "Same Unit Fixture", unit: unitA, role: "staff", employmentType: "volunteer" },
  { id: "31000000-0000-4000-8000-000000000007", email: "managerb@ceac.local.test", name: "Manager B Fixture", unit: unitB, role: "manager" },
];

for (const user of users) {
  const invite = await service.from("pending_invitations").insert({
    org_id: orgId,
    email: user.email,
    full_name: user.name,
    unit_id: user.unit,
    role: "staff",
    invited_by: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(invite.error, null, invite.error?.message);

  const created = await service.auth.admin.createUser({
    id: user.id,
    email: user.email,
    password: rolePassword,
    email_confirm: true,
  });
  assert.equal(created.error, null, created.error?.message);

  if (user.role === "manager") {
    const promoted = await service.from("unit_memberships")
      .update({ role: "manager" })
      .eq("profile_id", user.id)
      .eq("unit_id", user.unit);
    assert.equal(promoted.error, null, promoted.error?.message);
  }

  if (user.isAdmin || user.isExec) {
    const elevated = await service.from("profiles")
      .update({ is_admin: Boolean(user.isAdmin), is_exec: Boolean(user.isExec) })
      .eq("id", user.id);
    assert.equal(elevated.error, null, elevated.error?.message);
  }
}

// An explicit test office makes browser GPS evidence meaningful, rather than
// allowing the former null-location office start. This is isolated fixture data.
const officeFixture = await service.from("office_locations").insert({
  org_id: orgId, name: "Acceptance office", lat: 5.6037, lng: -0.1870,
  radius_meters: 100, is_primary: true, set_by: users[2].id,
});
assert.equal(officeFixture.error, null, officeFixture.error?.message);

// Employee-roster fixtures mirror production semantics: authentication is not
// itself proof of employment, so test employees are explicitly represented in
// the employee master and then linked to their known test accounts.
const employeeByProfile = new Map();
for (const user of users) {
  const employee = await service.from("employee_roster").insert({
    org_id: orgId,
    profile_id: user.id,
    full_name: user.name,
    source_display_name: user.name,
    source_department_text: user.unit === unitA ? "Test Unit A" : "Test Unit B",
    source_position: user.role === "manager" ? "Manager" : user.isAdmin ? "Administration" : user.isExec ? "Executive" : "Staff",
    job_title: user.role === "manager" ? "Manager" : user.isAdmin ? "Administration" : user.isExec ? "Executive" : "Staff",
    employment_type: user.employmentType || "not_recorded",
    employment_status: "active",
    identity_state: "linked",
    source_system: "role_fixture",
    source_row_key: user.id,
  }).select("id").single();
  assert.equal(employee.error, null, employee.error?.message);
  employeeByProfile.set(user.id, employee.data.id);

  const rosterMembership = await service.from("employee_unit_memberships").insert({
    org_id: orgId,
    employee_id: employee.data.id,
    unit_id: user.unit,
    is_primary: true,
    context_label: "Local acceptance fixture membership",
  });
  assert.equal(rosterMembership.error, null, rosterMembership.error?.message);
}

// A synthetic roster-only employee has NO auth user or profile. This is the
// real regression subject for HR employment/unit changes before invitation.
const rosterOnlyId = "41000000-0000-4000-8000-000000000178";
const rosterOnly = await service.from("employee_roster").insert({
  id: rosterOnlyId,
  org_id: orgId,
  profile_id: null,
  full_name: "Roster-only HR Fixture",
  job_title: "Original roster title",
  employment_type: "not_recorded",
  employment_status: "active",
  identity_state: "roster_only",
  source_system: "role_fixture",
  source_row_key: "roster-only-hr-acceptance",
  review_note: "Preserve this imported review note",
});
assert.equal(rosterOnly.error, null, rosterOnly.error?.message);
const rosterOnlyUnit = await service.from("employee_unit_memberships").insert({
  org_id: orgId, employee_id: rosterOnlyId, unit_id: unitA, is_primary: true,
  context_label: "Synthetic roster-only HR acceptance",
});
assert.equal(rosterOnlyUnit.error, null, rosterOnlyUnit.error?.message);

const employmentFixtures = [
  { id: users[0].id, manager: users[1].id, role: "staff" },
  { id: users[1].id, manager: users[2].id, role: "manager" },
  { id: users[4].id, manager: users[6].id, role: "staff" },
  { id: users[5].id, manager: users[1].id, role: "staff", employmentType: "volunteer", workingPattern: { kind: "no_attendance" } },
  { id: users[6].id, manager: users[2].id, role: "manager" },
];

for (const row of employmentFixtures) {
  const employment = await service.from("employment_records")
    .update({ manager_profile_id: row.manager, membership_role: row.role, employment_type: row.employmentType || "not_recorded", working_pattern: row.workingPattern || { kind: "not_recorded" }, updated_by: users[2].id })
    .eq("profile_id", row.id);
  assert.equal(employment.error, null, employment.error?.message);
}

const adminCapabilityKeys = [
  "authority.manage",
  "people.manage",
  "hr_private.access",
  "attendance.correct",
  "performance.admin",
  "audit.view",
  "integration.manage",
  "strategy.manage",
  "delivery.manage",
  "resource.manage",
  "learning.manage",
  "workforce.manage",
  "asset.manage",
  "compliance.manage",
  "payroll.prepare",
];
const capabilityGrants = await service.from("capability_grants").insert(
  adminCapabilityKeys.map((capability) => ({
    org_id: orgId,
    profile_id: users[2].id,
    capability,
    scope_unit_id: null,
    granted_by: users[2].id,
    grant_reason: "Local acceptance fixture authority.",
  }))
);
assert.equal(capabilityGrants.error, null, capabilityGrants.error?.message);

const executiveCapabilityGrants = await service.from("capability_grants").insert(
  ["hr_private.access", "payroll.approve"].map((capability) => ({
    org_id: orgId,
    profile_id: users[3].id,
    capability,
    scope_unit_id: null,
    granted_by: users[3].id,
    grant_reason: "Local acceptance fixture executive payroll authority.",
  }))
);
assert.equal(executiveCapabilityGrants.error, null, executiveCapabilityGrants.error?.message);

const subTeamA = "22000000-0000-4000-8000-000000000011";
const subTeam = await service.from("sub_teams").insert({
  id: subTeamA,
  org_id: orgId,
  unit_id: unitA,
  name: "Fixture Video Team",
  code: "VID",
  lead_id: users[1].id,
  position: 1,
  active: true,
});
assert.equal(subTeam.error, null, subTeam.error?.message);

const subTeamMember = await service.from("sub_team_members").insert({
  sub_team_id: subTeamA,
  profile_id: users[0].id,
});
assert.equal(subTeamMember.error, null, subTeamMember.error?.message);

const capability = await service.from("capabilities").insert({
  org_id: orgId,
  profile_id: users[1].id,
  capability: "create_project",
  granted_by: users[2].id,
});
assert.equal(capability.error, null, capability.error?.message);

const stage4Project = await service.from("projects").insert({
  id: "25000000-0000-4000-8000-000000000011",
  org_id: orgId,
  kind: "project",
  lead_unit_id: unitA,
  name: "Stage 4 Browser Project",
  purpose: "Synthetic project for Strategy browser acceptance.",
  status: "active",
  created_by: users[1].id,
});
assert.equal(stage4Project.error, null, stage4Project.error?.message);

const stage5DependencyProject = await service.from("projects").insert({
  id: "25000000-0000-4000-8000-000000000012",
  org_id: orgId,
  kind: "project",
  lead_unit_id: unitA,
  name: "Stage 5 Dependency Project",
  purpose: "Synthetic predecessor project for Delivery browser acceptance.",
  status: "active",
  created_by: users[1].id,
});
assert.equal(stage5DependencyProject.error, null, stage5DependencyProject.error?.message);

const stage5Work = await service.from("work_items").insert([
  {
    id: "26000000-0000-4000-8000-000000000011",
    org_id: orgId,
    ref: "TUA-WM5-001",
    kind: "task",
    unit_id: unitA,
    project_id: stage4Project.data?.id || "25000000-0000-4000-8000-000000000011",
    assignee_id: users[0].id,
    assigned_by: users[1].id,
    title: "Stage 5 predecessor work",
    purpose: "Synthetic dependency source.",
    origin: "assigned",
    visibility: "unit",
    confidential: false,
    status: "not_started",
  },
  {
    id: "26000000-0000-4000-8000-000000000012",
    org_id: orgId,
    ref: "TUA-WM5-002",
    kind: "task",
    unit_id: unitA,
    project_id: "25000000-0000-4000-8000-000000000011",
    assignee_id: users[5].id,
    assigned_by: users[1].id,
    title: "Stage 5 dependent work",
    purpose: "Synthetic dependency target.",
    origin: "assigned",
    visibility: "unit",
    confidential: false,
    status: "not_started",
  },
]);
assert.equal(stage5Work.error, null, stage5Work.error?.message);


// Stage 3 ministry-number fixture: configuration is created as recurring work,
// while recording goes through record_routine_occurrence().
const ministryWorkId = "26000000-0000-4000-8000-000000000013";
const ministryOperationId = "27000000-0000-4000-8000-000000000013";
const ministryWork = await service.from("work_items").insert({
  id: ministryWorkId,
  org_id: orgId,
  ref: "TUA-MIN-001",
  kind: "routine",
  unit_id: unitA,
  assignee_id: users[0].id,
  assigned_by: users[1].id,
  title: "Acceptance first timers",
  purpose: "Record the factual recurring ministry number.",
  origin: "assigned",
  visibility: "unit",
  confidential: false,
  status: "not_started",
});
assert.equal(ministryWork.error, null, ministryWork.error?.message);

const ministryOperation = await service.from("recurring_operations").insert({
  id: ministryOperationId,
  org_id: orgId,
  unit_id: unitA,
  work_item_id: ministryWorkId,
  name: "Acceptance first timers",
  cadence: "Daily",
  records_value: true,
  value_label: "People received",
  active: true,
  starts_on: "2026-01-01",
  schedule_kind: "daily",
});
assert.equal(ministryOperation.error, null, ministryOperation.error?.message);

const ministrySchedule = await service.from("routine_schedule_versions").insert({
  operation_id: ministryOperationId,
  version: 1,
  effective_from: "2026-01-01",
  schedule_kind: "daily",
  created_by: users[1].id,
});
assert.equal(ministrySchedule.error, null, ministrySchedule.error?.message);

// The Admin acceptance suite must exercise a real deterministic attention rule.
// Production organisations receive these through their setup data; the isolated
// local fixture needs its own row because org-scoped rows are not copied across.
const threshold = await service.from("thresholds").upsert({
  org_id: orgId,
  name: "work_gone_quiet",
  label: "active work has not moved for",
  value: 3,
  unit_label: "working days",
  updated_by: users[2].id,
}, { onConflict: "org_id,name" });
assert.equal(threshold.error, null, threshold.error?.message);

console.log("Role fixtures seeded.");
