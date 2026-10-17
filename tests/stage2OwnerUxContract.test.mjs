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

test("project portrait inputs cannot substitute stock faces for actual staff", () => {
  const avatar = file("src/components/PersonAvatar.jsx");
  const project = file("src/components/Stage2ProjectOverview.jsx");
  assert.match(avatar, /permittedPortraitUrl/);
  assert.match(avatar, /VITE_SUPABASE_URL/);
  assert.match(avatar, /referrerPolicy="no-referrer"/);
  assert.match(avatar, /initials\(name\)/);
  assert.match(project, /<PersonAvatar/);
  assert.match(project, /photoUrls/);
  const manager = file("src/screens/ManagerProjects.jsx");
  assert.match(manager, /className="s2-project-context-disclosure"/);
  assert.match(manager, /CostSummary rows=\{detail.costs\}/);
});

test("stage 2 universal MFA is staged behind explicit cutover, Stage 1 unchanged", () => {
  const app = file("src/App.jsx");
  const gate = file("src/components/Stage2UniversalMfaGate.jsx");
  assert.match(app, /VITE_STAGE2_UNIVERSAL_AAL2/);
  assert.match(app, /Stage2UniversalMfaGate/);
  assert.match(app, /PrivilegedMfaGate/);
  assert.match(gate, /\.getClaims\(\)/);
  assert.match(gate, /decideUniversalTotpAccess/);
  assert.match(gate, /onAuthStateChange/);
  assert.match(gate, /getAuthenticatorAssuranceLevel/);
  assert.doesNotMatch(gate, /ceac_google_mfa_eligible|signInWithOAuth/);
});

test("Executive and Administration open the same authorised Projects workspace, without granting write authority", () => {
  const delivery = file("src/screens/Delivery.jsx");
  const admin = file("src/screens/AdminProjects.jsx");
  const reader = file("src/components/Stage2ProjectReader.jsx");
  const app = file("src/App.jsx");
  assert.match(delivery, /Stage2ProjectReader/);
  assert.match(delivery, /label:"Open project"/);
  assert.match(delivery, /inspectProjectId/);
  assert.match(admin, /Stage2ProjectReader/);
  assert.match(reader, /canAssign=\{false\}/);
  assert.match(reader, /\.neq\("visibility", "private"\)/);
  assert.match(app, /<Delivery me=\{me\} initialProjectId=\{projectId\} openItem=\{openItem\}/);
});

