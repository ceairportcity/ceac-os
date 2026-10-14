import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const team = read("../src/screens/Team.jsx");
const people = read("../src/components/PeopleAccess.jsx");
const sql = read("../supabase/migrations/20261014213000_141_volunteer_hr_activation_gate.sql");

test("Manager's volunteer nomination does not send an account-creating OTP", () => {
  const start = team.indexOf("async function inviteVolunteer()");
  const end = team.indexOf("function openResource(", start);
  assert.ok(start >= 0 && end > start);
  const action = team.slice(start, end);
  assert.match(action, /create_pending_invitation/);
  assert.match(action, /engagement_type: "volunteer"/);
  assert.doesNotMatch(action, /signInWithOtp/);
  assert.match(action, /HR approval/);
});

test("HR uses an attributable approval RPC before requesting volunteer activation", () => {
  const start = people.indexOf("async function approveVolunteer()");
  const end = people.indexOf("async function saveResponsibility(", start);
  assert.ok(start >= 0 && end > start);
  const action = people.slice(start, end);
  assert.match(action, /volunteer_approve_pending_invitation/);
  assert.match(action, /p_reason: reason/);
  assert.ok(action.indexOf("volunteer_approve_pending_invitation") < action.indexOf("signInWithOtp"));
  assert.match(people, /pendingVolunteerApproval/);
  assert.match(people, /HR approval required/);
});

test("server refuses new volunteer Auth accounts lacking prior HR approval", () => {
  assert.match(sql, /create or replace function public\.handle_new_user\(\)/i);
  assert.match(sql, /v_invite\.engagement_type='volunteer'/);
  assert.match(sql, /v_invite\.volunteer_approved_at is null/);
  assert.match(sql, /Volunteer account activation requires prior HR approval/);
  assert.match(sql, /where lower\(email\)=lower\(new\.email\)/);
});

test("HR approval is tenant-scoped, immutable and cannot be set by Manager update policy", () => {
  assert.match(sql, /public\.app_has_capability\('people\.manage',null\)/);
  assert.match(sql, /where id=p_invitation_id and org_id=v_org/);
  assert.match(sql, /current_setting\('ceac\.volunteer_approval_operation',true\)/);
  assert.match(sql, /An HR-approved volunteer invitation is immutable/);
  assert.match(sql, /revoke all on function public\.volunteer_approve_pending_invitation\(uuid,text\) from public,anon/);
});

test("existing signed-in volunteer records and payroll remain untouched by activation migration", () => {
  assert.doesNotMatch(sql, /delete from public\.(profiles|employee_roster|employment_records)/i);
  assert.doesNotMatch(sql, /update public\.employee_roster\s+set employment_status/i);
  assert.doesNotMatch(sql, /drop table public\./i);
});
