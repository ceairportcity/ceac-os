\set ON_ERROR_STOP on
-- Every write below rolls back. The live database is never modified by this gate.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false WHERE id='10000000-0000-4000-8000-000000000010';
DO $surface$
BEGIN
 IF to_regprocedure('public.admin_record_roster_employment(uuid,timestamptz,text,text,text,text,text,uuid,uuid[],uuid,text)') IS NULL
  OR has_function_privilege('anon','public.admin_record_roster_employment(uuid,timestamptz,text,text,text,text,text,uuid,uuid[],uuid,text)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.admin_record_roster_employment(uuid,timestamptz,text,text,text,text,text,uuid,uuid[],uuid,text)','EXECUTE')
  OR has_table_privilege('authenticated','public.employee_roster','UPDATE')
  OR has_table_privilege('authenticated','public.employee_unit_memberships','INSERT,UPDATE,DELETE')
  OR has_table_privilege('authenticated','public.employee_roster_change_events','INSERT,UPDATE,DELETE') THEN
  RAISE EXCEPTION 'Roster-only protected update surface was opened to direct writes or anon'; END IF;
END;
$surface$;
INSERT INTO public.employee_roster
 (id,org_id,full_name,employment_type,employment_status,identity_state,source_system,source_row_key,review_note)
VALUES('41000000-0000-4000-8000-000000000179','10000000-0000-4000-8000-000000000010',
 'Roster-only edit fixture','not_recorded','active','roster_only','stage2_roster_gate','roster-only-179',
 'Original imported reviewer note');
-- Create the linked employee test row while the migration test harness
-- still has its setup role; authenticated clients can never insert roster
-- rows directly. The entire transaction is rolled back.
INSERT INTO public.employee_roster(
 id,org_id,profile_id,full_name,preferred_name,employment_type,
 employment_status,identity_state,source_system,source_row_key)
SELECT '41000000-0000-4000-8000-000000000182',p.org_id,p.id,
 p.full_name,p.preferred_name,'not_recorded','active','linked',
 'stage2_hr_linked_contact_gate','linked-contact-182'