test("switching units or selected projects invalidates previous Project responses and actions", () => {
  const screen = file("src/screens/ManagerProjects.jsx");
  for (const guard of ["listRequestRef.current", "detailRequestRef.current", "proposalRequestRef.current",
    "request !== detailRequestRef.current", "listScope !== scope",
    "detail.id !== selectedId || detailScope !== scope", "proposalScope === scope ? proposals : []"]) {
    assert.ok(screen.includes(guard), "missing current-role/project guard: " + guard);
  }
  assert.doesNotMatch(screen, /\{proposals\.filter\(/);
});

test("all Manager unit-scoped panels discard previous headship state", () => {
  const app = file("src/App.jsx");
  assert.ok(app.includes('const managerScopeKey = `${me.org_id}:${me.id}:${me.unit_id || "none"}`;'));
  for (const name of ["ManagerHome", "ManagerWork", "ManagerProjects",
    "ManagerCalendar", "ManagerFinance", "ManagerReports", "Team"]) {
    assert.ok(app.includes(`<${name} key={managerScopeKey}`),
      `unit-scoped route does not remount on switching: ${name}`);
  }
  assert.ok(app.includes('<ManagerProjects key={`${me.org_id}:${me.id}:${me.unit_id || "none"}:${projectId}`}'));
});


test("P0 route and shell inventory preserves authorised role navigation, not accidental missing branches", () => {
  const app = file("src/App.jsx");
  const nav = file("src/experience-v2/shell/navigation.js");
  const navSource = nav.split("const ROLE_DESTINATIONS = Object.freeze({")[1]
    ?.split("const MOBILE_PRIMARY_KEYS")[0];
  assert.ok(navSource, "canonical role destinations must exist");
  const renderedTabs = new Set([...app.matchAll(/if\s*\(tab\s*===\s*"([^"]+)"/g)].map((match) => match[1]));
  assert.ok(renderedTabs.size >= 47, "P0 root-route inventory lost a tab branch");
  const roleMap = {};
  for (const match of navSource.matchAll(/(?:^|\n)\s*(staff|manager|admin|executive): Object\.freeze\(\[([\s\S]*?)\]\),/g)) {
    roleMap[match[1]] = [...match[2].matchAll(/key: "([^"]+)"/g)].map((entry) => entry[1]);
  }
  assert.deepEqual(Object.keys(roleMap).sort(), ["admin", "executive", "manager", "staff"]);
  for (const [role, keys] of Object.entries(roleMap)) {
    assert.ok(keys.length >= 8, role + " lost its normal navigation");
    assert.equal(new Set(keys).size, keys.length, role + " has duplicate destinations");
    for (const required of ["home", "work", "me", "account"]) {
      assert.ok(keys.includes(required), role + " missing " + required);
    }
    for (const key of keys) {
      assert.ok(key === "me" || renderedTabs.has(key),
        role + " shell points to a missing tab branch: " + key);
    }
  }
  assert.match(nav, /capabilities\.has\("support\.case\.manage"\)/);
  assert.match(app, /const canManageSupport = hasCapability\("support\.case\.manage"\)/);
  assert.match(app, /if \(tab === "technical-support"\) return canManageSupport/);
  assert.match(nav, /capability: "people\.manage"/);
  assert.match(nav, /capability: "payroll\.prepare"/);
  assert.match(nav, /capability: "payroll\.approve"/);
});
test("P0 deep-link overlay precedence and sensitive route UI boundaries are explicit", () => {
  const app = file("src/App.jsx");
  const overlayOrder = [
    "itemId ? <Item",
    ": assigning ? <Assign",
    ": projectId && isUnitManager ? <ManagerProjects",
    ": goalId ? <Goals",
    ": person && isManager ? <PersonDetail",
    ": roomContext ? <Room",
    ": meetingDraft ? <MeetingScheduler",
    ": meetingId ? <Meeting",
    ": pageForTab()",
  ];
  let previous = -1;
  for (const branch of overlayOrder) {
    const position = app.indexOf(branch, previous + 1);
    assert.ok(position > previous, "deep-link priority changed or lost: " + branch);
    previous = position;
  }

  // Query strings are navigation inputs, never a security role or grant.
  for (const key of ["tab", "item", "project", "meeting", "roomKind", "room"]) {
    assert.ok(app.includes('params.get("' + key + '")'),
      "missing audited deep-link query field: " + key);
  }
  for (const kind of ["unit", "sub_team", "project"]) {
    assert.ok(app.includes('roomKind === "' + kind + '"'),
      "room kind must remain explicitly enumerated: " + kind);
  }
  assert.match(app, /if \(authPath === "\/activate" \|\| authPath === "\/reset-password"\)/);
  assert.match(app, /if \(tab === "technical-support"\) return canManageSupport/);
  assert.match(app, /if \(tab === "protected-hr" && canAccessProtectedHR\)/);
  assert.match(app, /if \(tab === "payroll" && canUsePayroll\)/);
  assert.match(app, /if \(tab === "people" && canManagePeople\)/);
  assert.match(app, /if \(tab === "manager-reports" && isUnitManager\)/);
  assert.match(app, /if \(tab === "exec-reports" && isExec\)/);
  assert.match(app, /if \(tab === "integrations" && canManageIntegrations\)/);
  assert.match(app, /if \(tab === "authority" && canManageAuthority\)/);
  assert.match(app, /if \(tab === "attendance" && canUseWorkforce\)/);
  assert.match(app, /<ActiveMfaGate me=\{me\} onVerified=\{boot\}>/);
  assert.match(app, /VITE_STAGE2_UNIVERSAL_AAL2 === "true"/);
});
