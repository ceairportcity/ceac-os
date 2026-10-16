-- 152 — Stage 2 private published-human-ratings employee projection.
-- Required because existing HR release-request RLS correctly hides confidential
-- approval notes from employees; joining that protected table in an ordinary
-- employee RLS policy returns no rows after legitimate HR publication.
-- Forward-only, source-isolated. No production apply without separate P9 GO.
--
-- This OWNER-CONTROLLED, security-barrier view is executed with view-owner
-- privileges to test release linkage while restricting every output row to
-- the signed-in employee and actual independently approved assessment VERSION.
-- It intentionally exposes NO HR request reason, reviewer decision narrative,
-- private colleague data, unapproved draft or later unapproved revision.
CREATE VIEW public.stage2_employee_published_rating_versions
WITH (security_barrier=true)
AS
SELECT
  r.id,
  r.appraisal_id,
  r.assessment_entry_id,
  r.profile_id,
  r.reviewer_id,
  r.cadence,
  r.rubric_version,
  r.category_ratings,
  r.overall_rating,
  r.overall_narrative,
  r.strengths,
  r.challenges,
  r.next_actions,
  r.created_at
FROM public.appraisal_human_rating_versions AS r
JOIN public.appraisals AS a
  ON a.id=r.appraisal_id
 AND a.org_id=r.org_id
 AND a.profile_id=r.profile_id
JOIN public.performance_review_release_requests AS req
  ON req.appraisal_id=a.id
 AND req.org_id=a.org_id
 AND req.requested_assessment_id=r.assessment_entry_id
WHERE a.profile_id=auth.uid()
  AND a.org_id=public.app_org_id()
  AND req.state='approved'
  AND req.decided_at>=r.created_at
  AND a.status IN ('shared','closed');

REVOKE ALL ON public.stage2_employee_published_rating_versions FROM PUBLIC,anon;
GRANT SELECT ON public.stage2_employee_published_rating_versions TO authenticated;
COMMENT ON VIEW public.stage2_employee_published_rating_versions IS
  'Strict self-only published projection. HR publication, not reviewer draft, controls every record; does not expose independent HR decision/request notes.';