FROM public.profiles p
WHERE p.id='31000000-0000-4000-8000-000000000001'
AND NOT EXISTS (
 SELECT 1 FROM public.employee_roster r
 WHERE r.org_id=p.org_id AND r.profile_id=p.id
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('ceac.test.roster_original_version',
 (SELECT updated_at::text FROM public.employee_roster WHERE id='41000000-0000-4000-8000-000000000179'),true);
DO $admin$
DECLARE v_result jsonb; v_old timestamptz:=current_setting('ceac.test.roster_original_version')::timestamptz;
BEGIN
 v_result:=public.admin_record_roster_employment(
  '41000000-0000-4000-8000-000000000179',v_old,'Updated roster-only employee','Preferred','HR worker',
  'permanent','active','20000000-0000-4000-8000-000000000011',
  ARRAY['20000000-0000-4000-8000-000000000012']::uuid[],null,'Confirmed HR roster and placement');
 IF v_result->>'employee_id'<>'41000000-0000-4000-8000-000000000179'
  OR v_result->>'profile_id' IS NOT NULL OR jsonb_array_length(v_result->'units')<>2
  OR (SELECT full_name FROM public.employee_roster WHERE id='41000000-0000-4000-8000-000000000179')<>'Updated roster-only employee'
  OR (SELECT review_note FROM public.employee_roster WHERE id='41000000-0000-4000-8000-000000000179')<>'Original imported reviewer note'
  OR (SELECT count(*) FROM public.employee_unit_memberships WHERE employee_id='41000000-0000-4000-8000-000000000179' AND is_primary)<>1
  OR (SELECT count(*) FROM public.employee_roster_change_events WHERE employee_id='41000000-0000-4000-8000-000000000179' AND actor_id=auth.uid())<>1
 THEN RAISE EXCEPTION 'Roster-only readback, history, reviewer note or unit placement was incorrect'; END IF;
 BEGIN
  PERFORM public.admin_record_roster_employment(
   '41000000-0000-4000-8000-000000000179',v_old,'Stale worker',null,null,
   'permanent','active',null,'{}'::uuid[],null,'Stale overwrite attempt');
  RAISE EXCEPTION 'Stale HR client overwrote a newer record';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  PERFORM public.admin_record_roster_employment(
   '41000000-0000-4000-8000-000000000179',
   (SELECT updated_at FROM public.employee_roster WHERE id='41000000-0000-4000-8000-000000000179'),
   'Invalid manager',null,null,'permanent','active',
   '20000000-0000-4000-8000-000000000011','{}'::uuid[],
   '31000000-0000-4000-8000-000000000007','Invalid reporting authority');
  RAISE EXCEPTION 'Manager from another unit was assigned';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.admin_record_roster_employment(
   '41000000-0000-4000-8000-000000000179',
   (SELECT updated_at FROM public.employee_roster WHERE id='41000000-0000-4000-8000-000000000179'),
   'Invalid foreign unit',null,null,'permanent','active',
   gen_random_uuid(),'{}'::uuid[],null,'Invalid foreign unit requested');
  RAISE EXCEPTION 'Foreign unit was accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.admin_record_roster_employment(
   (SELECT id FROM public.employee_roster WHERE profile_id='31000000-0000-4000-8000-000000000001' LIMIT 1),
   (SELECT updated_at FROM public.employee_roster WHERE profile_id='31000000-0000-4000-8000-000000000001' LIMIT 1),
   'Linked must not change',null,null,'permanent','active',null,'{}'::uuid[],null,
   'Linked employee workflow bypass');
  RAISE EXCEPTION 'Linked employment change bypassed canonical history';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- Update a second time with a fresh revision, moving the primary department.
 v_result:=public.admin_record_roster_employment(
  '41000000-0000-4000-8000-000000000179',
  (SELECT updated_at FROM public.employee_roster WHERE id='41000000-0000-4000-8000-000000000179'),
  'Updated roster-only employee','Preferred','HR worker',
  'permanent','active','20000000-0000-4000-8000-000000000012',
  '{}'::uuid[],null,'Transferred to another department');
 IF (SELECT count(*) FROM public.employee_unit_memberships WHERE employee_id='41000000-0000-4000-8000-000000000179')<>1
  OR NOT EXISTS(SELECT 1 FROM public.employee_unit_memberships WHERE employee_id='41000000-0000-4000-8000-000000000179'
   AND unit_id='20000000-0000-4000-8000-000000000012' AND is_primary)
  OR (SELECT count(*) FROM public.employee_roster_change_events WHERE employee_id='41000000-0000-4000-8000-000000000179')<>2
  OR EXISTS(SELECT 1 FROM public.employee_roster_change_events WHERE employee_id='41000000-0000-4000-8000-000000000179'
   AND (before_record IS NULL OR after_record IS NULL OR length(btrim(reason))<8))
 THEN RAISE EXCEPTION 'Primary transfer did not retain exact, reasoned, append-only HR history'; END IF;
 BEGIN
  UPDATE public.employee_roster_change_events SET reason='Overwritten history'
    WHERE employee_id='41000000-0000-4000-8000-000000000179';
  RAISE EXCEPTION 'History mutated directly';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$admin$;

-- Owner corrective extension: real HR email/phone/start date belong to the
-- SAME roster ID and SAME atomic employment-placement save, not to an Auth user.
DO $contact_profile$
DECLARE
 v_employee uuid:='41000000-0000-4000-8000-000000000179';
 v_before timestamptz;
 v_result jsonb;
