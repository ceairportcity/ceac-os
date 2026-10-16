\set ON_ERROR_STOP on
-- Universal Stage 2 server-side opt-in MFA replay, rollback-only test.
-- Uses disposable synthetic Auth users and factors only, not production.
BEGIN;

DO $contract$
DECLARE v_policy_count integer;
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='organisations' AND column_name='universal_totp_required'
    AND column_default ILIKE '%false%' AND is_nullable='NO'
 ) THEN RAISE EXCEPTION 'Universal TOTP must exist and default OFF'; END IF;
 SELECT count(*) INTO v_policy_count FROM pg_policies
 WHERE schemaname='public' AND policyname='stage2_universal_totp_gate'
   AND permissive='RESTRICTIVE' AND roles @> ARRAY['authenticated'::name];
 IF v_policy_count<50 THEN
   RAISE EXCEPTION 'Universal TOTP restrictive public table coverage missing: %',v_policy_count;
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_policies WHERE schemaname='storage'
     AND tablename='objects'
     AND policyname='stage2_universal_totp_storage_gate'
     AND permissive='RESTRICTIVE'
 ) THEN RAISE EXCEPTION 'Universal TOTP Storage guard missing'; END IF;
 IF (SELECT universal_totp_required FROM public.organisations
       WHERE id='10000000-0000-4000-8000-000000000010') THEN
   RAISE EXCEPTION 'Stage 2 migration improperly enabled production-shaped MFA flag';
 END IF;
END
$contract$;

-- Stage 1 default remains functional for standard password-only Staff.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}', true);
DO $default_off$
BEGIN
 IF public.app_org_id()<>'10000000-0000-4000-8000-000000000010'::uuid THEN
   RAISE EXCEPTION 'Stage 1 default-off identity lost organisation';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid()) THEN
   RAISE EXCEPTION 'Stage 1 default-off Staff profile was blocked';
 END IF;
END
$default_off$;
RESET ROLE;

-- Owner-controlled activation simulated only inside a ROLLBACK transaction.
UPDATE public.organisations SET universal_totp_required=true
WHERE id='10000000-0000-4000-8000-000000000010';

INSERT INTO auth.mfa_factors(
 id,user_id,friendly_name,factor_type,status,created_at,updated_at,secret
) VALUES(
 '51000000-0000-4000-8000-000000000081',
 '31000000-0000-4000-8000-000000000001',
 'Stage 2 synthetic staff factor',
 'totp'::auth.factor_type,'verified'::auth.factor_status,
 now(),now(),'stage2-fixture-not-a-real-secret'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}', true);
DO $aal1_deny$
BEGIN
 IF public.app_org_id() IS NOT NULL
 OR EXISTS (SELECT 1 FROM public.profiles)
 OR EXISTS (SELECT 1 FROM public.work_items)
 OR EXISTS (SELECT 1 FROM public.organisations)
 OR EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='ceac-operational-private')
 THEN RAISE EXCEPTION 'AAL1 user reached restricted CEAC table/Storage'; END IF;
END
$aal1_deny$;

SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","amr":[{"method":"password"},{"method":"phone"}]}', true);
DO $phone_deny$
BEGIN
 IF public.app_org_id() IS NOT NULL OR EXISTS (SELECT 1 FROM public.profiles)
 THEN RAISE EXCEPTION 'Non-TOTP AAL2 bypassed authenticator app requirement'; END IF;
END
$phone_deny$;

SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","amr":[{"method":"password"},{"method":"totp"}]}', true);
DO $totp_allow$
BEGIN
 IF public.app_org_id()<>'10000000-0000-4000-8000-000000000010'::uuid
 OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid())
 THEN RAISE EXCEPTION 'Verified TOTP AAL2 Staff was not restored to normal role access'; END IF;
END
$totp_allow$;

-- An AAL2/TOTP-shaped JWT without a verified factor still fails closed.
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","amr":[{"method":"totp"}]}', true);
DO $factor_deny$
BEGIN
 IF public.app_org_id() IS NOT NULL OR EXISTS(SELECT 1 FROM public.profiles)
 THEN RAISE EXCEPTION 'No verified TOTP factor but universal MFA passed'; END IF;
END
$factor_deny$;

RESET ROLE;
ROLLBACK;
SELECT 'CEAC Stage 2 universal all-role signed TOTP AAL2 RLS gate PASSED' AS result;
