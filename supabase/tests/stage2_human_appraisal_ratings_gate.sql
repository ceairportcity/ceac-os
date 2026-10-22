\set ON_ERROR_STOP on
-- Stage 2 P6: rollback-only human rubric, evidence and independent HR guard.
-- Depends on local seeded identities. Nothing is ever committed to production.
BEGIN;

DO $schema$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.stage2_employee_published_human_ratings'::regclass
   AND reloptions @> ARRAY['security_invoker=true','security_barrier=true'])
  OR to_regprocedure('private.stage2_self_published_human_ratings()') IS NULL
  OR has_function_privilege('anon','private.stage2_self_published_human_ratings()','EXECUTE')
  OR NOT has_function_privilege('authenticated','private.stage2_self_published_human_ratings()','EXECUTE')
 THEN RAISE EXCEPTION 'Published rating invoker/private-reader boundary is incorrect'; END IF;
 IF to_regclass('public.appraisal_human_rating_versions') IS NULL
    OR to_regclass('public.appraisal_review_exceptions') IS NULL
 THEN RAISE EXCEPTION 'Stage 2 protected human-review tables are absent'; END IF;
 IF has_table_privilege('anon','public.appraisal_human_rating_versions','SELECT')
  OR has_table_privilege('anon','public.appraisal_review_exceptions','SELECT')
  OR has_table_privilege('authenticated','public.appraisal_human_rating_versions','UPDATE')
  OR has_table_privilege('authenticated','public.appraisal_human_rating_versions','DELETE')
 THEN RAISE EXCEPTION 'Human appraisal privacy or append-only privileges bypassed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.performance_review_release_requests'::regclass
    AND tgname='stage2_require_quarterly_ratings_for_release' AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'Quarterly HR release must enforce structured human ratings'; END IF;
END
$schema$;

-- Synthetic, date-aligned Q4 cycle. No historical Stage 1 rows touched.
INSERT INTO public.appraisal_cycles(id,org_id,name,starts_on,ends_on,status,opened_by,opened_reason)
VALUES('53000000-0000-4000-8000-000000000081','10000000-0000-4000-8000-000000000010',
'Stage 2 isolated Q4', '2026-10-01','2026-12-31','open',
'31000000-0000-4000-8000-000000000003','Isolated owner P6 assessment test');
DO $cycle$
BEGIN
 IF (SELECT stage2_cadence FROM public.appraisal_cycles
 WHERE id='53000000-0000-4000-8000-000000000081')<>'quarter'
 THEN RAISE EXCEPTION 'New calendar-aligned quarter not classified'; END IF;
END
$cycle$;

INSERT INTO public.appraisals(
 id,org_id,cycle_id,profile_id,manager_id,unit_id,status
) VALUES (
 '53000000-0000-4000-8000-000000000082',
 '10000000-0000-4000-8000-000000000010',
 '53000000-0000-4000-8000-000000000081',
 '31000000-0000-4000-8000-000000000001',
 '31000000-0000-4000-8000-000000000002',
 '20000000-0000-4000-8000-000000000011',
 'manager_draft'
);
INSERT INTO public.appraisal_entries(
 id,org_id,appraisal_id,profile_id,entry_type,body,created_by
) VALUES(
 '53000000-0000-4000-8000-000000000083',
 '10000000-0000-4000-8000-000000000010',
 '53000000-0000-4000-8000-000000000082',
 '31000000-0000-4000-8000-000000000001',
 'manager_assessment',
 'Factual manager narrative to support human review',
 '31000000-0000-4000-8000-000000000002'
);

-- A quarterly HR request WITHOUT the rating version must fail, even if a
-- caller bypasses the frontend and presents a valid reviewer session.
DO $must_block_release$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
 INSERT INTO public.performance_review_release_requests(
 org_id,appraisal_id,requested_by,requested_assessment_id,request_reason)
 VALUES ('10000000-0000-4000-8000-000000000010',
 '53000000-0000-4000-8000-000000000082',
 '31000000-0000-4000-8000-000000000002',
 '53000000-0000-4000-8000-000000000083',
 'Pretend request without required rubric');
 EXCEPTION WHEN OTHERS THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Quarterly release without ratings was accepted'; END IF;
END
$must_block_release$;

