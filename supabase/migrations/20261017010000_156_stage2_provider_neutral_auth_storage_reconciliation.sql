-- CEAC OS Stage 2 P2: forward-only repair of a never-rewritten Google-only
-- migration in the pending chronological ledger. DO NOT apply to live production
-- absent reviewed Stage 2 P9 GO. The universal TOTP flag stays DEFAULT OFF.
--
-- The earlier 20261012172718 migration installs a PostgREST pre-request
-- Google/AAL2 hook and five restrictive Storage policies. Migration 150's
-- provider-neutral guards cannot cancel their effect without removing them.
-- Fail closed if an operator has configured a DIFFERENT pre-request hook.
DO $reconcile_legacy_hook$
DECLARE
  hook_count integer;
  hook_config text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    RAISE EXCEPTION 'Required authenticator role is missing; cannot safely reconcile pre-request hook';
  END IF;

  SELECT count(*), max(setting)
    INTO hook_count, hook_config
  FROM pg_roles role_config
  CROSS JOIN LATERAL unnest(role_config.rolconfig) AS setting
  WHERE role_config.rolname = 'authenticator'
    AND setting LIKE 'pgrst.db_pre_request=%';

  IF hook_count > 1 OR (
    hook_config IS NOT NULL AND
    hook_config <> 'pgrst.db_pre_request=public.ceac_require_google_aal2'
  ) THEN
    RAISE EXCEPTION 'An unknown PostgREST pre-request hook is configured; explicit operator reconciliation required';
  END IF;

  IF hook_config = 'pgrst.db_pre_request=public.ceac_require_google_aal2' THEN
    EXECUTE 'ALTER ROLE authenticator RESET pgrst.db_pre_request';
  END IF;
END
$reconcile_legacy_hook$;
NOTIFY pgrst, 'reload config';

-- Only retire the five EXACT historical Google-only restrictive policies.
-- Keep all Stage 1 permissive ownership/tenant policies untouched.
DROP POLICY IF EXISTS "CEAC Google AAL2 read objects" ON storage.objects;
DROP POLICY IF EXISTS "CEAC Google AAL2 insert objects" ON storage.objects;
DROP POLICY IF EXISTS "CEAC Google AAL2 update objects" ON storage.objects;
DROP POLICY IF EXISTS "CEAC Google AAL2 delete objects" ON storage.objects;
DROP POLICY IF EXISTS "CEAC Google AAL2 read buckets" ON storage.buckets;

-- If migration 150 did not install its narrow object gate, do not silently
-- remove the historical Google restriction and leave Storage unguarded.
DO $required_stage2_storage$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage'
      AND tablename='objects'
      AND policyname='stage2_universal_totp_storage_gate'
      AND permissive='RESTRICTIVE'
  ) OR to_regprocedure('public.app_stage2_universal_aal_allowed()') IS NULL THEN
    RAISE EXCEPTION 'Provider-neutral Stage 2 object Storage protection missing';
  END IF;
END
$required_stage2_storage$;

CREATE POLICY stage2_universal_totp_bucket_gate
ON storage.buckets AS RESTRICTIVE FOR SELECT TO authenticated
USING ((SELECT public.app_stage2_universal_aal_allowed()));

-- Migration 150 also required email_confirmed_at even with Stage 2 MFA
-- switched OFF. Preserve Stage 1 active-profile access under default-OFF;
-- when enabled, require a confirmed identity plus factor-backed AAL2/TOTP.
-- This is one replacement of the SAME already-reviewed helper, not another
-- identity engine, and does not add a SECURITY DEFINER function to the allowlist.
CREATE OR REPLACE FUNCTION public.app_stage2_universal_aal_allowed()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $universal_auth$
 SELECT coalesce((
   SELECT
     NOT o.universal_totp_required
     OR (
       u.email_confirmed_at IS NOT NULL
       AND coalesce(auth.jwt()->>'aal','aal1')='aal2'
       AND jsonb_path_exists(
         coalesce(auth.jwt()->'amr','[]'::jsonb),
         '$[*] ? (@.method == "totp")'
       )
       AND EXISTS(
         SELECT 1 FROM auth.mfa_factors mf
         WHERE mf.user_id=auth.uid()
           AND mf.factor_type='totp'::auth.factor_type
           AND mf.status='verified'::auth.factor_status
       )
     )
   FROM public.profiles p
   JOIN public.organisations o ON o.id=p.org_id
   JOIN auth.users u ON u.id=p.id
   WHERE p.id=auth.uid()
     AND p.active
 ),false);
$universal_auth$;

-- Do not switch on universal_totp_required or touch other Auth providers,
-- tenant ownership RLS, Storage owner policy, live Supabase or Vercel.
