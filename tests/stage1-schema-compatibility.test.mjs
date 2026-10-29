import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isMissingAttendanceEvidenceStageSchema,
  isMissingAnnualLeaveStageSchema,
  isMissingPersonalPlanningSchema,
  isMissingTechnicalSupportStageSchema,
  isMissingVolunteerManagementSchema,
  isMissingVolunteerNoticeSchema,
  isMissingVolunteerInvitationSchema,
} from "../src/lib/stage1SchemaCompatibility.js";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("only exact missing Stage 2 schema objects enable compatibility", () => {
  assert.equal(isMissingPersonalPlanningSchema({ code: "42P01", message: 'relation "personal_day_tasks" does not exist' }), true);
  assert.equal(isMissingAnnualLeaveStageSchema({ code: "PGRST202", message: "Could not find workforce_annual_leave_summary in the schema cache" }), true);
  assert.equal(isMissingAttendanceEvidenceStageSchema({ code: "42883", message: "function attendance_corroboration_for_day(date) does not exist" }), true);
  assert.equal(isMissingTechnicalSupportStageSchema({ code: "42P01", message: 'relation "support_access_requests" does not exist' }), true);
  assert.equal(isMissingVolunteerNoticeSchema({ code: "PGRST205", message: "Could not find public.volunteer_engagement_notices" }), true);
  assert.equal(isMissingVolunteerManagementSchema({ code: "42P01", message: 'relation "volunteer_change_recommendations" does not exist' }), true);
});

test("permission, network and unrelated database failures never enable compatibility", () => {
  for (const error of [
    { code: "42501", message: "permission denied" },
    { message: "Failed to fetch" },
    { code: "42P01", message: 'relation "employee_compensation" does not exist' },
  ]) {
    assert.equal(isMissingPersonalPlanningSchema(error), false);
    assert.equal(isMissingAnnualLeaveStageSchema(error), false);
    assert.equal(isMissingAttendanceEvidenceStageSchema(error), false);
    assert.equal(isMissingTechnicalSupportStageSchema(error), false);
    assert.equal(isMissingVolunteerManagementSchema(error), false);
    assert.equal(isMissingVolunteerInvitationSchema(error), false);
  }
});

test("Manager Team preserves existing Staff when only volunteer invitation columns are pending", () => {
  assert.equal(isMissingVolunteerInvitationSchema({ code: "42703", message: "column pending_invitations.engagement_type does not exist" }), true);
  assert.equal(isMissingVolunteerInvitationSchema({ code: "42703", message: "column pending_invitations.engagement_working_pattern does not exist" }), true);
  assert.equal(isMissingVolunteerInvitationSchema({ code: "42703", message: "column pending_invitations.expires_at does not exist" }), false);

  const team = source("src/screens/Team.jsx");
  assert.match(team, /loadPendingInvitations\(me\.unit_id\)/);
  assert.match(team, /select\("email, full_name, invited_at"\)/);
  assert.match(team, /volunteerFieldsReady: false/);
  assert.equal((team.match(/disabled=\{!volunteerInvitationsReady\}/g) || []).length, 2);
  assert.match(team, /Existing Staff, team membership and pending Staff invitations remain available/);
});

test("Workforce keeps existing attendance evidence when Stage 2 corroboration is pending", () => {
  const evidence = source("src/components/AttendanceEvidence.jsx");
  assert.match(evidence, /isMissingAttendanceEvidenceStageSchema/);
  assert.match(evidence, /Existing attendance evidence and notices remain available/);
  assert.match(evidence, /optionalErrors\.length&&!pendingOnly/);
});

test("Manager and Administration homes label pending Support approvals without hiding other work", () => {
  const approvals = source("src/components/SupportAccessApprovals.jsx");
  assert.match(approvals, /isMissingTechnicalSupportStageSchema/);
  assert.match(approvals, /Existing Manager and Administration work remains available/);
  assert.match(approvals, /!stagePending && !loading && !visible\.length/);
});

test("People Administration cannot begin Support membership changes while Stage 1 schema is unavailable", () => {
  const memberships = source("src/components/SupportTeamMemberships.jsx");
  assert.match(memberships, /const unavailable = !loading && !verifiedLoad/);
  assert.equal((memberships.match(/disabled=\{busy \|\| loading \|\| unavailable\}/g) || []).length, 4);
  assert.match(memberships, /!loading && verifiedLoad && <p className="screen-note">No active Support memberships/);
  assert.match(memberships, /!loading && verifiedLoad && <p className="screen-note">No recorded membership transitions/);
});

test("Technical Help cannot accept a request draft while its Stage 1 service is unavailable", () => {
  const help = source("src/screens/TechnicalHelp.jsx");
  assert.match(help, /const requestUnavailable = scopedLoading \|\| Boolean\(loadError\)/);
  assert.equal((help.match(/disabled=\{requestUnavailable \|\| busy\}/g) || []).length, 6);
  assert.match(help, /disabled=\{busy \|\| requestUnavailable\}/);
});

test("Calendar keeps shared commitments and visibly defers only private planning", () => {
  const calendar = source("src/screens/StaffCalendar.jsx");
  assert.match(calendar, /isMissingPersonalPlanningSchema/);
  assert.match(calendar, /Shared calendar commitments remain available/);
  assert.match(calendar, /composer&&personalPlanningReady/);
});

test("My Hub and Workforce fall back to existing leave rows without inventing balances", () => {
  const me = source("src/screens/Me.jsx");
  const workforce = source("src/screens/Workforce.jsx");
  assert.match(me, /select\("id, kind, start_date, end_date, days, status, requested_at"\)/);
  assert.match(workforce, /select\("id,profile_id,kind,start_date,end_date,days,status,reason,requested_at/);
  assert.match(me, /CEAC OS will not invent a working-day balance/);
  assert.match(workforce, /CEAC OS will not invent working-day calculations/);
  assert.match(workforce, /for\(const row of Object\.values\(byName\)\)/);
  assert.doesNotMatch(workforce, /for\(const row of results\)\{\s*if\(row\.error\) errors/);
});

test("Manager person detail remains usable when volunteer migrations are pending", () => {
  const detail = source("src/screens/PersonDetail.jsx");
  assert.match(detail, /isMissingVolunteerManagementSchema/);
  assert.match(detail, /volunteerStageReady/);
  assert.match(detail, /New working-arrangement versions and formal change recommendations are not being written/);
});
