\set ON_ERROR_STOP on
-- Disposable seeded local database only. Every test and fixture rolls back.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false
 WHERE id='10000000-0000-4000-8000-000000000010';
INSERT INTO public.work_items(id,org_id,unit_id,ref,kind,title,assignee_id,assigned_by,origin,visibility,confidential,status,project_id)
VALUES ('26000000-0000-4000-8000-000000000162','10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011',
 'TUA-OWNER-162','task','Synthetic owner activity guard','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',
 'self_created','unit',false,'in_progress','25000000-0000-4000-8000-000000000011');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
INSERT INTO public.work_activity_records(id,org_id,work_item_id,contributor_id,activity_date,activity_state,action_summary)
VALUES ('27000000-0000-4000-8000-000000000162','10000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000162',
 '31000000-0000-4000-8000-000000000001','2026-09-30','done','Original dated action');
SELECT public.stage2_relink_own_work('26000000-0000-4000-8000-000000000162',NULL,NULL,NULL,'Correct the current project link');
INSERT INTO public.work_activity_records(id,org_id,work_item_id,contributor_id,activity_date,activity_state,action_summary,supersedes_id)
VALUES ('27000000-0000-4000-8000-000000000163','10000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000162',
 '31000000-0000-4000-8000-000000000001','2026-10-01','done','Corrected dated action','27000000-0000-4000-8000-000000000162');
DO $history$
BEGIN
 IF (SELECT source_project_id FROM public.work_activity_records WHERE id='27000000-0000-4000-8000-000000000163')
    IS DISTINCT FROM '25000000-0000-4000-8000-000000000011'::uuid THEN
   RAISE EXCEPTION 'Correction lost the original project after parent relink';
 END IF;
 BEGIN
   UPDATE public.work_activity_records SET action_summary='Attempt to overwrite history' WHERE id='27000000-0000-4000-8000-000000000162';
   RAISE EXCEPTION 'Browser overwrote append-only activity';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   DELETE FROM public.work_activity_records WHERE id='27000000-0000-4000-8000-000000000162';
   RAISE EXCEPTION 'Browser deleted append-only activity';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$history$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000006',true);
DO $other_contributor$
BEGIN
 BEGIN
  INSERT INTO public.work_activity_records(org_id,work_item_id,contributor_id,activity_date,activity_state,action_summary,supersedes_id)
  VALUES ('10000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000162','31000000-0000-4000-8000-000000000006',
   '2026-10-02','done','Attempt another contributor correction','27000000-0000-4000-8000-000000000163');
  RAISE EXCEPTION 'Another contributor corrected the original author';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.stage2_relink_own_work('26000000-0000-4000-8000-000000000162',NULL,NULL,NULL,'Attempt another person project relink');
  RAISE EXCEPTION 'Another contributor relinked someone else responsibility';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$other_contributor$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('ceac.test.assessment_id', public.stage2_record_project_person_assessment(
 '25000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000001',
 'Specific synthetic contribution with attributable original project evidence.')::text,true);
DO $manager_scope$
BEGIN
 BEGIN
  PERFORM public.stage2_record_project_person_assessment('25000000-0000-4000-8000-000000000011',
   '31000000-0000-4000-8000-000000000002','Attempt to assess my own project contribution.');
  RAISE EXCEPTION 'Manager assessed their own contribution';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.stage2_record_project_person_assessment('25000000-0000-4000-8000-000000000011',
   '31000000-0000-4000-8000-000000000005','Attempt to assess a person outside my managed scope.');
  RAISE EXCEPTION 'Manager assessed another unit without supervised contribution';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$manager_scope$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $unpublished$
BEGIN
 IF EXISTS(SELECT 1 FROM public.project_person_contribution_assessments
     WHERE id=current_setting('ceac.test.assessment_id')::uuid) THEN
  RAISE EXCEPTION 'Employee can read unpublished project assessment';
 END IF;
 BEGIN
  PERFORM public.stage2_record_project_person_assessment('25000000-0000-4000-8000-000000000011',
   '31000000-0000-4000-8000-000000000006','Ordinary staff attempting managerial contribution assessment.');
  RAISE EXCEPTION 'Ordinary staff authored a managerial assessment';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$unpublished$;
RESET ROLE;
UPDATE public.organisations SET universal_totp_required=true WHERE id='10000000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $assurance$
BEGIN
 BEGIN
  PERFORM public.stage2_relink_own_work('26000000-0000-4000-8000-000000000162',NULL,NULL,NULL,'No changes still require authorisation');
  RAISE EXCEPTION 'An AAL1 caller bypassed the opted-in future assurance guard';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM NOT LIKE '%assurance level%' THEN RAISE; END IF;
 END;
END;
$assurance$;
RESET ROLE;
DO $grants$
BEGIN
 IF has_function_privilege('anon','public.stage2_relink_own_work(uuid,uuid,uuid,uuid,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.stage2_snapshot_activity_attribution()','EXECUTE') THEN
   RAISE EXCEPTION 'Reconciliation widened browser function access';
 END IF;
END;
$grants$;
ROLLBACK;
