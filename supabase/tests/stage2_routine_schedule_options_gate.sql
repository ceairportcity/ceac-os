\set ON_ERROR_STOP on
BEGIN;
UPDATE public.organisations SET universal_totp_required=false WHERE id='10000000-0000-4000-8000-000000000010';
DO $surface$
BEGIN
 IF has_function_privilege('anon','public.routine_schedule_preview(uuid[],date,date)','EXECUTE')
  OR has_function_privilege('anon','public.change_routine_schedule_options(uuid,date,jsonb)','EXECUTE')
  OR has_function_privilege('anon','private.change_routine_schedule_options(uuid,date,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'Anonymous schedule API execution'; END IF;
 IF EXISTS(select 1 from pg_proc where oid in('public.routine_schedule_preview(uuid[],date,date)'::regprocedure,
  'public.change_routine_schedule_options(uuid,date,jsonb)'::regprocedure) and prosecdef)
  OR NOT EXISTS(select 1 from pg_proc where oid='private.change_routine_schedule_options(uuid,date,jsonb)'::regprocedure
    and prosecdef and proconfig @> array['search_path=""']) THEN
  RAISE EXCEPTION 'Unreviewed schedule invoker/trusted implementation boundary'; END IF;
END;
$surface$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('ceac.test.options',public.create_typed_work(
 p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',
 p_title=>'Rollback-only interval/count routine',p_assignee_id=>auth.uid(),p_expected_outcome=>'Inspect venue',
 p_details=>jsonb_build_object('origin','self_created','schedule_kind','daily','starts_on',current_date-6,
  'interval_count',2,'timezone','Africa/Accra','due_time','09:30','occurrence_limit',2)
)::text,true);
DO $options$
DECLARE w uuid:=current_setting('ceac.test.options')::uuid; v_dates date[];
BEGIN
 SELECT array_agg(scheduled_on order by scheduled_on) INTO v_dates
 FROM public.routine_schedule_preview(array[w],current_date-6,current_date+5);
 IF v_dates IS DISTINCT FROM array[current_date-6,current_date-4] THEN RAISE EXCEPTION 'Interval/count dates incorrect: %',v_dates; END IF;
 PERFORM public.record_routine_occurrence(w,current_date-6,null,'Actual inspection');
 BEGIN PERFORM public.record_routine_occurrence(w,current_date-5,null,'Off interval'); RAISE EXCEPTION 'Off-interval proof accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.record_routine_occurrence(w,current_date-2,null,'After end count'); RAISE EXCEPTION 'Post-count proof accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM public.change_routine_schedule_options(w,current_date+1,
  '{"schedule_kind":"weekly","weekdays":[6],"interval_count":2,"timezone":"Europe/Amsterdam","due_time":"10:00","occurrence_limit":3}');
 IF (SELECT count(*) FROM public.routine_schedule_preview(array[w],current_date-6,current_date)
   WHERE scheduled_on=current_date-6 AND state='recorded')<>1 THEN RAISE EXCEPTION 'Future options rewrote past proof'; END IF;
 BEGIN PERFORM public.change_routine_schedule_options(w,current_date+2,
   '{"schedule_kind":"daily","timezone":"not/a-zone"}'); RAISE EXCEPTION 'Invalid zone accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF (SELECT max(version) FROM public.routine_schedule_versions WHERE operation_id=(SELECT id FROM public.recurring_operations WHERE work_item_id=w))<>2 THEN
  RAISE EXCEPTION 'Rejected configuration left a partial version'; END IF;
 BEGIN PERFORM public.routine_schedule_preview(array[w],current_date,current_date+371); RAISE EXCEPTION 'Unbounded preview accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END;
$options$;
-- Fixed 2026 clock transitions test real named-zone rules, not machine TZ.
DO $dst$
DECLARE w uuid; v_due timestamptz;
BEGIN
 w:=public.create_typed_work(p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',
  p_title=>'Rollback DST fall',p_assignee_id=>auth.uid(),p_expected_outcome=>'Inspect venue',
  p_details=>'{"origin":"self_created","schedule_kind":"weekly","weekdays":[7],"starts_on":"2026-10-25","timezone":"America/New_York","due_time":"01:30","occurrence_limit":3}');
 SELECT due_at INTO v_due FROM public.routine_schedule_preview(array[w],'2026-10-25','2026-11-08') WHERE scheduled_on='2026-11-01';
 IF v_due IS DISTINCT FROM '2026-11-01 06:30:00+00'::timestamptz THEN RAISE EXCEPTION 'Repeated local time not resolved to later instant: %',v_due; END IF;
 w:=public.create_typed_work(p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',
  p_title=>'Rollback DST spring',p_assignee_id=>auth.uid(),p_expected_outcome=>'Inspect venue',
  p_details=>'{"origin":"self_created","schedule_kind":"daily","starts_on":"2026-03-08","timezone":"America/New_York","due_time":"02:30","occurrence_limit":1}');
 SELECT due_at INTO v_due FROM public.routine_schedule_preview(array[w],'2026-03-08','2026-03-09') WHERE scheduled_on='2026-03-08';
 IF v_due IS DISTINCT FROM '2026-03-08 07:30:00+00'::timestamptz THEN RAISE EXCEPTION 'Skipped local time not shifted forward: %',v_due; END IF;
END;
$dst$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000006',true);
DO $colleague$
BEGIN
 BEGIN PERFORM public.change_routine_schedule_options(current_setting('ceac.test.options')::uuid,current_date+2,'{"schedule_kind":"daily"}');
  RAISE EXCEPTION 'Colleague changed own-author routine'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$colleague$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);
DO $other_unit$
BEGIN
 IF EXISTS(SELECT 1 FROM public.routine_schedule_preview(array[current_setting('ceac.test.options')::uuid],current_date-6,current_date+30)) THEN
  RAISE EXCEPTION 'Other unit read routine schedule'; END IF;
END;
$other_unit$;
RESET ROLE;
UPDATE public.organisations SET universal_totp_required=true WHERE id='10000000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $future_assurance$
BEGIN
 BEGIN PERFORM public.routine_schedule_preview(array[current_setting('ceac.test.options')::uuid],current_date,current_date+1);
  RAISE EXCEPTION 'Assurance-off preview bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.change_routine_schedule_options(current_setting('ceac.test.options')::uuid,current_date+2,'{"schedule_kind":"daily"}');
  RAISE EXCEPTION 'Assurance-off configuration bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$future_assurance$;
RESET ROLE;
ROLLBACK;
