\set ON_ERROR_STOP on
-- Stage 2 P6: rollback-only human rubric, evidence and independent HR guard.
-- Depends on local seeded identities. Nothing is ever committed to production.
BEGIN;

DO $schema$
BEGIN
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
ROLLBACK;
SELECT 'Stage 2 human quarterly rating, privacy and HR release gate PASSED' AS result;
