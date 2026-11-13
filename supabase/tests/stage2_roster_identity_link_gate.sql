\set ON_ERROR_STOP on
-- Rollback-only isolated gate. Tests source/identity refusals without linking accounts.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false
 WHERE id='10000000-0000-4000-8000-000000000010';
DO $surface$
BEGIN
 IF to_regprocedure('public.admin_confirm_existing_roster_account_link(uuid,uuid,timestamptz,uuid,text,boolean,text)') IS NULL
 OR has_function_privilege('anon','public.admin_confirm_existing_roster_account_link(uuid,uuid,timestamptz,uuid,text,boolean,text)','EXECUTE')
 OR has_table_privilege('authenticated','public.employee_roster_identity_link_events','INSERT,UPDATE,DELETE')
 OR NOT has_function_privilege('authenticated','public.admin_confirm_existing_roster_account_link(uuid,uuid,timestamptz,uuid,text,boolean,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Existing-account linking boundary exposed or missing';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public'
   AND tablename='employee_roster_identity_link_events' AND cmd<>'SELECT') THEN
  RAISE EXCEPTION 'Identity link history allows unintended browser writes';
 END IF;
END;
$surface$;
INSERT INTO public.employee_roster(
 id,org_id,full_name,employment_type,employment_status,identity_state,
 source_system,source_row_key)
VALUES('42000000-0000-4000-8000-000000000179',
 '10000000-0000-4000-8000-000000000010',
 'Unlinked identity test person','not_recorded','active','needs_review',
 'stage2_identity_gate','identity_179');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $staff$
BEGIN
 BEGIN
  PERFORM public.admin_confirm_existing_roster_account_link(
    '42000000-0000-4000-8000-000000000179',
    '31000000-0000-4000-8000-000000000002',clock_timestamp(),
    gen_random_uuid(),'example@invalid.test',true,'A staff role cannot confirm a link');
  RAISE EXCEPTION 'Staff account linked an employee identity';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$staff$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
