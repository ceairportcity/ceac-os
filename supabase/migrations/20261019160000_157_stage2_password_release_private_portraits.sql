-- Stage 2 P9 forward-only deferred-MFA portrait reconciliation.
-- Original 149 migration remains immutable in the historical/staging ledger.
-- Stage 2 shipping now retains password sign-in and no mandatory MFA.
-- This *narrows* entitlement to a signed-in, active, verified-email profile
-- in an organisation, using the already reviewed universal account helper.
-- The original Storage/pointer permissive owner + tenant policies still apply.
-- When a later owner-approved release switches universal_totp_required=true,
-- this same helper transparently enforces real verified factor-backed AAL2.
--
-- Existing app_portrait_totp_aal2() name is kept for historical policy
-- references; it no longer unconditionally means TOTP is currently required.
DO $preconditions$
BEGIN
 IF to_regprocedure('public.app_stage2_universal_aal_allowed()') IS NULL
    OR to_regprocedure('public.app_portrait_totp_aal2()') IS NULL
    OR to_regclass('public.profile_portraits') IS NULL THEN
   RAISE EXCEPTION 'Expected migrations 149 and 150 missing';
 END IF;
END
$preconditions$;

CREATE OR REPLACE FUNCTION public.app_portrait_totp_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $account_boundary$
  SELECT auth.uid() IS NOT NULL
     AND public.app_stage2_universal_aal_allowed();
$account_boundary$;
REVOKE ALL ON FUNCTION public.app_portrait_totp_aal2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_portrait_totp_aal2() TO authenticated;
COMMENT ON FUNCTION public.app_portrait_totp_aal2() IS
  'Private CEAC portrait access: active verified same-org account through existing RLS. TOTP/AAL2 is deferred and only required when independently enabled by an organisation after future owner GO.';

-- Never modify the existing 4 pointer and 3 private Storage ownership/tenant
-- policies, bucket public=false, MIME, path ownership or user permissions.
DO $postconditions$
BEGIN
 IF EXISTS(SELECT 1 FROM public.organisations WHERE universal_totp_required) THEN
   RAISE EXCEPTION 'Deferred Stage 2 release cannot force MFA on existing organisations';
 END IF;
 IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='profile_portraits'
        AND policyname LIKE 'ceac_profile_portraits_%') <> 4 THEN
   RAISE EXCEPTION 'Private portrait pointer RLS changed unexpectedly';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.buckets
     WHERE id='ceac-profile-portraits' AND public=false) THEN
   RAISE EXCEPTION 'Private portrait bucket missing or publicly exposed';
 END IF;
END
$postconditions$;
