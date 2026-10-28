\set ON_ERROR_STOP on
-- Isolated CI identities only. Every fixture and business write is rolled back.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false,privileged_mfa_required=false
 WHERE id='10000000-0000-4000-8000-000000000010';
DELETE FROM public.unit_memberships WHERE profile_id IN ('31000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000004');
INSERT INTO public.sub_teams(id,org_id,unit_id,name,code,active) VALUES
 ('23000000-0000-4000-8000-000000000026','10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000012','HR room gate team','HRT',true);
INSERT INTO public.sub_team_members(sub_team_id,profile_id) VALUES
 ('23000000-0000-4000-8000-000000000026','31000000-0000-4000-8000-000000000005');
INSERT INTO public.projects(id,org_id,kind,lead_unit_id,name,status,created_by) VALUES
 ('25000000-0000-4000-8000-000000000036','10000000-0000-4000-8000-000000000010','project','20000000-0000-4000-8000-000000000012','HR room gate project','active','31000000-0000-4000-8000-000000000002'),
 ('25000000-0000-4000-8000-000000000037','10000000-0000-4000-8000-000000000010','project','20000000-0000-4000-8000-000000000012','Archived HR room gate project','active','31000000-0000-4000-8000-000000000002');
INSERT INTO public.operational_archive_events(org_id,record_table,record_id,archived,reason,recorded_by) VALUES
 ('10000000-0000-4000-8000-000000000010','projects','25000000-0000-4000-8000-000000000037',true,'Synthetic archive isolation','31000000-0000-4000-8000-000000000003');
INSERT INTO public.organisations(id,name,short_code) VALUES('10000000-0000-4000-8000-000000000036','Foreign HR room fixture','XHR');
INSERT INTO public.units(id,org_id,name,code,active) VALUES
 ('20000000-0000-4000-8000-000000000036','10000000-0000-4000-8000-000000000036','Foreign HR unit','XHR',true),
 ('20000000-0000-4000-8000-000000000037','10000000-0000-4000-8000-000000000010','Inactive HR unit','IHR',false);
