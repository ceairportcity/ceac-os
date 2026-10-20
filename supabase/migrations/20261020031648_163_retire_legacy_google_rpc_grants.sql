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

REVOKE ALL ON FUNCTION public.ceac_google_mfa_eligible()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ceac_session_is_google_aal2()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ceac_session_is_google()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ceac_require_google_aal2()
  FROM PUBLIC, anon, authenticated;

-- Do not drop historical definitions, replace an operator's unrelated hook,
-- enable MFA, change providers, or alter any existing account or data row.
NOTIFY pgrst, 'reload schema';
COMMIT;
