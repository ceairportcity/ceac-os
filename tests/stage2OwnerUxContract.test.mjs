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

test("P0 route census continuously matches JSX branches, actual screens and direct backend scope", () => {
  const app = file("src/App.jsx");
  const census = file("docs/continuity/CEAC_STAGE2_P0_ROUTE_DATA_AUTHORITY_CENSUS_2026-10-17.md");
  const matrix = Object.freeze({
  "guide": [
    "Guide"
  ],
  "account": [
    "AccountActivity"
  ],
  "achievements": [
    "PersonalAchievements"
  ],
  "technical-help": [
    "TechnicalHelp"
  ],
  "technical-support": [
    "TechnicalSupport"
  ],
  "primitives": [
    "DesignPrimitives"
  ],
  "home": [
    "Home",
    "ManagerHome",
    "AdminHome",
    "ExecutiveHome"
  ],
  "team": [
    "Team",
    "StaffTeam"
  ],
  "work": [
    "Work",
    "ManagerWork",
    "AdminWork",
    "ExecutiveWork"
  ],
  "staff-calendar": [
    "StaffCalendar"
  ],
  "messages": [
    "Inbox"
  ],
  "projects": [
    "ManagerProjects"
  ],
  "calendar": [
    "ManagerCalendar"
  ],
  "manager-finance": [
    "ManagerFinance"
  ],
  "manager-reports": [
    "ManagerReports"
  ],
  "exec-organisation": [
    "ExecutiveOrganisation"
  ],
  "exec-finance": [
    "ExecutiveFinance"
  ],
  "exec-reports": [
    "ExecutiveReports"
  ],
  "record": [
    "Record"
  ],
  "announcements": [
    "Announcements"
  ],
  "strategy": [
    "Strategy"
  ],
  "delivery": [
    "Delivery"
  ],
  "workload": [
    "ResourceWorkload"
  ],
  "performance": [
    "Performance"
  ],
  "learning": [
    "Learning"
  ],
  "assets": [
    "Assets"
  ],
  "compliance": [
    "Compliance"
  ],
  "cost": [
    "Cost"
  ],
  "finance": [
    "Finance"
  ],
  "reporting": [
    "Reports"
  ],
  "attendance": [
    "Workforce"
  ],
  "people": [
    "People"
  ],
  "lifecycle": [
    "AdminLifecycle"
  ],
  "protected-hr": [
    "AdminProtectedHR"
  ],
  "payroll": [
    "AdminPayroll"
  ],
  "units": [
    "Units"
  ],
  "admin-projects": [
    "AdminProjects"
  ],
  "admin-calendar": [
    "AdminCalendar"
  ],
  "exec-calendar": [
    "AdminCalendar"
  ],
  "audit": [
    "AdminAudit"
  ],
  "events": [
    "AdminEvents"
  ],
  "workflows": [
    "AdminWorkflows"
  ],
  "policies": [
    "AdminPolicies"
  ],
  "integrations": [
    "AdminIntegrations"
  ],
  "authority": [
    "AdminAuthority"
  ],
  "settings": [
    "ControlCenter"
  ],
  "office-settings": [
    "OfficeSettings"
  ]
});
  const start = app.indexOf("function pageForTab() {");
  const end = app.indexOf("const appModeClass", start);
  assert.ok(start >= 0 && end > start, "route dispatch no longer has its audited bounds");
  const dispatch = app.slice(start, end);
  const branchMatches = [...dispatch.matchAll(/if\s*\(tab === "([^"]+)"(?:\s*&&\s*([^)]+))?\)/g)];
  assert.equal(branchMatches.length, 47);
  const actualKeys = branchMatches.map((m) => m[1]);
  assert.equal(new Set(actualKeys).size, 47);
  assert.deepEqual(actualKeys.slice().sort(), Object.keys(matrix).sort());

  const lazyModules = new Map(
    [...app.matchAll(/const ([A-Z][A-Za-z0-9]*) = lazy\(\(\) => import\("\.\/screens\/([^"]+)"\)\);/g)]
      .map((m) => [m[1], m[2]]),
  );
  const byRoute = {};
  for (let i = 0; i < branchMatches.length; i++) {
    const route = branchMatches[i][1];
    const section = dispatch.slice(branchMatches[i].index, branchMatches[i + 1]?.index || dispatch.length);
    assert.ok(census.includes("| " + String.fromCharCode(96) + route + String.fromCharCode(96) + " |"),
      "P0 census missing explicit root route " + route);
    byRoute[route] = [];
    for (const component of matrix[route]) {
      const moduleName = lazyModules.get(component);
      assert.ok(moduleName, "P0 route " + route + " has no lazy-loaded screen " + component);
      assert.ok(section.includes("<" + component), "P0 route " + route + " no longer mounts " + component);
      const source = file("src/screens/" + moduleName + ".jsx");
      byRoute[route].push(source);
    }
  }
  assert.ok(byRoute.work.some((s) => /\.from\("work_items"\)/.test(s)));
  assert.ok(byRoute.projects.some((s) => /\.from\("projects"\)/.test(s)));
  assert.ok(byRoute["manager-reports"].some((s) => /\.from\("work_sessions"\)/.test(s)));
  assert.ok(byRoute["technical-support"].some((s) => /support_case_events/.test(s)));
  assert.ok(byRoute["protected-hr"].some((s) => /hr_employee_protected_record/.test(s)));
  assert.ok(census.includes("| " + String.fromCharCode(96) + "me" + String.fromCharCode(96) + " (fallback) |"));
});
test("P0 executable census captures all mapped screen and direct data sources without claiming RLS acceptance", async () => {
  const { collectP0SourceInventory } = await import("../scripts/stage2/p0-source-inventory.mjs");
  const audit = collectP0SourceInventory();
  assert.equal(audit.status, "SOURCE_INVENTORY_ONLY");
  assert.equal(audit.routeCount, 47);
  assert.deepEqual(audit.roleNavigationCounts, { staff: 8, manager: 11, admin: 12, executive: 12 });
  assert.equal(audit.overlays.length, 9);
  assert.ok(audit.routes.every((r) => r.components.length > 0
    && r.components.every((c) => c.path.startsWith("src/screens/"))));
  const byTab = Object.fromEntries(audit.routes.map((route) => [route.tab, route]));
  assert.deepEqual(byTab.home.components.map((c) => c.component),
    ["Home", "ManagerHome", "AdminHome", "ExecutiveHome"]);
  assert.deepEqual(byTab.work.components.map((c) => c.component),
    ["Work", "ManagerWork", "AdminWork", "ExecutiveWork"]);
  assert.ok(byTab.work.components.some((c) => c.directTables.includes("work_items")));
  assert.ok(byTab["manager-reports"].components.some((c) => c.directTables.includes("work_sessions")));
  assert.ok(byTab["protected-hr"].rootGuard.includes("canAccessProtectedHR"));
  assert.ok(byTab["payroll"].rootGuard.includes("canUsePayroll"));
  assert.ok(byTab["technical-support"].components.some((c) => c.directTables.includes("support_case_events")));
});

test("P0 nested overlays trace the exact eight source modules and their direct data authority", async () => {
  const { collectP0SourceInventory } = await import("../scripts/stage2/p0-source-inventory.mjs");
  const { overlays } = collectP0SourceInventory();
  assert.deepEqual(overlays.map(({ name }) => name), [
    "item", "assign", "manager-project", "personal-goal", "manager-person",
    "room", "meeting-draft", "meeting", "fallback",
  ]);
  const active = overlays.filter((entry) => entry.name !== "fallback");
  assert.equal(active.length, 8);
  for (const overlay of active) {
    assert.match(overlay.path, /^src\/(?:screens|components)\/[A-Za-z0-9]+\.jsx$/);
    assert.ok(typeof overlay.directWriteCall === "boolean");
    assert.equal(overlay.proof.startsWith("SOURCE_ONLY"), true);
    assert.ok(Array.isArray(overlay.directRpcs) && Array.isArray(overlay.directTables));
  }
  const byName = Object.fromEntries(active.map((row) => [row.name, row]));
  assert.equal(byName["meeting-draft"].path, "src/components/MeetingScheduler.jsx");
  assert.ok(byName["meeting-draft"].directRpcs.includes("schedule_meeting"));
  assert.ok(byName.item.directTables.includes("work_items"));
  assert.ok(byName.item.directRpcs.includes("approve_work_submission"));
  assert.ok(byName.room.directRpcs.includes("send_room_message"));
  assert.ok(byName["manager-person"].directTables.includes("employment_records"));
  assert.ok(byName["personal-goal"].directTables.includes("personal_goals"));
  assert.ok(byName.meeting.directTables.includes("meeting_private_notes"));
});
