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

-- Owner-authorised exception: Group Pastor may review the Head of HR's own
-- enrolled employee appraisal, never other personnel's private reviews.
-- The existing synthetic accounts/units are reused; all changes roll back.
UPDATE public.profiles SET job_title='Group Pastor'
WHERE id='31000000-0000-4000-8000-000000000004' AND is_exec AND active;

INSERT INTO public.employment_records(
 profile_id,org_id,employment_type,job_title,unit_id,membership_role,employment_status
) VALUES
 ('31000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000010',
  'staff','Administration and Head of HR','20000000-0000-4000-8000-000000000011','staff','active'),
 ('31000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000010',
  'staff','Group Pastor','20000000-0000-4000-8000-000000000011','staff','active')
ON CONFLICT(profile_id) DO UPDATE SET employment_status='active',
 unit_id=EXCLUDED.unit_id, job_title=EXCLUDED.job_title;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
DO $hr_head_period$
DECLARE v_cycle uuid; v_case uuid;
BEGIN
  v_cycle:=public.open_performance_review_cycle(
    'Independent Head of HR August 2026','2026-08-01','2026-08-31',
    'Owner-authorised independent appraisal review scope');
  SELECT a.id INTO v_case FROM public.appraisals a
    WHERE a.cycle_id=v_cycle AND a.profile_id='31000000-0000-4000-8000-000000000003';
  IF v_case IS NULL THEN RAISE EXCEPTION 'Employed HR head missing from review period'; END IF;
  IF EXISTS(SELECT 1 FROM public.appraisals a
    WHERE a.cycle_id=v_cycle AND a.profile_id='31000000-0000-4000-8000-000000000004')
  THEN RAISE EXCEPTION 'Group Pastor was wrongly enrolled in employee appraisal'; END IF;
  IF (SELECT manager_id FROM public.appraisals WHERE id=v_case) IS NOT NULL
  THEN RAISE EXCEPTION 'HR head review was auto-assigned without independent authorisation'; END IF;
  BEGIN
    PERFORM public.assign_performance_reviewer(v_case,'31000000-0000-4000-8000-000000000003',
      'Self-review must be forbidden');
    RAISE EXCEPTION 'HR head was permitted to review themselves';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.assign_performance_reviewer(v_case,'31000000-0000-4000-8000-000000000002',
      'Ordinary unit Manager is not authorised for the HR head');
    RAISE EXCEPTION 'Ordinary Manager received HR head review';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.assign_performance_reviewer(v_case,'31000000-0000-4000-8000-000000000004',
    'Owner approved Group Pastor as independent reviewer of this exact HR case');
  IF (SELECT manager_id FROM public.appraisals WHERE id=v_case)
        IS DISTINCT FROM '31000000-0000-4000-8000-000000000004'::uuid
  THEN RAISE EXCEPTION 'Group Pastor reviewer assignment was not persisted'; END IF;
  PERFORM set_config('ceac.hr_head_owner_case',v_case::text,true);
  PERFORM set_config('ceac.hr_head_owner_cycle',v_cycle::text,true);
END
$hr_head_period$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
DO $pastor_case_only$
DECLARE v_case uuid:=nullif(current_setting('ceac.hr_head_owner_case',true),'')::uuid;
        v_cycle uuid:=nullif(current_setting('ceac.hr_head_owner_cycle',true),'')::uuid;
        v_other uuid;
        v_entry uuid;
        v_request uuid;
