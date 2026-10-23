\set ON_ERROR_STOP on
BEGIN;
UPDATE public.organisations SET universal_totp_required=false WHERE id='10000000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('ceac.test.date_work',public.create_typed_work(
 p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',
 p_title=>'Rollback-only dated progress',p_assignee_id=>auth.uid(),p_expected_outcome=>'Inspect each scheduled day',
 p_details=>jsonb_build_object('origin','self_created','schedule_kind','daily','starts_on',current_date-1,
 'steps',jsonb_build_array('Inspect doors','Check lights'))
)::text,true);
SELECT set_config('ceac.test.date_operation',(SELECT id::text FROM public.recurring_operations WHERE work_item_id=current_setting('ceac.test.date_work')::uuid),true);
DO $own$
DECLARE op uuid:=current_setting('ceac.test.date_operation')::uuid; step uuid; steps uuid[]; first_id uuid; v_snapshot jsonb;
BEGIN
 SELECT array_agg(id ORDER BY position) INTO steps FROM public.checklist_items WHERE work_item_id=current_setting('ceac.test.date_work')::uuid;
 step:=steps[1];
 INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,actor_id,status,completed_step_ids,recorded_at,checklist_snapshot)
 VALUES(public.app_org_id(),op,current_date,'31000000-0000-4000-8000-000000000003','in_progress',ARRAY[step],'2001-01-01','[{"label":"FORGED"}]') RETURNING id,checklist_snapshot INTO first_id,v_snapshot;
 IF NOT EXISTS(SELECT 1 FROM public.routine_date_progress WHERE id=first_id AND actor_id=auth.uid() AND recorded_at>now()-interval '3 minutes')
  OR jsonb_array_length(v_snapshot)<>2 OR v_snapshot::text LIKE '%FORGED%' OR v_snapshot->0->>'done'<>'true' THEN
  RAISE EXCEPTION 'Date actor/time/checklist snapshot was not stamped from real source'; END IF;
 BEGIN
  INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,actor_id,status)
   VALUES(public.app_org_id(),op,current_date,auth.uid(),'in_progress');
  RAISE EXCEPTION 'Stale same-date progress overwrote another save';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,entry_number,actor_id,status,completed_step_ids)
   VALUES(public.app_org_id(),op,current_date,2,auth.uid(),'ready_for_review',ARRAY[step]);
  RAISE EXCEPTION 'Incomplete date checklist marked ready';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,entry_number,actor_id,status,completed_step_ids)
   VALUES(public.app_org_id(),op,current_date,2,auth.uid(),'in_progress',ARRAY[gen_random_uuid()]);
  RAISE EXCEPTION 'Foreign checklist step accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,entry_number,actor_id,status,evidence_links)
   VALUES(public.app_org_id(),op,current_date,2,auth.uid(),'in_progress',ARRAY['javascript:alert(1)']);
  RAISE EXCEPTION 'Unsafe evidence link accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,entry_number,actor_id,status)
   VALUES(public.app_org_id(),op,current_date,2,auth.uid(),'waiting_on');
  RAISE EXCEPTION 'Waiting status accepted without factual explanation';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,entry_number,actor_id,status,completed_step_ids,note,evidence_links)
 VALUES(public.app_org_id(),op,current_date,2,auth.uid(),'ready_for_review',steps,'Doors and lights inspected',ARRAY['https://example.org/inspection']);
 INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,actor_id,status,note)
 VALUES(public.app_org_id(),op,current_date-1,auth.uid(),'waiting_on','Waiting for safe access');
 IF (SELECT count(*) FROM public.routine_date_progress WHERE operation_id=op AND scheduled_on=current_date)<>2
  OR (SELECT cardinality(completed_step_ids) FROM public.routine_date_progress WHERE operation_id=op AND scheduled_on=current_date-1)<>0 THEN
  RAISE EXCEPTION 'Checklist state leaked between dates or history was lost'; END IF;
 IF EXISTS(SELECT 1 FROM public.operation_occurrences WHERE operation_id=op)
  OR NOT EXISTS(SELECT 1 FROM public.work_items WHERE id=current_setting('ceac.test.date_work')::uuid AND status='in_progress') THEN
  RAISE EXCEPTION 'Readiness invented completion or changed the parent'; END IF;
 BEGIN UPDATE public.routine_date_progress SET status='waiting_on' WHERE id=first_id;
  RAISE EXCEPTION 'Historical progress UPDATE allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM public.routine_date_progress WHERE id=first_id;
  RAISE EXCEPTION 'Historical progress DELETE allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,actor_id,status)
  VALUES(public.app_org_id(),op,current_date+1,auth.uid(),'in_progress');
  RAISE EXCEPTION 'Future date accepted actual progress'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END;
$own$;
-- Same-unit colleague can read permitted work, but gains no assignment power.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000006',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}',true);
DO $colleague$
BEGIN
 BEGIN INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,entry_number,actor_id,status)
 VALUES(public.app_org_id(),current_setting('ceac.test.date_operation')::uuid,current_date,3,auth.uid(),'in_progress');
 RAISE EXCEPTION 'Colleague wrote another assignee progress'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$colleague$;
-- Unrelated manager cannot read or write this date.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000007',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}',true);
DO $other$
BEGIN
 IF EXISTS(SELECT 1 FROM public.routine_date_progress WHERE operation_id=current_setting('ceac.test.date_operation')::uuid) THEN
 RAISE EXCEPTION 'Other unit manager read date history'; END IF;
 BEGIN INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,entry_number,actor_id,status)
 VALUES(public.app_org_id(),current_setting('ceac.test.date_operation')::uuid,current_date,3,auth.uid(),'in_progress');
 RAISE EXCEPTION 'Other unit manager wrote date history'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$other$;
-- Actual unit manager can clarify a date without impersonating the assignee.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,entry_number,actor_id,status,note)
 VALUES(public.app_org_id(),current_setting('ceac.test.date_operation')::uuid,current_date,3,auth.uid(),'waiting_on','Arrange access for further inspection');
DO $manager$
BEGIN
 IF (SELECT count(*) FROM public.routine_date_progress WHERE operation_id=current_setting('ceac.test.date_operation')::uuid)<>4 THEN
 RAISE EXCEPTION 'Manager correction removed earlier evidence'; END IF;
END;
$manager$;
RESET ROLE;
ROLLBACK;
