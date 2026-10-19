import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  assert.doesNotMatch(composer, /setRole\(|impersonate|localStorage\.setItem\("role"/);
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
  assert.doesNotMatch(sql, /UPDATE public\.work_items|DELETE FROM public\.work_items/);
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
