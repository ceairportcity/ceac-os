import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

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
  const planner = file("supabase/migrations/20261020120556_168_organisational_schedule_options.sql");
  const reader = file("src/lib/readRoutineSchedulePreview.js");
  assert.match(work, /ManagerRoutineOccurrences/);
  assert.match(work, /\["routines", "Routines"/);
  assert.match(schedule, /\.from\("recurring_operations"\)/);
  assert.match(schedule, /readRoutineSchedulePreview/);
  assert.match(reader, /rpc\("routine_schedule_preview"/);
  assert.match(planner, /public\.operation_occurrences/);
  assert.match(planner, /security invoker set search_path=''/);
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

test("Executive and Administration share authorised Projects; assignment actions require Executive authority", () => {
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
  assert.match(app, /<Delivery key=\{`\$\{me.org_id\}:\$\{me.id\}`\} me=\{me\} initialProjectId=\{projectId\} openItem=\{openItem\}/);
  assert.match(reader, /me\?\.is_exec && \["planned","active"\]\.includes\(project.status\)/);
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

test("P1 connected V4 role demo stays synthetic, responsive and mechanically interactive", async () => {
  const { Script, runInNewContext } = await import("node:vm");
  const html = file("docs/design/stage2-v4/CEAC_STAGE2_P1_CONNECTED_ROLE_REVIEW.html");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "standalone P1 preview lost its interactive source");
  new Script(script, { filename: "p1-connected-role-review.inline.js" });
  for (const visualToken of ["--bg:#f5f8fc", "--surface:#fff", "--nav:#fff",
    "--ink:#122440", "--blue:#1368ed", "--line:#e7edf4", "@media(max-width:520px)"]) {
    assert.ok(html.includes(visualToken), "approved V4 token or mobile rule missing: " + visualToken);
  }
  for (const role of ["staff", "manager", "support", "admin", "executive", "volunteer"]) {
    assert.ok(html.includes('<option value="' + role + '">'), "role preview missing: " + role);
  }
  assert.match(html, /Owner review candidate, NOT application acceptance/);
  assert.match(html, /No actual changes will be saved/);
  assert.doesNotMatch(html, /<script[^>]+src=|XMLHttpRequest|fetch\(|WebSocket\(/);
  const events = {};
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: "staff", innerHTML: "", textContent: "",
      addEventListener: (type, fn) => { events[id + ":" + type] = fn; },
    });
    return elements.get(id);
  };
  const document = {
    getElementById: get, querySelector: () => null,
    addEventListener: (type, fn) => { events["document:" + type] = fn; },
  };
  runInNewContext(script, { document, window: { scrollTo() {} } }, { timeout: 2000 });
  assert.match(get("navigation").innerHTML, /My work/);
  assert.match(get("screen").innerHTML, /My work session/);
  const switchRole = (role) => {
    get("role").value = role;
    events["role:change"]({ target: get("role") });
  };
  switchRole("admin");
  assert.match(get("navigation").innerHTML, /Protected HR/);
  assert.match(get("screen").innerHTML, /Administration overview/);
  switchRole("executive");
  assert.match(get("navigation").innerHTML, /Strategy &amp; outcomes|Strategy & outcomes/);
  assert.doesNotMatch(get("navigation").innerHTML, /Protected HR/);
  switchRole("volunteer");
  assert.match(get("screen").innerHTML, /without employment attendance/);
  assert.doesNotMatch(get("navigation").innerHTML, /Payroll/);
  switchRole("manager");
  events["document:click"]({ target: {
    closest: () => ({ dataset: { page: "work" } }),
  } });
  assert.match(get("screen").innerHTML, /Give out work/);
  events["document:click"]({ target: {
    closest: () => ({ dataset: { action: "give-work" } }),
  } });
  assert.match(get("modal").innerHTML, /Give out work/);
  assert.match(get("modal").innerHTML, /No actual changes will be saved/);
  events["document:click"]({ target: { closest: () => ({ dataset: { action: "close" } }) } });
  assert.equal(get("modal").innerHTML, "");
});

test("Stage 2 visual source authority is verified and withdrawn graphics cannot return as approved fixtures", () => {
  const approval = JSON.parse(file("docs/design/stage2-v4/CEAC_STAGE2_OWNER_SELECTED_SCREEN_PROVENANCE_2026-10-17.json"));
  const refs = approval.references;
  assert.equal(refs.work_desktop.original_sha256, "c84f9ab01a43be444ac7e2364555a0bfe3cbf63dd3117c6d9001fda94192406b");
  assert.equal(refs.work_mobile.original_sha256, "e53d92014cf2f4852402730db95f6dcf2772c095bdd9917ffc72f861d1408555");
  assert.equal(refs.overview_scenic.original_sha256, "315c6260aa7994e339841b4ca26e78004b041a294209b197c016b9f55c13324e");
  assert.equal(refs.overview_scenic.approval_scope, "design_direction_not_full_p1_signoff");
  assert.equal(refs.projects_revised.original_sha256, "66918f3e3d35fe7a6adf36a85eb90b14c0f719fc8f88fed378d538a47518a559");
  assert.equal(refs.projects_revised.original_binary_verified_in_repo, false);
  for (const retired of approval.retired_active_paths) {
    assert.equal(existsSync(retired), false, "Owner-rejected or superseded bitmap must not exist at HEAD: " + retired);
  }
  const candidate = file("docs/design/stage2-v4/CEAC_STAGE2_V4_CANONICAL_INTERACTIVE.html");
  assert.match(candidate, /Owner rejected this Overview design/);
  assert.match(candidate, /Projects visual was superseded by the product owner/);
  assert.match(candidate, /#page-overview > :not\(\.withdrawn-overview\)\{display:none !important;\}/);
  assert.match(candidate, /#page-projects > :not\(\.owner-withdrawn-projects\)\{display:none !important;\}/);
  const correction = file("docs/design/CEAC_STAGE2_VISUAL_REFERENCE_CORRECTION_2026-10-17.md");
  for (const hash of [refs.work_desktop.original_sha256, refs.work_mobile.original_sha256, refs.overview_scenic.original_sha256, refs.projects_revised.original_sha256]) {
    assert.ok(correction.includes(hash), "Owner visual register must retain identity: " + hash);
  }
  for (const path of [
    "AGENTS.md",
    "docs/final-product/PRODUCT_OWNER_DECISIONS.md",
    "docs/design/CEAC_STAGE2_V4_VISUAL_PRODUCT_LOCK_2026-10-16.md",
    "docs/design/CEAC_STAGE2_P1_FINITE_FAMILY_REVIEW_2026-10-17.md",
    "docs/design/CEAC_STAGE2_P1_ROUTE_REFERENCE_COVERAGE_MATRIX_2026-10-17.md",
    "docs/continuity/CEAC_STAGE2_UNIFIED_EXECUTION_CONTRACT_2026-10-16.md"
  ]) {
    assert.match(file(path), /CEAC_STAGE2_VISUAL_REFERENCE_CORRECTION_2026-10-17\.md/, "Critical first-read contract must link current source authority: " + path);
  }
});

test("P4 personal work creation blocks duplicate clicks and verifies the actual owned row", () => {
  const work = file("src/screens/Work.jsx");
  assert.match(work, /const ownCreatePending = useRef\(false\)/);
  assert.match(work, /if \(busy \|\| ownCreatePending\.current\) return/);
  assert.match(work, /ownCreatePending\.current = true/);
  assert.match(work, /ownCreatePending\.current = false/);
  assert.match(work, /typeof created\?\.ref !== "string"/);
  assert.match(work, /\.eq\("ref", created\.ref\)\.eq\("org_id", me\.org_id\)/);
  assert.match(work, /\.eq\("assignee_id", me\.id\)\.maybeSingle\(\)/);
  assert.match(work, /confirmation\.data\.origin !== "self_created"/);
  assert.match(work, /confirmation\.data\.visibility !== createVisibility/);
  assert.match(work, /Check your work list before creating another task/);
});

test("P5 project-close history requires a current actor-owned verified read", () => {
  const project = file("src/screens/ManagerProjectClose.jsx");
  assert.match(project, /const projectScope = \[project\.id, me\.org_id, me\.id, me\.unit_id\]\.join\(":"\)/);
  assert.match(project, /currentProjectScope\.current !== requestedScope/);
  assert.match(project, /const closeReadSequence = useRef\(0\)/);
  assert.match(project, /const requestedRead = \+\+closeReadSequence\.current/);
  assert.match(project, /closeReadSequence\.current === requestedRead/);
  assert.match(project, /if \(!stillCurrent\(\)\) return false/);
  assert.match(project, /const closeEvidenceVerified = verifiedScope === projectScope && !evidenceLoading/);
  assert.match(project, /if \(closeResult\.error \|\| reopenResult\.error \|\| !Array\.isArray\(reopenResult\.data\)\)/);
  assert.match(project, /if \(readyResult\.error\) throw readyResult\.error/);
  assert.match(project, /if \(!closeEvidenceVerified\) return/);
  assert.match(project, /Retry project-close verification/);
  assert.match(project, /setCloses\(\[\]\); setReadiness\(\[\]\); setLastReopenedAt\(null\)/);
});

test("P5 project close history cannot hide truncated submitted versions", () => {
 const project = file("src/screens/ManagerProjectClose.jsx");
 assert.match(project,/\.select\("id,scope,unit_id,version,status,deliverables_note,challenges,do_differently,submitted_at", \{ count: "exact" \}\)/);
 assert.match(project,/closeResult\.count !== \(closeResult\.data \|\| \[\]\)\.length/);
 assert.match(project,/Project close history was truncated/);
});

test("P5 versioned project close, reopen and unit returns cannot double-dispatch", () => {
  const project = file("src/screens/ManagerProjectClose.jsx");
  assert.match(project, /const closeMutationPending = useRef\(false\)/);
  for (const method of ["submitClose", "closeProject", "reopenProject"]) {
    const body = project.match(new RegExp("async function " + method + "\\(\\) \\{([\\s\\S]*?)\\n  \\}"))?.[1];
    assert.ok(body, method + " must be present");
    assert.match(body, /if \(busy \|\| closeMutationPending\.current\) return/);
    assert.match(body, /closeMutationPending\.current = true/);
    assert.match(body, /closeMutationPending\.current = false/);
  }
  assert.doesNotMatch(project, /No partial close was saved/,
    "Network ambiguity must not be misrepresented as a guaranteed rollback");
});

test("P7 approved Executive R4 laptop shell dimensions stay role-scoped", () => {
 const shared = file("src/experience-v2/shell/shell.css");
 const executive = file("src/role-styles/executive-redesign.css");
 const geometry = file("src/role-styles/executive-r4-geometry.css");
 const home = file("src/experience-v2/executive-overview/executive-overview.css");
 const refs = file("tests/visual-home-baselines.js");
 assert.match(shared,/--ev2s-sidebar-width: 13\.75rem/);
 assert.match(geometry,/@media \(min-width: 1025px\) \{\s*\.executive-app \{/);
 assert.doesNotMatch(geometry,/--ev2s-sidebar-width:/, "R4 must inherit the approved 220px desktop sidebar, not shift it to 210px");
 assert.match(geometry,/--ev2s-topbar-height: 3\.375rem/);
 assert.match(geometry,/\.executive-app \.executivev2-hero\.s2-landscape-hero \{ min-height: 136px/);
 assert.match(geometry,/\.executive-app \.executivev2 > \.s2-own-work-session/);
 assert.doesNotMatch(home,/\.(staff-app|manager-app|office-app|executive-app)\b/);
 assert.match(refs,/Visual regression threshold <=6 stays strictly unchanged/);
});


test("P7 retired legacy navigation CSS is not emitted after the unified V2 shell migration",()=>{
 const app=file("src/App.jsx");
 const shell=file("src/experience-v2/shell/ShellV2.jsx");
 assert.match(app,/<SideNav/);
 assert.match(shell,/className="ev2s-sidebar"/);
 assert.match(shell,/className="ev2s-topbar"/);
 const legacy=/(?<![\w-])\.(side|mobile-topbar|bottom-nav|desktop-topbar|app-workspace|mobile-unit-switch|mobile-more-item)(?![\w-])/;
 for(const path of ["src/styles.css","src/premium-parity.css"]){
   const css=file(path);
   for(const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
     const selector=rule[1].replace(/\/\*[\s\S]*?\*\//g,"").trim();
     const parts=selector.split(",").map(x=>x.trim()).filter(Boolean);
     assert.ok(!parts.length || selector.startsWith("@") || /:not\(|:where\(|:has\(/.test(selector) || !parts.every(x=>legacy.test(x)),
       "Dead standalone pre-V2 navigation style in "+path+": "+selector.slice(0,120));
   }
 }
});


test("P7 removes obsolete Home CSS without deleting the surviving Ministry, Announcements and V2 Manager surfaces",()=>{
 const css=file("src/styles.css");
 const staff=file("src/experience-v2/staff-today/StaffTodayV2.jsx");
 const manager=file("src/experience-v2/manager-overview/ManagerOverviewV2.jsx");
 const ministry=file("src/components/MinistryNumbers.jsx");
 const announcements=file("src/screens/Announcements.jsx");
 assert.doesNotMatch(css,/\.staff-app \.staff-home-dashboard\s*>/);
 assert.doesNotMatch(css,/\.staff-app \.home-panel-priority\s*\{/);
 assert.doesNotMatch(css,/\.manager-app \.home-panel-projects\s*\{/);
 assert.match(css,/\.home-panel-secondary/);
 assert.match(css,/\.home-tone-info/);
 assert.match(ministry,/home-panel-secondary/);
 assert.match(announcements,/home-tone-info/);
 assert.match(staff,/className="staffv2-/);
 assert.match(manager,/home-hero/);
});


test("P7 retired Staff and Manager command-dashboard CSS is removed without erasing the approved V2 shells",()=>{
  const staff=file("src/experience-v2/staff-today/StaffTodayV2.jsx");
  const manager=file("src/experience-v2/manager-overview/ManagerOverviewV2.jsx");
  assert.match(staff,/staffv2/);
  assert.match(manager,/managerv2/);
  assert.match(file("src/experience-v2/admin-overview/AdminOverviewV2.jsx"),/adminv2/);
  assert.match(file("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx"),/executivev2/);
  for (const path of ["src/styles.css","src/premium-parity.css"]) {
    const css=file(path);
    const retired=/\.(?:manager-command(?:-[\w-]+)?|admin-command(?:-[\w-]+)?|executive-command(?:-[\w-]+)?|admin-pulse(?:-[\w-]+)?|staff-command-surface|staff-work-status(?:-[\w-]+)?|staff-quick-(?:actions?|icon)|staff-status-action)(?![\w-])/;
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector=rule[1].replace(/\/\*[\s\S]*?\*\//g,"").trim();
      const parts=selector.split(",").map(x=>x.trim()).filter(Boolean);
      assert.ok(!parts.length || selector.startsWith("@") || parts.some(x=>x.includes("@")) || !parts.every(x=>retired.test(x)),
        "Old dashboard-only selector remains in "+path+": "+selector.slice(0,120));
    }
  }
});


test("P7 legacy department, personal and project-screen CSS is retired only where V2 replaced its DOM",()=>{
 const css=file("src/styles.css");
 const staffMe=file("src/screens/Me.jsx");
 const managerCalendar=file("src/screens/ManagerCalendar.jsx");
 const adminProjects=file("src/screens/AdminProjects.jsx");
 const staffTeam=file("src/screens/StaffTeam.jsx");
 const managerPerson=file("src/screens/PersonDetail.jsx");
 for(const screen of [staffMe,managerCalendar,adminProjects,staffTeam]){
   assert.doesNotMatch(screen,/className="(?:staff-me|manager-calendar|team-resource-row|team-person-row)"/);
 }
 assert.match(managerPerson,/manager-person-detail/);
 assert.match(css,/\.manager-person-detail/);
 for(const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
   const selector=rule[1].replace(/\/\*[\s\S]*?\*\//g,"").trim();
   if(selector.startsWith("@")||selector.includes("@media"))continue;
   const obsolete=/\.(?:staff-me(?:-[\w-]+)?|manager-calendar(?:-[\w-]+)?|team-resource-row|team-person-row|admin-project-[\w-]+|manager-person-(?!detail\b)[\w-]+)/;
   const members=selector.split(",").map(x=>x.trim()).filter(Boolean);
   assert.ok(!members.length||!members.every(x=>obsolete.test(x)), "Orphaned pre-V2 surface rule: "+selector.slice(0,100));
 }
});

test("P7 shared shell adopts the owner-approved light/blue Work navigation on all roles",()=>{
 const css=file("src/experience-v2/shell/shell.css");
 assert.match(css,/\.ev2s-sidebar \{[\s\S]*?background: var\(--ev2-surface\)/);
 assert.match(css,/\.ev2s-sidebar-nav button\.is-active \{[\s\S]*?background: var\(--ev2-action-soft\)/);
 assert.match(css,/\.ev2s-sidebar-nav button\.is-active \{[\s\S]*?color: #1458b8/);
 assert.match(css,/\.ev2s-mobile-topbar \{[\s\S]*?background: rgba\(255, 255, 255, \.98\)/);
 assert.match(css,/--ev2s-sidebar-width: 13\.75rem/);
 assert.doesNotMatch(css,/background: linear-gradient\(180deg, var\(--ev2-shell-raised\)/);
});
