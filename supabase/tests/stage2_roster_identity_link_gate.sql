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
ROLLBACK;