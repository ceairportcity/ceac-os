-- Synthetic rollback-only content archive and preservation proof.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
INSERT INTO public.announcements(id,org_id,author_id,title,body) VALUES('aa620001-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000003','Demo · archive announcement','Synthetic original body');
INSERT INTO public.learning_courses(id,org_id,title,summary,created_by,updated_by) VALUES('aa620002-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','Demo · archive course','Synthetic source unchanged','31000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000003');
INSERT INTO public.learning_modules(id,org_id,course_id,position,title,created_by,updated_by) VALUES('aa620002-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','aa620002-0000-4000-8000-000000000001',1,'Synthetic retained module','31000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000003');
INSERT INTO public.asset_items(id,org_id,asset_code,category,created_by,updated_by) VALUES('aa620003-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','SYNTH-ARC-01','Camera','31000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000003');
INSERT INTO public.appraisal_cycles(id,org_id,name,starts_on,ends_on) VALUES('aa620004-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','Demo · archive appraisal','2097-01-01','2097-03-31');
INSERT INTO public.meeting_sessions(id,org_id,scope,title,starts_at,created_by) VALUES('aa620005-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','organisation','Demo · archive meeting','2097-03-30T12:00:00Z','31000000-0000-4000-8000-000000000003');
INSERT INTO public.strategy_nodes(id,org_id,node_type,name,statement,change_reason,created_by,updated_by) VALUES('aa620006-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','ministry_direction','Demo · archive direction','Synthetic original direction','Synthetic initial source','31000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000003');
INSERT INTO public.compliance_policy_versions(id,org_id,policy_key,version,title,category,body_text,effective_on,reason,created_by) VALUES('aa620007-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','aa620007-0000-4000-8000-000000000009',1,'Demo · archive policy','Conduct','Original synthetic policy','2097-01-01','Synthetic original policy','31000000-0000-4000-8000-000000000003');
-- A new retained dependency version invalidates an earlier root review.
DO $stale_dependency$
DECLARE changes jsonb;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('record_table',record_table,'record_id',record_id,'fingerprint',fingerprint,'event_no',event_no,'archived',true)) INTO changes FROM public.admin_operational_archive_records() WHERE record_id='aa620002-0000-4000-8000-000000000001';
 UPDATE public.learning_modules SET title='Synthetic retained module, revised' WHERE id='aa620002-0000-4000-8000-000000000002';
 BEGIN PERFORM public.admin_apply_operational_archive(changes,'Dependency changed after root review'); RAISE EXCEPTION 'Stale dependency review allowed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END; $stale_dependency$;
CREATE TEMP TABLE content_original AS
 SELECT 'announcements'::text kind,id,md5(to_jsonb(t)::text) fingerprint FROM announcements t WHERE id='aa620001-0000-4000-8000-000000000001'
 UNION ALL SELECT 'learning_courses',id,md5(to_jsonb(t)::text) FROM learning_courses t WHERE id='aa620002-0000-4000-8000-000000000001'
 UNION ALL SELECT 'learning_modules',id,md5(to_jsonb(t)::text) FROM learning_modules t WHERE id='aa620002-0000-4000-8000-000000000002'
 UNION ALL SELECT 'asset_items',id,md5(to_jsonb(t)::text) FROM asset_items t WHERE id='aa620003-0000-4000-8000-000000000001'
 UNION ALL SELECT 'appraisal_cycles',id,md5(to_jsonb(t)::text) FROM appraisal_cycles t WHERE id='aa620004-0000-4000-8000-000000000001'
 UNION ALL SELECT 'meeting_sessions',id,md5(to_jsonb(t)::text) FROM meeting_sessions t WHERE id='aa620005-0000-4000-8000-000000000001'
 UNION ALL SELECT 'strategy_nodes',id,md5(to_jsonb(t)::text) FROM strategy_nodes t WHERE id='aa620006-0000-4000-8000-000000000001'
 UNION ALL SELECT 'compliance_policy_versions',id,md5(to_jsonb(t)::text) FROM compliance_policy_versions t WHERE id='aa620007-0000-4000-8000-000000000001';
