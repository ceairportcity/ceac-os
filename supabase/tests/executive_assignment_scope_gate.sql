\set ON_ERROR_STOP on
-- Synthetic existing CI identities only; every record and membership change rolls back.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false,privileged_mfa_required=false
 WHERE id='10000000-0000-4000-8000-000000000010';
DELETE FROM public.unit_memberships WHERE profile_id='31000000-0000-4000-8000-000000000004';
INSERT INTO public.projects(id,org_id,kind,lead_unit_id,name,purpose,status,created_by)
 VALUES('25000000-0000-4000-8000-000000000025','10000000-0000-4000-8000-000000000010','project',
 '20000000-0000-4000-8000-000000000011','Executive assignment rollback fixture','Isolated authority verification','active',
 '31000000-0000-4000-8000-000000000002');
INSERT INTO public.projects(id,org_id,kind,lead_unit_id,name,purpose,status,created_by)
 VALUES('25000000-0000-4000-8000-000000000026','10000000-0000-4000-8000-000000000010','project',
 '20000000-0000-4000-8000-000000000011','Archived Executive rollback fixture','Archive boundary verification','active',
 '31000000-0000-4000-8000-000000000002');
INSERT INTO public.operational_archive_events(org_id,record_table,record_id,archived,reason,recorded_by)
 VALUES('10000000-0000-4000-8000-000000000010','projects','25000000-0000-4000-8000-000000000026',true,
 'Synthetic archived project boundary','31000000-0000-4000-8000-000000000003');
INSERT INTO public.organisations(id,name,short_code) VALUES('10000000-0000-4000-8000-000000000025','Foreign Executive gate fixture','XEQ');
INSERT INTO public.units(id,org_id,name,code,active) VALUES
 ('20000000-0000-4000-8000-000000000025','10000000-0000-4000-8000-000000000025','Foreign department','XEQ',true),
 ('20000000-0000-4000-8000-000000000026','10000000-0000-4000-8000-000000000010','Inactive department','IEQ',false);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
DO $executive$
DECLARE
 v_project uuid:='25000000-0000-4000-8000-000000000025';
 v_unit uuid:='20000000-0000-4000-8000-000000000012';
 v_staff uuid:='31000000-0000-4000-8000-000000000005';
 v_item uuid; v_task jsonb; v_kind text; v_result jsonb; v_denied boolean;
