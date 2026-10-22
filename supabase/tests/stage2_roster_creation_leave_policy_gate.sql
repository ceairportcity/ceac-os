\set ON_ERROR_STOP on
-- Canonical roster creation and leave-policy activation: seeded local roles only.
-- All employee and policy test operations roll back.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false WHERE id='10000000-0000-4000-8000-000000000010';
DO $surface$
BEGIN
 IF to_regprocedure('public.admin_create_roster_employee(text,text,text,text,text,uuid,uuid[],uuid,text,text,date,text,boolean)') IS NULL
  OR has_function_privilege('anon','public.admin_create_roster_employee(text,text,text,text,text,uuid,uuid[],uuid,text,text,date,text,boolean)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.admin_create_roster_employee(text,text,text,text,text,uuid,uuid[],uuid,text,text,date,text,boolean)','EXECUTE')
  OR has_table_privilege('authenticated','public.employee_roster','INSERT')
  OR has_table_privilege('authenticated','public.employee_roster_change_events','INSERT,UPDATE,DELETE')
 THEN RAISE EXCEPTION 'New employee privileged creation surface invalid'; END IF;
END;
$surface$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
DO $admin$
DECLARE
 v_new uuid;
 v_out jsonb;
 v_denied boolean;
 v_existing_profiles integer;
BEGIN
 SELECT count(*) INTO v_existing_profiles FROM public.profiles;
 v_out:=public.admin_create_roster_employee(
  'Stage Two New Roster Person','New Person','Employee','permanent','active',
  '20000000-0000-4000-8000-000000000011',
  ARRAY['20000000-0000-4000-8000-000000000012']::uuid[],
  NULL,'new-roster-185@example.test','+233 20 125 4567','2026-10-22',
  'Verified appointment from authorised HR source',false);
 v_new:=(v_out->>'employee_id')::uuid;
 IF v_out->>'created'<>'true' OR v_out->>'profile_id' IS NOT NULL
  OR NOT EXISTS(SELECT 1 FROM public.employee_roster
    WHERE id=v_new AND profile_id IS NULL AND source_system='hr_manual'
      AND identity_state='roster_only' AND hr_contact_email='new-roster-185@example.test'
      AND hr_started_on='2026-10-22')
  OR (SELECT count(*) FROM public.employee_unit_memberships WHERE employee_id=v_new)<>2
  OR (SELECT count(*) FROM public.employee_unit_memberships WHERE employee_id=v_new AND is_primary)<>1
  OR NOT EXISTS(SELECT 1 FROM public.employee_roster_change_events
       WHERE employee_id=v_new AND actor_id=auth.uid()
         AND after_record->>'event'='employee_created'
         AND before_record='{}'::jsonb)
  OR (SELECT count(*) FROM public.profiles)<>v_existing_profiles THEN
   RAISE EXCEPTION 'New employee did not save in canonical roster or mutated an operational identity'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.admin_create_roster_employee(
   'Stage Two New Roster Person',NULL,NULL,'permanent','active',NULL,'{}'::uuid[],NULL,
   'new-roster-185@example.test',NULL,NULL,
   'Trying to duplicate a recorded employee or account',false);
 EXCEPTION WHEN unique_violation THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Duplicate existing email accepted'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.admin_create_roster_employee(
   'Stage Two New Roster Person',NULL,NULL,'permanent','active',NULL,'{}'::uuid[],NULL,
   NULL,NULL,NULL,'Same person name requires independent verification',false);
 EXCEPTION WHEN unique_violation THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Unreviewed exact-name duplication accepted'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.admin_create_roster_employee(
   'Foreign Unit Test',NULL,NULL,'permanent','active',gen_random_uuid(),'{}'::uuid[],
   NULL,NULL,NULL,NULL,'Unverified different organisation placement',false);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Unknown organisation unit accepted'; END IF;
END;
$admin$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $staff$
DECLARE v_denied boolean:=false; v_result jsonb;
BEGIN
 BEGIN
  PERFORM public.admin_create_roster_employee(
   'Staff Cannot Create HR Employee',NULL,NULL,'permanent','active',
   NULL,'{}'::uuid[],NULL,NULL,NULL,NULL,'Staff attempted protected employee creation',false);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Ordinary Staff created employee without HR authority'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.leave_policy_versions
  WHERE org_id=public.app_org_id() AND state='active'
   AND effective_from<=DATE '2026-10-22'
   AND (effective_to IS NULL OR effective_to>=DATE '2026-10-22')) THEN
  v_result:=public.workforce_annual_leave_summary(auth.uid(),DATE '2026-10-22');
  IF (v_result->>'balance_available')::boolean IS DISTINCT FROM false
    OR v_result->>'reason'<>'annual_leave_policy_not_active'
    OR v_result->>'available_days' IS NOT NULL THEN
    RAISE EXCEPTION 'Annual leave balance was issued with no active policy'; END IF;
 END IF;
END;
$staff$;
RESET ROLE;
ROLLBACK;
SELECT 'Stage 2 HR roster creation + annual leave active-policy security gate PASSED' AS result;
