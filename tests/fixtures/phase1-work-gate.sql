-- Focused PGlite fixture only: executes the real forward migration/functions.
INSERT INTO organisations VALUES('10000000-0000-4000-8000-000000000010');
INSERT INTO profiles(id,org_id,full_name) SELECT ('31000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000010','Synthetic '||i FROM generate_series(1,2)i;
INSERT INTO units(id,org_id,name) VALUES('20000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000010','Synthetic department');
INSERT INTO unit_memberships VALUES('31000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011','staff'),('31000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011','manager');
INSERT INTO work_items(id,org_id,assigned_by,assignee_id,unit_id,origin,title) VALUES('41000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000011','self_created','Synthetic work');
INSERT INTO work_activity_records(id,org_id,work_item_id,contributor_id,next_action,next_action_on) VALUES('42000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','41000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','Follow up with the supplier','2026-11-03');
INSERT INTO work_items(id,org_id,assigned_by,assignee_id,unit_id,origin,title) VALUES('41000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000011','assigned','Manager assigned work');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',false);
SELECT public.edit_open_work_details('41000000-0000-4000-8000-000000000001',NULL,'Updated synthetic work','Purpose','Expected outcome','Instructions');
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
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',false);
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
UPDATE work_items SET status='completed' WHERE id='41000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM personal_day_tasks WHERE linked_work_item_id='41000000-0000-4000-8000-000000000001' AND completed_at IS NULL) THEN RAISE EXCEPTION 'Assignment completion consumed follow-up';END IF;
 BEGIN PERFORM public.edit_open_work_details('41000000-0000-4000-8000-000000000001',NULL,'Closed work edit','','','');RAISE EXCEPTION 'Closed work edited';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $$;
RESET ROLE;