-- A real staff reflection is required unless independent HR records an
-- attributable exception. This fixture supplies an actual reflection.
INSERT INTO public.appraisal_entries(
 id,org_id,appraisal_id,profile_id,entry_type,body,created_by
) VALUES(
 '53000000-0000-4000-8000-000000000084',
 '10000000-0000-4000-8000-000000000010',
 '53000000-0000-4000-8000-000000000082',
 '31000000-0000-4000-8000-000000000001',
 'employee_reflection',
 'Employee reflection recorded voluntarily in the isolated fixture',
 '31000000-0000-4000-8000-000000000001'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $no_self_review$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
 INSERT INTO public.appraisal_human_rating_versions(
 org_id,appraisal_id,assessment_entry_id,profile_id,reviewer_id,cadence,
 category_ratings,overall_rating,overall_narrative,strengths,challenges,next_actions)
 VALUES(
 '10000000-0000-4000-8000-000000000010','53000000-0000-4000-8000-000000000082',
 '53000000-0000-4000-8000-000000000083','31000000-0000-4000-8000-000000000001',
 '31000000-0000-4000-8000-000000000001','quarter',
 '{}'::jsonb,'5','Self-chosen rating without review','Self','Self','Self'
 );
 EXCEPTION WHEN OTHERS THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Employee self-rating was accepted'; END IF;
END
$no_self_review$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
DO $quarter_complete$
DECLARE v_categories jsonb;
BEGIN
 v_categories:=jsonb_build_object(
  'delivery',jsonb_build_object('rating','N/O','reason','Not directly observed','evidenceIds','[]'::jsonb),
  'quality',jsonb_build_object('rating','N/O','reason','Not directly observed','evidenceIds','[]'::jsonb),
  'reliability',jsonb_build_object('rating','N/O','reason','Not directly observed','evidenceIds','[]'::jsonb),
  'initiative',jsonb_build_object('rating','N/O','reason','Not directly observed','evidenceIds','[]'::jsonb),
  'collaboration',jsonb_build_object('rating','N/O','reason','Not directly observed','evidenceIds','[]'::jsonb)
 );
 INSERT INTO public.appraisal_human_rating_versions(
 org_id,appraisal_id,assessment_entry_id,profile_id,reviewer_id,cadence,
 category_ratings,overall_rating,overall_narrative,strengths,challenges,next_actions)
 VALUES(
 '10000000-0000-4000-8000-000000000010','53000000-0000-4000-8000-000000000082',
 '53000000-0000-4000-8000-000000000083','31000000-0000-4000-8000-000000000001',
 '31000000-0000-4000-8000-000000000002','quarter',
 v_categories,'3','Manager independently selected this rating',
 'Areas in which the employee contributed',
 'Resources were a recurring obstacle',
 'Agree a specific support plan'
 );
 IF (SELECT count(*) FROM public.appraisal_human_rating_versions
 WHERE appraisal_id='53000000-0000-4000-8000-000000000082')<>1
 THEN RAISE EXCEPTION 'Authorised Manager rating was not recorded'; END IF;
END
$quarter_complete$;
RESET ROLE;

-- Even valid structural ratings remain PRIVATE to employee until HR release.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $unpublished$
BEGIN
 IF EXISTS(SELECT 1 FROM public.appraisal_human_rating_versions
 WHERE appraisal_id='53000000-0000-4000-8000-000000000082') THEN
 RAISE EXCEPTION 'Unreleased confidential Manager ratings leaked to employee'; END IF;
END
$unpublished$;
RESET ROLE;

-- Manager requests independent HR release AFTER completing the rubric.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT public.performance_request_release(
 '53000000-0000-4000-8000-000000000082',
 'Independent HR must inspect and approve this quarterly review.'
);
RESET ROLE;
DO $pending$
BEGIN
 IF (SELECT count(*) FROM public.performance_review_release_requests
 WHERE appraisal_id='53000000-0000-4000-8000-000000000082' AND state='pending')<>1 THEN
 RAISE EXCEPTION 'Correct quarterly rating did not reach existing HR release queue'; END IF;
END
$pending$;
-- The employee must not see the HR request, unpublished human ratings
-- or direct table row. After INDEPENDENT HR publication, the narrowly scoped
-- view must show ONLY the matched approved assessment version.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $employee_pending_view$
BEGIN
 IF EXISTS(SELECT 1 FROM private.stage2_self_published_human_ratings()
   WHERE appraisal_id='53000000-0000-4000-8000-000000000082') THEN
  RAISE EXCEPTION 'Private reader leaked an unpublished rating';
 END IF;
 IF EXISTS(SELECT 1 FROM public.stage2_employee_published_human_ratings
   WHERE appraisal_id='53000000-0000-4000-8000-000000000082') THEN
  RAISE EXCEPTION 'Employee read the pending unpublished Manager rating from projection';
 END IF;
END
$employee_pending_view$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
DO $independent_hr$
DECLARE v_request uuid;
BEGIN
 SELECT id INTO v_request
 FROM public.performance_review_release_requests
 WHERE appraisal_id='53000000-0000-4000-8000-000000000082' AND state='pending';
 IF v_request IS NULL THEN RAISE EXCEPTION 'No pending quarterly HR request'; END IF;
 PERFORM public.performance_hr_decide_release(v_request,true,
  'HR independently examined the actual evidence and recorded appraisal content.');
END
$independent_hr$;
RESET ROLE;

-- Owner correction: the ordinary People/HR dossier may only receive
-- independently published human ratings. Manager/draft rating versions are
-- never returned by this server-side source, even though HR can separately
-- access protected reviewer work through its canonical adjudication route.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
DO $hr_dossier_published$
DECLARE v_report jsonb;
BEGIN
 IF to_regprocedure('public.admin_employee_published_development(uuid)') IS NULL
  OR has_function_privilege('anon','public.admin_employee_published_development(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'Published-only HR dossier server boundary missing'; END IF;
 v_report:=public.admin_employee_published_development(
   '31000000-0000-4000-8000-000000000001');
 IF jsonb_array_length(v_report)<>1 OR v_report->0->>'overall_rating'<>'3'
  OR v_report->0->>'overall_narrative'<>'Manager independently selected this rating'
 THEN RAISE EXCEPTION 'HR employee dossier did not return exact independent publication'; END IF;
 IF jsonb_array_length(public.admin_employee_published_development(
    '31000000-0000-4000-8000-000000000006'))<>0 THEN
  RAISE EXCEPTION 'HR dossier inferred employee ratings from absent approvals'; END IF;
END
$hr_dossier_published$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
DO $manager_dossier_denied$
DECLARE v_denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.admin_employee_published_development(
   '31000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
 END;
 IF NOT v_denied THEN
  RAISE EXCEPTION 'Manager bypassed protected People/HR published dossier boundary'; END IF;
END
$manager_dossier_denied$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $employee_approved$
BEGIN
 IF (SELECT count(*) FROM private.stage2_self_published_human_ratings() WHERE appraisal_id='53000000-0000-4000-8000-000000000082')<>1 THEN
  RAISE EXCEPTION 'Private reader lost the exact independently approved rating';
 END IF;
 IF (SELECT count(*) FROM public.stage2_employee_published_human_ratings
  WHERE appraisal_id='53000000-0000-4000-8000-000000000082')<>1 THEN
  RAISE EXCEPTION 'Employee cannot read the single exact HR-approved rating version';
 END IF;
 IF EXISTS(SELECT 1 FROM public.performance_review_release_requests) THEN
  RAISE EXCEPTION 'HR private independent publication request leaked to employee';
 END IF;
END
$employee_approved$;
RESET ROLE;

-- Neither an unrelated colleague nor a different requested profile may read it.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000006',true);
DO $other_employee$
BEGIN
 IF EXISTS(SELECT 1 FROM public.stage2_employee_published_human_ratings
   WHERE appraisal_id='53000000-0000-4000-8000-000000000082')
  OR EXISTS(SELECT 1 FROM private.stage2_self_published_human_ratings()
   WHERE appraisal_id='53000000-0000-4000-8000-000000000082') THEN
  RAISE EXCEPTION 'Another employee read a colleague published rating';
 END IF;
END;
$other_employee$;
RESET ROLE;

-- Re-enabling universal MFA inside this rollback-only fixture must close the
-- view's explicit AAL1 view-owner bypass before server/provider cutover.
UPDATE public.organisations SET universal_totp_required=true
WHERE id='10000000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
DO $mfa_no_published_view_bypass$
BEGIN
 IF EXISTS(SELECT 1 FROM public.stage2_employee_published_human_ratings) THEN
  RAISE EXCEPTION 'AAL1 user bypassed universal authenticator gate through protected HR published view';
 END IF;
END
$mfa_no_published_view_bypass$;
RESET ROLE;

ROLLBACK;
SELECT 'Stage 2 human quarterly rating, independent HR publication and AAL2 privacy gate PASSED' AS result;