GRANT SELECT ON content_original TO authenticated;
SET LOCAL ROLE authenticated;
DO $gate$
DECLARE changes jsonb; n integer; t record; row_count bigint;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('record_table',record_table,'record_id',record_id,'fingerprint',fingerprint,'event_no',event_no,'archived',true)) INTO changes
 FROM public.admin_operational_archive_records() WHERE record_id::text LIKE 'aa620%' AND record_table<>'learning_modules';
 IF jsonb_array_length(changes)<>7 THEN RAISE EXCEPTION 'Expected seven authorised content roots'; END IF;
 SELECT count(*) INTO row_count FROM operational_archive_events;
 BEGIN PERFORM public.admin_apply_operational_archive(jsonb_set(changes,'{0,fingerprint}','"stale"'),'Synthetic stale content batch'); RAISE EXCEPTION 'Stale content batch allowed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF (SELECT count(*) FROM operational_archive_events)<>row_count THEN RAISE EXCEPTION 'Partial content classification persisted'; END IF;
 n:=public.admin_apply_operational_archive(changes,'Synthetic confirmed demonstration archive');
 IF n<>7 THEN RAISE EXCEPTION 'Seven content roots not archived'; END IF;
 FOR t IN SELECT * FROM content_original LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',t.kind) INTO row_count USING t.id;
  IF row_count<>0 THEN RAISE EXCEPTION 'Archived % visible in live read',t.kind; END IF;
 END LOOP;
 IF public.app_can_manage_meeting('aa620005-0000-4000-8000-000000000001')
  OR public.app_can_read_operational_context('announcement','aa620001-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Definer context bypassed content archive'; END IF;
 BEGIN PERFORM public.mark_announcement_read('aa620001-0000-4000-8000-000000000001',true); RAISE EXCEPTION 'Archived announcement mutated'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Archived announcement mutated' THEN RAISE; END IF; END;
 SELECT jsonb_agg(jsonb_build_object('record_table',record_table,'record_id',record_id,'fingerprint',fingerprint,'event_no',event_no,'archived',false)) INTO changes
 FROM public.admin_operational_archive_records() WHERE record_id::text LIKE 'aa620%';
 IF public.admin_apply_operational_archive(changes,'Synthetic content restoration proof')<>7 THEN RAISE EXCEPTION 'Content restoration incomplete'; END IF;
 FOR t IN SELECT * FROM content_original LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1 AND md5(to_jsonb(%I)::text)=$2',t.kind,t.kind) INTO row_count USING t.id,t.fingerprint;
  IF row_count<>1 THEN RAISE EXCEPTION 'Original % changed or restore hidden',t.kind; END IF;
 END LOOP;
END; $gate$;
-- Definer writes are guarded even if the caller bypasses table SELECT RLS.
RESET ROLE;
DO $privileged$
DECLARE changes jsonb;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('record_table',record_table,'record_id',record_id,'fingerprint',fingerprint,'event_no',event_no,'archived',true)) INTO changes FROM public.admin_operational_archive_records() WHERE record_id='aa620002-0000-4000-8000-000000000001';
 PERFORM public.admin_apply_operational_archive(changes,'Synthetic rearchive for descendant write denial');
 BEGIN UPDATE public.learning_modules SET title='Changed original' WHERE id='aa620002-0000-4000-8000-000000000002'; RAISE EXCEPTION 'Privileged descendant write bypassed archive'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $privileged$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
DO $deny$
BEGIN
 BEGIN PERFORM public.admin_operational_archive_records(); RAISE EXCEPTION 'Staff content review allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_apply_operational_archive('[]','Staff content classification denied'); RAISE EXCEPTION 'Staff content write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF has_function_privilege('authenticated','private.guard_content_archive()','EXECUTE')
 OR has_function_privilege('authenticated','private.content_archive_fingerprint(text,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Private archive implementation exposed'; END IF;
END; $deny$;
ROLLBACK;
