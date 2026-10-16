-- 153 — Stage 2 integrated protections for new P6 confidential HR records.
-- Staged only. Owner P9 Auth/SQL/production GO is mandatory.
-- Migration 150 is default OFF; it precedes 151/152 and thus cannot include
-- those later newly created tables in its original RLS inventory.
DO $later_tables$
DECLARE target text;
BEGIN
 IF to_regprocedure('public.app_stage2_universal_aal_allowed()') IS NULL THEN
   RAISE EXCEPTION 'Stage 2 universal TOTP guard migration 150 must precede P6 integration.';
 END IF;
 FOREACH target IN ARRAY ARRAY[
  'appraisal_human_rating_versions',
  'appraisal_review_exceptions',
  'quarterly_ministry_review_events'
 ] LOOP
   IF to_regclass('public.' || target) IS NULL THEN
     RAISE EXCEPTION 'Expected Stage 2 P6 table % is missing',target;
   END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename=target
       AND policyname='stage2_universal_totp_gate'
       AND permissive='RESTRICTIVE')
   THEN
     EXECUTE format('CREATE POLICY stage2_universal_totp_gate ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.app_stage2_universal_aal_allowed())) WITH CHECK ((SELECT public.app_stage2_universal_aal_allowed()))',target);
   END IF;
 END LOOP;
END
$later_tables$;

-- The existing rating-table policy correctly hides unpublished reviews, but
-- its ordinary employee query cannot observe HR-only release-request rows.
-- Preserve the HR data silo and give employees a NARROW self-only released
-- projection. The view is security-barrier and server-filtered: clients may
-- not supply a profile ID, HR request ID or override the authenticated actor.
-- The view bypasses source RLS only to verify the actual independent HR
-- release. Enforce the NEW AAL2 helper explicitly here (view-owner execution).
CREATE VIEW public.stage2_employee_published_human_ratings
WITH (security_barrier=true)
AS
SELECT
  r.id,r.appraisal_id,r.assessment_entry_id,r.profile_id,r.cadence,
  r.rubric_version,r.category_ratings,r.overall_rating,
  r.overall_narrative,r.strengths,r.challenges,r.next_actions,r.created_at
FROM public.appraisal_human_rating_versions r
JOIN public.appraisals a
 ON a.id=r.appraisal_id AND a.org_id=r.org_id AND a.profile_id=r.profile_id
JOIN public.performance_review_release_requests d
 ON d.appraisal_id=a.id AND d.org_id=a.org_id
 AND d.requested_assessment_id=r.assessment_entry_id
WHERE a.profile_id=auth.uid()
 AND a.org_id=public.app_org_id()
 AND public.app_stage2_universal_aal_allowed()
 AND a.status IN ('shared','closed')
 AND d.state='approved'
 AND d.decided_at>=r.created_at;

REVOKE ALL ON public.stage2_employee_published_human_ratings FROM PUBLIC,anon;
GRANT SELECT ON public.stage2_employee_published_human_ratings TO authenticated;
COMMENT ON VIEW public.stage2_employee_published_human_ratings IS
 'Self-only, AAL2-aware, exactly HR-approved human appraisal version. Omits HR request/decision notes and unpublished revisions; no organisation-wide read.';
