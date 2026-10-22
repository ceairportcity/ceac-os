\set ON_ERROR_STOP on
BEGIN;
UPDATE public.organisations SET universal_totp_required=false WHERE id='10000000-0000-4000-8000-000000000010';
DO $acl$ BEGIN
 IF has_function_privilege('anon','public.routine_set_date_cover(uuid,date,uuid,text,integer)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.routine_set_date_cover(uuid,date,uuid,text,integer)','EXECUTE')
 OR has_table_privilege('authenticated','public.routine_date_covers','INSERT')
 OR has_table_privilege('authenticated','public.routine_date_covers','UPDATE')
 OR has_table_privilege('authenticated','public.routine_date_covers','DELETE')
 OR EXISTS(SELECT 1 FROM pg_proc WHERE oid IN('private.routine_date_assignee(uuid,date)'::regprocedure,'private.routine_date_can_record(uuid,date)'::regprocedure) AND prosecdef)
 THEN RAISE EXCEPTION 'Unreviewed cover privilege surface'; END IF;
END; $acl$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('ceac.test.cover_work',public.create_typed_work(p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',p_title=>'Rollback single-date cover',p_assignee_id=>'31000000-0000-4000-8000-000000000001',p_expected_outcome=>'Inspect venue',p_details=>jsonb_build_object('schedule_kind','daily','starts_on',current_date))::text,true);
SELECT set_config('ceac.test.cover_op',(SELECT id::text FROM public.recurring_operations WHERE work_item_id=current_setting('ceac.test.cover_work')::uuid),true);
DO $manager$ DECLARE w uuid:=current_setting('ceac.test.cover_work')::uuid; op uuid:=current_setting('ceac.test.cover_op')::uuid; result jsonb; BEGIN
 BEGIN
  PERFORM public.routine_set_date_cover(w,current_date,'31000000-0000-4000-8000-000000000005','Foreign department candidate',0);
  RAISE EXCEPTION 'Cross-department cover accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 result:=public.routine_set_date_cover(w,current_date,'31000000-0000-4000-8000-000000000006','Authorised department colleague covers today',0);
 IF result->>'recorded_by'<>auth.uid()::text OR (result->>'version')::int<>1
 OR private.routine_date_assignee(op,current_date)<>'31000000-0000-4000-8000-000000000006'
 OR private.routine_date_assignee(op,current_date+1)<>'31000000-0000-4000-8000-000000000001'
 OR (SELECT assignee_id FROM public.work_items WHERE id=w)<>'31000000-0000-4000-8000-000000000001'
 THEN RAISE EXCEPTION 'Date cover rewrote series, another day or actor'; END IF;
 BEGIN PERFORM public.routine_set_date_cover(w,current_date,NULL,'Stale restore must fail',0);RAISE EXCEPTION 'Stale cover version accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
 PERFORM public.routine_set_date_cover(w,current_date+1,'31000000-0000-4000-8000-000000000006','Future date temporary cover',0);
 PERFORM public.routine_set_date_cover(w,current_date+1,NULL,'Restore original next-day assignment',1);
 IF private.routine_date_assignee(op,current_date+1)<>'31000000-0000-4000-8000-000000000001'
 OR (SELECT count(*) FROM public.routine_date_covers WHERE operation_id=op AND scheduled_on=current_date+1)<>2
 THEN RAISE EXCEPTION 'Restoration lost original assignment or history'; END IF;
 PERFORM public.routine_change_single_date(w,current_date+2,'skip','No scheduled work on this date',0);
 BEGIN PERFORM public.routine_set_date_cover(w,current_date+2,'31000000-0000-4000-8000-000000000006','Cover cannot bypass a skipped date',0);RAISE EXCEPTION 'Skipped day cover accepted';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
END; $manager$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $original$ BEGIN
 BEGIN PERFORM public.routine_set_date_cover(current_setting('ceac.test.cover_work')::uuid,current_date+3,'31000000-0000-4000-8000-000000000006','Staff cannot delegate manager work',0);RAISE EXCEPTION 'Staff delegated without authority';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.record_routine_occurrence(current_setting('ceac.test.cover_work')::uuid,current_date,NULL,'Original assignee cannot take cover credit');RAISE EXCEPTION 'Original assignee took cover outcome';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,actor_id,status) VALUES(public.app_org_id(),current_setting('ceac.test.cover_op')::uuid,current_date,auth.uid(),'in_progress');RAISE EXCEPTION 'Original assignee took cover checklist';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO public.routine_date_covers(org_id,operation_id,work_item_id,unit_id,scheduled_on,version,action,assignee_id,reason,actor_id) VALUES(public.app_org_id(),current_setting('ceac.test.cover_op')::uuid,current_setting('ceac.test.cover_work')::uuid,'20000000-0000-4000-8000-000000000011',current_date,2,'assign',auth.uid(),'Forged direct assignment',auth.uid());RAISE EXCEPTION 'Direct cover insert accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $original$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000006',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}',true);
INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,actor_id,status,note)
 VALUES(public.app_org_id(),current_setting('ceac.test.cover_op')::uuid,current_date,auth.uid(),'ready_for_review','Actual independent cover progress');
SELECT set_config('ceac.test.cover_progress',(SELECT id::text FROM public.routine_date_progress WHERE operation_id=current_setting('ceac.test.cover_op')::uuid),true);
SELECT set_config('ceac.test.cover_outcome',public.record_routine_occurrence(current_setting('ceac.test.cover_work')::uuid,current_date,NULL,'Actual dated work by the cover person')::text,true);
SELECT set_config('ceac.test.cover_file',(SELECT file_id::text FROM public.register_operational_file('routine_date_progress',current_setting('ceac.test.cover_progress')::uuid,'routine_evidence','cover-proof.txt','text/plain',12)),true);
DO $contributor$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.operation_occurrences WHERE id=current_setting('ceac.test.cover_outcome')::uuid AND recorded_by=auth.uid())

 THEN RAISE EXCEPTION 'Actual cover evidence lost attribution or private upload permission';END IF;
 BEGIN INSERT INTO public.routine_occurrence_reviews(org_id,occurrence_id,reviewer_id,decision) VALUES(public.app_org_id(),current_setting('ceac.test.cover_outcome')::uuid,auth.uid(),'accepted');RAISE EXCEPTION 'Cover person self-approved';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $contributor$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
DO $preserve$ BEGIN
 BEGIN PERFORM public.routine_set_date_cover(current_setting('ceac.test.cover_work')::uuid,current_date,NULL,'Cannot move credit after work is recorded',1);RAISE EXCEPTION 'Recorded date reassigned';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
END; $preserve$;
INSERT INTO public.routine_occurrence_reviews(org_id,occurrence_id,reviewer_id,decision,note) VALUES(public.app_org_id(),current_setting('ceac.test.cover_outcome')::uuid,auth.uid(),'accepted','Independent manager reviewed actual cover evidence');
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $file_guard$ BEGIN
 BEGIN PERFORM public.register_operational_file('routine_date_progress',current_setting('ceac.test.cover_progress')::uuid,'routine_evidence','impersonation.txt','text/plain',12);RAISE EXCEPTION 'Original assignee attached to cover update';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $file_guard$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000007',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}',true);
DO $other$ BEGIN
 IF EXISTS(SELECT 1 FROM public.routine_date_covers WHERE operation_id=current_setting('ceac.test.cover_op')::uuid)
 OR EXISTS(SELECT 1 FROM public.operational_files WHERE id=current_setting('ceac.test.cover_file')::uuid)
 THEN RAISE EXCEPTION 'Unrelated manager read cover evidence'; END IF;
 BEGIN PERFORM public.routine_set_date_cover(current_setting('ceac.test.cover_work')::uuid,current_date+3,auth.uid(),'Unrelated department delegation',0);RAISE EXCEPTION 'Unrelated manager changed cover';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $other$;
