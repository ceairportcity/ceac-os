-- Stage 2 ONLY: private, authenticated staff portrait media.
-- Source review/migration rehearsal required. Do NOT apply to live Supabase
-- before universal TOTP/AAL2 cutover and owner production GO.
-- Each profile retains existing Auth ID, memberships, HR data and identity.
-- No image bytes, biometric inference or synthetic faces in application tables.


-- A verified AAL2 token established by another factor is insufficient for
-- CEAC's authenticator-app-only policy. A signed JWT AMR must record TOTP.
CREATE FUNCTION public.app_portrait_totp_aal2()
RETURNS boolean LANGUAGE sql STABLE SET search_path = ''
AS $security$
 SELECT auth.uid() IS NOT NULL
    AND (auth.jwt()->>'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(auth.jwt()->'amr') = 'array'
          THEN auth.jwt()->'amr' ELSE '[]'::jsonb END
      ) AS method_claim
      WHERE method_claim->>'method' = 'totp'
    );
$security$;
REVOKE ALL ON FUNCTION public.app_portrait_totp_aal2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_portrait_totp_aal2() TO authenticated;

CREATE TABLE public.profile_portraits (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  object_path text NOT NULL UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portrait_path_format CHECK (
    object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
    AND split_part(object_path, '/', 1) = org_id::text
    AND split_part(object_path, '/', 2) = profile_id::text
  )
);

ALTER TABLE public.profile_portraits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_portraits FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_portraits TO authenticated;

-- Read-only to active authenticated colleagues in the same organisation.
-- A portrait is not a confidential HR file but is never anonymous/public.
CREATE POLICY ceac_profile_portraits_read ON public.profile_portraits
FOR SELECT TO authenticated
USING (
  public.app_portrait_totp_aal2()
  AND org_id = public.app_org_id()
  AND EXISTS (SELECT 1 FROM public.profiles viewer
    WHERE viewer.id = auth.uid() AND viewer.org_id = org_id AND viewer.active)
  AND EXISTS (SELECT 1 FROM public.profiles subject
    WHERE subject.id = profile_id AND subject.org_id = org_id AND subject.active)
);

CREATE POLICY ceac_profile_portraits_owner_insert ON public.profile_portraits
FOR INSERT TO authenticated WITH CHECK (
  public.app_portrait_totp_aal2()
  AND profile_id = auth.uid()
  AND org_id = public.app_org_id()
  AND EXISTS (SELECT 1 FROM public.profiles owner
    WHERE owner.id = auth.uid() AND owner.org_id = org_id AND owner.active)
  AND EXISTS (SELECT 1 FROM storage.objects object
    WHERE object.bucket_id = 'ceac-profile-portraits'
      AND object.name = object_path
      AND object.owner_id = auth.uid()::text)
);

CREATE POLICY ceac_profile_portraits_owner_update ON public.profile_portraits
FOR UPDATE TO authenticated
USING (profile_id = auth.uid() AND org_id = public.app_org_id()
  AND public.app_portrait_totp_aal2())
WITH CHECK (
  profile_id = auth.uid() AND org_id = public.app_org_id()
  AND public.app_portrait_totp_aal2()
  AND EXISTS (SELECT 1 FROM public.profiles owner
    WHERE owner.id = auth.uid() AND owner.org_id = org_id AND owner.active)
  AND EXISTS (SELECT 1 FROM storage.objects object
    WHERE object.bucket_id = 'ceac-profile-portraits'
      AND object.name = object_path
      AND object.owner_id = auth.uid()::text)
);

CREATE POLICY ceac_profile_portraits_owner_delete ON public.profile_portraits
FOR DELETE TO authenticated USING (
  profile_id = auth.uid() AND org_id = public.app_org_id()
  AND public.app_portrait_totp_aal2()
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ceac-profile-portraits','ceac-profile-portraits',false,1048576,ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public=false, file_size_limit=1048576, allowed_mime_types=ARRAY['image/webp'];

CREATE POLICY ceac_portrait_storage_insert ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'ceac-profile-portraits'
  AND public.app_portrait_totp_aal2()
  AND (storage.foldername(name))[1] = public.app_org_id()::text
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
  AND EXISTS (SELECT 1 FROM public.profiles owner
    WHERE owner.id=auth.uid() AND owner.org_id=public.app_org_id() AND owner.active)
);

CREATE POLICY ceac_portrait_storage_read ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'ceac-profile-portraits'
  AND public.app_portrait_totp_aal2()
  AND (storage.foldername(name))[1] = public.app_org_id()::text
  AND EXISTS (SELECT 1 FROM public.profiles viewer
    WHERE viewer.id=auth.uid() AND viewer.org_id=public.app_org_id() AND viewer.active)
  AND EXISTS (SELECT 1 FROM public.profiles subject
    WHERE subject.id::text=(storage.foldername(name))[2]
      AND subject.org_id=public.app_org_id() AND subject.active)
);

CREATE POLICY ceac_portrait_storage_delete ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'ceac-profile-portraits'
  AND public.app_portrait_totp_aal2()
  AND (storage.foldername(name))[1] = public.app_org_id()::text
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND owner_id = auth.uid()::text
);

COMMENT ON TABLE public.profile_portraits IS
'Owner-uploaded staff portrait pointer only; private Storage, current organisation and TOTP/AAL2 checks. Requires complete Stage 2 Auth cutover.';

-- Negative tests required before release:
-- anon/AAL1 SELECT, INSERT, UPDATE, DELETE both table and Storage DENY.
-- Active AAL2 same-org colleague sees only accepted portrait media;
-- external org/inactive user/inactive subject denied.
-- Existing HR private bucket never used as a staff-avatar public source.
-- No service role in browser, no writable arbitrary user ID, MIME not SVG.