BEGIN
 IF NOT public.app_is_exec() OR EXISTS(SELECT 1 FROM public.unit_memberships WHERE profile_id=auth.uid()) THEN
  RAISE EXCEPTION 'Fixture must be a verified Executive with no department membership';
 END IF;
 -- Failed work must not leave behind an implicit project participation change.
 v_denied:=false;
 BEGIN
  PERFORM public.create_task_with_checklist(p_unit_id=>v_unit,p_assignee_id=>v_staff,p_title=>'Invalid phase',
   p_expected_outcome=>'Denied',p_project_id=>v_project,p_phase_id=>'29000000-0000-4000-8000-000000000025',
   p_purpose=>'Check rollback',p_due_at=>now()+interval '1 day',p_origin=>'assigned_by_exec');
 EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
 IF NOT v_denied OR EXISTS(SELECT 1 FROM public.project_units WHERE project_id=v_project AND unit_id=v_unit) THEN
  RAISE EXCEPTION 'Invalid work left behind a project department';
 END IF;
 v_task:=public.create_task_with_checklist(p_unit_id=>v_unit,p_assignee_id=>v_staff,p_title=>'Executive Task fixture',
  p_expected_outcome=>'Recorded result',p_project_id=>v_project,p_purpose=>'Verify authority',
  p_due_at=>now()+interval '1 day',p_origin=>'assigned_by_exec',p_steps=>ARRAY['Check evidence']);
 IF NOT EXISTS(SELECT 1 FROM public.work_items WHERE id=(v_task->>'id')::uuid AND assignee_id=v_staff
   AND assigned_by=auth.uid() AND origin='assigned_by_exec' AND project_id=v_project AND unit_id=v_unit) THEN
  RAISE EXCEPTION 'Executive Task lost its assignee, attribution, department or project';
 END IF;
 v_result:=public.executive_assign_project_department(v_project,v_unit,'Idempotent retry');
 IF (v_result->>'added')::boolean OR (SELECT count(*) FROM public.project_units WHERE project_id=v_project AND unit_id=v_unit)<>1 THEN
  RAISE EXCEPTION 'Repeated department assignment duplicated membership';
 END IF;
 FOREACH v_kind IN ARRAY ARRAY['routine','case','request','decision','meeting_outcome','deliverable'] LOOP
  v_item:=public.create_typed_work(p_kind=>v_kind,p_unit_id=>v_unit,p_assignee_id=>v_staff,
   p_title=>'Executive '||v_kind||' fixture',p_expected_outcome=>'Recorded result',p_project_id=>v_project,
   p_details=>jsonb_build_object('schedule_kind','daily','meeting_title','Fixture meeting','meeting_on',current_date));
  IF NOT EXISTS(SELECT 1 FROM public.work_items WHERE id=v_item AND kind=v_kind AND assignee_id=v_staff
    AND assigned_by=auth.uid() AND origin='assigned_by_exec' AND project_id=v_project) THEN
   RAISE EXCEPTION 'Typed Executive work lost contract for %',v_kind;
  END IF;
 END LOOP;
 v_task:=public.create_task_with_checklist(p_unit_id=>v_unit,p_assignee_id=>auth.uid(),p_title=>'Executive own task',
  p_expected_outcome=>'Own result',p_origin=>'self_created');
 IF NOT EXISTS(SELECT 1 FROM public.work_items WHERE id=(v_task->>'id')::uuid AND origin='self_created' AND assignee_id=auth.uid()) THEN
  RAISE EXCEPTION 'Executive own task required invented membership';
 END IF;
 v_item:=public.create_typed_work(p_kind=>'routine',p_unit_id=>v_unit,p_assignee_id=>auth.uid(),
  p_title=>'Executive own routine',p_expected_outcome=>'Own result',p_details=>'{"origin":"self_created","schedule_kind":"daily"}');
 IF NOT EXISTS(SELECT 1 FROM public.work_items WHERE id=v_item AND origin='self_created' AND assignee_id=auth.uid()) THEN
  RAISE EXCEPTION 'Executive own routine required invented membership';
 END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.create_task_with_checklist(p_unit_id=>v_unit,p_assignee_id=>v_staff,p_title=>'Spoofed self work',p_expected_outcome=>'Denied',p_origin=>'self_created');
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Executive self-work impersonated another person'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.executive_assign_project_department(v_project,'20000000-0000-4000-8000-000000000099','Unknown department');
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Unknown department accepted'; END IF;
 -- Definer assignment must respect archived records even though its owner bypasses RLS.
 v_denied:=false;
 BEGIN
  PERFORM public.executive_assign_project_department('25000000-0000-4000-8000-000000000026',v_unit,'Archived project denial');
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Archived project accepted a department'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.create_task_with_checklist(p_unit_id=>v_unit,p_assignee_id=>v_staff,p_title=>'Archived project Task',
   p_expected_outcome=>'Denied',p_project_id=>'25000000-0000-4000-8000-000000000026',
   p_purpose=>'Archive boundary',p_due_at=>now(),p_origin=>'assigned_by_exec');
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Task bypassed project archive'; END IF;
 FOREACH v_kind IN ARRAY ARRAY['routine','case','request','decision','meeting_outcome','deliverable'] LOOP
  v_denied:=false;
  BEGIN
   PERFORM public.create_typed_work(p_kind=>v_kind,p_unit_id=>v_unit,p_assignee_id=>v_staff,
    p_title=>'Archived project '||v_kind,p_expected_outcome=>'Denied',p_project_id=>'25000000-0000-4000-8000-000000000026',
    p_details=>jsonb_build_object('schedule_kind','daily','meeting_title','Fixture meeting','meeting_on',current_date));
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Typed % bypassed project archive',v_kind; END IF;
 END LOOP;
 -- Real cross-tenant and inactive department rows must be denied, not merely hidden by the picker.
 FOREACH v_item IN ARRAY ARRAY['20000000-0000-4000-8000-000000000025'::uuid,'20000000-0000-4000-8000-000000000026'::uuid] LOOP
  v_denied:=false;
  BEGIN
   PERFORM public.executive_assign_project_department(v_project,v_item,'Invalid scope');
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Foreign or inactive department accepted'; END IF;
 END LOOP;
 v_denied:=false;
 BEGIN
  PERFORM public.create_task_with_checklist(p_unit_id=>v_unit,p_assignee_id=>v_staff,p_title=>'Private assigned work',
   p_expected_outcome=>'Denied',p_purpose=>'Privacy boundary',p_due_at=>now(),p_origin=>'assigned_by_exec',p_visibility=>'private');
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Assigned task bypassed private-work boundary'; END IF;
END $executive$;
RESET ROLE;
UPDATE public.profiles SET active=false WHERE id='31000000-0000-4000-8000-000000000005';
SET LOCAL ROLE authenticated;
DO $inactive_assignee$
BEGIN
 BEGIN
  PERFORM public.create_task_with_checklist(p_unit_id=>'20000000-0000-4000-8000-000000000012',
   p_assignee_id=>'31000000-0000-4000-8000-000000000005',p_title=>'Inactive assignee',p_expected_outcome=>'Denied',
   p_purpose=>'Active account boundary',p_due_at=>now(),p_origin=>'assigned_by_exec');
  RAISE EXCEPTION 'Inactive person accepted an assignment';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $inactive_assignee$;
RESET ROLE;
UPDATE public.projects SET status='closed' WHERE id='25000000-0000-4000-8000-000000000025';
SET LOCAL ROLE authenticated;
DO $closed_project$
BEGIN
 BEGIN
  PERFORM public.executive_assign_project_department('25000000-0000-4000-8000-000000000025','20000000-0000-4000-8000-000000000011','Closed project');
  RAISE EXCEPTION 'Closed project accepted a department';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $closed_project$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $staff$
BEGIN
 BEGIN
  PERFORM public.executive_assign_project_department('25000000-0000-4000-8000-000000000025','20000000-0000-4000-8000-000000000011','Staff escalation');
  RAISE EXCEPTION 'Staff gained Executive project authority';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.create_task_with_checklist(p_unit_id=>'20000000-0000-4000-8000-000000000011',
   p_assignee_id=>auth.uid(),p_title=>'Forged Executive origin',p_expected_outcome=>'Denied',
   p_purpose=>'Spoof',p_due_at=>now(),p_origin=>'assigned_by_exec');
  RAISE EXCEPTION 'Staff forged Executive attribution';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $staff$;
ROLLBACK;
SELECT 'Executive assignment scope gate passed' AS result;