BEGIN
  IF (SELECT count(*) FROM public.appraisals WHERE cycle_id=v_cycle)<>1
  THEN RAISE EXCEPTION 'Pastor can see appraisals other than specifically assigned HR head'; END IF;
  IF (SELECT count(*) FROM public.appraisal_evidence_items WHERE appraisal_id=v_case)
     <> (SELECT count(*) FROM public.appraisal_evidence_items e
            WHERE e.appraisal_id=v_case)
  THEN RAISE EXCEPTION 'Assigned evidence could not be inspected'; END IF;
  SELECT id INTO v_other FROM public.appraisals WHERE profile_id='31000000-0000-4000-8000-000000000001'
    AND cycle_id=v_cycle;
  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION 'Pastor read unrelated Staff appraisal';
  END IF;
  BEGIN
    PERFORM public.admin_employment_detail('31000000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'Pastor acquired protected HR employee detail authority';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.assign_performance_reviewer(v_case,'31000000-0000-4000-8000-000000000004',
      'Pastor may not self-assign other cases');
    RAISE EXCEPTION 'Pastor acquired general reviewer assignment authority';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  v_entry:=public.record_appraisal_entry(v_case,'manager_assessment',
     'I independently reviewed the Head of HR evidence and recorded this factual assessment.',NULL);
  IF v_entry IS NULL THEN RAISE EXCEPTION 'Pastor could not record his assigned assessment'; END IF;
  v_request:=public.performance_request_release(v_case,
     'The individual assigned appraisal is ready for independently authorised HR review.');
  IF v_request IS NULL THEN RAISE EXCEPTION 'Pastor assigned review cannot request independent HR publication'; END IF;
  PERFORM set_config('ceac.hr_head_release_request',v_request::text,true);
END
$pastor_case_only$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $staff_no_hr_review$
BEGIN
 IF EXISTS(SELECT 1 FROM public.appraisals
   WHERE id=nullif(current_setting('ceac.hr_head_owner_case',true),'')::uuid)
 THEN RAISE EXCEPTION 'Staff viewed Head of HR protected appraisal'; END IF;
END
$staff_no_hr_review$;
RESET ROLE;

-- Before any independent release, even the employee who is Administration
-- may not inspect the Group Pastor's confidential draft or pending HR queue.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
DO $admin_employee_no_unreleased_view$
DECLARE v_case uuid:=nullif(current_setting('ceac.hr_head_owner_case',true),'')::uuid;
        v_request uuid:=nullif(current_setting('ceac.hr_head_release_request',true),'')::uuid;
BEGIN
  IF EXISTS(SELECT 1 FROM public.appraisal_entries
    WHERE appraisal_id=v_case AND entry_type='manager_assessment')
  THEN RAISE EXCEPTION 'HR employee saw their own unpublished reviewer assessment'; END IF;
  IF EXISTS(SELECT 1 FROM public.performance_review_release_requests
    WHERE id=v_request)
  THEN RAISE EXCEPTION 'HR employee accessed independent publication request for their own case'; END IF;
  IF EXISTS(SELECT 1 FROM public.appraisal_human_rating_versions
    WHERE appraisal_id=v_case)
  THEN RAISE EXCEPTION 'HR employee accessed their own unpublished human ratings'; END IF;
END
$admin_employee_no_unreleased_view$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
DO $hr_cannot_self_publish$
DECLARE v_request uuid:=nullif(current_setting('ceac.hr_head_release_request',true),'')::uuid;
BEGIN
  BEGIN
    PERFORM public.performance_hr_decide_release(v_request,true,
      'Subject HR head must not approve publication of their own appraisal.');
    RAISE EXCEPTION 'HR head self-published appraisal';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- The subject remains forbidden from seeing this independent HR request.
  IF EXISTS(SELECT 1 FROM public.performance_review_release_requests WHERE id=v_request)
  THEN RAISE EXCEPTION 'Denied self-decision exposed confidential HR request'; END IF;
END
$hr_cannot_self_publish$;
RESET ROLE;
-- Inspect unchanged state as the fixture owner, not as the subject whom RLS
-- deliberately prevents from reading the pending request.
DO $self_decision_preserved$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.performance_review_release_requests
    WHERE id=nullif(current_setting('ceac.hr_head_release_request',true),'')::uuid
      AND state='pending' AND decided_by IS NULL AND decided_at IS NULL)
  THEN RAISE EXCEPTION 'Self-decision mutated confidential pending HR release'; END IF;
END
$self_decision_preserved$;