RESET ROLE;
-- Shared-series recording authority returns only after explicit restoration.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('ceac.test.cover_shared',public.create_typed_work(p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',p_title=>'Rollback shared routine cover',p_assignee_id=>NULL,p_expected_outcome=>'Shared unit inspection',p_details=>jsonb_build_object('schedule_kind','daily','starts_on',current_date))::text,true);
SELECT public.routine_set_date_cover(current_setting('ceac.test.cover_shared')::uuid,current_date,'31000000-0000-4000-8000-000000000006','One named colleague covers shared responsibility',0);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $shared_denial$ BEGIN
 BEGIN PERFORM public.record_routine_occurrence(current_setting('ceac.test.cover_shared')::uuid,current_date,NULL,'Shared member cannot take named cover credit');RAISE EXCEPTION 'Shared member bypassed named date cover';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $shared_denial$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT public.routine_set_date_cover(current_setting('ceac.test.cover_shared')::uuid,current_date,NULL,'Restore shared department recording authority',1);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT public.record_routine_occurrence(current_setting('ceac.test.cover_shared')::uuid,current_date,NULL,'Actual shared unit inspection after restoration');
RESET ROLE;
-- Reminder recipients use the effective date assignee's explicit working pattern.
INSERT INTO public.workforce_day_types(id,org_id,name,session_expected,active) VALUES('71000000-0000-4000-8000-000000000176','10000000-0000-4000-8000-000000000010','Rollback cover reminder workday',true,true);
INSERT INTO public.workforce_schedule_versions(org_id,schedule_key,version,profile_id,effective_from,source,day_map,expected_start,expected_end,reason,created_by)
 SELECT '10000000-0000-4000-8000-000000000010',gen_random_uuid(),1,person,current_date,'person',
 jsonb_build_object('mon','71000000-0000-4000-8000-000000000176','tue','71000000-0000-4000-8000-000000000176','wed','71000000-0000-4000-8000-000000000176','thu','71000000-0000-4000-8000-000000000176','fri','71000000-0000-4000-8000-000000000176','sat','71000000-0000-4000-8000-000000000176','sun','71000000-0000-4000-8000-000000000176'),
 '00:00','24:00','Synthetic cover reminder pattern','31000000-0000-4000-8000-000000000003'
 FROM unnest(ARRAY['31000000-0000-4000-8000-000000000001'::uuid,'31000000-0000-4000-8000-000000000006'::uuid]) person;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('ceac.test.cover_reminder',public.create_typed_work(p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',p_title=>'Rollback cover recipient reminder',p_assignee_id=>'31000000-0000-4000-8000-000000000001',p_expected_outcome=>'Inspect venue',p_details=>jsonb_build_object('schedule_kind','daily','starts_on',current_date,'timezone','Africa/Accra','due_time',to_char(now() at time zone 'Africa/Accra','HH24:MI'),'reminder_minutes_before',15))::text,true);
SELECT public.routine_set_date_cover(current_setting('ceac.test.cover_reminder')::uuid,current_date,'31000000-0000-4000-8000-000000000006','Manager authorises actual reminder recipient',0);
RESET ROLE;
UPDATE private.routine_reminder_sweep SET last_operation_id=NULL;
SELECT public.app_heartbeat();SELECT public.app_heartbeat();SELECT public.app_heartbeat();
DO $reminder$ BEGIN
 IF (SELECT count(*) FROM public.routine_reminder_deliveries WHERE work_item_id=current_setting('ceac.test.cover_reminder')::uuid AND for_profile_id='31000000-0000-4000-8000-000000000006')<>1
 OR EXISTS(SELECT 1 FROM public.routine_reminder_deliveries WHERE work_item_id=current_setting('ceac.test.cover_reminder')::uuid AND for_profile_id='31000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'Reminder did not follow the independently authorised date assignee';END IF;
END; $reminder$;
-- Account revocation must deny date evidence despite immutable past assignment.
UPDATE public.profiles SET active=false WHERE id='31000000-0000-4000-8000-000000000006';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000006',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}',true);
DO $revoked$ BEGIN
 IF private.routine_date_can_record(current_setting('ceac.test.cover_op')::uuid,current_date)

 THEN RAISE EXCEPTION 'Revoked account retained cover write authority';END IF;
 BEGIN PERFORM public.register_operational_file('routine_date_progress',current_setting('ceac.test.cover_progress')::uuid,'routine_evidence','revoked.txt','text/plain',12);RAISE EXCEPTION 'Revoked account registered a file';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $revoked$;
RESET ROLE;
ROLLBACK;
