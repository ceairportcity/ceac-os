import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const sql=read("supabase/migrations/20261016180000_151_stage2_human_appraisal_ratings.sql");
test("Stage 2 ratings extend existing HR appraisal cases, never form second engine",()=>{
 assert.match(sql,/REFERENCES public\.appraisals\(id\)/);
 assert.match(sql,/assessment_entry_id uuid NOT NULL UNIQUE REFERENCES public\.appraisal_entries/);
 assert.match(sql,/FROM public\.appraisals a JOIN public\.appraisal_cycles c/);
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
 assert.match(sql,/v_review\.profile_id=auth\.uid\(\)/);
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

test("P6 sensitive human ratings and HR exceptions cannot duplicate or misstate uncertain writes",()=>{
 const editor=read("src/components/StructuredAppraisalRatings.jsx");
 assert.match(editor,/const ratingMutationPending=useRef\(false\)/);
 for(const method of ["save","saveException"]){
   const body=editor.match(new RegExp("async function "+method+"\\(\\)\\{([\\s\\S]*?)\\n \\}"))?.[1];
   assert.ok(body,method+" must exist");
   assert.match(body,/ratingMutationPending\.current/);
   assert.match(body,/ratingMutationPending\.current=true/);
   assert.match(body,/ratingMutationPending\.current=false/);
   assert.match(body,/finally\{/);
 }
 assert.match(editor,/Ratings were recorded, but refreshing the review failed/);
 assert.match(editor,/The HR exception was recorded, but refreshing the review failed/);
 assert.match(editor,/Recheck the exception history before trying again/);
 assert.doesNotMatch(editor,/setBusy\(false\);\s*if\(result\.error\)/);
});

test("P6 protected human rating and HR exception writes fail closed on unavailable history",()=>{
 const source=read("src/components/StructuredAppraisalRatings.jsx");
 assert.match(source,/const versionsVerified=!loading&&!unavailable&&!error/);
 assert.match(source,/const canEdit=versionsVerified&&isReviewer/);
 assert.match(source,/if\(busy\|\|ratingMutationPending\.current\|\|!versionsVerified\|\|!isHR/);
 assert.match(source,/\{versionsVerified&&isHR&&cadence==="quarter"/);
 assert.match(source,/disabled=\{busy\|\|!versionsVerified\|\|!exceptionKind/);
 assert.match(source,/Retry protected review verification/);
 assert.match(source,/onClick=\{\(\)=>setReload\(n=>n\+1\)\}/);
 assert.match(source,/const recorded=rows\.find\(x=>x\.assessment_entry_id===assessment\?\.id\)/);
});

test("owner-approved HR head appraisal includes Administration and excludes Group Pastor without self-review",()=>{
 const migration=read("supabase/migrations/20261022170000_188_admin_hr_head_group_pastor_appraisal.sql");
 assert.match(migration,/AND NOT p\.is_exec/);
 assert.doesNotMatch(migration,/AND NOT p\.is_admin/);
 assert.match(migration,/IF v_subject\.is_admin THEN/);
 assert.match(migration,/v_subject\.id=v_reviewer\.id/);
 assert.match(migration,/v_reviewer\.is_exec/);
 assert.match(migration,/lower\(btrim\(coalesce\(v_reviewer\.job_title,''\)\)\)='group pastor'/);
 assert.match(migration,/UPDATE public\.appraisals\s+SET manager_id=v_reviewer\.id/);
 assert.match(migration,/AND um\.unit_id=v_appraisal\.unit_id AND um\.role='manager'/);
 assert.doesNotMatch(migration,/\bGRANT\s+(ALL|EXECUTE|SELECT|UPDATE|INSERT|DELETE)\b/i);
 assert.doesNotMatch(migration,/CREATE\s+POLICY|ALTER\s+POLICY/i);
});
test("Group Pastor receives a single-case review destination, not Admin or HR publication authority",()=>{
 const migration=read("supabase/migrations/20261022170000_188_admin_hr_head_group_pastor_appraisal.sql");
 const app=read("src/App.jsx");
 const personal=read("src/screens/Me.jsx");
 const review=read("src/screens/Performance.jsx");
 assert.match(migration,/v_actor=v_review\.profile_id/);
 assert.match(migration,/v_actor=v_request\.requested_by/);
 assert.match(migration,/NOT public\.app_is_admin\(\)/);
 assert.match(migration,/NOT public\.app_has_capability\('people\.manage',NULL\)/);
 assert.match(app,/const canUsePerformance = isExec \|\| isStaff \|\| isUnitManager/);
 assert.match(personal,/title="Assigned appraisals"/);
 assert.match(personal,/ariaLabel="My assigned appraisals"/);
 assert.match(review,/selectedCase\.profiles\?\.is_admin/);
 assert.match(review,/profile\.id === selectedCase\.profile_id/);
 assert.match(review,/profile\.is_exec && !profile\.is_admin/);
 assert.match(review,/hrReleaseAdmin && isSelf && <ProductNotice/);
 assert.match(review,/hrReleaseAdmin && !isSelf && <div className="performance-share-bar"/);
});