-- 23 Oct owner approval: the current assigned Group Pastor may publish ONLY
-- the HR-head case. Exercise the same endpoint as ordinary independent HR.
-- An ordinary Staff case remains outside this exception, even for a Pastor.
DO $ordinary_pending_fixture$
DECLARE v_case uuid;
BEGIN
 SELECT id INTO v_case FROM public.appraisals
 WHERE cycle_id=nullif(current_setting('ceac.hr_head_owner_cycle',true),'')::uuid
   AND profile_id='31000000-0000-4000-8000-000000000001';
 IF v_case IS NULL THEN RAISE EXCEPTION 'Ordinary review regression fixture absent'; END IF;
 UPDATE public.appraisals SET manager_id='31000000-0000-4000-8000-000000000002' WHERE id=v_case;
 PERFORM set_config('ceac.ordinary_case',v_case::text,true);
END
$ordinary_pending_fixture$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT public.record_appraisal_entry(nullif(current_setting('ceac.ordinary_case',true),'')::uuid,
 'manager_assessment','Ordinary Staff review remains under independent HR publication.',NULL);
SELECT set_config('ceac.ordinary_request',public.performance_request_release(
 nullif(current_setting('ceac.ordinary_case',true),'')::uuid,
 'An ordinary review needs independent HR publication.')::text,true);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
DO $pastor_no_general_release$
BEGIN
 BEGIN
  PERFORM public.performance_hr_decide_release(nullif(current_setting('ceac.ordinary_request',true),'')::uuid,
    true,'Executive must not publish an ordinary Staff review.');
  RAISE EXCEPTION 'Pastor acquired general publication authority';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$pastor_no_general_release$;
RESET ROLE;

-- The new command authority must retain the dormant privileged-MFA gate.
UPDATE public.organisations SET privileged_mfa_required=true
 WHERE id='10000000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
DO $pastor_privileged_mfa_denied$
BEGIN
 BEGIN
  PERFORM public.performance_hr_decide_release(nullif(current_setting('ceac.hr_head_release_request',true),'')::uuid,
    true,'Privileged MFA when enabled must still protect this publication command.');
  RAISE EXCEPTION 'AAL1 Pastor bypassed privileged MFA publication gate';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$pastor_privileged_mfa_denied$;
RESET ROLE;
UPDATE public.organisations SET privileged_mfa_required=false
 WHERE id='10000000-0000-4000-8000-000000000010';
SELECT set_config('request.jwt.claims','{}',true);

-- Wrong-title Executive and non-Executive Manager cannot use the exception.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
UPDATE public.profiles SET job_title='Executive colleague'
 WHERE id='31000000-0000-4000-8000-000000000004';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
DO $wrong_title_denied$
BEGIN
 BEGIN
  PERFORM public.performance_hr_decide_release(nullif(current_setting('ceac.hr_head_release_request',true),'')::uuid,
    true,'An Executive title alone must not authorise HR-head publication.');
  RAISE EXCEPTION 'Unqualified Executive published HR head';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$wrong_title_denied$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
DO $manager_no_hr_head_publication$
BEGIN
 BEGIN
  PERFORM public.performance_hr_decide_release(nullif(current_setting('ceac.hr_head_release_request',true),'')::uuid,
    true,'Ordinary Manager must not publish the HR head appraisal.');
  RAISE EXCEPTION 'Manager published HR head';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$manager_no_hr_head_publication$;
RESET ROLE;
UPDATE public.profiles SET job_title='Group Pastor'
 WHERE id='31000000-0000-4000-8000-000000000004';

-- Revoking assignment must immediately revoke publication, including decline.
UPDATE public.appraisals SET manager_id=NULL
 WHERE id=nullif(current_setting('ceac.hr_head_owner_case',true),'')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
DO $revoked_assignment_denied$
BEGIN
 BEGIN
  PERFORM public.performance_hr_decide_release(nullif(current_setting('ceac.hr_head_release_request',true),'')::uuid,
    false,'Former reviewer may not decide after assignment is revoked.');
  RAISE EXCEPTION 'Revoked Pastor decided HR-head publication';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$revoked_assignment_denied$;
