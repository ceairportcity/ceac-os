import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source = path => readFileSync(path, "utf8");

test("one Executive Projects workspace keeps creating projects and distinct delivery insights", () => {
  const nav = source("src/experience-v2/shell/navigation.js");
  const app = source("src/App.jsx");
  const workspace = source("src/screens/ExecutiveProjectsWorkspace.jsx");
  const delivery = source("src/screens/Delivery.jsx");
  assert.match(nav, /key: "exec-projects", label: "Projects"/);
  assert.doesNotMatch(nav, /key: "delivery", label: "Portfolio"/);
  assert.match(app, /tab === "exec-projects" && isExec/);
  assert.match(app, /tab === "delivery" && canUseDelivery/);
  assert.match(workspace, /<AdminProjects/);
  assert.match(workspace, /<Delivery me=\{me\} insightsOnly/);
  assert.match(workspace, /All projects/);
  assert.match(workspace, /Delivery insights/);
  assert.match(delivery, /executiveSurface&&!insightsOnly/);
  assert.match(delivery, /!insightsOnly && <div className="ev2p-delivery-layout"/);
});

test("Executive employee directory offers meaningful non-protected profile sections", () => {
  const home = source("src/screens/ExecutiveHome.jsx");
  const person = source("src/screens/ExecutiveOrganisation.jsx");
  const overview = source("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx");
  assert.match(home, /activeStaff: activeStaffIds\.size/);
  assert.match(home, /activeVolunteers: activeVolunteerIds\.size/);
  assert.match(overview, /onOpenOrganisation\?\.\("staff"\)/);
  for(const label of ["Profile","Employment & schedule","Attendance & leave","Contributions"])
    assert.ok(person.includes(label), label+" view missing");
  assert.match(person, /\.from\("work_sessions"\)/);
  assert.match(person, /\.from\("leave_requests"\)/);
  assert.match(person, /selectedActionUnitId/);
  assert.doesNotMatch(person, /hr_employee_protected_summary|hr_private\.access|service_role/);
});

test("personal achievements remain in My Hub and are reachable from Reports but not Work", () => {
  const app = source("src/App.jsx");
  const me = source("src/screens/Me.jsx");
  const reports = source("src/experience-v2/reporting-family/ReportingFamilyV2.jsx");
  assert.match(me, /title="My achievements"/);
  assert.doesNotMatch(app, /s2-achievement-entry/);
  assert.match(app, /openAchievements\("manager-reports"\)/);
  assert.match(app, /openAchievements\("exec-reports"\)/);
  assert.match(app, /openAchievements\("reporting"\)/);
  assert.match(reports, /onOpenAchievements/);
  assert.match(reports, />My achievements<\/button>/);
});

test("Executive reports separate leadership insights from quarterly submissions", () => {
  const reports = source("src/screens/ExecutiveReports.jsx");
  assert.match(reports, /workspaceView==="submissions"/);
  assert.match(reports, /workspaceView==="insights"/);
  assert.match(reports, /<ExecutiveOutcomeBrief/);
  assert.match(reports, /<ExecutiveContributionDrilldown/);
  assert.match(reports, /<ExecutiveFilingOverview/);
});

test("Ministry direction links to actual recorded projects instead of passive text", () => {
  const app = source("src/App.jsx");
  const strategy = source("src/screens/Strategy.jsx");
  assert.match(strategy, /onOpenProject\(link\.project_id\)/);
  assert.match(strategy, /Strategic priorities and delivery/);
  assert.match(app, /onOpenProject=\{isExec/);
});

test("attendance uses one summary and actionable recorded-person list", () => {
  const panel = source("src/components/WorkforceAttendancePanel.jsx");
  const map = source("src/components/AdminWorkforceToday.jsx");
  const exec = source("src/components/ExecutiveWorkforceToday.jsx");
  assert.match(panel, /data-attendance-person/);
  assert.match(panel, /recordedPlace\(person,office\)/);
  assert.doesNotMatch(panel, /workforce-attendance-metric/);
  assert.match(map, /<WorkforceStreetMap/);
  assert.doesNotMatch(exec, /onOpenPeople=\{onOpenOrganisation\}/);
});
