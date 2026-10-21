\set ON_ERROR_STOP on
-- Every write below rolls back. The live database is never modified by this gate.
BEGIN;
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
 BEGIN
  UPDATE public.employee_roster_change_events SET reason='Overwritten history'
    WHERE employee_id='41000000-0000-4000-8000-000000000179';
  RAISE EXCEPTION 'History mutated directly';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$admin$;
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
END;
$staff$;
RESET ROLE;
ROLLBACK;
