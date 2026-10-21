\set ON_ERROR_STOP on
-- Rollback-only metadata/RLS checks; actual uploaded bytes are proved in browser.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false WHERE id='10000000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('ceac.test.file_work',public.create_typed_work(p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',
 p_title=>'Rollback dated file evidence',p_assignee_id=>auth.uid(),p_expected_outcome=>'Keep each date evidence attributable',
 p_details=>jsonb_build_object('origin','self_created','schedule_kind','daily','starts_on',current_date-1))::text,true);
SELECT set_config('ceac.test.file_operation',(SELECT id::text FROM public.recurring_operations WHERE work_item_id=current_setting('ceac.test.file_work')::uuid),true);
WITH added AS(INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,actor_id,status)
 VALUES(public.app_org_id(),current_setting('ceac.test.file_operation')::uuid,current_date,auth.uid(),'in_progress') RETURNING id)
SELECT set_config('ceac.test.file_date',(SELECT id::text FROM added),true);
WITH added AS(INSERT INTO public.routine_date_progress(org_id,operation_id,scheduled_on,actor_id,status)
 VALUES(public.app_org_id(),current_setting('ceac.test.file_operation')::uuid,current_date-1,auth.uid(),'in_progress') RETURNING id)
SELECT set_config('ceac.test.file_other_date',(SELECT id::text FROM added),true);
DO $files$
DECLARE f record; pending record; plain record; blocked record;
BEGIN
 SELECT * INTO f FROM public.register_operational_file('routine_date_progress',current_setting('ceac.test.file_date')::uuid,'routine_evidence','venue-proof.txt','text/plain',12);
 PERFORM set_config('ceac.test.date_file',f.file_id::text,true);
 PERFORM set_config('ceac.test.date_file_path',f.storage_path,true);
 IF f.storage_bucket<>'ceac-operational-private' OR f.storage_path NOT LIKE '%/routine-date/'||current_setting('ceac.test.file_date')||'/%' THEN
 RAISE EXCEPTION 'Dated evidence registration did not bind its private path'; END IF;
 INSERT INTO storage.objects(bucket_id,name) VALUES(f.storage_bucket,f.storage_path);
 PERFORM public.finalize_operational_file(f.file_id);
 IF NOT public.app_can_access_operational_file(f.file_id) THEN RAISE EXCEPTION 'Author cannot read dated evidence'; END IF;
 BEGIN PERFORM public.link_operational_file(f.file_id,'routine_date_progress',current_setting('ceac.test.file_other_date')::uuid,'routine_evidence');
 RAISE EXCEPTION 'Dated file moved to another date'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.link_operational_file(f.file_id,'work_item',current_setting('ceac.test.file_work')::uuid,'assignment_source');
 RAISE EXCEPTION 'Dated file escaped to another context'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT * INTO plain FROM public.register_operational_file('work_item',current_setting('ceac.test.file_work')::uuid,'assignment_source','ordinary-source.txt','text/plain',12);
 INSERT INTO storage.objects(bucket_id,name) VALUES(plain.storage_bucket,plain.storage_path);
 PERFORM public.finalize_operational_file(plain.file_id);
 BEGIN PERFORM public.link_operational_file(plain.file_id,'routine_date_progress',current_setting('ceac.test.file_date')::uuid,'routine_evidence');
 RAISE EXCEPTION 'Broader ordinary file imported into dated evidence'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT * INTO pending FROM public.register_operational_file('routine_date_progress',current_setting('ceac.test.file_date')::uuid,'routine_evidence','paused-proof.txt','text/plain',12);
 INSERT INTO storage.objects(bucket_id,name) VALUES(pending.storage_bucket,pending.storage_path);
 SELECT * INTO blocked FROM public.register_operational_file('routine_date_progress',current_setting('ceac.test.file_date')::uuid,'routine_evidence','not-uploaded-yet.txt','text/plain',12);
 PERFORM public.set_routine_paused(current_setting('ceac.test.file_work')::uuid,true,'Pause before pending upload is finalised');
 BEGIN PERFORM public.finalize_operational_file(pending.file_id);
 RAISE EXCEPTION 'Pending dated evidence finalised after authority changed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- A previously registered path must also recheck current authority at Storage.
 BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES(blocked.storage_bucket,blocked.storage_path);
 RAISE EXCEPTION 'Storage upload ignored paused/current authority'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.set_routine_paused(current_setting('ceac.test.file_work')::uuid,false,'Resume verified date evidence work');
END;
$files$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000006',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}',true);
DO $colleague$
BEGIN
 IF NOT public.app_can_read_operational_context('routine_date_progress',current_setting('ceac.test.file_date')::uuid) THEN
 RAISE EXCEPTION 'Permitted unit work evidence became inaccessible'; END IF;
 BEGIN PERFORM * FROM public.register_operational_file('routine_date_progress',current_setting('ceac.test.file_date')::uuid,'routine_evidence','impersonated.txt','text/plain',12);
 RAISE EXCEPTION 'Colleague added files to another authors update'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$colleague$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000007',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}',true);
DO $other$
BEGIN
 IF public.app_can_read_operational_context('routine_date_progress',current_setting('ceac.test.file_date')::uuid)
  OR EXISTS(SELECT 1 FROM public.operational_files WHERE id=current_setting('ceac.test.date_file')::uuid)
  OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='ceac-operational-private' AND name=current_setting('ceac.test.date_file_path')) THEN
 RAISE EXCEPTION 'Other-unit manager can read private dated evidence'; END IF;
 BEGIN PERFORM * FROM public.register_operational_file('routine_date_progress',current_setting('ceac.test.file_date')::uuid,'routine_evidence','other-unit.txt','text/plain',12);
 RAISE EXCEPTION 'Other-unit manager can upload dated evidence'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$other$;
RESET ROLE;
ROLLBACK;
