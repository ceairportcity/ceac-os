\set ON_ERROR_STOP on
-- Stage 2 P6 confidential human appraisal, disposable isolated Supabase only.
-- Every test mutation is rolled back; never execute against production.
BEGIN;

DO $inventory$
DECLARE actual integer;
BEGIN
  IF to_regclass('public.appraisal_structured_ratings') IS NULL
    OR to_regclass('public.appraisal_review_exceptions') IS NULL
    OR to_regprocedure('public.stage2_rating_payload_valid(jsonb)') IS NULL
  THEN RAISE EXCEPTION 'P6 reviewer-controlled appraisal infrastructure missing'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='appraisal_cycles'
      AND column_name='cadence'
  ) THEN RAISE EXCEPTION 'Appraisal cadence missing'; END IF;
  IF has_table_privilege('anon','public.appraisal_structured_ratings','SELECT')
    OR has_table_privilege('anon','public.appraisal_structured_ratings','INSERT')
    OR has_table_privilege('authenticated','public.appraisal_structured_ratings','UPDATE')
    OR has_table_privilege('authenticated','public.appraisal_structured_ratings','DELETE')
  THEN RAISE EXCEPTION 'Appraisal rating grants expose an unsafe write/read'; END IF;
  SELECT count(*) INTO actual FROM pg_policies
  WHERE schemaname='public' AND tablename='appraisal_structured_ratings'
    AND policyname IN ('stage2_appraisal_rating_read','stage2_appraisal_rating_insert');
  IF actual<>2 THEN RAISE EXCEPTION 'Exact new rating RLS policies missing'; END IF;
  IF has_function_privilege('authenticated','public.stage2_quarterly_release_guard()','EXECUTE')
     OR has_function_privilege('authenticated','public.stage2_validate_rating_version_insert()','EXECUTE')
  THEN RAISE EXCEPTION 'Review trigger helpers leaked as callable SECURITY DEFINER RPCs'; END IF;
  IF NOT public.stage2_rating_payload_valid(
   '{"delivery":{"rating":"3","reason":"Actual completed work"},"quality":{"rating":"N/O","reason":"Not directly observed"},"reliability":{"rating":"4","reason":"Documented commitments"},"initiative":{"rating":"3","reason":"Observed improvements"},"collaboration":{"rating":"2","reason":"Relevant work evidence"}}'::jsonb
  ) OR public.stage2_rating_payload_valid('{"delivery":{"rating":"5","reason":"Missing four categories"}}')
  THEN RAISE EXCEPTION 'Five category validation does not reject incomplete rubric'; END IF;
END
$inventory$;

-- Synthetic, deterministic appraisal subjects in the existing seeded org only.
INSERT INTO public.appraisal_cycles(id,org_id,name,starts_on,ends_on,status,opened_by,opened_reason)
VALUES
 ('62000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000010',
 'P6 quarterly review','2026-07-01','2026-09-30','open',
 '31000000-0000-4000-8000-000000000003','Stage 2 QA'),
 ('62000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000010',
 'P6 monthly review','2026-08-01','2026-08-31','open',
 '31000000-0000-4000-8000-000000000003','Stage 2 QA');

DO $classification$
BEGIN
 IF (SELECT cadence FROM public.appraisal_cycles WHERE id='62000000-0000-4000-8000-000000000001') <> 'quarterly'
 OR (SELECT cadence FROM public.appraisal_cycles WHERE id='62000000-0000-4000-8000-000000000002') <> 'monthly'
 THEN RAISE EXCEPTION 'Quarter/month classification is incorrect'; END IF;
END
$classification$;

INSERT INTO public.appraisals(id,org_id,cycle_id,profile_id,manager_id,unit_id,status,opened_by)
VALUES
('62000000-0000-4000-8000-000000000011',
 '10000000-0000-4000-8000-000000000010',
 '62000000-0000-4000-8000-000000000001',
 '31000000-0000-4000-8000-000000000001',
 '31000000-0000-4000-8000-000000000002',
 '20000000-0000-4000-8000-000000000011','manager_draft',
 '31000000-0000-4000-8000-000000000003'),
('62000000-0000-4000-8000-000000000012',
 '10000000-0000-4000-8000-000000000010',
 '62000000-0000-4000-8000-000000000002',
 '31000000-0000-4000-8000-000000000001',
 '31000000-0000-4000-8000-000000000002',
 '20000000-0000-4000-8000-000000000011','manager_draft',
 '31000000-0000-4000-8000-000000000003');

INSERT INTO public.appraisal_entries(
 id,org_id,appraisal_id,profile_id,entry_type,body,created_by
) VALUES
('62000000-0000-4000-8000-000000000021',
 '10000000-0000-4000-8000-000000000010',
 '62000000-0000-4000-8000-000000000011',
 '31000000-0000-4000-8000-000000000001',
 'manager_assessment','Independent quarterly narrative',
 '31000000-0000-4000-8000-000000000002'),
('62000000-0000-4000-8000-000000000022',
 '10000000-0000-4000-8000-000000000010',
 '62000000-0000-4000-8000-000000000012',
 '31000000-0000-4000-8000-000000000001',
 'manager_assessment','Independent monthly narrative',
 '31000000-0000-4000-8000-000000000002');

-- Legacy monthly reporting MUST stay optional: no human rating required.
INSERT INTO public.performance_review_release_requests
 (org_id,appraisal_id,requested_by,requested_assessment_id,request_reason)
