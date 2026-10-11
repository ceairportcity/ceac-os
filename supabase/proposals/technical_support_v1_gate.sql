-- CEAC Support v1 candidate gate. RUN ONLY ON DISPOSABLE LOCAL DB AFTER
-- APPROVED S3 + all prior migrations + promoted Technical Support migration.
-- Never run against production and never assume this tests actual role isolation.
\set ON_ERROR_STOP on
BEGIN;
DO $gate$
DECLARE
  v_qual text;
  v_anon integer;
BEGIN
  IF to_regclass('public.support_cases') IS NULL
     OR to_regclass('public.support_case_events') IS NULL
     OR to_regclass('public.support_team_memberships') IS NULL THEN
    RAISE EXCEPTION 'Technical Support schema not installed in fixture database.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
      WHERE c.oid IN ('public.support_cases'::regclass,
                      'public.support_case_events'::regclass,
                      'public.support_team_memberships'::regclass)
        AND NOT c.relrowsecurity
  ) THEN RAISE EXCEPTION 'Technical Support RLS is required on all tables.'; END IF;

  IF has_table_privilege('anon','public.support_cases','SELECT')
     OR has_table_privilege('anon','public.support_cases','INSERT')
     OR has_table_privilege('anon','public.support_team_memberships','SELECT')
     OR has_table_privilege('anon','public.support_case_events','SELECT') THEN
    RAISE EXCEPTION 'Anonymous role has Technical Support table access.';
  END IF;

  IF has_table_privilege('authenticated','public.support_team_memberships','INSERT')
     OR has_table_privilege('authenticated','public.support_team_memberships','UPDATE')
     OR has_table_privilege('authenticated','public.support_team_memberships','DELETE')
     OR has_table_privilege('authenticated','public.support_case_events','INSERT')
     OR has_table_privilege('authenticated','public.support_case_events','UPDATE')
     OR has_table_privilege('authenticated','public.support_case_events','DELETE')
     OR has_table_privilege('authenticated','public.support_cases','DELETE') THEN
    RAISE EXCEPTION 'Direct browser writes to membership/history or case deletion are forbidden.';
  END IF;

  SELECT coalesce(string_agg(qual,' '),'') INTO v_qual FROM pg_policies
    WHERE schemaname='public' AND tablename='support_cases' AND cmd IN ('SELECT','UPDATE');
  IF position('support.case.manage' IN v_qual)=0
     OR position('support_team_memberships' IN v_qual)=0
     OR position('reported_by' IN v_qual)=0 THEN
    RAISE EXCEPTION 'Case visibility/management membership-capability gate is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.capability_definitions WHERE capability='support.case.manage'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.capability_definitions WHERE capability='support.access.apply_approved'
  ) THEN RAISE EXCEPTION 'Support-only capability catalogue is incomplete.'; END IF;

  IF has_function_privilege('authenticated','public.support_case_audit_guard()','EXECUTE')
     OR has_function_privilege('anon','public.support_case_audit_guard()','EXECUTE')
     OR has_function_privilege('authenticated','public.support_case_insert_guard()','EXECUTE')
     OR has_function_privilege('anon','public.support_case_insert_guard()','EXECUTE')
     OR has_function_privilege('authenticated','public.support_membership_scope_guard()','EXECUTE')
     OR has_function_privilege('anon','public.support_membership_scope_guard()','EXECUTE') THEN
    RAISE EXCEPTION 'Internal support guard functions are directly callable.';
  END IF;

  SELECT count(*) INTO v_anon
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef AND
    has_function_privilege('anon',p.oid,'EXECUTE');
  IF v_anon<>0 THEN RAISE EXCEPTION 'Anon-executable SECURITY DEFINER surface exceeds zero.'; END IF;
END;
$gate$;
ROLLBACK;
