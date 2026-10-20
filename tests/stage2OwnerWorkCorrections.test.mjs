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
  assert.match(fields, /role="group" aria-label="Repeat weekdays"/);
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
  assert.match(item, /setRoutineEvidenceDate\(occurrence\.occurred_on\)/);
  assert.match(item, /setRoutineEvidenceRequest\(\(n\) => n \+ 1\)/);
  assert.match(item, /Record evidence for \{occurrence\.occurred_on\}/);
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
