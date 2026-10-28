\set ON_ERROR_STOP on
-- REVIEWED RELEASE ONLY. No consolidation, deletion or reassignment.
-- Supply primary_profile_id, it_unit_id and support_unit_id from a fresh read.
-- Run as the trusted database owner after migration/security acceptance.
BEGIN;
SELECT set_config('ceac.it.primary',:'primary_profile_id',true);
SELECT set_config('ceac.it.department',:'it_unit_id',true);
SELECT set_config('ceac.it.support',:'support_unit_id',true);
DO $correct$
DECLARE actor uuid:=current_setting('ceac.it.primary')::uuid;
 department uuid:=current_setting('ceac.it.department')::uuid;
 support uuid:=current_setting('ceac.it.support')::uuid;
 org uuid;
BEGIN
 SELECT org_id INTO org FROM public.profiles WHERE id=actor
  AND lower(email)='ceairportcity@gmail.com' AND active FOR UPDATE;
 IF org IS NULL OR department=support
  OR NOT EXISTS(SELECT 1 FROM public.units WHERE id=department AND org_id=org AND active AND name='IT')
  OR NOT EXISTS(SELECT 1 FROM public.units WHERE id=support AND org_id=org AND active AND name='Technical Support' AND parent_id=department)
  OR NOT EXISTS(SELECT 1 FROM public.unit_memberships WHERE profile_id=actor AND org_id=org AND unit_id=support AND role='manager')
  OR EXISTS(SELECT 1 FROM public.unit_memberships WHERE profile_id=actor AND unit_id=department AND role<>'manager')
 THEN RAISE EXCEPTION 'Reviewed IT identity or relationships changed. Reinspect before release.'; END IF;
 -- Profile/member audit triggers remain enabled. Existing Support identity,
 -- memberships, assignments, projects and recorded reviewers stay intact.
 UPDATE public.profiles SET job_title='IT Head' WHERE id=actor AND job_title IS DISTINCT FROM 'IT Head';
 INSERT INTO public.unit_memberships(org_id,profile_id,unit_id,role)
 VALUES(org,actor,department,'manager') ON CONFLICT(profile_id,unit_id) DO NOTHING;
END; $correct$;
COMMIT;
