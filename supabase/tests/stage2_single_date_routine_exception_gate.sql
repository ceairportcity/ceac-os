\set ON_ERROR_STOP on
-- Isolated replay fixture only: every write is rolled back, no existing CEAC employee data.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false
 WHERE id='10000000-0000-4000-8000-000000000010';
DO $acl$
BEGIN
 IF has_function_privilege('anon','public.routine_change_single_date(uuid,date,text,text,integer)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.routine_change_single_date(uuid,date,text,text,integer)','EXECUTE')
  OR has_table_privilege('authenticated','public.routine_date_exceptions','INSERT')
  OR has_table_privilege('authenticated','public.routine_date_exceptions','UPDATE')
  OR has_table_privilege('authenticated','public.routine_date_exceptions','DELETE')
 THEN RAISE EXCEPTION 'Date exceptions opened an unauthorised write surface'; END IF;
END;
$acl$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('ceac.test.single_date_work',public.create_typed_work(
 p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',
 p_title=>'Rollback-only one-date skip',p_assignee_id=>'31000000-0000-4000-8000-000000000001',
 p_expected_outcome=>'Inspect scheduled period',
 p_details=>jsonb_build_object('schedule_kind','daily','starts_on',current_date,'interval_count',1))::text,true);
SELECT set_config('ceac.test.single_date_operation',(SELECT id::text FROM public.recurring_operations
 WHERE work_item_id=current_setting('ceac.test.single_date_work')::uuid),true);
DO $manager$
DECLARE v_work uuid:=current_setting('ceac.test.single_date_work')::uuid;
 v_op uuid:=current_setting('ceac.test.single_date_operation')::uuid; v_result jsonb;
BEGIN
 v_result:=public.routine_change_single_date(v_work,current_date+1,'skip','Authorised absence for one specific date',0);
 IF v_result->>'action'<>'skip' OR (v_result->>'version')::int<>1
  OR NOT EXISTS(SELECT 1 FROM public.routine_schedule_preview(ARRAY[v_work],current_date+1,current_date+1) p
    WHERE p.state='skipped')
  OR (SELECT count(*) FROM public.routine_date_exceptions
      WHERE operation_id=v_op AND scheduled_on=current_date+1)<>1
  OR NOT EXISTS(SELECT 1 FROM public.routine_schedule_preview(ARRAY[v_work],current_date,current_date) p
    WHERE p.state<>'skipped')
 THEN RAISE EXCEPTION 'Skip changed another date, lost its history or did not update preview'; END IF;
 BEGIN
  PERFORM public.routine_change_single_date(v_work,current_date+1,'restore','Stale client must fail',0);
  RAISE EXCEPTION 'Stale date revision was not rejected';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  PERFORM public.routine_change_single_date(v_work,current_date+1,'skip','Duplicate skip attempted',1);
  RAISE EXCEPTION 'Repeated skip created duplicate event';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  INSERT INTO public.routine_date_exceptions(org_id,operation_id,scheduled_on,version,action,reason,actor_id)
  VALUES(public.app_org_id(),v_op,current_date+2,1,'skip','Forged direct exception',auth.uid());
  RAISE EXCEPTION 'Direct client insert bypassed secured date RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 v_result:=public.routine_change_single_date(v_work,current_date+1,'restore','Corrected the single day plan',1);
 IF v_result->>'action'<>'restore' OR (v_result->>'version')::int<>2
  OR (SELECT count(*) FROM public.routine_date_exceptions WHERE operation_id=v_op AND scheduled_on=current_date+1)<>2
  OR NOT EXISTS(SELECT 1 FROM public.routine_schedule_preview(ARRAY[v_work],current_date+1,current_date+1) p
   WHERE p.state='scheduled')
 THEN RAISE EXCEPTION 'Single-date restoration failed to preserve immutable history'; END IF;
 IF EXISTS(SELECT 1 FROM public.operation_occurrences WHERE operation_id=v_op)
  OR EXISTS(SELECT 1 FROM public.routine_date_progress WHERE operation_id=v_op)
 THEN RAISE EXCEPTION 'Date exceptions fabricated completion or checklist progress'; END IF;
END;
$manager$;

-- An assigned Staff account can record its outcome, but cannot skip manager-owned routine dates.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $staff$
DECLARE v_work uuid:=current_setting('ceac.test.single_date_work')::uuid;
BEGIN
 BEGIN
  PERFORM public.routine_change_single_date(v_work,current_date+1,'skip','Unapproved Staff change',2);
  RAISE EXCEPTION 'Assigned Staff changed its manager-owned schedule';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- A restored date remains a valid individual occurrence; no approval inference.
 PERFORM public.record_routine_occurrence(v_work,current_date,null,'Actually verified restored work');
 IF NOT EXISTS(SELECT 1 FROM public.operation_occurrences
  WHERE operation_id=current_setting('ceac.test.single_date_operation')::uuid AND occurred_on=current_date)
 THEN RAISE EXCEPTION 'Restoration damaged normal work recording'; END IF;
END;
$staff$;

-- The actual manager must not skip a date containing recorded outcomes.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
DO $protect$
BEGIN
 BEGIN
  PERFORM public.routine_change_single_date(current_setting('ceac.test.single_date_work')::uuid,current_date,
      'skip','Cannot remove a genuine recorded occurrence',0);
  RAISE EXCEPTION 'Manager erased recorded outcome';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END;
$protect$;

-- Unrelated unit manager gains neither date read nor write authority.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000007',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}',true);
DO $other$
BEGIN
 IF EXISTS(SELECT 1 FROM public.routine_date_exceptions
  WHERE operation_id=current_setting('ceac.test.single_date_operation')::uuid) THEN
  RAISE EXCEPTION 'Another unit accessed protected date history'; END IF;
 BEGIN
  PERFORM public.routine_change_single_date(current_setting('ceac.test.single_date_work')::uuid,current_date+2,
  'skip','Unrelated manager attempted escalation',0);
  RAISE EXCEPTION 'Another department changed a protected routine';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$other$;
RESET ROLE;
ROLLBACK;
