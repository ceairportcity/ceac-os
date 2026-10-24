-- Rollback-only synthetic proof. Never run this fixture against production.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
INSERT INTO public.projects(id,org_id,kind,name,lead_unit_id,created_by) VALUES
 ('aa610001-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','project','Demo · isolated project','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000003');
INSERT INTO public.work_items(id,org_id,ref,kind,unit_id,project_id,title,visibility,status,assignee_id) VALUES
 ('aa610010-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','OPSA-001','task','20000000-0000-4000-8000-000000000011','aa610001-0000-4000-8000-000000000001','Demo · isolated task','unit','not_started','31000000-0000-4000-8000-000000000001'),
 ('aa610010-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','OPSA-002','task','20000000-0000-4000-8000-000000000011','aa610001-0000-4000-8000-000000000001','Owner-confirmed test task','unit','in_progress','31000000-0000-4000-8000-000000000001'),
 ('aa610010-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000010','OPSA-003','task','20000000-0000-4000-8000-000000000011',null,'Private other-person task','private','not_started','31000000-0000-4000-8000-000000000002');
INSERT INTO public.report_periods(id,org_id,kind,label,starts_on,ends_on,status) VALUES
 ('aa610100-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','month','Canonical isolated month','2098-01-01','2098-01-31','open'),
 ('aa610100-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','month','Legacy duplicate month','2098-02-01','2098-02-28','closed'),
 ('aa610100-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000010','month','Demo · isolated month','2098-03-01','2098-03-31','open');
-- Seed the PRE-EXISTING duplicate state that this forward migration repairs.
-- Only the new uniqueness trigger is suspended for this synthetic legacy row.
ALTER TABLE public.report_periods DISABLE TRIGGER report_period_identity_guard;
UPDATE public.report_periods SET starts_on='2098-01-01',ends_on='2098-01-31' WHERE id='aa610100-0000-4000-8000-000000000002';
ALTER TABLE public.report_periods ENABLE TRIGGER report_period_identity_guard;
INSERT INTO public.reports(id,org_id,period_id,scope,unit_id,narrative,status,submitted_by,submitted_at)
VALUES('aa610101-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','aa610100-0000-4000-8000-000000000003','unit','20000000-0000-4000-8000-000000000011','Demo · original submitted report','submitted','31000000-0000-4000-8000-000000000003',now());
CREATE TEMP TABLE ops_original AS
 SELECT 'projects'::text kind,id,md5(to_jsonb(p)::text) fingerprint FROM public.projects p WHERE id::text LIKE 'aa610001%'
 UNION ALL SELECT 'work_items',id,md5(to_jsonb(w)::text) FROM public.work_items w WHERE id::text LIKE 'aa610010%'
 UNION ALL SELECT 'report_periods',id,md5(to_jsonb(p)::text) FROM public.report_periods p WHERE id::text LIKE 'aa610100%'
 UNION ALL SELECT 'reports',id,md5(to_jsonb(r)::text) FROM public.reports r WHERE id::text LIKE 'aa610101%';
