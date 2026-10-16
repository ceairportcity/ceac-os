-- Forward-only security repair acceptance on the disposable migration-replay DB.
-- Never run fixture inserts outside this transaction.
\set ON_ERROR_STOP on
BEGIN;

DO $metadata$
DECLARE
  v_sql text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c WHERE c.oid='public.support_case_safe_status'::regclass
      AND 'security_invoker=true'=any(coalesce(c.reloptions,array[]::text[]))
      AND 'security_barrier=true'=any(coalesce(c.reloptions,array[]::text[]))
  ) THEN RAISE EXCEPTION 'Support status is not security_invoker=true with a security barrier.'; END IF;
  IF has_table_privilege('anon','public.support_case_safe_status','SELECT')
     OR has_function_privilege('anon','private.support_case_safe_status_rows()','EXECUTE')
     OR NOT has_table_privilege('authenticated','public.support_case_safe_status','SELECT')
     OR NOT has_function_privilege('authenticated','private.support_case_safe_status_rows()','EXECUTE')
  THEN RAISE EXCEPTION 'Private Support projection has incorrect anonymous/authenticated grants.'; END IF;
  v_sql:=pg_get_viewdef('public.support_case_safe_status'::regclass,true);
  IF position('private.support_case_safe_status_rows()' in v_sql)=0
  THEN RAISE EXCEPTION 'Invoking view does not call the private reporter projection.'; END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='support_case_safe_status'
       AND column_name IN ('org_id','reported_by','affected_profile_id','affected_unit_id','assigned_to','impact','updated_at')
  ) THEN RAISE EXCEPTION 'Sensitive Support case fields escaped the projection.'; END IF;
END
$metadata$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);

INSERT INTO public.support_cases(org_id,reported_by,affected_profile_id,category,summary,description)
VALUES('10000000-0000-4000-8000-000000000010',
  '31000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  'something_not_working','Invoker projection rollback QA',
  'Test reporter can see only the restricted Support case view, not the underlying table.'
);
DO $reporter$
BEGIN
  IF (SELECT count(*) FROM public.support_case_safe_status WHERE summary='Invoker projection rollback QA')<>1
     OR (SELECT count(*) FROM public.support_cases WHERE summary='Invoker projection rollback QA')<>0
  THEN RAISE EXCEPTION 'Reporter cannot safely see own status or can read raw cases.'; END IF;
END
$reporter$;

SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
DO $unrelated$
BEGIN
  IF (SELECT count(*) FROM public.support_case_safe_status WHERE summary='Invoker projection rollback QA')<>0
     OR (SELECT count(*) FROM public.support_cases WHERE summary='Invoker projection rollback QA')<>0
  THEN RAISE EXCEPTION 'Other authenticated users can read reporter case data.'; END IF;
END
$unrelated$;

RESET ROLE;
ROLLBACK;
SELECT 'Support invoker projection RLS/privacy gate passed' AS result;
