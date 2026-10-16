import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const sql=read("supabase/migrations/20261016180000_151_stage2_human_appraisal_ratings.sql");
test("Stage 2 ratings extend existing HR appraisal cases, never form second engine",()=>{
 assert.match(sql,/REFERENCES public\.appraisals\(id\)/);
 assert.match(sql,/assessment_entry_id uuid NOT NULL UNIQUE REFERENCES public\.appraisal_entries/);
 assert.match(sql,/REFERENCES public\.appraisal_cycles/);
 assert.match(sql,/CREATE TRIGGER stage2_require_quarterly_ratings_for_release/);
 assert.match(sql,/ON public\.performance_review_release_requests/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.performance_hr_decide_release/);
});
test("quarterly typed human score never automatically averaged or becomes payroll",()=>{
 assert.match(sql,/category_ratings jsonb NOT NULL/);
 assert.match(sql,/overall_rating text CHECK/);
 assert.match(sql,/rubric_version integer NOT NULL/);
 assert.match(sql,/FOREACH v_dimension IN ARRAY/);
 assert.match(sql,/v_rating<>'N\/O'/);
 assert.match(sql,/appraisal_review_exceptions/);
 assert.doesNotMatch(sql,/AVG\(|SUM\(|salary|payroll_trigger|automatic_score/);
});
test("RLS and triggers independently reject self review, unapproved employee viewing and tampering",()=>{
 assert.match(sql,/CREATE POLICY stage2_appraisal_human_rating_select/);
 assert.match(sql,/requested_assessment_id=appraisal_human_rating_versions\.assessment_entry_id/);
 assert.match(sql,/state='approved'/);
 assert.match(sql,/CREATE POLICY stage2_appraisal_human_rating_insert/);
 assert.match(sql,/a\.manager_id<>a\.profile_id/);
 assert.match(sql,/NEW\.profile_id=auth\.uid\(\)/);
 assert.match(sql,/NEW\.created_at:=clock_timestamp\(\)/);
 assert.match(sql,/REVOKE ALL ON public\.appraisal_human_rating_versions FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT SELECT,INSERT ON public\.appraisal_human_rating_versions TO authenticated/);
 assert.doesNotMatch(sql,/GRANT[^;]+UPDATE|GRANT[^;]+DELETE/);
});
test("existing formal Performance review displays real separate Manager entries and independent HR exemptions",()=>{
 const performance=read("src/screens/Performance.jsx");
 const editor=read("src/components/StructuredAppraisalRatings.jsx");
 assert.match(performance,/StructuredAppraisalRatings/);
 assert.match(performance,/assessment=\{currentAssessment\}/);
 assert.match(editor,/\.from\("appraisal_human_rating_versions"\)/);
 assert.match(editor,/\.from\("appraisal_review_exceptions"\)/);
 assert.match(editor,/validateHumanAppraisal/);
 assert.match(editor,/isReviewer/);
 assert.match(editor,/isHR/);
 assert.doesNotMatch(editor,/\.from\("payroll"|averageRating|automaticScore|\.rpc\("performance_hr_decide_release"/);
});
test("rollback-only adversarial SQL gate is registered",()=>{
 const sqlGate=read("supabase/tests/stage2_human_appraisal_ratings_gate.sql");
 const runner=read("scripts/ci/run-sql-security-gates.sh");
 assert.match(sqlGate,/BEGIN;/);
 assert.match(sqlGate,/ROLLBACK;/);
 assert.match(sqlGate,/Unreleased confidential Manager ratings leaked to employee/);
 assert.match(sqlGate,/Quarterly release without ratings was accepted/);
 assert.match(runner,/stage2_human_appraisal_ratings_gate\.sql/);
});
