import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { organisationalRepeatDetails } from "../src/lib/organisationalRepeatRules.js";

const source = (path) => readFileSync(path, "utf8");

test("all salaried role Work pages expose first-class self creation, not a staff impersonation shortcut", () => {
  const composer = source("src/components/SelfWorkComposer.jsx");
  for (const role of ["ManagerWork", "AdminWork", "ExecutiveWork"]) {
    const page = source(`src/screens/${role}.jsx`);
    assert.match(page, /import SelfWorkComposer from/);
    assert.match(page, /Add my work/);
    assert.match(page, /<SelfWorkComposer me=\{me\}/);
    assert.match(page, /setView\("mine"\)/);
  }
  assert.match(composer, /supabase\.rpc\("create_task_with_checklist"/);
  assert.match(composer, /p_origin: "self_created"/);
  assert.match(composer, /p_assignee_id: me\.id/);
  assert.match(composer, /p_visibility: "unit"/);
  assert.match(composer, /p_objective_id:/);
  assert.match(composer, /p_phase_id:/);
  assert.match(composer, /eq\("assignee_id", me\.id\)/);
  assert.doesNotMatch(composer, /setRole\(|localStorage\.setItem\("role"|auth\.admin\./);
});

test("each real work record exposes source-backed person-attributed dated activity, not calculated performance", () => {
  const item = source("src/screens/Item.jsx");
  const diary = source("src/components/WorkActivityDiary.jsx");
  assert.match(item, /<WorkActivityDiary .*me=\{me\} item=\{item\}/);
  assert.match(diary, /\.from\("work_activity_records"\)/);
  assert.match(diary, /action_summary:/);
  assert.match(diary, /contributor_id: me\.id/);
  assert.match(diary, /activity_date: date/);
  assert.match(diary, /next_action:/);
  assert.match(diary, /duration_minutes:/);
  assert.match(diary, /check\.data\.contributor_id !== me\.id/);
  assert.match(diary, /This is not an attendance or performance score\./);
  assert.doesNotMatch(diary, /\.update\(|\.delete\(|autoApprove|markObjectiveAchieved|calculatePerformanceScore/);
});

test("work diary SQL denies cross-person writes, keeps corrections append-only, and inherits work visibility", () => {
  const sql = source("supabase/migrations/20261019174500_158_owner_work_activity_diary.sql");
  assert.match(sql, /CREATE TABLE public\.work_activity_records/);
  assert.match(sql, /contributor_id uuid NOT NULL REFERENCES public\.profiles/);
  assert.match(sql, /supersedes_id uuid UNIQUE REFERENCES public\.work_activity_records/);
  assert.match(sql, /ALTER TABLE public\.work_activity_records ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /GRANT SELECT,INSERT ON public\.work_activity_records TO authenticated/);
  assert.doesNotMatch(sql, /GRANT[^;]*(UPDATE|DELETE)[^;]*work_activity_records/);
  assert.match(sql, /stage2_activity_owner_or_authorised_work_read/);
  assert.match(sql, /stage2_activity_write_by_contributor/);
  assert.match(sql, /contributor_id=auth\.uid\(\)/);
  assert.match(sql, /public\.app_can_see_item\(work_item_id\)/);
  assert.match(sql, /public\.app_stage2_universal_aal_allowed\(\)/);
  assert.match(sql, /prior\.contributor_id<>NEW\.contributor_id/);
  assert.match(sql, /NEW\.recorded_at:=clock_timestamp\(\)/);
  const diarySql = sql.split('CREATE FUNCTION public.stage2_relink_own_work')[0];
  assert.doesNotMatch(diarySql, /UPDATE public\.work_items|DELETE FROM public\.work_items/);
});

test("relink only self-created organisational work through an audited authority-checked RPC", () => {
  const sql = source("supabase/migrations/20261019174500_158_owner_work_activity_diary.sql");
  const form = source("src/components/WorkProjectLink.jsx");
  const detail = source("src/screens/Item.jsx");
  assert.match(sql, /CREATE FUNCTION public\.stage2_relink_own_work/);
  assert.match(sql, /w\.assignee_id IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(sql, /w\.origin<>'self_created'/);
  assert.match(sql, /w\.visibility<>'unit'/);
  assert.match(sql, /w\.unit_id NOT IN \(SELECT public\.app_my_units\(\)\)/);
  assert.match(sql, /project_id',w\.project_id/);
  assert.match(sql, /'reason',btrim\(p_reason\)/);
  assert.match(form, /supabase\.rpc\("stage2_relink_own_work"/);
  assert.match(form, /eq\("assignee_id",me\.id\)/);
  assert.match(detail, /<WorkProjectLink .*item=\{item\} onLinked=\{load\}/);
});

test("approved Work register opens a factual responsive inspector for every role", () => {
  const inspector = source("src/components/WorkRegisterInspector.jsx");
  const css = source("src/components/WorkRegisterInspector.css");
  for (const page of ["Work", "ManagerWork", "AdminWork", "ExecutiveWork"]) {
    const code = source(`src/screens/${page}.jsx`);
    assert.match(code, /import WorkRegisterLayout from/);
    assert.match(code, /<WorkRegisterLayout me=\{me\}/);
    assert.match(code, /<ResponsibilityRegister/);
    assert.match(code, /onSelect=\{setSelectedWorkId\}/);
  }
  assert.match(inspector, /\.from\("work_items"\)/);
  assert.match(inspector, /\.eq\("org_id",me\.org_id\)/);
  assert.match(inspector, /<WorkActivityDiary me=\{me\} item=\{work\}[^>]*>/);
  assert.match(inspector, /<WorkProjectLink me=\{me\} item=\{work\}[^>]*>/);
  assert.match(inspector, /openItem\?\.\(work\.id\)/);
  assert.match(css, /\.s2-work-layout\{display:grid/);
  assert.match(css, /@media\(max-width:920px\)/);
});

test("personal monthly and quarterly report waits for complete authoritative dated activity reads", () => {
  const report = source("src/screens/PersonalAchievements.jsx");
  const sql = source("supabase/migrations/20261019175500_159_owner_activity_project_attribution.sql");
  assert.match(report, /fetchAll\(\(\)=>supabase\.from\("work_activity_records"\)/);
  assert.match(report, /setActivities\(activity\);setLoadedKey\(reportKey\)/);
  assert.match(report, /a\.activity_date >= range\.start && a\.activity_date <= range\.end/);
  assert.match(report, /\.eq\("contributor_id",me\.id\)/);
  assert.match(report, /a\.source_project_id === projectId/);
  assert.match(report, /Self-recorded, not verified/);
  assert.match(sql, /source_project_id uuid REFERENCES public\.projects/);
  assert.match(sql, /NEW\.source_project_id:=w\.project_id/);
  assert.match(sql, /NEW\.source_objective_id:=w\.objective_id/);
});

test("rejected live mobile Team screenshot is not a design reference, and Manager Team adopts compact owner layout", () => {
  const team = source("src/screens/Team.jsx");
  const styles = source("src/experience-v2/people-family/people-family.css");
  const manifest = JSON.parse(source("docs/design/stage2-v4/CEAC_STAGE2_OWNER_SELECTED_SCREEN_PROVENANCE_2026-10-17.json"));
  assert.equal(manifest.rejected_live_team_capture?.never_use_as_design_baseline, true);
  assert.equal(manifest.rejected_live_team_capture?.status, "EXPLICITLY_REJECTED_NOT_A_MOCKUP");
  assert.match(team, /title="Team"/);
  assert.doesNotMatch(team, /Volunteer is an engagement type, not a new CEAC role or authority level\./);
  assert.match(team, /className="s2-team-room-entry"/);
  assert.match(team, /className="s2-team-room-open" onClick=\{openRoom\}/);
  assert.doesNotMatch(team, /<PeopleRoomCard/);
  assert.match(team, /role="tablist" aria-label="People type"/);
  assert.match(team, /\["all", `All \$\{people\.length \+ 1\}`\]/);
  assert.match(team, /showSelf && <PeoplePersonRow/);
  assert.match(team, /setOwnEngagement\(employmentByProfile.get\(me.id\) \|\| null\)/);
  assert.match(team, /visiblePeople.length === 0 && !showSelf && <PeopleEmpty/);
  assert.match(team, /disabled=\{!volunteerInvitationsReady\}/);
  assert.match(styles, /\.phase6-manager-people-tabs button\.is-selected\{border-bottom-color:/);
  assert.match(styles, /\.phase6-add-volunteer\.btn\{[^}]*width:auto/);
  assert.match(styles, /\.s2-team-room-entry\{display:flex/);
  assert.match(styles, /\.ev2-people-manager \.ev2p-count\{display:inline-flex/);
});

test("optional individual project-close review stays unpublished and is not mandatory for closure", () => {
  const project = source("src/screens/ManagerProjectClose.jsx");
  const review = source("src/components/ProjectPersonAssessments.jsx");
  const migration = source("supabase/migrations/20261019181500_160_project_person_optional_assessments.sql");
  assert.match(project, /<ProjectPersonAssessments me=\{me\}/);
  assert.match(review, /stage2_record_project_person_assessment/);
  assert.match(migration, /CREATE TABLE public\.project_person_contribution_assessments/);
  assert.match(migration, /GRANT SELECT ON public\.project_person_contribution_assessments TO authenticated/);
  assert.doesNotMatch(migration, /GRANT INSERT ON public\.project_person_contribution_assessments TO authenticated/);
  assert.match(review, /not published employee ratings/);
});

test("Executive drilldown links people, projects and dated evidence without inferred rankings", () => {
  const exec = source("src/screens/ExecutiveReports.jsx");
  const detail = source("src/components/ExecutiveContributionDrilldown.jsx");
  assert.match(exec, /<ExecutiveContributionDrilldown me=\{me\}/);
  assert.match(detail, /work_activity_records/);
  assert.match(detail, /source_project_id/);
  assert.match(detail, /contributor_id/);
  assert.match(detail, /collected.length!==expected/);
  assert.doesNotMatch(detail, /performanceScore|autoRate|averageRating/);
});

test("support organisational migration preserves unit identity instead of reassigning people", () => {
  const sql = source("supabase/migrations/20261019183500_161_technical_support_under_it.sql");
  assert.match(sql, /UPDATE public\.units SET parent_id=new_parent/);
  assert.doesNotMatch(sql, /DELETE FROM public\.unit_memberships|UPDATE public\.unit_memberships/);
  assert.match(sql, /lower\(s\.name\)='technical support'/);
});

test("HR alone sees restricted optional project contribution drafts; employee output stays unpublished", () => {
  const hr = source("src/components/HRProjectContributionQueue.jsx");
  const performance = source("src/screens/Performance.jsx");
  const sql = source("supabase/migrations/20261019181500_160_project_person_optional_assessments.sql");
  assert.match(performance, /hrReleaseAdmin && <HRProjectContributionQueue me=\{me\}/);
  assert.match(hr, /project_person_contribution_assessments/);
  assert.match(hr, /eq\("org_id",me\.org_id\)/);
  assert.match(hr, /all\.length !== expected/);
  assert.doesNotMatch(hr, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(sql, /reviewer_id=auth\.uid\(\)/);
  assert.match(sql, /app_has_capability\('people\.manage',NULL\)/);
  assert.match(sql, /wi\.confidential=false/);
});

test("dated work corrections retain the original contributor, audit history and project", () => {
  const diary = source("src/components/WorkActivityDiary.jsx");
  const snapshot = source("supabase/migrations/20261019175500_159_owner_activity_project_attribution.sql");
  const access = source("supabase/migrations/20261019174500_158_owner_work_activity_diary.sql");
  assert.match(diary, /entry\.contributor_id !== me\.id/);
  assert.match(diary, /supersedes_id: correctingId \|\| null/);
  assert.match(diary, /check\.data\.supersedes_id \|\| null/);
  assert.match(diary, /Correct this entry/);
  assert.match(snapshot, /IF NEW\.supersedes_id IS NOT NULL THEN/);
  assert.match(snapshot, /prior\.source_project_id,prior\.source_objective_id/);
  assert.match(snapshot, /prior\.work_item_id=NEW\.work_item_id/);
  assert.match(snapshot, /prior\.contributor_id=NEW\.contributor_id/);
  assert.match(access, /prior\.contributor_id<>NEW\.contributor_id/);
  assert.doesNotMatch(diary, /\.update\("work_activity_records"\)|\.delete\("work_activity_records"\)/);
});

test("monthly and quarterly evidence excludes superseded activity even when correction crosses period boundaries", () => {
  const report = source("src/screens/PersonalAchievements.jsx");
  assert.match(report, /supersededActivityIds/);
  assert.match(report, /activities\.map\(\(a\) => a\.supersedes_id\)/);
  assert.match(report, /!supersededActivityIds\.has\(a\.id\)/);
  assert.match(report, /periodActions\.filter/);
  assert.match(report, /\.order\("recorded_at",\{ascending:false\}\)/);
  assert.doesNotMatch(report, /\.gte\("activity_date",range\.start\)\.lte\("activity_date",range\.end\)/);
  assert.match(report, /Current project/);
  assert.match(report, /No project at action time/);
});

test("approved desktop and mobile Work header places Give out work and Add my work together", () => {
  const header = source("src/experience-v2/work-family/WorkFamilyV2.jsx");
  const css = source("src/experience-v2/work-family/work-family.css");
  assert.match(header, /secondaryActionLabel/);
  assert.match(header, /onSecondaryAction/);
  assert.match(header, /ev2w-header-actions/);
  for(const role of ["ManagerWork","AdminWork","ExecutiveWork"]) {
    const code=source(`src/screens/${role}.jsx`);
    assert.match(code, /actionLabel="Give out work"/);
    assert.match(code, /secondaryActionLabel="Add my work"/);
    assert.match(code, /onSecondaryAction=\{\(\) => setAddingMyWork\(true\)\}/);
    assert.doesNotMatch(code, /ev2w-self-work-action/);
  }
  assert.match(css, /\.ev2w-header-actions\{/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
});

test("manager, administration and executive default to truthful My work records with complete status tabs", () => {
  for (const role of ["ManagerWork","AdminWork","ExecutiveWork"]) {
    const page = source(`src/screens/${role}.jsx`);
    assert.match(page, /const \[view, setView\] = useState\("mine"\)/);
    assert.match(page, /\["mine", "My work"/);
    assert.match(page, /\["created", "Created by me"/);
    assert.match(page, /\["given", "Given out"/);
    assert.match(page, /\["reviews", "For review"/);
    assert.match(page, /\["completed", "Completed"/);
    assert.match(page, /origin === "self_created"/);
    assert.match(page, /item\.status === "completed" \|\| item\.status === "self_certified"/);
  }
  const manager=source("src/screens/ManagerWork.jsx");
  const register=source("src/lib/responsibilityRegister.js");
  for(const label of ["In progress", "Waiting & review", "Upcoming", "Completed"]){
    assert.ok(register.includes(label),`Missing shared Work group: ${label}`);
  }
  assert.match(manager, /<ResponsibilityRegister/);
});


test("organisational repeat creation validates civil dates and several weekdays before RPC", () => {
  const fields = source("src/components/OrganisationalRepeatFields.jsx");
  const rules = source("src/lib/organisationalRepeatRules.js");
  const composer = source("src/components/SelfWorkComposer.jsx");
  assert.match(fields, /export \{ organisationalRepeatDetails \}/);
  assert.match(fields, /weekdays: \[6\]/);
  assert.match(fields, /RoutineWeekdayPicker/);
  assert.match(fields, /weekdays\[0\]/);
  assert.match(rules, /validCivilDate\(repeat\.start\)/);
  assert.match(rules, /validCivilDate\(repeat\.end\)/);
  assert.match(rules, /repeat\.end < repeat\.start/);
  assert.match(rules, /new Set\(weekdays\)\.size !== weekdays\.length/);
  assert.match(rules, /Number\.isInteger\(weekday\)/);
  assert.match(rules, /Number\.isInteger\(monthDay\)/);
  assert.match(composer, /organisationalRepeatDetails\(repeat, cleanSteps\)/);
});

test("multi-weekday organisational routines keep independent dates without duplicate weekdays", () => {
  const options = { frequency: "weekly", start: "2026-10-20", end: "2026-11-30", weekday: "6", weekdays: [7, 6] };
  assert.deepEqual(organisationalRepeatDetails(options, ["Venue check"]), {
    origin: "self_created", schedule_kind: "weekly", starts_on: "2026-10-20",
    ends_on: "2026-11-30", weekdays: [6, 7], steps: ["Venue check"],
  });
  assert.deepEqual(organisationalRepeatDetails({ ...options, weekdays: undefined }, []).weekdays, [6]);
  assert.throws(() => organisationalRepeatDetails({ ...options, weekdays: [] }, []), /weekdays/);
  assert.throws(() => organisationalRepeatDetails({ ...options, weekdays: [7, 7] }, []), /weekdays/);
  assert.throws(() => organisationalRepeatDetails({ ...options, weekdays: [0] }, []), /weekdays/);
  assert.throws(() => organisationalRepeatDetails({ ...options, weekdays: [8] }, []), /weekdays/);
  assert.throws(() => organisationalRepeatDetails({ ...options, weekdays: [1.5] }, []), /weekdays/);
  assert.throws(() => organisationalRepeatDetails({ ...options, weekdays: "6" }, []), /weekday/);
});

test("organisational schedule errors are rejected before server creation, including invalid calendar days", () => {
  const base = { frequency: "monthly", start: "2026-10-20", monthDay: "31" };
  assert.equal(organisationalRepeatDetails(base, []).day_of_month, 31);
  assert.throws(() => organisationalRepeatDetails({ ...base, monthDay: "32" }, []), /month/);
  assert.throws(() => organisationalRepeatDetails({ ...base, start: "2026-02-30" }, []), /date/);
  assert.throws(() => organisationalRepeatDetails({ ...base, end: "2026-10-19" }, []), /date/);
  assert.throws(() => organisationalRepeatDetails({ ...base, frequency: "custom" }, []), /frequency/);
});


test("recorded routine dates can open a factual evidence entry without certifying occurrence completion", () => {
  const item = source("src/screens/Item.jsx");
  const diary = source("src/components/WorkActivityDiary.jsx");
  assert.match(item, /setRoutineEvidenceDate\(date\)/);
  assert.match(item, /setRoutineEvidenceRequest\(\(n\) => n \+ 1\)/);
  assert.match(source("src/components/RoutineOccurrenceReviews.jsx"), /Record evidence for \{entry\.occurred_on\}/);
  assert.match(item, /prefillDate=\{routineEvidenceDate\} prefillRequest=\{routineEvidenceRequest\}/);
  assert.match(diary, /if \(!prefillRequest/);
  assert.match(diary, /setDate\(prefillDate\)/);
  assert.match(diary, /setCorrectingId\(null\)/);
  assert.match(diary, /setEditor\(true\)/);
  assert.match(diary, /work_activity_records/);
  assert.doesNotMatch(diary, /autoApprove|markObjectiveAchieved|record_routine_occurrence/);
});

test("unit coordination Room uses compact square controls and readable light-blue visual hierarchy",()=>{
  const css=source("src/styles.css");
  const room=source("src/screens/Room.jsx");
  assert.match(css,/\.room-head\{[\s\S]*?color:#173D63;background:#FFFFFF;/);
  assert.match(css,/\.room-scope-strip button\{[\s\S]*?border-bottom:2px solid transparent;border-radius:0/);
  assert.match(css,/\.room-message\.mine\{[\s\S]*?border-radius:6px;background:#F1F7FF/);
  assert.match(css,/\.room-plus\{[\s\S]*?width:36px;height:42px;[^}]*border-radius:6px/);
  assert.match(css,/\.room-person-avatar\{[\s\S]*?border-radius:6px/);
  assert.doesNotMatch(css,/\.room-scope-strip button\{[^}]*border-radius:999px/);
  assert.match(room,/aria-label="Back from Room"/);
  assert.match(room,/aria-label="Unit conversations"/);
});

test("compact Room action control makes open/close state visible without circular rotation",()=>{
  const room=source("src/screens/Room.jsx");
  const css=source("src/styles.css");
  assert.match(room,/aria-expanded=\{Boolean\(panel\)\}/);
  assert.match(room,/panel \? "×" : "\+"/);
  assert.match(room,/panel \? "Close Room actions" : "Add context or action"/);
  assert.match(css,/\.room-plus\.on\{transform:none/);
});

test("Room live badge describes the actual subscribed connection, never a permanent false-green indicator",()=>{
  const room=source("src/screens/Room.jsx");
  const css=source("src/styles.css");
  assert.match(room,/const \[realtimeStatus, setRealtimeStatus\] = useState\("offline"\)/);
  assert.match(room,/\.subscribe\(\(status\) =>/);
  assert.match(room,/status === "SUBSCRIBED"/);
  assert.match(room,/status === "CHANNEL_ERROR" \|\| status === "CLOSED" \|\| status === "TIMED_OUT"/);
  assert.match(room,/active = false; setRealtimeStatus\("offline"\)/);
  assert.match(room,/data-state=\{realtimeStatus\}/);
  assert.match(room,/realtimeStatus === "connected" \? "Live updates"/);
  assert.match(css,/\.room-live-status\[data-state=offline\]/);
  assert.doesNotMatch(room,/title="Live updates" aria-label="Live updates"/);
});

test("Room switching never restores stale participants or work links, and failed message reads are not acknowledged", () => {
  const room = source("src/screens/Room.jsx");
  assert.match(room,/activeRoomIdRef = useRef\(null\)/);
  assert.match(room,/setParticipants\(\[\]\); setScopeRooms\(\[\]\); setWorkOptions\(\[\]\); setProjectOptions\(\[\]\);/);
  assert.match(room,/async function loadParticipants\(currentRoom, openSerial\)/);
  assert.match(room,/async function loadReferenceOptions\(currentRoom, openSerial\)/);
  assert.match(room,/async function loadScopeRooms\(currentRoom, openSerial\)/);
  assert.match(room,/const current = \(\) => openSerial === roomOpenSerial.current && activeRoomIdRef.current === currentRoom.id/);
  assert.match(room,/if \(!current\(\)\) return;/);
  assert.match(room,/const loaded = await loadMessages\(room.id, false\)/);
  assert.match(room,/if \(loaded && activeRoomIdRef.current === room.id && atBottomRef.current\)/);
  assert.match(room,/if \(loading \|\| !room\?\.id \|\| error \|\| activeRoomIdRef.current !== room.id\) return;/);
  assert.match(room,/if \(requestSerial !== messageLoadSerial.current \|\| activeRoomIdRef.current !== roomId\) return false;/);
  assert.match(room,/if \(!result.error && activeRoomIdRef.current === roomId\) setNewMessageCount\(0\)/);
});

test("Room message history uses a deterministic same-timestamp cursor without silently skipping messages",()=>{
  const room=source("src/screens/Room.jsx");
  assert.match(room,/\.or\(\`created_at\.lt\.\$\{oldest\.created_at\},and\(created_at\.eq\.\$\{oldest\.created_at\},id\.lt\.\$\{oldest\.id\}\)\`\)/);
  const ordered=(room.match(/\.order\("created_at", \{ ascending: false \}\)\s*\.order\("id", \{ ascending: false \}\)/g)||[]).length;
  assert.ok(ordered >= 2,"recent/older reads must agree on timestamp + ID ordering");
  assert.doesNotMatch(room,/\.lt\("created_at", oldest\.created_at\)/);
  assert.match(room,/activeRoomIdRef.current !== selectedRoomId\) return/);
});

test("Projects shows real dated project contributions, not merely recently created tasks",()=>{
  const project=source("src/components/Stage2ProjectOverview.jsx");
  assert.match(project,/\.from\("work_activity_records"\)/);
  assert.match(project,/\.eq\("source_project_id", project\.id\)/);
  assert.match(project,/\.eq\("org_id", project\.org_id\)/);
  assert.match(project,/\.order\("recorded_at"/);
  assert.match(project,/collected\.length !== total/);
  assert.match(project,/currentProjectActions\(collected\)/);
  assert.match(project,/visibleProjectPeople\(work, visibleActions\)/);
  assert.match(project,/Recent visible project activity/);
  assert.match(project,/Recorded actions visible to your account/);
  assert.doesNotMatch(project,/Recently created work/);
  assert.doesNotMatch(project,/const recent = work\.filter/);
});

test("Unit Room keeps helper labels at least 12px with compact non-pill controls",()=>{
  const css=source("src/styles.css");
  const rules=[...css.matchAll(/([^{}]*\.room-[^{}]+)\{([^{}]*)\}/g)];
  assert.ok(rules.length>35,"Expected broad Room family coverage");
  for(const [,selector,body] of rules){
    for(const m of body.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))
      assert.ok(Number(m[1])>=12,selector.trim()+" includes illegible "+m[0]);
    assert.doesNotMatch(body,/border-radius:999px/,"Room pill retained in "+selector.trim());
  }
});

test("Executive contribution filters stay connected from unit to its projects to its people",()=>{
  const code=source("src/components/ExecutiveContributionDrilldown.jsx");
  assert.match(code,/rows\.filter\(a => !unitId \|\| a\.work_items\?\.unit_id === unitId\)\.forEach/);
  assert.match(code,/\},\[rows,unitId\]\)/);
  assert.match(code,/setUnitId\(e\.target\.value\);setProjectId\(""\);setPersonId\(""\)/);
  assert.match(code,/!projectId \|\| a\.source_project_id===projectId/);
  assert.match(code,/!personId \|\| a\.contributor_id===personId/);
});

test("Administration Control Center hides inaccessible, inert notices without hiding Finance or other actionable routes",()=>{
  const code=source("src/screens/ControlCenter.jsx");
  assert.match(code,/canIntegrations\?\[/);
  assert.match(code,/canAudit\?\[/);
  assert.match(code,/caps.has\("authority.manage"\)/);
  assert.match(code,/go\("finance"\)/);
  assert.match(code,/control-related-work/);
  assert.doesNotMatch(code,/ControlCenterTrail/);

});

test("Project team merges assignment with fully verified current activity contributors",()=>{
  const src=source("src/components/Stage2ProjectOverview.jsx");
  assert.match(src,/const pageSize = 200/);
  assert.match(src,/collected\.length !== total/);
  assert.match(src,/currentProjectActions\(collected\)/);
  assert.match(src,/visibleProjectPeople\(work, visibleActions\)/);
  assert.match(src,/people with visible assignments or dated actions/);
  assert.match(src,/Additional contributors could not be verified/);
});

test("date-specific routine reviews are append-only and cannot self-approve or modify formal attendance",()=>{
  const sql=source("supabase/migrations/20261020095000_167_routine_occurrence_reviews.sql");
  const review=source("src/components/RoutineOccurrenceReviews.jsx");
  const detail=source("src/screens/Item.jsx");
  assert.match(sql,/CREATE TABLE public\.routine_occurrence_reviews/);
  assert.match(sql,/ALTER TABLE public\.routine_occurrence_reviews ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/GRANT SELECT,INSERT ON public\.routine_occurrence_reviews TO authenticated/);
  assert.doesNotMatch(sql,/GRANT[^;]*(UPDATE|DELETE)[^;]*routine_occurrence_reviews/);
  assert.match(sql,/occurrence\.recorded_by IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(sql,/public\.app_can_see_item\(work\.id\)/);
  assert.match(sql,/public\.app_stage2_universal_aal_allowed\(\)/);
  assert.match(sql,/routine\.unit_id IN \(SELECT public\.app_managed_units\(\)\)/);
  assert.match(sql,/NEW\.reviewer_id := auth\.uid\(\)/);
  assert.match(sql,/NEW\.reviewed_at := clock_timestamp\(\)/);
  assert.match(review,/\.from\("routine_occurrence_reviews"\)\.insert\(/);
  assert.match(review,/entry\.recorded_by !== me\.id/);
  assert.match(review,/Awaiting independent review/);
  assert.match(review,/Record human review/);
  assert.match(detail,/<RoutineOccurrenceReviews me=\{me\} item=\{item\} occurrences=\{routineOccurrences\}/);
  assert.doesNotMatch(review,/record_routine_occurrence|setTaskCompleted|autoApprove|staffPerformanceScore/);
});

test("all self-created and assigned routine forms share a compact weekday picker", () => {
  const picker = source("src/components/RoutineWeekdayPicker.jsx");
  const css = source("src/components/RoutineWeekdayPicker.css");
  const own = source("src/components/OrganisationalRepeatFields.jsx");
  const assign = source("src/screens/Assign.jsx");
  const detail = source("src/screens/Item.jsx");
  for (const text of [own,assign,detail]) assert.match(text,/RoutineWeekdayPicker/);
  assert.match(picker,/type="checkbox"/);
  assert.match(picker,/aria-label=\{day\}/);
  assert.match(css,/flex-wrap:wrap/);
  assert.doesNotMatch(picker,/btn btn-sm|btn-ghost/);
});


test("Stage 2 evidence readers hide prior project, period and actor data until the new scope is verified",()=>{
  const project=source("src/components/Stage2ProjectOverview.jsx");
  const exec=source("src/components/ExecutiveContributionDrilldown.jsx");
  const reviews=source("src/components/RoutineOccurrenceReviews.jsx");
  assert.match(project,/const projectEvidenceKey = `\$\{project\.org_id\}:\$\{project\.id\}`/);
  assert.match(project,/completedProjectKey !== projectEvidenceKey/);
  assert.match(project,/const visibleActions = !activityChecking && !displayActionError \? sourceActions : \[\]/);
  assert.match(project,/setCompletedProjectKey\(projectEvidenceKey\)/);
  assert.match(exec,/const evidenceScope = `\$\{me\.org_id\}:\$\{me\.id\}:\$\{start\}:\$\{end\}`/);
  assert.match(exec,/const rows = evidenceReady \? sourceRows : \[\]/);
  assert.match(exec,/setCompletedEvidenceScope\(evidenceScope\)/);
  assert.match(exec,/\{evidenceReady&&<>/);
  assert.match(reviews,/const reviewScope = `\$\{me\.org_id\}:\$\{me\.id\}:\$\{item\.id\}:\$\{ids\}`/);
  assert.match(reviews,/const history = ready \? sourceHistory : \[\]/);
  assert.match(reviews,/setCompletedReviewScope\(reviewScope\)/);
  assert.match(reviews,/if \(sending\.current \|\| saving \|\| !ready/);
  assert.match(reviews,/const canReviewEntry = reviewPermitted && ready/);
});


test("project navigation does not inherit stale task filters or another project's activities",()=>{
  const project=source("src/components/Stage2ProjectOverview.jsx");
  const exec=source("src/components/ExecutiveContributionDrilldown.jsx");
  assert.match(project,/const scopedSearch = projectFilterReady \? search : ""/);
  assert.match(project,/const scopedFilter = projectFilterReady \? filter : "all"/);
  assert.match(project,/const scopedUnit = projectFilterReady \? unit : "all"/);
  assert.match(project,/setSearch\(""\); setFilter\("all"\); setUnit\("all"\); setFilterProjectKey\(projectEvidenceKey\)/);
  assert.match(exec,/setSelectedId\(null\); setUnitId\(""\); setProjectId\(""\); setPersonId\(""\); setQuery\(""\)/);
});


test("person-specific project and HR appraisal draft views reject stale identities and submissions",()=>{
  const p=source("src/components/ProjectPersonAssessments.jsx");
  const h=source("src/components/HRProjectContributionQueue.jsx");
  const f=source("src/components/FormalReviewProjectDrafts.jsx");
  assert.match(p,/const assessmentScope = /);
  assert.match(p,/const ready = verified && !loading && !error && completedAssessmentScope === assessmentScope/);
  assert.match(p,/const people = ready \? sourcePeople : \[\]/);
  assert.match(p,/const notes = ready \? sourceNotes : \[\]/);
  assert.match(p,/if \(!ready \|\| pending\.current/);
  assert.match(p,/setCompletedAssessmentScope\(assessmentScope\)/);
  assert.match(h,/const queueScope = /);
  assert.match(h,/const rows = ready \? sourceRows : \[\]/);
  assert.match(h,/\{ready&&<>/);
  assert.match(f,/const reviewScope = /);
  assert.match(f,/const notes = ready \? sourceNotes : \[\]/);
  assert.match(f,/disabled=\{disabled \|\| !ready\}/);
});


test("Work inspector and dated diary cannot display or submit stale actor/work context",()=>{
  const inspector=source("src/components/WorkRegisterInspector.jsx");
  const diary=source("src/components/WorkActivityDiary.jsx");
  assert.match(inspector,/const workScope = /);
  assert.match(inspector,/completedWorkScope !== workScope/);
  assert.match(inspector,/const work = !checking && !activeError && completedWorkScope === workScope \? sourceWork : null/);
  assert.match(inspector,/data\.id !== selectedId \|\| data\.org_id !== me\.org_id/);
  assert.match(inspector,/setCompletedWorkScope\(workScope\)/);
  assert.match(diary,/const diaryScope = /);
  assert.match(diary,/const verified = completedDiaryScope === diaryScope && !loading && !error && !unavailable/);
  assert.match(diary,/const history = verified \? sourceHistory : \[\]/);
  assert.match(diary,/setCompletedDiaryScope\(diaryScope\)/);
  assert.match(diary,/const canRecord = verified &&/);
  assert.match(diary,/if \(busy \|\| submitting\.current \|\| !verified \|\| !canRecord/);
  assert.match(diary,/\{editor && verified && <form/);
});


test("Work full-detail remounts its independent async state on account, department and responsibility changes",()=>{
  const item=source("src/screens/Item.jsx");
  assert.match(item,/export default function Item\(props\)/);
  assert.match(item,/const scope = \[props\.me\?\.org_id, props\.me\?\.id, props\.me\?\.unit_id, props\.id, props\.initialRoutineDate \|\| ""\]\.join\(":"\)/);
  assert.match(item,/<ItemDetail key=\{scope\} \{\.\.\.props\} \/>/);
  assert.match(item,/function ItemDetail\(\{ id, me, session, isManager = false, initialRoutineDate=null, openRoom, back \}\)/);
  assert.match(item,/record_routine_occurrence/);
  assert.match(item,/change_routine_schedule/);
});


test("restricted reviewer evidence shows a safe retry when the database request rejects asynchronously",()=>{
  const src=source("src/components/FormalReviewProjectDrafts.jsx");
  assert.match(src,/\.catch\(\(\) => \{/);
  assert.match(src,/if \(!current\) return;/);
  assert.match(src,/setSourceNotes\(\[\]\)/);
  assert.match(src,/setCompletedReviewScope\(reviewScope\); setLoading\(false\)/);
  assert.match(src,/\{activeError && <p role="alert">/);
});