CREATE TEMP TABLE hr_gate_rooms ON COMMIT DROP AS SELECT id,kind,unit_id,project_id FROM public.rooms;
GRANT SELECT ON hr_gate_rooms TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
DO $hr$
DECLARE v_room record; v_message_id uuid; v_project_id uuid; item uuid; task jsonb; kind text; denied boolean;
BEGIN
 IF NOT public.app_is_admin() OR EXISTS(SELECT 1 FROM public.unit_memberships WHERE profile_id=auth.uid()) THEN
  RAISE EXCEPTION 'HR gate must exercise verified Administration without unit membership';
 END IF;
 FOR v_room IN SELECT * FROM public.rooms WHERE unit_id='20000000-0000-4000-8000-000000000012'
   OR project_id='25000000-0000-4000-8000-000000000036' LOOP
  IF NOT public.app_can_access_room(v_room.id) THEN RAISE EXCEPTION 'HR cannot open authorised % room',v_room.kind; END IF;
  v_message_id:=public.send_room_message(v_room.id,'Synthetic HR coordination',null,'[]'::jsonb,ARRAY['31000000-0000-4000-8000-000000000005'::uuid]);
  IF NOT EXISTS(SELECT 1 FROM public.room_messages m WHERE m.id=v_message_id AND m.author_id=auth.uid() AND m.org_id=public.app_org_id())
    OR NOT EXISTS(SELECT 1 FROM public.room_mentions m WHERE m.message_id=v_message_id AND m.profile_id='31000000-0000-4000-8000-000000000005') THEN
   RAISE EXCEPTION 'HR room message or real recipient attribution missing';
  END IF;
  PERFORM public.mark_room_read(v_room.id);
 END LOOP;
 IF (SELECT count(*) FROM public.rooms WHERE unit_id='20000000-0000-4000-8000-000000000012' OR project_id='25000000-0000-4000-8000-000000000036')<3 THEN
  RAISE EXCEPTION 'Unit, sub-team and project room fixtures are all required';
 END IF;
 IF EXISTS(SELECT 1 FROM hr_gate_rooms r WHERE (r.unit_id IN ('20000000-0000-4000-8000-000000000036','20000000-0000-4000-8000-000000000037') OR r.project_id='25000000-0000-4000-8000-000000000037') AND public.app_can_access_room(r.id)) THEN
  RAISE EXCEPTION 'HR escaped tenant, inactive unit or archived project boundary';
 END IF;
 v_project_id:=public.create_project_with_participants('20000000-0000-4000-8000-000000000012','Synthetic HR-created project','Verify owner authority',current_date,current_date+7,ARRAY['20000000-0000-4000-8000-000000000011'::uuid]);
 IF NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=v_project_id AND p.created_by=auth.uid() AND p.org_id=public.app_org_id())
  OR (SELECT count(*) FROM public.project_units pu WHERE pu.project_id=v_project_id)<>2 THEN
  RAISE EXCEPTION 'HR project lost verified creator, organisation or participating units';
 END IF;
 task:=public.create_task_with_checklist(p_unit_id=>'20000000-0000-4000-8000-000000000012',p_assignee_id=>'31000000-0000-4000-8000-000000000005',p_title=>'HR task gate',p_expected_outcome=>'Verified HR result',p_project_id=>v_project_id,p_purpose=>'Synthetic coordination',p_due_at=>now()+interval '1 day',p_origin=>'assigned',p_steps=>ARRAY['Check result']);
 IF NOT EXISTS(SELECT 1 FROM public.work_items WHERE id=(task->>'id')::uuid AND assigned_by=auth.uid() AND origin='assigned' AND assignee_id='31000000-0000-4000-8000-000000000005') THEN RAISE EXCEPTION 'HR task attribution invalid'; END IF;
 FOREACH kind IN ARRAY ARRAY['routine','case','request','decision','meeting_outcome','deliverable'] LOOP
  item:=public.create_typed_work(p_kind=>kind,p_unit_id=>'20000000-0000-4000-8000-000000000012',p_assignee_id=>'31000000-0000-4000-8000-000000000005',p_title=>'HR '||kind||' gate',p_expected_outcome=>'Recorded result',p_project_id=>v_project_id,p_details=>jsonb_build_object('schedule_kind','daily','meeting_title','Synthetic meeting','meeting_on',current_date));
  IF NOT EXISTS(SELECT 1 FROM public.work_items WHERE id=item AND assigned_by=auth.uid() AND origin='assigned' AND work_items.project_id=v_project_id) THEN RAISE EXCEPTION 'HR typed % attribution invalid',kind; END IF;
 END LOOP;
 denied:=false;
 BEGIN PERFORM public.create_project_with_participants('20000000-0000-4000-8000-000000000036','Foreign denied'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'HR created foreign-tenant project'; END IF;
END;
$hr$;
-- Staff can reply to HR by a real mention, without assigning HR fake membership.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
DO $staff$
DECLARE r uuid; msg uuid; denied boolean:=false;
BEGIN
 SELECT id INTO r FROM public.rooms WHERE kind='unit' AND unit_id='20000000-0000-4000-8000-000000000012';
 msg:=public.send_room_message(r,'Synthetic reply to HR',null,'[]'::jsonb,ARRAY['31000000-0000-4000-8000-000000000003'::uuid]);
 IF NOT EXISTS(SELECT 1 FROM public.room_mentions WHERE message_id=msg AND profile_id='31000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'HR reply notification missing'; END IF;
 IF EXISTS(SELECT 1 FROM hr_gate_rooms WHERE unit_id='20000000-0000-4000-8000-000000000011' AND public.app_can_access_room(id)) THEN RAISE EXCEPTION 'Staff gained unrelated department access'; END IF;
 BEGIN PERFORM public.create_project_with_participants('20000000-0000-4000-8000-000000000012','Denied staff project'); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Ordinary staff gained HR project authority'; END IF;
END;
$staff$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
DO $manager$ BEGIN
 IF EXISTS(SELECT 1 FROM hr_gate_rooms WHERE unit_id='20000000-0000-4000-8000-000000000012' AND public.app_can_access_room(id)) THEN RAISE EXCEPTION 'Manager gained unrelated department rooms'; END IF;
END;$manager$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
DO $exec$ BEGIN
 IF EXISTS(SELECT 1 FROM hr_gate_rooms WHERE project_id='25000000-0000-4000-8000-000000000036' AND public.app_can_access_room(id)) THEN RAISE EXCEPTION 'Executive contextual project limit was widened'; END IF;
END;$exec$;
RESET ROLE;
DO $grants$ BEGIN
 IF has_function_privilege('anon','public.app_can_access_room(uuid)','EXECUTE') OR has_function_privilege('anon','public.send_room_message(uuid,text,uuid,jsonb,uuid[])','EXECUTE') THEN RAISE EXCEPTION 'Anonymous room entry point was granted'; END IF;
END;$grants$;
ROLLBACK;
