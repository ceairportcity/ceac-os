\set ON_ERROR_STOP on
-- Rollback-only defensive coverage. Positive linking is additionally required
-- in the isolated Auth-backed browser acceptance before this may ship.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false
 WHERE id='10000000-0000-4000-8000-000000000010';
DO $surface$
BEGIN
 IF to_regprocedure('public.admin_confirm_existing_roster_account_link(uuid,uuid,timestamptz,uuid,text,boolean,text)') IS NULL
  OR has_function_privilege('anon','public.admin_confirm_existing_roster_account_link(uuid,uuid,timestamptz,uuid,text,boolean,text)','EXECUTE')
  OR has_table_privilege('authenticated','public.employee_roster_identity_link_events','INSERT,UPDATE,DELETE')
  OR has_table_privilege('authenticated','public.employee_roster','UPDATE')
  OR NOT EXISTS(SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='employee_roster_identity_link_events'
    AND policyname='employee_roster_identity_link_events_hr_read')
 THEN RAISE EXCEPTION 'Verified HR identity-link security surface is incorrect'; END IF;
END;
$surface$;
INSERT INTO public.employee_roster (
 id,org_id,full_name,employment_type,employment_status,identity_state,source_system,source_row_key)
VALUES (
 '41000000-0000-4000-8000-000000000189','10000000-0000-4000-8000-000000000010',
 'Unlinked identity gate fixture','not_recorded','active','needs_review','stage2_identity_gate','unlinked-189');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $staff$
BEGIN
 BEGIN
  PERFORM public.admin_confirm_existing_roster_account_link(
    '41000000-0000-4000-8000-000000000189',
    '31000000-0000-4000-8000-000000000004',clock_timestamp(),gen_random_uuid(),
    'exec@ceac.local.test',true,'Staff attempted an unverified identity link');
  RAISE EXCEPTION 'Staff escalated into HR identity linking';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$staff$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
DO $manager$
BEGIN
 BEGIN
  PERFORM public.admin_confirm_existing_roster_account_link(
    '41000000-0000-4000-8000-000000000189',
    '31000000-0000-4000-8000-000000000004',clock_timestamp(),gen_random_uuid(),
    'exec@ceac.local.test',true,'Manager attempted HR identity link');
  RAISE EXCEPTION 'Manager escalated into HR identity linking';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$manager$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
DO $admin$
DECLARE v_version timestamptz;
BEGIN
 SELECT updated_at INTO v_version FROM public.employee_roster
 WHERE id='41000000-0000-4000-8000-000000000189';
 BEGIN
  PERFORM public.admin_confirm_existing_roster_account_link(
    '41000000-0000-4000-8000-000000000189',
    '31000000-0000-4000-8000-000000000004',v_version,gen_random_uuid(),
    'exec@ceac.local.test',false,'Unconfirmed manual match refused');
  RAISE EXCEPTION 'Independent HR identity confirmation was not required';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.admin_confirm_existing_roster_account_link(
    '41000000-0000-4000-8000-000000000189',
    '31000000-0000-4000-8000-000000000004',v_version,gen_random_uuid(),
    'exec@ceac.local.test',true,'Missing existing private employee file');
  RAISE EXCEPTION 'Private documentary proof was not required';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS (SELECT 1 FROM public.employee_roster_identity_link_events
    WHERE employee_id='41000000-0000-4000-8000-000000000189')
 OR EXISTS (SELECT 1 FROM public.employee_roster
    WHERE id='41000000-0000-4000-8000-000000000189'
    AND profile_id IS NOT NULL) THEN
  RAISE EXCEPTION 'A denied HR identity link changed the person or audit trail';
 END IF;
END;
$admin$;
RESET ROLE;
ROLLBACK;
