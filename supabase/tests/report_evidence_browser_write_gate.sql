\set ON_ERROR_STOP on
-- Verify the isolated version-130 authority change after migration replay.
-- No production writes. The transaction is rolled back in disposable Postgres.
BEGIN;
DO $grants$
DECLARE v_sig regprocedure := 'public.save_and_submit_report(uuid,text,uuid,uuid,text,text,jsonb,jsonb)'::regprocedure;
BEGIN
  IF has_table_privilege('anon','public.report_evidence_refs','INSERT')
     OR has_table_privilege('anon','public.report_evidence_refs','UPDATE')
     OR has_table_privilege('anon','public.report_evidence_refs','DELETE')
     OR has_table_privilege('anon','public.report_evidence_refs','TRUNCATE')
     OR has_table_privilege('authenticated','public.report_evidence_refs','INSERT')
     OR has_table_privilege('authenticated','public.report_evidence_refs','UPDATE')
     OR has_table_privilege('authenticated','public.report_evidence_refs','DELETE')
     OR has_table_privilege('authenticated','public.report_evidence_refs','TRUNCATE') THEN
     RAISE EXCEPTION 'Evidence ACL gate: browser direct DML is still exposed';
  END IF;
  IF NOT has_table_privilege('authenticated','public.report_evidence_refs','SELECT')
     OR NOT has_table_privilege('service_role','public.report_evidence_refs','INSERT')
     OR NOT has_function_privilege('authenticated',v_sig,'EXECUTE')
     OR has_function_privilege('anon',v_sig,'EXECUTE') THEN
     RAISE EXCEPTION 'Evidence ACL gate: legitimate read or RPC write boundary was altered';
  END IF;
  IF NOT EXISTS(
       SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='report_evidence_refs' AND c.relrowsecurity
     ) THEN
     RAISE EXCEPTION 'Evidence ACL gate: table RLS is disabled';
  END IF;
END
$grants$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
-- SELECT remains legal, with returned data restricted by existing report RLS.
SELECT count(*) AS visible_report_evidence_count
  FROM public.report_evidence_refs;
DO $browser$
BEGIN
  BEGIN
    INSERT INTO public.report_evidence_refs(
      report_id,section,object_type,object_id)
    VALUES('23000000-0000-4000-8000-000000000095',
           'evidence','work_item',
           '26000000-0000-4000-8000-000000000096');
    RAISE EXCEPTION 'Evidence ACL gate: direct authenticated INSERT succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$browser$;
RESET ROLE;
ROLLBACK;
SELECT 'CEAC report evidence browser-write lock gate passed' AS result;
