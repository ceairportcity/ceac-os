\set ON_ERROR_STOP on
-- Universal Stage 2 server-side opt-in MFA replay, rollback-only test.
-- Uses disposable synthetic Auth users and factors only, not production.
BEGIN;

DO $contract$
DECLARE v_policy_count integer;
BEGIN
 IF to_regprocedure('public.app_stage2_universal_aal_allowed()') IS NULL
   OR has_function_privilege('anon','public.app_stage2_universal_aal_allowed()','EXECUTE')
   OR NOT has_function_privilege('authenticated','public.app_stage2_universal_aal_allowed()','EXECUTE')
 THEN RAISE EXCEPTION 'Universal TOTP helper missing or has unsafe grants'; END IF;
 IF pg_get_functiondef('public.app_stage2_universal_aal_allowed()'::regprocedure)
      NOT ILIKE '%auth.mfa_factors%'
   OR pg_get_functiondef('public.app_stage2_universal_aal_allowed()'::regprocedure)
      NOT ILIKE '%totp%'
 THEN RAISE EXCEPTION 'Universal TOTP helper does not verify enrolled factor and signed authenticator method'; END IF;
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
 IF EXISTS (
   SELECT 1 FROM pg_roles pr
   CROSS JOIN LATERAL unnest(pr.rolconfig) AS conf
   WHERE pr.rolname='authenticator'
     AND conf='pgrst.db_pre_request=public.ceac_require_google_aal2'
 ) THEN
   RAISE EXCEPTION 'Legacy Google-only pre-request hook survived provider-neutral reconciliation';
 END IF;
 IF EXISTS (
   SELECT 1 FROM pg_policies WHERE schemaname='storage'
     AND ((tablename='objects' AND policyname IN (
       'CEAC Google AAL2 read objects','CEAC Google AAL2 insert objects',
       'CEAC Google AAL2 update objects','CEAC Google AAL2 delete objects'
     )) OR (tablename='buckets' AND policyname='CEAC Google AAL2 read buckets'))
 ) THEN
   RAISE EXCEPTION 'Legacy restrictive Google-only Storage policy survived';
 END IF;
 -- Ensure no remaining role RLS policy still silently demands Google OAuth.
 IF EXISTS (
   SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN (
     'ceac_google_mfa_eligible','ceac_session_is_google_aal2',
     'ceac_session_is_google','ceac_require_google_aal2'
   ) AND (has_function_privilege('authenticated',p.oid,'EXECUTE')
       OR has_function_privilege('anon',p.oid,'EXECUTE'))
 ) THEN
   RAISE EXCEPTION 'Retired Google-only helpers remain callable by browser roles';
 END IF;
 -- This detects regressions beyond the five known historical Storage policy names.
 IF EXISTS (
   SELECT 1 FROM pg_policies
   WHERE schemaname IN ('public','storage')
     AND (
       coalesce(qual,'') ~* 'ceac_session_is_google(_aal2)?[[:space:]]*[(]'
       OR coalesce(with_check,'') ~* 'ceac_session_is_google(_aal2)?[[:space:]]*[(]'
       OR coalesce(qual,'') ~* 'ceac_google_mfa_eligible[[:space:]]*[(]'
       OR coalesce(with_check,'') ~* 'ceac_google_mfa_eligible[[:space:]]*[(]'
     )
 ) THEN
   RAISE EXCEPTION 'A Google-only public/Storage RLS predicate survived Stage 2 provider-neutral reconciliation';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_policies WHERE schemaname='storage'
     AND tablename='buckets'
     AND policyname='stage2_universal_totp_bucket_gate'
     AND permissive='RESTRICTIVE'
     AND cmd='SELECT'
     AND roles @> ARRAY['authenticated'::name]
 ) THEN
   RAISE EXCEPTION 'Provider-neutral restrictive Storage bucket gate missing';
 END IF;
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
 IF NOT public.app_stage2_universal_aal_allowed() THEN
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
 IF public.app_stage2_universal_aal_allowed()
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
 IF public.app_stage2_universal_aal_allowed() OR EXISTS (SELECT 1 FROM public.profiles)
 THEN RAISE EXCEPTION 'Non-TOTP AAL2 bypassed authenticator app requirement'; END IF;
