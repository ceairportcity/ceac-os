import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isMissingAnnualLeaveStageSchema,
  isMissingPersonalPlanningSchema,
  isMissingVolunteerManagementSchema,
  isMissingVolunteerNoticeSchema,
} from "../src/lib/stage1SchemaCompatibility.js";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("only exact missing Stage 2 schema objects enable compatibility", () => {
  assert.equal(isMissingPersonalPlanningSchema({ code: "42P01", message: 'relation "personal_day_tasks" does not exist' }), true);
  assert.equal(isMissingAnnualLeaveStageSchema({ code: "PGRST202", message: "Could not find workforce_annual_leave_summary in the schema cache" }), true);
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
    assert.equal(isMissingVolunteerManagementSchema(error), false);
  }
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
});

test("Manager person detail remains usable when volunteer migrations are pending", () => {
  const detail = source("src/screens/PersonDetail.jsx");
  assert.match(detail, /isMissingVolunteerManagementSchema/);
  assert.match(detail, /volunteerStageReady/);
  assert.match(detail, /New working-arrangement versions and formal change recommendations are not being written/);
});