BEGIN
 IF to_regprocedure('public.admin_record_roster_employment_profile(uuid,timestamptz,text,text,text,text,text,uuid,uuid[],uuid,text,text,date,text)') IS NULL
  OR has_function_privilege('anon','public.admin_record_roster_employment_profile(uuid,timestamptz,text,text,text,text,text,uuid,uuid[],uuid,text,text,date,text)','EXECUTE')
  OR has_table_privilege('authenticated','public.employee_roster','UPDATE') THEN
  RAISE EXCEPTION 'HR contact/start protected function or base roster RLS invalid'; END IF;
 SELECT updated_at INTO v_before FROM public.employee_roster WHERE id=v_employee;
 v_result:=public.admin_record_roster_employment_profile(
  v_employee,v_before,'Updated roster-only employee','Preferred','HR worker',
  'permanent','active','20000000-0000-4000-8000-000000000012',
  '{}'::uuid[],NULL,'Person@EXAMPLE.com','+233 20 123 4567','2026-10-20',
  'HR verified contact and initial start date');
 IF v_result->>'employee_id'<>v_employee::text
 OR v_result->>'profile_id' IS NOT NULL
 OR v_result->>'hr_contact_email'<>'person@example.com'
 OR v_result->>'hr_started_on'<>'2026-10-20'
 OR (SELECT hr_contact_phone FROM public.employee_roster WHERE id=v_employee)<>'+233 20 123 4567'
 OR (SELECT count(*) FROM public.employee_roster_change_events WHERE employee_id=v_employee)<>4
 OR NOT EXISTS(SELECT 1 FROM public.employee_roster_change_events
  WHERE employee_id=v_employee AND actor_id=auth.uid()
   AND after_record->>'hr_contact_email'='person@example.com'
   AND after_record->>'hr_started_on'='2026-10-20')
 THEN RAISE EXCEPTION 'Atomic HR roster contact/start history and readback are incomplete'; END IF;
 BEGIN
  PERFORM public.admin_record_roster_employment_profile(
   v_employee,v_before,'Stale overwrite','Preferred','HR worker',
   'permanent','active','20000000-0000-4000-8000-000000000012',
   '{}'::uuid[],NULL,'person@example.com',NULL,NULL,'Stale employee overwrite');
  RAISE EXCEPTION 'Stale contact editor overwrote current HR roster';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  PERFORM public.admin_record_roster_employment_profile(
   v_employee,(SELECT updated_at FROM public.employee_roster WHERE id=v_employee),
   'Invalid email','Preferred','HR worker','permanent','active',
   '20000000-0000-4000-8000-000000000012','{}'::uuid[],NULL,
   'not-an-email',NULL,NULL,'Contact validation negative');
  RAISE EXCEPTION 'Invalid contact email was accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.employee_roster WHERE id=v_employee AND profile_id IS NOT NULL) THEN
  RAISE EXCEPTION 'HR contact edit incorrectly created or linked an Auth account'; END IF;
END;
$contact_profile$;

-- Linked employee HR contact corrections use existing profile IDs and never Auth
-- address, role, capability, salary or account status. All writes roll back.
DO $linked_hr$
DECLARE v_staff uuid:='31000000-0000-4000-8000-000000000001';
 v_before public.profiles%rowtype; v_after public.profiles%rowtype;
 v_employee uuid; v_roster public.employee_roster%rowtype; v_out jsonb;
