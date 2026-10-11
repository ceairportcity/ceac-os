\set ON_ERROR_STOP on
-- Support case private evidence contract. Synthetic and rollback-only.
-- Requires all 141 candidate migrations applied in disposable postgres,
-- normal seed-role-fixtures.mjs and reviewed local grants.
BEGIN;

DO $contract$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
    WHERE conrelid='public.operational_file_links'::regclass
      AND conname='operational_file_links_context_relation_check'
      AND pg_get_constraintdef(oid) LIKE '%support_evidence%')
   OR has_function_privilege('anon','public.app_can_read_support_case(uuid)','EXECUTE')
   OR has_function_privilege('authenticated','public.app_can_write_support_case(uuid)','EXECUTE')
 THEN
   RAISE EXCEPTION 'Support evidence invariant or internal RPC protection missing';
 END IF;
 IF NOT has_function_privilege('authenticated',
      'public.register_operational_file(text,uuid,text,text,text,bigint)','EXECUTE')
   OR NOT has_function_privilege('authenticated',
      'public.app_can_read_operational_context(text,uuid)','EXECUTE')
 THEN
   RAISE EXCEPTION 'Existing private file helper was disabled';
 END IF;
END
$contract$;

INSERT INTO public.support_team_memberships(
 org_id,profile_id,role,added_by,reason,associated_unit_id
) VALUES('10000000-0000-4000-8000-000000000010',
 '31000000-0000-4000-8000-000000000003','lead',
 '31000000-0000-4000-8000-000000000003',
 'Support evidence operator fixture', '20000000-0000-4000-8000-000000000011');
INSERT INTO public.capability_grants(
 org_id,profile_id,capability,granted_by,grant_reason
) VALUES('10000000-0000-4000-8000-000000000010',
 '31000000-0000-4000-8000-000000000003','support.case.manage',
 '31000000-0000-4000-8000-000000000004',
 'Support private evidence test grant.');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
INSERT INTO public.support_cases(
 id,org_id,reported_by,affected_profile_id,category,summary,description
) VALUES('61000000-0000-4000-8000-000000000093',
 '10000000-0000-4000-8000-000000000010',
 '31000000-0000-4000-8000-000000000001',
 '31000000-0000-4000-8000-000000000001',
 'cannot_upload','Private support evidence fixture',
 'The user needs help troubleshooting private operational file uploads.');

DO $reporter$
BEGIN
 IF public.app_can_read_operational_context(
     'support_case','61000000-0000-4000-8000-000000000093')
   OR public.app_can_write_operational_context(
     'support_case','61000000-0000-4000-8000-000000000093')
 THEN RAISE EXCEPTION 'Case reporting created access to Support private evidence.'; END IF;
 BEGIN
   PERFORM public.register_operational_file(
     'support_case','61000000-0000-4000-8000-000000000093',
     'support_evidence','self-test.pdf','application/pdf',512);
   RAISE EXCEPTION 'Reporter registered internal Support private evidence.';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$reporter$;

SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
UPDATE public.support_cases
 SET assigned_to='31000000-0000-4000-8000-000000000003'
 WHERE id='61000000-0000-4000-8000-000000000093';

DO $support$
DECLARE v_file uuid;
BEGIN
 IF NOT public.app_can_read_operational_context(
      'support_case','61000000-0000-4000-8000-000000000093')
    OR NOT public.app_can_write_operational_context(
      'support_case','61000000-0000-4000-8000-000000000093')
 THEN RAISE EXCEPTION 'Assigned Support operator lacks case evidence access.'; END IF;

 SELECT file_id INTO v_file FROM public.register_operational_file(
     'support_case','61000000-0000-4000-8000-000000000093',
     'support_evidence','case-test.pdf','application/pdf',1024);
 IF v_file IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.operational_file_links
   WHERE file_id=v_file AND context_type='support_case'
     AND context_id='61000000-0000-4000-8000-000000000093'
     AND relation='support_evidence'
 ) THEN RAISE EXCEPTION 'Support evidence was not registered in private bucket.'; END IF;
 IF EXISTS(
   SELECT 1 FROM public.operational_files
   WHERE id=v_file AND storage_bucket<>'ceac-operational-private'
 ) THEN RAISE EXCEPTION 'Support evidence was stored in wrong bucket.'; END IF;
 IF (SELECT count(*) FROM public.support_case_events
     WHERE case_id='61000000-0000-4000-8000-000000000093'
       AND action='evidence_registered')<>1
    OR NOT EXISTS(
      SELECT 1 FROM public.support_case_events
      WHERE case_id='61000000-0000-4000-8000-000000000093'
        AND action='evidence_registered'
        AND actor_id='31000000-0000-4000-8000-000000000003'
        AND note LIKE '%upload not yet verified%'
    ) THEN
     RAISE EXCEPTION 'Immutable Support evidence registration history was not recorded truthfully.';
 END IF;
 BEGIN
   PERFORM public.register_operational_file(
     'support_case','61000000-0000-4000-8000-000000000093',
     'employee_document','invalid.pdf','application/pdf',100);
   RAISE EXCEPTION 'Support evidence used protected employee file relation.';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='Support evidence used protected employee file relation.' THEN RAISE; END IF;
 END;
END
$support$;

-- An ordinary manager is not granted Support case file access by unit authority.
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
DO $manager$
BEGIN
 IF public.app_can_read_operational_context(
   'support_case','61000000-0000-4000-8000-000000000093')
 THEN RAISE EXCEPTION 'Manager could read internal Support private evidence.'; END IF;
END
$manager$;

RESET ROLE;
ROLLBACK;
SELECT 'CEAC private Support case evidence gate PASSED' AS result;
