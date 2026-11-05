import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = path => readFileSync(path,"utf8");
const migration=file("supabase/migrations/20261105150000_inline_progress_and_project_controls.sql");

test("work progress uses an inline editor and a milestone option, not prominent log actions",()=>{
  const screen=file("src/components/WorkActivityDiary.jsx");
  assert.match(screen,/s2-progress-inline/);
  assert.match(screen,/What have you accomplished/);
  assert.match(screen,/entry_kind:entryKind/);
  assert.match(screen,/Milestone reached/);
  assert.match(screen,/remove_own_work_update/);
  assert.match(screen,/Edit entry/);
  assert.doesNotMatch(screen,/\+ Add work update|Record earlier work|Log progress/);
  assert.match(screen,/supersedes_id: correctingId/);
});

test("removed entries are hidden in normal history but preserved for audit",()=>{
  assert.match(migration,/work_activity_hide_removed/);
  assert.match(migration,/removed_at IS NULL/);
  assert.match(migration,/CREATE OR REPLACE FUNCTION public\.remove_own_work_update/);
  assert.match(migration,/r\.contributor_id IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(migration,/public\.activity_events/);
  assert.doesNotMatch(migration,/DELETE FROM public\.work_activity_records/);
});

test("project changes require server-side authority and unused-only removal",()=>{
  assert.match(migration,/CREATE OR REPLACE FUNCTION public\.manage_ceac_project/);
  assert.match(migration,/public\.app_can_manage_delivery_project\(p\.id\)/);
  assert.match(migration,/p\.created_by=auth\.uid\(\)/);
  assert.match(migration,/EXISTS\(SELECT 1 FROM public\.work_items WHERE project_id=p\.id\)/);
  assert.match(migration,/EXISTS\(SELECT 1 FROM public\.project_closes WHERE project_id=p\.id\)/);
  assert.match(migration,/projects_hide_deleted/);
  assert.doesNotMatch(migration,/DELETE FROM public\.projects/);
  const editor=file("src/components/ProjectManageControls.jsx");
  for(const action of ["save","archive","restore","delete"])assert.match(editor,new RegExp('"'+action+'"'));
});

test("manager-owned routine dates require Executive or the actual assigning Admin",()=>{
  assert.match(migration,/CREATE OR REPLACE FUNCTION public\.app_can_review_routine_work/);
  assert.match(migration,/public\.app_is_exec\(\)/);
  assert.match(migration,/assigning_admin\.active AND assigning_admin\.is_admin/);
  assert.match(migration,/public\.app_can_review_routine_work\(work\.id\)/);
  const ui=file("src/components/RoutineOccurrenceReviews.jsx");
  assert.match(ui,/supabase\.rpc\("app_can_review_routine_work"/);
  assert.match(ui,/reviewAuthority/);
});