GRANT SELECT ON ops_original TO authenticated;
SET LOCAL ROLE authenticated;
DO $gate$
DECLARE r record; changes jsonb; before_events bigint; canonical uuid:='aa610100-0000-4000-8000-000000000001';
BEGIN
 IF EXISTS(SELECT 1 FROM public.admin_operational_archive_records() WHERE record_id='aa610010-0000-4000-8000-000000000003') THEN
  RAISE EXCEPTION 'Operational archive exposed another person private work'; END IF;
 SELECT jsonb_agg(jsonb_build_object('record_table',record_table,'record_id',record_id,'fingerprint',fingerprint,'event_no',event_no,'archived',true)) INTO changes
 FROM public.admin_operational_archive_records() WHERE record_id='aa610001-0000-4000-8000-000000000001';
 BEGIN PERFORM public.admin_apply_operational_archive(changes,'Synthetic project with live task must fail');
  RAISE EXCEPTION 'Mixed project archive was allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Mixed project archive was allowed' THEN RAISE; END IF; END;
 SELECT count(*) INTO before_events FROM public.operational_archive_events;
 SELECT jsonb_agg(jsonb_build_object('record_table',record_table,'record_id',record_id,'fingerprint',CASE WHEN record_table='projects' THEN 'stale' ELSE fingerprint END,'event_no',event_no,'archived',true)) INTO changes
 FROM public.admin_operational_archive_records() WHERE record_id IN ('aa610001-0000-4000-8000-000000000001','aa610010-0000-4000-8000-000000000001');
 BEGIN PERFORM public.admin_apply_operational_archive(changes,'Synthetic stale batch must roll back'); RAISE EXCEPTION 'Stale batch allowed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF (SELECT count(*) FROM public.operational_archive_events)<>before_events THEN RAISE EXCEPTION 'Stale batch partially applied'; END IF;
 SELECT jsonb_agg(jsonb_build_object('record_table',record_table,'record_id',record_id,'fingerprint',fingerprint,'event_no',event_no,'archived',true)) INTO changes
 FROM public.admin_operational_archive_records() WHERE record_id IN ('aa610001-0000-4000-8000-000000000001','aa610010-0000-4000-8000-000000000001','aa610010-0000-4000-8000-000000000002','aa610100-0000-4000-8000-000000000003');
 IF public.admin_apply_operational_archive(changes,'Synthetic owner-confirmed demonstration archive')<>4 THEN RAISE EXCEPTION 'Atomic archive count mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.projects WHERE id='aa610001-0000-4000-8000-000000000001') OR EXISTS(SELECT 1 FROM public.work_items WHERE id::text LIKE 'aa610010%' AND id<>'aa610010-0000-4000-8000-000000000003')
  OR EXISTS(SELECT 1 FROM public.report_periods WHERE id='aa610100-0000-4000-8000-000000000003') OR EXISTS(SELECT 1 FROM public.reports WHERE id='aa610101-0000-4000-8000-000000000001') THEN
  RAISE EXCEPTION 'Archive leaked into live RLS reads'; END IF;
 IF public.app_can_see_item('aa610010-0000-4000-8000-000000000001') OR EXISTS(SELECT 1 FROM public.app_visible_projects() id WHERE id='aa610001-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Definer visibility bypassed archive'; END IF;
 SELECT * INTO r FROM public.admin_operational_archive_records() WHERE record_id='aa610100-0000-4000-8000-000000000003';
 IF jsonb_array_length(r.retained_reports)<>1 OR r.retained_reports->0->>'narrative'<>'Demo · original submitted report' THEN RAISE EXCEPTION 'Archived report unavailable to authorized reviewer'; END IF;
 SELECT jsonb_agg(jsonb_build_object('record_table',record_table,'record_id',record_id,'fingerprint',fingerprint,'event_no',event_no,'archived',true,'canonical_period_id',canonical)) INTO changes
 FROM public.admin_operational_archive_records() WHERE record_id='aa610100-0000-4000-8000-000000000002';
 PERFORM public.admin_apply_operational_archive(changes,'Synthetic unfiled duplicate reconciliation');
 IF EXISTS(SELECT 1 FROM public.report_periods WHERE id='aa610100-0000-4000-8000-000000000002') OR NOT EXISTS(SELECT 1 FROM public.report_periods WHERE id=canonical) THEN RAISE EXCEPTION 'Canonical period selection failed'; END IF;
 BEGIN INSERT INTO public.report_periods(org_id,kind,label,starts_on,ends_on,status) VALUES('10000000-0000-4000-8000-000000000010','month','Another duplicate','2098-01-01','2098-01-31','open'); RAISE EXCEPTION 'New duplicate allowed'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN PERFORM public.save_report_draft('aa610100-0000-4000-8000-000000000003','unit','20000000-0000-4000-8000-000000000011',null,'New filing against archive',null); RAISE EXCEPTION 'Archived filing allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Archived filing allowed' THEN RAISE; END IF; END;
 -- Restore parent and both tasks in one batch, with the original states intact.
 SELECT jsonb_agg(jsonb_build_object('record_table',record_table,'record_id',record_id,'fingerprint',fingerprint,'event_no',event_no,'archived',false)) INTO changes
 FROM public.admin_operational_archive_records() WHERE record_id IN ('aa610001-0000-4000-8000-000000000001','aa610010-0000-4000-8000-000000000001','aa610010-0000-4000-8000-000000000002');
 PERFORM public.admin_apply_operational_archive(changes,'Synthetic archive restoration proof');
 IF (SELECT count(*) FROM public.work_items WHERE id IN ('aa610010-0000-4000-8000-000000000001','aa610010-0000-4000-8000-000000000002'))<>2 THEN RAISE EXCEPTION 'Task restoration failed'; END IF;
END; $gate$;
RESET ROLE;
DO $immutability$
DECLARE r record; actual text;
BEGIN
 FOR r IN SELECT * FROM ops_original LOOP
  EXECUTE format('SELECT md5(to_jsonb(t)::text) FROM public.%I t WHERE id=$1',r.kind) INTO actual USING r.id;
  IF actual IS DISTINCT FROM r.fingerprint THEN RAISE EXCEPTION 'Archive rewrote source % %',r.kind,r.id; END IF;
 END LOOP;
END; $immutability$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
DO $denials$
BEGIN
 BEGIN PERFORM public.admin_operational_archive_records(); RAISE EXCEPTION 'Staff archive reader allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_apply_operational_archive('[]'::jsonb,'Staff may not classify records'); RAISE EXCEPTION 'Staff archive writer allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.operational_archive_events(org_id,record_table,record_id,archived,reason,recorded_by) VALUES('10000000-0000-4000-8000-000000000010','projects','aa610001-0000-4000-8000-000000000001',true,'Direct write denied','31000000-0000-4000-8000-000000000001'); RAISE EXCEPTION 'Direct archive write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF has_function_privilege('anon','public.admin_apply_operational_archive(jsonb,text)','EXECUTE') OR has_function_privilege('anon','public.admin_operational_archive_records()','EXECUTE')
 OR has_function_privilege('authenticated','private.guard_operational_archive()','EXECUTE') THEN RAISE EXCEPTION 'Archive execution grants widened'; END IF;
END; $denials$;
RESET ROLE;
ROLLBACK;