END
$phone_deny$;

SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","amr":[{"method":"password"},{"method":"totp"}]}', true);
DO $totp_allow$
BEGIN
 IF NOT public.app_stage2_universal_aal_allowed()
 OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid())
 THEN RAISE EXCEPTION 'Verified TOTP AAL2 Staff was not restored to normal role access'; END IF;
END
$totp_allow$;

-- An AAL2/TOTP-shaped JWT without a verified factor still fails closed.
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","amr":[{"method":"totp"}]}', true);
DO $factor_deny$
BEGIN
 IF public.app_stage2_universal_aal_allowed() OR EXISTS(SELECT 1 FROM public.profiles)
 THEN RAISE EXCEPTION 'No verified TOTP factor but universal MFA passed'; END IF;
END
$factor_deny$;

-- Stage 2 migration 154: the RLS restriction alone is insufficient because
-- SECURITY DEFINER RPCs can bypass it. Assert the SAME AAL1 denial through
-- each reviewed server-side identity/RPC boundary, not merely table SELECT.
DO $rpc_source_inventory$
DECLARE name text;
BEGIN
 FOREACH name IN ARRAY ARRAY[
   'app_org_id','app_identity_confirmed','app_privileged_aal_allowed',
   'app_can_read_announcement','my_sessions','my_account_activity',
   'update_my_personal_details'
 ] LOOP
   IF NOT EXISTS(
     SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=name
       AND pg_get_functiondef(p.oid) LIKE '%public.app_stage2_universal_aal_allowed()%'
   ) THEN
     RAISE EXCEPTION 'Stage 2 RPC universal TOTP guard missing from function %',name;
   END IF;
 END LOOP;
END
$rpc_source_inventory$;

SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}', true);
DO $rpc_aal1_deny$
DECLARE denied boolean := false;
BEGIN
 -- Two internal S3 identity helpers are deliberately inaccessible to browsers.
 IF has_function_privilege('authenticated','public.app_identity_confirmed()','EXECUTE')
    OR has_function_privilege('authenticated','public.app_privileged_aal_allowed()','EXECUTE')
 THEN RAISE EXCEPTION 'Protected internal S3 authority helper was made browser-callable'; END IF;
 IF public.app_org_id() IS NOT NULL OR public.app_is_admin()
    OR public.app_is_exec() OR EXISTS(SELECT 1 FROM public.app_my_units())
    OR EXISTS(SELECT 1 FROM public.my_sessions())
    OR EXISTS(SELECT 1 FROM public.my_account_activity(10)) THEN
    RAISE EXCEPTION 'An AAL1 signed-in employee bypassed Stage 2 security-definer RPC controls';
 END IF;
 BEGIN
   PERFORM public.update_my_personal_details(
     'Not a verified login',NULL,NULL,NULL,NULL,NULL,NULL,'{}'::jsonb
   );
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN
   RAISE EXCEPTION 'Stage 2 AAL1 can invoke a privileged personal-data mutating RPC';
 END IF;
END
$rpc_aal1_deny$;

SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","amr":[{"method":"password"},{"method":"totp"}]}', true);
DO $rpc_totp_allow$
BEGIN
 IF public.app_org_id() IS DISTINCT FROM '10000000-0000-4000-8000-000000000010'::uuid
    OR NOT public.app_stage2_universal_aal_allowed() THEN
    RAISE EXCEPTION 'Signed AAL2/TOTP account cannot use its ordinary signed-in RPC identity';
 END IF;
END
$rpc_totp_allow$;

RESET ROLE;
ROLLBACK;
SELECT 'CEAC Stage 2 universal all-role signed TOTP AAL2 RLS + RPC gate PASSED' AS result;
