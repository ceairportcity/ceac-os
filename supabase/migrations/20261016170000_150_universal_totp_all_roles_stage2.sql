-- CEAC OS Stage 2 (P2) universal verified authenticator AAL2 server guard.
-- NEVER enable on original production until isolated replay, all-role onboarding,
-- recovery, and explicit owner P9 Auth GO. Flag DEFAULT FALSE preserves Stage 1.
-- Provider neutral: password or OAuth may authenticate initially; current JWT
-- MUST prove real verified TOTP AAL2, no Google-only test or provider exemption.
--
-- Stage 2 application mounts the Auth-only TOTP enrollment/challenge screen
-- BEFORE accessing profiles/unit memberships while the flag is enabled.
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS universal_totp_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organisations.universal_totp_required IS
  'Stage 2 owner-GO-only switch: when true, every authenticated CEAC profile must possess a verified TOTP factor and current signed AAL2/TOTP JWT. Default-off is Stage 1 preservation.';

-- Preserve existing user identity/org/active/email confirmation checks exactly.
-- All existing app_org_id() authority paths become unusable at signed AAL1
-- only after the organisation's owner-controlled switch is turned on.
CREATE OR REPLACE FUNCTION public.app_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $universal_auth$
  SELECT p.org_id
  FROM public.profiles p
  JOIN public.organisations o ON o.id=p.org_id
  JOIN auth.users u ON u.id=p.id
  WHERE p.id=auth.uid()
    AND p.active
    AND u.email_confirmed_at IS NOT NULL
    AND (
      NOT o.universal_totp_required
      OR (
        coalesce(auth.jwt()->>'aal','aal1')='aal2'
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
    );
$universal_auth$;
-- Existing app_org_id grants and function identity preserved (no new RPC).

-- Existing permissive RLS sometimes uses another helper, not app_org_id.
-- Restrictive policies enforce the SAME check on all signed-in database
-- reads/writes without granting a new browser-callable SECURITY DEFINER RPC.
-- They never grant access to any row: old permissive policies still apply.
DO $all_role_rls$
DECLARE target record;
BEGIN
  FOR target IN
    SELECT ns.nspname AS schema_name, cls.relname AS table_name
    FROM pg_class cls
    JOIN pg_namespace ns ON ns.oid=cls.relnamespace
    WHERE ns.nspname='public'
      AND cls.relkind IN ('r','p')
      AND cls.relrowsecurity
    ORDER BY cls.relname
  LOOP
    EXECUTE format(
      'CREATE POLICY stage2_universal_totp_gate ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.app_org_id()) IS NOT NULL) WITH CHECK ((SELECT public.app_org_id()) IS NOT NULL)',
      target.schema_name, target.table_name
    );
  END LOOP;
END
$all_role_rls$;

-- Protect all authenticated Storage object operations, including employee
-- portraits and operational evidence; service_role/background operations are
-- separate and unaffected. Public/anonymous access policy remains unchanged.
CREATE POLICY stage2_universal_totp_storage_gate
ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.app_org_id()) IS NOT NULL)
WITH CHECK ((SELECT public.app_org_id()) IS NOT NULL);

-- Do NOT add an automatic switch-on operation here. Installation of the
-- migration is NOT P9 authorisation to require MFA in live production.
