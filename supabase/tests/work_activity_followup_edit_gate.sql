\set ON_ERROR_STOP on
-- Disposable seeded local database only; roll back every fixture and write.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false WHERE id='10000000-0000-4000-8000-000000000010';
INSERT INTO work_items(id,org_id,assigned_by,assignee_id,unit_id,origin,title,ref,kind) VALUES('41000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000011','self_created','Synthetic work','TUA-PHASE1-212','task');

INSERT INTO work_items(id,org_id,assigned_by,assignee_id,unit_id,origin,title,ref,kind) VALUES('41000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000011','assigned','Manager assigned work','TUA-PHASE1-213','task');
INSERT INTO work_items(id,org_id,assigned_by,assignee_id,unit_id,origin,title,ref,kind) VALUES('41000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000012','assigned','HR cross-department assigned work','TUA-PHASE1-214','task');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
INSERT INTO work_activity_records(id,org_id,work_item_id,contributor_id,next_action,next_action_on,activity_date,activity_state,action_summary) VALUES('42000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','41000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','Follow up with the supplier','2026-11-03','2026-10-29','done','Completed the supplier meeting');
SELECT public.edit_open_work_details('41000000-0000-4000-8000-000000000001',(SELECT last_movement_at FROM public.work_items WHERE id='41000000-0000-4000-8000-000000000001'),'Updated synthetic work','Purpose','Expected outcome','Instructions');
DO $$ DECLARE first_id uuid; BEGIN
 BEGIN PERFORM public.edit_open_work_details('41000000-0000-4000-8000-000000000002',NULL,'Assignee changed original brief','','','');RAISE EXCEPTION 'Assignee rewrote manager brief';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM 1 FROM private.work_detail_revisions LIMIT 1;RAISE EXCEPTION 'Private revision table exposed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 first_id:=public.plan_work_activity_followup('42000000-0000-4000-8000-000000000001');
 IF first_id IS DISTINCT FROM public.plan_work_activity_followup('42000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Duplicate follow-up'; END IF;
 IF (SELECT count(*) FROM public.personal_day_tasks WHERE linked_work_item_id='41000000-0000-4000-8000-000000000001')<>1 THEN RAISE EXCEPTION 'Follow-up missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.personal_day_tasks WHERE id=first_id AND plan_date='2026-11-03' AND linked_work_item_id='41000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Follow-up lost date or assignment link'; END IF;
 BEGIN PERFORM public.edit_open_work_details('41000000-0000-4000-8000-000000000001',NULL,'Stale overwrite','','','');RAISE EXCEPTION 'Stale edit accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
 PERFORM public.register_operational_file('work_activity','42000000-0000-4000-8000-000000000001','activity_evidence','evidence.pdf','application/pdf',100::bigint);
 BEGIN PERFORM public.register_operational_file('work_activity','42000000-0000-4000-8000-000000000001','assignment_source','invalid.pdf','application/pdf',100::bigint);RAISE EXCEPTION 'Invalid relation accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Invalid relation accepted' THEN RAISE;END IF;END;
END; $$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 PERFORM public.edit_open_work_details('41000000-0000-4000-8000-000000000002',(SELECT last_movement_at FROM public.work_items WHERE id='41000000-0000-4000-8000-000000000002'),'Manager revised work','Updated purpose','','');
 IF EXISTS(SELECT 1 FROM public.personal_day_tasks WHERE linked_work_item_id='41000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Private plan leaked'; END IF;
 BEGIN PERFORM public.plan_work_activity_followup('42000000-0000-4000-8000-000000000001');RAISE EXCEPTION 'Other contributor planned action';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.edit_open_work_details('41000000-0000-4000-8000-000000000001',NULL,'Other person edit','','','');RAISE EXCEPTION 'Other contributor edited work';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.register_operational_file('work_activity','42000000-0000-4000-8000-000000000001','activity_evidence','other.pdf','application/pdf',100::bigint);RAISE EXCEPTION 'Other person attached evidence';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.work_detail_revisions WHERE before_details->>'title'='Synthetic work' AND after_details->>'title'='Updated synthetic work') THEN RAISE EXCEPTION 'Edit audit missing'; END IF;
 IF EXISTS(SELECT 1 FROM activity_events WHERE object_id='41000000-0000-4000-8000-000000000001' AND meta::text LIKE '%Expected outcome%') THEN RAISE EXCEPTION 'Private work content copied to broad feed';END IF;
END; $$;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
UPDATE work_items SET status='completed' WHERE id='41000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM personal_day_tasks WHERE linked_work_item_id='41000000-0000-4000-8000-000000000001' AND completed_at IS NULL) THEN RAISE EXCEPTION 'Assignment completion consumed follow-up';END IF;
 BEGIN PERFORM public.edit_open_work_details('41000000-0000-4000-8000-000000000001',NULL,'Closed work edit','','','');RAISE EXCEPTION 'Closed work edited';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $$;
RESET ROLE;

-- Preserve the already-approved HR cross-department assignment authority,
-- limited here to the work HR actually assigned. No reviewer change is made.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
SELECT public.edit_open_work_details('41000000-0000-4000-8000-000000000003',(SELECT last_movement_at FROM public.work_items WHERE id='41000000-0000-4000-8000-000000000003'),'HR revised assigned work','Clarified purpose','','');
RESET ROLE;
ROLLBACK;
