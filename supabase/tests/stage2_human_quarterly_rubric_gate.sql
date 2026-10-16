\set ON_ERROR_STOP on
-- Stage 2 monthly-optional / quarterly-required human judgments.
-- Disposable seeded PostgreSQL only; all fixture mutations ROLLBACK.
BEGIN;

DO $inventory$
DECLARE count_p integer;
BEGIN
 IF to_regclass('public.appraisal_human_rating_versions') IS NULL
 OR to_regprocedure('public.stage2_validate_human_ratings(jsonb)') IS NULL
 OR to_regprocedure('public.stage2_employee_human_rating_visible(uuid)') IS NULL
 THEN RAISE EXCEPTION 'Stage 2 human rating data/validation/visibility is missing'; END IF;
 IF has_table_privilege('anon','public.appraisal_human_rating_versions','SELECT')
 OR has_table_privilege('anon','public.appraisal_human_rating_versions','INSERT')
 OR has_table_privilege('authenticated','public.appraisal_human_rating_versions','UPDATE')
 OR has_table_privilege('authenticated','public.appraisal_human_rating_versions','DELETE')
 THEN RAISE EXCEPTION 'Human rubric table has forbidden privileges'; END IF;
 SELECT count(*) INTO count_p FROM pg_policies
 WHERE schemaname='public' AND tablename='appraisal_human_rating_versions';
 IF count_p<>2 THEN RAISE EXCEPTION 'Human rubric RLS policy inventory drifted: %',count_p; END IF;
 IF has_function_privilege('anon','public.stage2_employee_human_rating_visible(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous caller can check employee protected assessment'; END IF;
END
$inventory$;

-- Prepare one real shape of an appraisal with ONE source-linked evidence item.
INSERT INTO public.appraisal_cycles(id,org_id,name,starts_on,ends_on,status,review_cadence)
VALUES ('52000000-0000-4000-8000-000000000101',
 '10000000-0000-4000-8000-000000000010',
 'Stage 2 isolated Q3 review','2026-07-01','2026-09-30','open','quarterly');
INSERT INTO public.appraisals(id,org_id,cycle_id,profile_id,manager_id,unit_id,status)
VALUES ('52000000-0000-4000-8000-000000000102',
 '10000000-0000-4000-8000-000000000010',
 '52000000-0000-4000-8000-000000000101',
 '31000000-0000-4000-8000-000000000001',
 '31000000-0000-4000-8000-000000000002',
 '20000000-0000-4000-8000-000000000011','manager_draft');
INSERT INTO public.appraisal_entries(
 id,org_id,appraisal_id,profile_id,entry_type,body,created_by
) VALUES (
 '52000000-0000-4000-8000-000000000103',
 '10000000-0000-4000-8000-000000000010',
 '52000000-0000-4000-8000-000000000102',
 '31000000-0000-4000-8000-000000000001','manager_assessment',
 'Human assessment connected to actual work evidence; author is the assigned Manager.',
 '31000000-0000-4000-8000-000000000002'
),(
 '52000000-0000-4000-8000-000000000104',
 '10000000-0000-4000-8000-000000000010',
 '52000000-0000-4000-8000-000000000102',
 '31000000-0000-4000-8000-000000000001','employee_reflection',
 'Employee has recorded their own context and work reflection.',
 '31000000-0000-4000-8000-000000000001'
);
INSERT INTO public.appraisal_evidence_items(
 id,org_id,appraisal_id,profile_id,category,source_type,source_id,label
) VALUES (
 '52000000-0000-4000-8000-000000000105',
 '10000000-0000-4000-8000-000000000010',
 '52000000-0000-4000-8000-000000000102',
 '31000000-0000-4000-8000-000000000001',
 'work','work_item','27000000-0000-4000-8000-000000000071',
 'Isolated test evidence with source identifier'
);

-- Ordinary staff cannot read any unpublished structured Manager judgment.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $unpublished$
BEGIN
 IF EXISTS(SELECT 1 FROM public.appraisal_human_rating_versions)
 THEN RAISE EXCEPTION 'Employee obtained protected Manager draft'; END IF;
END
$unpublished$;

-- Assigned Manager can write a human score only with genuine review evidence.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
DO $manager$
DECLARE v_categories jsonb; v_count integer;
BEGIN
 SELECT jsonb_agg(jsonb_build_object(
  'category',category,
  'rating', '3',
  'explanation','Manager personally observed and reviewed this specific evidence.',
  'evidenceIds',jsonb_build_array('52000000-0000-4000-8000-000000000105')
 )) INTO v_categories
 FROM unnest(ARRAY['delivery','quality','ownership','initiative','collaboration']) category;

 INSERT INTO public.appraisal_human_rating_versions(
  org_id,appraisal_id,assessment_entry_id,created_by,category_ratings,
  overall_rating,overall_narrative,strengths,challenges,improvement_actions,
  next_responsibilities
 ) VALUES (
  '10000000-0000-4000-8000-000000000010',
  '52000000-0000-4000-8000-000000000102',
  '52000000-0000-4000-8000-000000000103',
  auth.uid(),v_categories,
  '4',
  'Manager independently chooses an overall rating beyond the five category values.',
  'Specific strength reflects a verified work evidence item and documented delivery.',
  'The assessed period included a real coordination challenge and response.',
  'Schedule a documented follow-up and clearly assigned improvement actions.',
  'Continue the next unit deliverables and agree reasonable verification steps.'
 );
 SELECT count(*) INTO v_count FROM public.appraisal_human_rating_versions
 WHERE appraisal_id='52000000-0000-4000-8000-000000000102';
 IF v_count<>1 THEN RAISE EXCEPTION 'Manager did not save their own structured version'; END IF;
END
$manager$;

-- Employee still cannot inspect even though Manager wrote version.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $no_leak$
BEGIN
 IF EXISTS(SELECT 1 FROM public.appraisal_human_rating_versions)
 THEN RAISE EXCEPTION 'Employee read unpublished human rating'; END IF;
END
$no_leak$;

SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
DO $release$
DECLARE v_request uuid;
BEGIN
 v_request:=public.performance_request_release(
  '52000000-0000-4000-8000-000000000102',
  'Manager requested independent release after the completed formal review.'
 );
 IF NOT EXISTS(SELECT 1 FROM public.performance_review_release_requests
  WHERE id=v_request AND human_rating_version_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Quarterly release was not pinned to one human rubric version';
 END IF;
END
$release$;

SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
DO $hr$
DECLARE v_request uuid;
BEGIN
 SELECT id INTO v_request FROM public.performance_review_release_requests
 WHERE appraisal_id='52000000-0000-4000-8000-000000000102' AND state='pending';
 PERFORM public.performance_hr_decide_release(v_request,true,
  'Independent HR officer reviewed the Manager narrative and verified evidence.');
END
$hr$;

SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $visible$
BEGIN
 IF (SELECT count(*) FROM public.appraisal_human_rating_versions
    WHERE appraisal_id='52000000-0000-4000-8000-000000000102')<>1
 THEN RAISE EXCEPTION 'Employee cannot read independently HR-published rating'; END IF;
END
$visible$;
RESET ROLE;
ROLLBACK;
SELECT 'CEAC Stage 2 monthly optional / quarterly mandatory human rubric RLS and HR review gate PASSED' AS result;
