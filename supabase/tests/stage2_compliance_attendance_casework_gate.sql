\set ON_ERROR_STOP on
-- Isolated transactional positive/negative roles; never run against live CEAC.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false WHERE id='10000000-0000-4000-8000-000000000010';
DO $surface$
BEGIN
 IF to_regprocedure('public.compliance_record_attendance_observation(uuid,date,text,text,text,text)') IS NULL
  OR to_regprocedure('public.compliance_attendance_case_action(uuid,text,text,text,text,text)') IS NULL
  OR to_regprocedure('public.compliance_attendance_case_register(date,date)') IS NULL
  OR has_function_privilege('anon','public.compliance_record_attendance_observation(uuid,date,text,text,text,text)','EXECUTE')
  OR has_function_privilege('anon','public.compliance_attendance_case_action(uuid,text,text,text,text,text)','EXECUTE')
  OR has_function_privilege('anon','public.compliance_attendance_case_register(date,date)','EXECUTE')
  OR has_function_privilege('authenticated','public.compliance_attendance_case_visible(uuid)','EXECUTE')
  OR has_table_privilege('authenticated','public.compliance_attendance_cases','SELECT,INSERT,UPDATE,DELETE')
  OR has_table_privilege('authenticated','public.compliance_attendance_case_events','SELECT,INSERT,UPDATE,DELETE')
 THEN RAISE EXCEPTION 'Compliance casework publicly exposed protected tables or authority helper'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='compliance_attendance_cases')<>0
  OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='compliance_attendance_case_events')<>0
 THEN RAISE EXCEPTION 'Unexpected browser table access policy on private Compliance casework'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.employee_roster
   WHERE profile_id='31000000-0000-4000-8000-000000000001'
    AND org_id='10000000-0000-4000-8000-000000000010')
 THEN RAISE EXCEPTION 'Required linked Staff employee fixture missing'; END IF;
END;
$surface$;
INSERT INTO public.capability_grants(org_id,profile_id,capability,scope_unit_id,granted_by,grant_reason)
SELECT '10000000-0000-4000-8000-000000000010',
 '31000000-0000-4000-8000-000000000005','compliance.manage',NULL,
 '31000000-0000-4000-8000-000000000003','Isolated observation case security verification'
WHERE NOT EXISTS (SELECT 1 FROM public.capability_grants
 WHERE profile_id='31000000-0000-4000-8000-000000000005'
 AND capability='compliance.manage' AND scope_unit_id IS NULL AND revoked_at IS NULL);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
DO $officer$
DECLARE v_employee uuid; v_id uuid; v_rows jsonb;
BEGIN
 SELECT id INTO v_employee FROM public.employee_roster
  WHERE profile_id='31000000-0000-4000-8000-000000000001' LIMIT 1;
 v_id:=public.compliance_record_attendance_observation(
  v_employee,current_date,'missing_evidence',
  'No verified session recorded in the factual source',
  'Officer asks for clarification before any attendance decision',
  'CEAC attendance evidence for the selected date');
 PERFORM set_config('ceac.test.observation_id',v_id::text,true);
 v_rows:=public.compliance_attendance_case_register(current_date,current_date);
 IF jsonb_array_length(v_rows)<>1 OR v_rows->0->>'status'<>'open'
  OR v_rows->0->'events'->0->>'event_type'<>'observation'
  OR v_rows->0->'events'->0->>'factual_note' IS NULL
  OR v_rows->0->'events'->0->>'interpretation_note' IS NULL
 THEN RAISE EXCEPTION 'Officer observation did not preserve separate facts and interpretation'; END IF;
 BEGIN
  PERFORM public.compliance_record_attendance_observation(v_employee,current_date,
   'missing_evidence','Duplicate factual summary from same date',
   'Duplicate interpretation must be refused',NULL);
  RAISE EXCEPTION 'Duplicate unresolved case was accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 PERFORM public.compliance_attendance_case_action(v_id,'open','refer',
  'Refer for independently authorised HR attendance review',NULL,'hr');
 BEGIN
  PERFORM public.compliance_attendance_case_action(v_id,'referred','resolve',
   'Compliance officer attempts independent disciplinary decision',NULL,NULL);
  RAISE EXCEPTION 'Compliance office bypassed HR/Manager resolution';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$officer$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $employee$
DECLARE v_id uuid:=current_setting('ceac.test.observation_id')::uuid; v_rows jsonb;
BEGIN
 v_rows:=public.compliance_attendance_case_register(current_date,current_date);
 IF jsonb_array_length(v_rows)<>1 OR v_rows->0->>'id'<>v_id::text THEN
  RAISE EXCEPTION 'Employee cannot inspect own attributable case'; END IF;
 PERFORM public.compliance_attendance_case_action(v_id,'referred','respond',
  'Recorded employee response with relevant correction context',NULL,NULL);
 PERFORM public.compliance_attendance_case_action(v_id,'referred','dispute',
  'Disputed inaccurate interpretation; review required',NULL,NULL);
 BEGIN
  PERFORM public.compliance_record_attendance_observation(
   (v_rows->0->>'employee_id')::uuid,
    current_date,'other','Unauthorised staff factual finding','Staff claims Compliance authority',NULL);
  RAISE EXCEPTION 'Staff submitted Compliance observation';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.compliance_attendance_cases SET status='resolved' WHERE id=v_id;
  RAISE EXCEPTION 'Employee updated protected case table directly';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$employee$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000007',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}',true);
DO $other_unit$
DECLARE v_id uuid:=current_setting('ceac.test.observation_id')::uuid;
BEGIN
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(
  public.compliance_attendance_case_register(current_date,current_date)) item
  WHERE item->>'id'=v_id::text) THEN
  RAISE EXCEPTION 'Unrelated Manager read a private attendance case'; END IF;
 BEGIN
  PERFORM public.compliance_attendance_case_action(v_id,'disputed','respond',
   'Other unit attempts an unauthorised response',NULL,NULL);
  RAISE EXCEPTION 'Unrelated Manager wrote another unit case';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$other_unit$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
DO $independent_hr$
DECLARE v_id uuid:=current_setting('ceac.test.observation_id')::uuid; v_rows jsonb;
BEGIN
 PERFORM public.compliance_attendance_case_action(v_id,'disputed','resolve',
  'HR considered case evidence; observation closed without automatically altering attendance',NULL,NULL);
 v_rows:=public.compliance_attendance_case_register(current_date,current_date);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_rows) r WHERE r->>'id'=v_id::text
  AND r->>'status'='resolved' AND jsonb_array_length(r->'events')=5) THEN
  RAISE EXCEPTION 'Independent resolution or append-only event history missing'; END IF;
 BEGIN
  PERFORM public.compliance_attendance_case_action(v_id,'resolved','respond',
   'Attempt to reopen closed history without new case',NULL,NULL);
  RAISE EXCEPTION 'Resolved case permitted another write';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END;
$independent_hr$;
RESET ROLE;
ROLLBACK;
