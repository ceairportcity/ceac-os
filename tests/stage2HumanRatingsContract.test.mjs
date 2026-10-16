import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(path,"utf8");
test("P6 selected human judgement is version bound, cannot be computed or self-authored",()=>{
 const migration=read("supabase/migrations/20261016172000_151_human_structured_ratings_p6.sql");
 const ui=read("src/components/Stage2HumanRatings.jsx");
 const performance=read("src/screens/Performance.jsx");
 for(const pattern of [
  /CREATE TABLE IF NOT EXISTS public\.appraisal_structured_ratings/,
  /CHECK\(overall_rating IN \('1','2','3','4','5','N\/O'\)\)/,
  /CREATE TRIGGER stage2_quarterly_release_guard BEFORE INSERT ON public\.performance_review_release_requests/,
  /CREATE POLICY stage2_appraisal_rating_read/,
  /a\.profile_id<>auth\.uid\(\)/,
  /assessment_entry_id=NEW\.requested_assessment_id/,
  /v_cycle\.cadence='quarterly'/,
  /employee_reflection_unavailable/,
  /stage2_rating_payload_valid\(categories\)/,
  /REVOKE ALL ON public\.appraisal_structured_ratings FROM PUBLIC, anon, authenticated/,
 ])assert.match(migration,pattern);
 assert.match(performance,/<Stage2HumanRatings/);
 assert.match(ui,/HUMAN_RUBRIC\.map/);
 assert.match(ui,/setOverall\(e\.target\.value\)/);
 assert.match(ui,/\.from\("appraisal_structured_ratings"\)/);
 assert.doesNotMatch(ui,/\.from\("work_sessions"\)|Math\.round|average\(|\.reduce\(/);
 assert.match(ui,/created_by: me\.id/);
});
test("quarterly and monthly structured assessment contract cannot be bypassed by a UI checkbox",()=>{
 const sql=read("supabase/tests/stage2_p6_human_appraisal_gate.sql");
 assert.match(sql,/Quarter was falsely released without human ratings/);
 assert.match(sql,/Quarter released without reflection or independent exception/);
 assert.match(sql,/Employee read unpublished manager appraisal/);
 assert.match(sql,/Monthly narrative voluntarily requested for HR release/);
 assert.match(sql,/ROLLBACK;/);
 const runner=read("scripts/ci/run-sql-security-gates.sh");
 assert.match(runner,/stage2_p6_human_appraisal_gate\.sql/);
});