VALUES
 ('10000000-0000-4000-8000-000000000010',
 '62000000-0000-4000-8000-000000000012',
 '31000000-0000-4000-8000-000000000002',
 '62000000-0000-4000-8000-000000000022',
 'Monthly narrative voluntarily requested for HR release');

DO $quarter_missing$
BEGIN
  BEGIN
    INSERT INTO public.performance_review_release_requests
      (org_id,appraisal_id,requested_by,requested_assessment_id,request_reason)
    VALUES
      ('10000000-0000-4000-8000-000000000010',
      '62000000-0000-4000-8000-000000000011',
      '31000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000021',
      'Attempt without any human rating');
    RAISE EXCEPTION 'Quarter was falsely released without human ratings';
  EXCEPTION WHEN check_violation THEN NULL; END;
END
$quarter_missing$;

-- Assigned Manager writes all five independent human judgements, not a score.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
INSERT INTO public.appraisal_structured_ratings(
  org_id,appraisal_id,assessment_entry_id,categories,overall_rating,
  overall_explanation,strengths,challenges,next_steps,created_by
) VALUES (
  '10000000-0000-4000-8000-000000000010',
  '62000000-0000-4000-8000-000000000011',
  '62000000-0000-4000-8000-000000000021',
  '{"delivery":{"rating":"3","reason":"Specific recorded deliveries","evidence_refs":[]},"quality":{"rating":"N/O","reason":"No direct quality inspection","evidence_refs":[]},"reliability":{"rating":"4","reason":"Evidence of follow-up calls","evidence_refs":[]},"initiative":{"rating":"3","reason":"Documented improvements made","evidence_refs":[]},"collaboration":{"rating":"2","reason":"Actual shared work contributed","evidence_refs":[]}}'::jsonb,
  '3','Human judgment based on observed outcomes',
  'Communication','Limited training','Provide coaching',
  '31000000-0000-4000-8000-000000000002'
);

DO $private_before_hr$
BEGIN
 IF (SELECT count(*) FROM public.appraisal_structured_ratings
  WHERE appraisal_id='62000000-0000-4000-8000-000000000011')<>1
 THEN RAISE EXCEPTION 'Manager cannot inspect own recorded review'; END IF;
END
$private_before_hr$;
RESET ROLE;

-- Employee may not see unpublished confidential Manager scores.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $staff_private$
BEGIN
 IF EXISTS(SELECT 1 FROM public.appraisal_structured_ratings WHERE
   appraisal_id='62000000-0000-4000-8000-000000000011')
 THEN RAISE EXCEPTION 'Employee read unpublished manager appraisal'; END IF;
END
$staff_private$;
RESET ROLE;

-- Even after recording five ratings, the quarterly employee reflection or
-- formally approved, attributable HR exception is independently REQUIRED.
DO $reflection_required$
BEGIN
  BEGIN
    INSERT INTO public.performance_review_release_requests
      (org_id,appraisal_id,requested_by,requested_assessment_id,request_reason)
    VALUES
      ('10000000-0000-4000-8000-000000000010',
      '62000000-0000-4000-8000-000000000011',
      '31000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000021',
      'Attempt without employee reflection');
    RAISE EXCEPTION 'Quarter released without reflection or independent exception';
  EXCEPTION WHEN check_violation THEN NULL; END;
END
$reflection_required$;

INSERT INTO public.appraisal_entries(id,org_id,appraisal_id,profile_id,entry_type,body,created_by)
VALUES ('62000000-0000-4000-8000-000000000023',
 '10000000-0000-4000-8000-000000000010',
 '62000000-0000-4000-8000-000000000011',
 '31000000-0000-4000-8000-000000000001',
 'employee_reflection','My independently recorded reflection on this quarter',
 '31000000-0000-4000-8000-000000000001');

INSERT INTO public.performance_review_release_requests(
  org_id,appraisal_id,requested_by,requested_assessment_id,request_reason)
VALUES (
 '10000000-0000-4000-8000-000000000010',
 '62000000-0000-4000-8000-000000000011',
 '31000000-0000-4000-8000-000000000002',
 '62000000-0000-4000-8000-000000000021',
 'Quarterly ratings and employee reflection are completed'
);

-- An independent HR officer, not the requesting Manager, issues publication.
UPDATE public.performance_review_release_requests SET state='approved',
 decided_by='31000000-0000-4000-8000-000000000003', decided_at=now(),
 decision_reason='Independent QA review of manager evidence'
WHERE appraisal_id='62000000-0000-4000-8000-000000000011'
AND requested_assessment_id='62000000-0000-4000-8000-000000000021';
UPDATE public.appraisals SET status='shared',
 shared_by='31000000-0000-4000-8000-000000000003',shared_at=now()
WHERE id='62000000-0000-4000-8000-000000000011';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $staff_published$
BEGIN
 IF (SELECT count(*) FROM public.appraisal_structured_ratings
 WHERE appraisal_id='62000000-0000-4000-8000-000000000011')<>1
 THEN RAISE EXCEPTION 'HR-approved exact assessment not visible to employee'; END IF;
END
$staff_published$;
RESET ROLE;

ROLLBACK;
SELECT 'CEAC P6 immutable structured human ratings / HR isolation / quarterly release gate PASSED' AS result;
