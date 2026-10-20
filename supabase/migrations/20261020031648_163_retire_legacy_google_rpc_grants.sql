-- Forward-only retirement of the browser surface left by historical Google-only
-- migration 20261012172718. Migration 156 already reconciles its pre-request
-- hook and restrictive Storage policies. Preserve immutable history, accounts,
-- password sign-in, current tenant/owner policies and deferred MFA flags.
BEGIN;

DO $retirement_preconditions$
BEGIN
  IF to_regprocedure('public.app_stage2_universal_aal_allowed()') IS NULL
    OR EXISTS (
      SELECT 1 FROM pg_roles r CROSS JOIN LATERAL unnest(r.rolconfig) AS setting
      WHERE r.rolname='authenticator'
        AND setting='pgrst.db_pre_request=public.ceac_require_google_aal2'
    ) OR EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname IN ('public','storage')
        AND (coalesce(qual,'') || ' ' || coalesce(with_check,''))
          ~ 'ceac_(session_is_google|google_mfa_eligible)'
    ) THEN
    RAISE EXCEPTION 'Complete provider-neutral migration 156 before retiring Google-only RPC grants';
  END IF;
END
$retirement_preconditions$;

DO $retire_browser_grants$
DECLARE signature text;
BEGIN
  -- The existing role-test fixture also supports installations that never
  -- applied historical Google enforcement. Missing retired helpers are safe;
  -- do not create them just to revoke them.
  FOREACH signature IN ARRAY ARRAY[
    'public.ceac_google_mfa_eligible()',
    'public.ceac_session_is_google_aal2()',
    'public.ceac_session_is_google()',
    'public.ceac_require_google_aal2()'
  ] LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        to_regprocedure(signature));
    END IF;
  END LOOP;
END
$retire_browser_grants$;

-- Do not drop historical definitions, replace an operator's unrelated hook,
-- enable MFA, change providers, or alter any existing account or data row.
NOTIFY pgrst, 'reload schema';
COMMIT;