RESET ROLE;
UPDATE public.appraisals SET manager_id='31000000-0000-4000-8000-000000000004'
 WHERE id=nullif(current_setting('ceac.hr_head_owner_case',true),'')::uuid;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
DO $exact_version_then_publication$
DECLARE v_case uuid:=nullif(current_setting('ceac.hr_head_owner_case',true),'')::uuid;
        v_request uuid:=nullif(current_setting('ceac.hr_head_release_request',true),'')::uuid;
        v_prior uuid; v_latest uuid; v_result jsonb;
BEGIN
 SELECT requested_assessment_id INTO v_prior FROM public.performance_review_release_requests
 WHERE id=v_request;
 v_latest:=public.record_appraisal_entry(v_case,'manager_assessment',
   'A revised factual assessment by the current assigned Group Pastor.',v_prior);
 -- Transactions share now(); deterministic latest-version checks need distinct dates.
 PERFORM set_config('ceac.hr_head_latest_entry',v_latest::text,true);
END
$exact_version_then_publication$;
RESET ROLE;
UPDATE public.appraisal_entries SET created_at=created_at-interval '1 second'
 WHERE id=(SELECT requested_assessment_id FROM public.performance_review_release_requests
 WHERE id=nullif(current_setting('ceac.hr_head_release_request',true),'')::uuid);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
DO $stale_denial_and_latest_publication$
DECLARE v_case uuid:=nullif(current_setting('ceac.hr_head_owner_case',true),'')::uuid;
        v_request uuid:=nullif(current_setting('ceac.hr_head_release_request',true),'')::uuid;
        v_new uuid; v_result jsonb;
BEGIN
 BEGIN
  PERFORM public.performance_hr_decide_release(v_request,true,
    'An obsolete version must not publish after a recorded revision.');
  RAISE EXCEPTION 'Pastor published stale assessment version';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.performance_hr_decide_release(v_request,false,
    'Declined obsolete assessment; a revised version requires its own decision.');
 v_new:=public.performance_request_release(v_case,
    'The latest assigned HR-head assessment is ready for publication.');
 v_result:=public.performance_hr_decide_release(v_new,true,
    'Group Pastor approved the exact latest version under owner authority.');
 IF v_result->>'manager_assessment_id' IS DISTINCT FROM current_setting('ceac.hr_head_latest_entry',true)
 THEN RAISE EXCEPTION 'Publication did not bind the exact revised assessment'; END IF;
 PERFORM set_config('ceac.hr_head_published_request',v_new::text,true);
 BEGIN
  PERFORM public.performance_hr_decide_release(v_new,true,
    'A duplicate publication decision must not change a final request.');
  RAISE EXCEPTION 'Final publication was decided twice';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$stale_denial_and_latest_publication$;
RESET ROLE;
DO $publication_audit$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.appraisals
   WHERE id=nullif(current_setting('ceac.hr_head_owner_case',true),'')::uuid
     AND status='shared' AND shared_by='31000000-0000-4000-8000-000000000004')
 OR NOT EXISTS(SELECT 1 FROM public.activity_events
   WHERE object_id=nullif(current_setting('ceac.hr_head_owner_case',true),'')::uuid
     AND verb='performance_hr_release_decided'
     AND meta->>'authority_scope'='assigned_hr_head_group_pastor'
     AND meta->>'approved'='true')
 THEN RAISE EXCEPTION 'Exact-case Pastor publication/audit absent'; END IF;
END
$publication_audit$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
DO $hr_employee_can_read_published_only$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.appraisal_entries
   WHERE id=nullif(current_setting('ceac.hr_head_latest_entry',true),'')::uuid)
 THEN RAISE EXCEPTION 'HR subject cannot read their authorised published assessment'; END IF;
 PERFORM public.performance_hr_decide_release(nullif(current_setting('ceac.ordinary_request',true),'')::uuid,
   true,'Independent HR still publishes ordinary employee reviews.');
END
$hr_employee_can_read_published_only$;
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
SELECT 'Stage 2 human ratings, independent HR and assigned HR-head publication, MFA privacy gate PASSED' AS result;
