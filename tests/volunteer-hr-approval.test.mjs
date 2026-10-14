import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const text = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sql = text("supabase/migrations/20261014213500_141_volunteer_hr_activation_gate.sql");
const team = text("src/screens/Team.jsx");
const people = text("src/components/PeopleAccess.jsx");
const hr = text("src/components/VolunteerActivationApprovals.jsx");

test("Manager requests a volunteer without issuing activation OTP prematurely", () => {
  const first = team.indexOf("async function inviteVolunteer()");
  const last = team.indexOf("function openResource(", first);
  assert.ok(first >= 0 && last > first);
  const flow = team.slice(first, last);
  assert.match(flow, /supabase\.rpc\("volunteer_request_invitation"/);
  assert.match(flow, /p_working_pattern: pattern/);
  assert.match(flow, /No activation email was sent yet/);
  assert.doesNotMatch(flow, /signInWithOtp|pending_invitations"\)\s*\.update/);
});

test("atomic volunteer request preserves existing manager-unit and duplicate-email checks", () => {
  assert.match(sql, /public\.volunteer_request_invitation\(/);
  assert.match(sql, /public\.create_pending_invitation\(p_email,p_full_name,p_unit_id,'staff'\)/);
  assert.match(sql, /engagement_type='volunteer'/);
  assert.match(sql, /engagement_working_pattern=p_working_pattern/);
  assert.match(sql, /revoke all on function public\.volunteer_request_invitation/);
});

test("only HR/Administration with People authority may approve current volunteer invitation", () => {
  assert.match(sql, /not public\.app_is_admin\(\)/);
  assert.match(sql, /not public\.app_has_capability\('people\.manage',null\)/);
  assert.match(sql, /a\.invited_at=v_invite\.invited_at/);
  assert.match(sql, /a\.approved_unit_id=v_invite\.unit_id/);
  assert.match(sql, /a\.approved_pattern=v_invite\.engagement_working_pattern/);
  assert.match(sql, /HR approval is required before volunteer activation/);
  assert.match(sql, /volunteer_invitation_approval_version_unique/);
  assert.match(sql, /volunteer_approved_invitation_guard/);
  assert.doesNotMatch(sql, /grant (insert|update|delete) on public\.volunteer_invitation_approvals to authenticated/i);
});

test("HR sends activation only after a confirmed approval; delivery is not misrepresented", () => {
  assert.match(people, /<VolunteerActivationApprovals me=\{me\} \/>/);
  const approval = hr.indexOf('supabase.rpc("volunteer_approve_invitation"');
  const otp = hr.indexOf("supabase.auth.signInWithOtp(");
  assert.ok(approval >= 0 && otp > approval);
  assert.match(hr, /shouldCreateUser:true/);
  assert.match(hr, /actual delivery and account verification remain unconfirmed/);
  assert.match(hr, /approvedForCurrentVersion/);
});