DO $admin$
DECLARE v_updated timestamptz; v_employee uuid:='42000000-0000-4000-8000-000000000179';
BEGIN
 -- This is the read-only optimistic identity version from the same employee.
 SELECT updated_at INTO v_updated FROM public.employee_roster WHERE id=v_employee;
 BEGIN
  PERFORM public.admin_confirm_existing_roster_account_link(
   v_employee,'31000000-0000-4000-8000-000000000002',v_updated,
   gen_random_uuid(),'account@example.com',false,
   'HR did not confirm independent documentary evidence');
  RAISE EXCEPTION 'Unconfirmed HR reconciliation was accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 BEGIN
  PERFORM public.admin_confirm_existing_roster_account_link(
   v_employee,'31000000-0000-4000-8000-000000000002',
   '2000-01-01T00:00:00Z'::timestamptz,gen_random_uuid(),
   'account@example.com',true,'This source revision is deliberately stale');
  RAISE EXCEPTION 'Stale employee revision was accepted';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 BEGIN
  PERFORM public.admin_confirm_existing_roster_account_link(
   v_employee,'31000000-0000-4000-8000-000000000002',v_updated,
   gen_random_uuid(),'not-the-account@example.invalid',true,
   'Account email must agree with confirmed existing Auth');
  RAISE EXCEPTION 'Unconfirmed Auth account identity was accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM public.employee_roster_identity_link_events WHERE employee_id=v_employee)
  OR EXISTS(SELECT 1 FROM public.employee_roster WHERE id=v_employee AND profile_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Refused identity checks still changed an identity or history';
 END IF;
END;
$admin$;
RESET ROLE;

DO $correction_fixture$
DECLARE
 v_org constant uuid:='10000000-0000-4000-8000-000000000010';
 v_employee constant uuid:='42000000-0000-4000-8000-000000000179';
 v_old constant uuid:='42000000-0000-4000-8000-000000000180';
 v_new constant uuid:='42000000-0000-4000-8000-000000000181';
 v_admin constant uuid:='31000000-0000-4000-8000-000000000003';
 v_file constant uuid:='42000000-0000-4000-8000-000000000182';
 v_schedule constant uuid:='42000000-0000-4000-8000-000000000183';
 v_unit uuid;
BEGIN
 SELECT id INTO STRICT v_unit FROM public.units WHERE org_id=v_org AND active ORDER BY id LIMIT 1;
 INSERT INTO auth.users(id,email,email_confirmed_at)
 VALUES(v_old,'old-roster-login@example.invalid',now()),(v_new,'new-roster-login@example.invalid',now());
 INSERT INTO public.profiles(id,org_id,full_name,email,active)
 VALUES(v_old,v_org,'Old fixture login','old-roster-login@example.invalid',true),
       (v_new,v_org,'New fixture login','new-roster-login@example.invalid',true)
 ON CONFLICT(id) DO UPDATE SET org_id=excluded.org_id,active=true;
 UPDATE public.employee_roster SET profile_id=v_old,identity_state='linked' WHERE id=v_employee;
 INSERT INTO public.employee_unit_memberships(org_id,employee_id,unit_id,is_primary)
 VALUES(v_org,v_employee,v_unit,true);
 INSERT INTO public.unit_memberships(org_id,profile_id,unit_id,role) VALUES(v_org,v_new,v_unit,'staff');
 INSERT INTO public.operational_files(id,org_id,filename,mime_type,size_bytes,storage_path,uploaded_by,state,finalised_at)
 VALUES(v_file,v_org,'correction-proof.pdf','application/pdf',42,v_org||'/'||v_file||'/correction-proof.pdf',v_admin,'active',now());
 INSERT INTO public.operational_file_links(org_id,file_id,context_type,context_id,relation,linked_by)
 VALUES(v_org,v_file,'employee_document',v_employee,'employee_document',v_admin);
 INSERT INTO public.workforce_schedule_versions(id,schedule_key,version,org_id,employee_id,profile_id,effective_from,source,day_map,reason,created_by)
 VALUES(v_schedule,v_schedule,1,v_org,v_employee,v_old,'2026-10-01','person','{}','Fixture schedule',v_admin);
END
$correction_fixture$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
DO $correct_link$
DECLARE
 v_employee constant uuid:='42000000-0000-4000-8000-000000000179';
 v_old constant uuid:='42000000-0000-4000-8000-000000000180';
 v_new constant uuid:='42000000-0000-4000-8000-000000000181';
 v_file constant uuid:='42000000-0000-4000-8000-000000000182';
 v_version timestamptz;
BEGIN
 SELECT updated_at INTO STRICT v_version FROM public.employee_roster WHERE id=v_employee;
 BEGIN
  PERFORM public.admin_correct_roster_account_link(v_employee,v_old,v_new,v_version,gen_random_uuid(),
    'new-roster-login@example.invalid',true,'Private document must be checked before correction');
  RAISE EXCEPTION 'Correction was accepted without the employee file';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM public.admin_correct_roster_account_link(v_employee,v_old,v_new,v_version,v_file,
   'new-roster-login@example.invalid',true,'HR verified that these logins represent one employee');
 IF NOT EXISTS(SELECT 1 FROM public.employee_roster WHERE id=v_employee AND profile_id=v_new)
 OR NOT EXISTS(SELECT 1 FROM public.employee_roster_change_events WHERE employee_id=v_employee
   AND before_record->>'linked_profile_id'=v_old::text AND after_record->>'linked_profile_id'=v_new::text) THEN
  RAISE EXCEPTION 'Employee link correction or HR audit missing';
 END IF;
END
$correct_link$;
RESET ROLE;
DO $schedule_preserved$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.workforce_schedule_versions
   WHERE id='42000000-0000-4000-8000-000000000183'
   AND profile_id='42000000-0000-4000-8000-000000000181' AND effective_from='2026-10-01' AND version=1) THEN
  RAISE EXCEPTION 'Correction did not preserve the employee schedule';
 END IF;
END
$schedule_preserved$;
ROLLBACK;
