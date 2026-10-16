\set ON_ERROR_STOP on
-- Stage 2 portrait media: local disposable PostgreSQL only, rollback-only.
-- Requires migration 149 and the standard seeded fixture profiles.
-- This tests policy effects; actual Supabase Storage signed-URL behaviour
-- and universal MFA/Auth provider step-up require separate browser testing.
BEGIN;

DO $contract$
BEGIN
 IF to_regclass('public.profile_portraits') IS NULL
    OR to_regprocedure('public.app_portrait_totp_aal2()') IS NULL
 THEN RAISE EXCEPTION 'Stage 2 portrait policy and TOTP method gate are missing'; END IF;
 IF has_table_privilege('anon','public.profile_portraits','SELECT')
    OR has_table_privilege('anon','public.profile_portraits','INSERT')
 THEN RAISE EXCEPTION 'Anonymous profile portrait table privileges were granted'; END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.buckets
                WHERE id='ceac-profile-portraits' AND public=false)
 THEN RAISE EXCEPTION 'Portrait bucket is missing or publicly readable'; END IF;
 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='profile_portraits') <> 4
 THEN RAISE EXCEPTION 'Portrait profile RLS policy inventory differs from contract'; END IF;
 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='storage' AND tablename='objects'
       AND policyname LIKE 'ceac_portrait_storage_%') <> 3
 THEN RAISE EXCEPTION 'Portrait Storage RLS policy inventory differs from contract'; END IF;
END
$contract$;

-- Synthetic staff-owned object; inserted under postgres for RLS testing.
-- Nothing leaves this transaction.
INSERT INTO storage.objects (bucket_id,name,owner_id)
VALUES (
 'ceac-profile-portraits',
 '10000000-0000-4000-8000-000000000010/31000000-0000-4000-8000-000000000001/81000000-0000-4000-8000-000000000001.webp',
 '31000000-0000-4000-8000-000000000001'
);
INSERT INTO public.profile_portraits (profile_id,org_id,object_path)
VALUES (
 '31000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000010',
 '10000000-0000-4000-8000-000000000010/31000000-0000-4000-8000-000000000001/81000000-0000-4000-8000-000000000001.webp'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
DO $no_aal2$
BEGIN
 IF public.app_portrait_totp_aal2() THEN
   RAISE EXCEPTION 'AAL1 user passed authenticator method helper'; END IF;
 IF EXISTS (SELECT 1 FROM public.profile_portraits) THEN
   RAISE EXCEPTION 'AAL1 user can read staff portrait pointer'; END IF;
 IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='ceac-profile-portraits') THEN
   RAISE EXCEPTION 'AAL1 user can read private portrait bytes'; END IF;
END
$no_aal2$;

SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","amr":[{"method":"password"},{"method":"phone"}]}',true);
DO $non_totp$
BEGIN
 IF public.app_portrait_totp_aal2() THEN
   RAISE EXCEPTION 'Phone/non-TOTP AAL2 incorrectly passed TOTP gate'; END IF;
 IF EXISTS (SELECT 1 FROM public.profile_portraits) THEN
   RAISE EXCEPTION 'AAL2 without TOTP read a portrait pointer'; END IF;
END
$non_totp$;

SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","amr":[{"method":"password"},{"method":"totp"}]}',true);
DO $staff_totp$
BEGIN
 IF NOT public.app_portrait_totp_aal2() THEN
   RAISE EXCEPTION 'Valid Staff signed AAL2/TOTP claim rejected'; END IF;
 IF (SELECT count(*) FROM public.profile_portraits) <> 1 THEN
   RAISE EXCEPTION 'Valid Staff unable to see own portrait'; END IF;
 IF (SELECT count(*) FROM storage.objects
     WHERE bucket_id='ceac-profile-portraits') <> 1 THEN
   RAISE EXCEPTION 'Valid Staff unable to read own signed portrait source'; END IF;
END
$staff_totp$;

-- A non-existent/cross-organisation viewer must not inherit a colleague's
-- authorised portrait merely by carrying a valid TOTP/AAL2 JWT shape.
SELECT set_config('request.jwt.claims',
 '{"sub":"91000000-0000-4000-8000-000000000099","role":"authenticated","aal":"aal2","amr":[{"method":"totp"}]}',true);
DO $no_membership$
BEGIN
 IF EXISTS (SELECT 1 FROM public.profile_portraits) THEN
   RAISE EXCEPTION 'Unregistered viewer read a CEAC portrait'; END IF;
 IF EXISTS (SELECT 1 FROM storage.objects
     WHERE bucket_id='ceac-profile-portraits') THEN
   RAISE EXCEPTION 'Unregistered viewer read private portrait bytes'; END IF;
END
$no_membership$;

RESET ROLE;
ROLLBACK;
SELECT 'CEAC Stage 2 private portrait TOTP/RLS gate PASSED' AS result;
