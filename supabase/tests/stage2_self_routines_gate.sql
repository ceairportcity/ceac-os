\set ON_ERROR_STOP on
-- Disposable role fixture only. All schema/data/identity changes roll back.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false
 WHERE id='10000000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('ceac.test.self_routine',public.create_typed_work(
 p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',
 p_title=>'Rollback-only self-created daily routine',
 p_assignee_id=>'31000000-0000-4000-8000-000000000001',
 p_expected_outcome=>'Confirm the venue is ready',
 p_project_id=>'25000000-0000-4000-8000-000000000011',
 p_details=>jsonb_build_object('origin','self_created','schedule_kind','daily','starts_on',current_date,'steps',jsonb_build_array('Inspect venue'))
)::text,true);
DO $own$
DECLARE v_id uuid:=current_setting('ceac.test.self_routine')::uuid; v_operation uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.work_items WHERE id=v_id AND kind='routine' AND origin='self_created'
     AND assignee_id=auth.uid() AND assigned_by=auth.uid() AND status='in_progress') THEN
   RAISE EXCEPTION 'Own routine kind, origin or actor was not preserved';
 END IF;
 IF (SELECT count(*) FROM public.checklist_items WHERE work_item_id=v_id AND label='Inspect venue')<>1 THEN
   RAISE EXCEPTION 'Own routine checklist not atomic';
 END IF;
 PERFORM public.record_routine_occurrence(v_id,current_date,NULL,'Venue checked');
 BEGIN
   PERFORM public.record_routine_occurrence(v_id,current_date,NULL,'Duplicate');
   RAISE EXCEPTION 'Duplicate operation/date accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 SELECT id INTO v_operation FROM public.recurring_operations WHERE work_item_id=v_id;
 IF (SELECT count(*) FROM public.operation_occurrences WHERE operation_id=v_operation AND recorded_by=auth.uid())<>1 THEN
   RAISE EXCEPTION 'Occurrence attribution lost';
 END IF;
 PERFORM public.set_routine_paused(v_id,true,'Venue temporarily unavailable');
 PERFORM public.set_routine_paused(v_id,true,'Retry must not replace pause');
 IF (SELECT count(*) FROM public.routine_pause_periods WHERE operation_id=v_operation AND resumed_at IS NULL)<>1
   OR NOT EXISTS(SELECT 1 FROM public.routine_pause_periods WHERE operation_id=v_operation AND paused_by=auth.uid()
     AND pause_reason='Venue temporarily unavailable') THEN
  RAISE EXCEPTION 'Pause retry duplicated or rewrote accountable history';
 END IF;
 BEGIN
  INSERT INTO public.routine_pause_periods(operation_id,org_id,paused_at)
   VALUES(v_operation,public.app_org_id(),now());
  RAISE EXCEPTION 'Browser could forge pause history';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.record_routine_occurrence(v_id,current_date,NULL,'Paused');
   RAISE EXCEPTION 'Paused routine accepted outcome';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM public.set_routine_paused(v_id,false,'Venue available again');
 PERFORM public.set_routine_paused(v_id,false,'Retry must not rewrite resume');
 IF (SELECT count(*) FROM public.routine_pause_periods WHERE operation_id=v_operation)<>1
  OR NOT EXISTS(SELECT 1 FROM public.routine_pause_periods WHERE operation_id=v_operation
    AND resumed_at IS NOT NULL AND resumed_by=auth.uid() AND resume_reason='Venue available again') THEN
  RAISE EXCEPTION 'Resume retry rewrote accountable history';
 END IF;
 IF (SELECT count(*) FROM public.operation_occurrences WHERE operation_id=v_operation AND recorded_by=auth.uid())<>1 THEN
  RAISE EXCEPTION 'Pause/resume rewrote recorded occurrence proof';
 END IF;
 PERFORM public.change_routine_schedule(v_id,current_date+1,'weekly',ARRAY[6]::smallint[]);
 BEGIN
   PERFORM public.create_typed_work(p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000012',
     p_title=>'Wrong unit',p_assignee_id=>auth.uid(),p_expected_outcome=>'Denied',
     p_details=>'{"origin":"self_created","schedule_kind":"daily"}');
   RAISE EXCEPTION 'Self routine bypassed department membership';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.create_typed_work(p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',
     p_title=>'Wrong assignee',p_assignee_id=>'31000000-0000-4000-8000-000000000006',p_expected_outcome=>'Denied',
     p_details=>'{"origin":"self_created","schedule_kind":"daily"}');
   RAISE EXCEPTION 'Self routine impersonated colleague';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.create_typed_work(p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',
     p_title=>'Wrong phase',p_assignee_id=>auth.uid(),p_expected_outcome=>'Denied',
     p_phase_id=>'29000000-0000-4000-8000-000000000164',
     p_details=>'{"origin":"self_created","schedule_kind":"daily"}');
   RAISE EXCEPTION 'Orphan phase accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END;
$own$;
-- Synthetic past interval, never a production rewrite. Dates are relative so
-- the resumed day remains eligible while the previous paused day is denied.
RESET ROLE;
UPDATE public.recurring_operations SET starts_on=current_date-5
 WHERE work_item_id=current_setting('ceac.test.self_routine')::uuid;
UPDATE public.routine_schedule_versions SET effective_from=current_date-5
 WHERE operation_id=(SELECT id FROM public.recurring_operations WHERE work_item_id=current_setting('ceac.test.self_routine')::uuid)
 AND version=1;
UPDATE public.routine_pause_periods SET paused_at=(current_date-2)::timestamp at time zone 'Africa/Accra',
 resumed_at=(current_date-1)::timestamp at time zone 'Africa/Accra'
 WHERE operation_id=(SELECT id FROM public.recurring_operations WHERE work_item_id=current_setting('ceac.test.self_routine')::uuid);
SET LOCAL ROLE authenticated;
DO $past_pause$
BEGIN
 BEGIN
  PERFORM public.record_routine_occurrence(current_setting('ceac.test.self_routine')::uuid,current_date-2,NULL,'False paused-day credit');
  RAISE EXCEPTION 'Paused historical day accepted a new outcome';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM public.record_routine_occurrence(current_setting('ceac.test.self_routine')::uuid,current_date-1,NULL,'Resumption-day outcome');
END;
$past_pause$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000006',true);
DO $colleague$
DECLARE v_id uuid:=current_setting('ceac.test.self_routine')::uuid;
BEGIN
 BEGIN
   PERFORM public.record_routine_occurrence(v_id,current_date,NULL,'Claim colleague outcome');
   RAISE EXCEPTION 'Colleague gained individual completion credit';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.set_routine_paused(v_id,true,'Pause a colleague routine');
   RAISE EXCEPTION 'Colleague paused own-author routine';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.change_routine_schedule(v_id,current_date+2,'daily');
   RAISE EXCEPTION 'Colleague changed own-author schedule';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$colleague$;
RESET ROLE;
-- Revocation must take effect at the server, even with a still-signed token.
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
UPDATE public.profiles SET active=false WHERE id='31000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $inactive$
DECLARE v_id uuid:=current_setting('ceac.test.self_routine')::uuid;
BEGIN
 BEGIN
   PERFORM public.set_routine_paused(v_id,true,'Inactive account attempt');
   RAISE EXCEPTION 'Inactive creator paused routine';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.change_routine_schedule(v_id,current_date+2,'daily');
   RAISE EXCEPTION 'Inactive creator changed schedule';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.record_routine_occurrence(v_id,current_date,NULL,'Inactive account attempt');
   RAISE EXCEPTION 'Inactive creator recorded outcome';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$inactive$;
RESET ROLE;
ROLLBACK;
