import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = (path) => readFileSync(path, "utf8");

test("all role Overviews use one deterministic locally stored real-photography component", () => {
  const surfaces = [
    "src/experience-v2/staff-today/StaffTodayV2.jsx",
    "src/experience-v2/manager-overview/ManagerOverviewV2.jsx",
    "src/experience-v2/admin-overview/AdminOverviewV2.jsx",
    "src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx",
    "src/experience-v2/project-family/ProjectFamilyV2.jsx",
  ];
  for (const name of surfaces) {
    const source = file(name);
    assert.match(source, /import DailyScenicPhoto from/);
    assert.match(source, /<DailyScenicPhoto\s*\/>/);
    assert.match(source, /s2-landscape-hero/);
  }
  const image = file("src/components/DailyScenicPhoto.jsx");
  assert.match(image, /selectDailyLandscape/);
  assert.match(image, /ceacLandscapeCatalog/);
  assert.doesNotMatch(image, /images\.unsplash\.com|https:\/\/.*?\.jpg/);
});

test("Projects presents one connected workspace with factual people and task tables", () => {
  const source = file("src/components/Stage2ProjectOverview.jsx");
  const parent = file("src/screens/ManagerProjects.jsx");
  const styles = file("src/components/Stage2ProjectOverview.css");
  assert.match(parent, /<Stage2ProjectOverview/);
  assert.match(parent, /ProjectParticipantRegister/);
  assert.match(parent, /ManagerProjectClose/);
  assert.match(source, /project\.participants/);
  assert.match(source, /project\.work/);
  assert.match(source, /item\.profiles\?\.full_name/);
  assert.match(source, /Project team/);
  assert.match(source, /Departments involved/);
  assert.match(source, /Project tasks/);
  assert.match(source, /No recorded tasks match this view/);
  assert.match(styles, /\.s2-project-layout>\.s2-project-content\{/);
  assert.doesNotMatch(styles, /\.s2-project-layout>\.s2-project-primary\{/);
});

test("manager routine schedule is backed by authoritative records, never synthetic completion", () => {
  const work = file("src/screens/ManagerWork.jsx");
  const schedule = file("src/components/ManagerRoutineOccurrences.jsx");
  const planner = file("src/lib/organisationRoutineSchedule.js");
  assert.match(work, /ManagerRoutineOccurrences/);
  assert.match(work, /\["routines", "Routines"/);
  assert.match(schedule, /\.from\("recurring_operations"\)/);
  assert.match(schedule, /\.from\("operation_occurrences"\)/);
  assert.match(schedule, /projectedRoutineDates/);
  assert.match(planner, /unrecorded_past/);
  assert.doesNotMatch(schedule, /\.insert\(/);
});

test("Technical Support premium roles retain all real case access checks", () => {
  const support = file("src/screens/TechnicalSupport.jsx");
  const css = file("src/role-styles/technical-support-stage2.css");
  assert.match(support, /canManageSupport/);
  assert.match(support, /support_case_events/);
  assert.match(support, /SupportAccessCaseActions/);
  assert.match(support, /technical-support-stage2\.css/);
  assert.match(css, /s2-support-heading/);
  assert.match(css, /ceac-support-layout/);
  assert.match(css, /max-width:800px/);
});

test("Stage 2 does not substitute Google-only identity for existing password sign-in", () => {
  const signIn = file("src/screens/SignIn.jsx");
  const policy = file("docs/security/CEAC_STAGE2_AUTH_SESSION_POLICY_2026-10-16.md");
  assert.match(signIn, /signInWithPassword/);
  assert.match(policy, /Google-only sign-in is CANCELLED/);
  assert.match(policy, /Supabase AAL2/);
});

test("Administration project drilldown reads through existing authenticated RLS and remains read only", () => {
  const admin = file("src/screens/AdminProjects.jsx");
  const reader = file("src/components/Stage2ProjectReader.jsx");
  const app = file("src/App.jsx");
  assert.match(admin, /Stage2ProjectReader/);
  assert.match(admin, /label:"Open project"/);
  assert.match(app, /<AdminProjects me=\{me\} scheduleMeeting=\{startMeeting\} openItem=\{openItem\}/);
  assert.match(reader, /\.from\("work_items"\)/);
  assert.match(reader, /\.neq\("visibility", "private"\)/);
  assert.match(reader, /canAssign=\{false\}/);
  assert.doesNotMatch(reader, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(reader, /No private project data was displayed/);
});