BEGIN
 IF has_function_privilege('anon',
  'public.admin_record_linked_person_contact(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE')
 OR has_table_privilege('authenticated','public.employee_linked_contact_change_events','INSERT,UPDATE,DELETE')
 THEN RAISE EXCEPTION 'Linked HR contact write policy exposed'; END IF;
 SELECT * INTO v_before FROM public.profiles WHERE id=v_staff;
 IF NOT FOUND THEN RAISE EXCEPTION 'Seeded ordinary staff is required for linked HR gate'; END IF;
 SELECT id INTO v_employee FROM public.employee_roster
   WHERE org_id=(SELECT org_id FROM public.profiles WHERE id=v_staff)
     AND profile_id=v_staff;

 IF v_employee IS NULL THEN
  RAISE EXCEPTION 'Linked profile and its rollback-only employee fixture were unavailable';
 END IF;
 v_out:=public.admin_record_linked_person_contact(
  v_employee,v_staff,v_before.full_name,v_before.preferred_name,v_before.phone,
  'Verified updated employee','Updated preferred','+233 20 123 4567',
  'Official HR profile details independently verified');
 SELECT * INTO v_after FROM public.profiles WHERE id=v_staff;
 SELECT * INTO v_roster FROM public.employee_roster WHERE id=v_employee;
 IF v_roster.full_name<>'Verified updated employee'
  OR v_roster.preferred_name<>'Updated preferred'
  OR v_roster.profile_id IS DISTINCT FROM v_staff
  OR (v_out->>'employee_id')::uuid IS DISTINCT FROM v_employee
  OR NOT EXISTS(SELECT 1 FROM public.employee_roster_change_events
    WHERE id=(v_out->>'roster_event_id')::uuid AND employee_id=v_employee
      AND actor_id=auth.uid() AND after_record->>'full_name'='Verified updated employee')
  OR v_after.full_name<>'Verified updated employee'
  OR v_after.phone<>'+233 20 123 4567'
  OR v_after.email IS DISTINCT FROM v_before.email
  OR v_after.is_admin IS DISTINCT FROM v_before.is_admin
  OR v_after.is_exec IS DISTINCT FROM v_before.is_exec
  OR v_after.active IS DISTINCT FROM v_before.active
  OR v_after.job_title IS DISTINCT FROM v_before.job_title
  OR (v_out->>'profile_id')::uuid IS DISTINCT FROM v_staff
  OR NOT EXISTS(SELECT 1 FROM public.employee_linked_contact_change_events
   WHERE id=(v_out->>'event_id')::uuid AND profile_id=v_staff
    AND actor_id=auth.uid()
    AND after_record->>'full_name'='Verified updated employee') THEN
  RAISE EXCEPTION 'Linked employee source, authority or history changed incorrectly'; END IF;
 BEGIN
  PERFORM public.admin_record_linked_person_contact(
   v_employee,v_staff,v_before.full_name,v_before.preferred_name,v_before.phone,
   'Old client overwrote','Preferred','+233 20 123 4567',
   'Old source revision attempted an overwrite');
  RAISE EXCEPTION 'Stale linked HR contact revision was accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  PERFORM public.admin_record_linked_person_contact(
   v_employee,v_staff,v_after.full_name,v_after.preferred_name,v_after.phone,
   'X','Preferred','+233 20 123 4567','Invalid short official name');
  RAISE EXCEPTION 'Invalid official employee name was accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
BEGIN
  PERFORM public.admin_record_linked_person_contact(
   '41000000-0000-4000-8000-000000000179',v_staff,
   v_after.full_name,v_after.preferred_name,v_after.phone,
   'Wrong roster','Other',NULL,'Unlinked identity cannot be silently replaced');
  RAISE EXCEPTION 'Wrong employee identity was accepted for linked HR record';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$linked_hr$;

SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $staff$
BEGIN
 IF EXISTS(SELECT 1 FROM public.employee_roster_change_events WHERE employee_id='41000000-0000-4000-8000-000000000179') THEN
  RAISE EXCEPTION 'Ordinary staff read protected roster history'; END IF;
 BEGIN
  PERFORM public.admin_record_roster_employment(
   '41000000-0000-4000-8000-000000000179',
   current_setting('ceac.test.roster_original_version')::timestamptz,'Unapproved',null,null,
   'permanent','active',null,'{}'::uuid[],null,'Unapproved staff overwrite');
  RAISE EXCEPTION 'Ordinary staff edited an HR roster';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.admin_record_roster_employment_profile(
   '41000000-0000-4000-8000-000000000179',clock_timestamp(),
   'Unauthorised','No','Job','permanent','active',NULL,'{}'::uuid[],NULL,
   'staff@example.com',NULL,NULL,'Staff attempted protected HR contact edit');
  RAISE EXCEPTION 'Ordinary staff edited protected roster contact';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.admin_record_linked_person_contact(
    '41000000-0000-4000-8000-000000000179',
    '31000000-0000-4000-8000-000000000002',NULL,NULL,NULL,
    'Employee','Staff',NULL,'Staff attempted to edit another person');
  RAISE EXCEPTION 'Ordinary staff edited official linked employee contact';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.employee_linked_contact_change_events) THEN
   RAISE EXCEPTION 'Staff read protected linked HR contact history'; END IF;
END;
$staff$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
DO $manager$
BEGIN
 BEGIN
  PERFORM public.admin_record_roster_employment(
   '41000000-0000-4000-8000-000000000179',
   (SELECT updated_at FROM public.employee_roster WHERE id='41000000-0000-4000-8000-000000000179'),
   'Unauthorised manager edit',null,null,'permanent','active',
   null,'{}'::uuid[],null,'Manager tried to change HR roster');
  RAISE EXCEPTION 'Manager role edited an HR record';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$manager$;
RESET ROLE;
ROLLBACK;
