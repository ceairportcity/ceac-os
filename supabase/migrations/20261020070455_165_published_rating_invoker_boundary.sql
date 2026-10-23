-- Forward-only: preserve the exact self-only HR-approved projection while
-- making its public view SECURITY INVOKER. Protected HR tables stay private.
-- The private helper is a reviewed trusted reader, not a public REST RPC.
DO $precondition$
BEGIN
 IF to_regnamespace('private') IS NULL
    OR to_regclass('public.stage2_employee_published_human_ratings') IS NULL
    OR to_regprocedure('public.app_stage2_universal_aal_allowed()') IS NULL THEN
  RAISE EXCEPTION 'The existing private schema and protected Stage 2 publication boundary are required.';
 END IF;
END;
$precondition$;

CREATE FUNCTION private.stage2_self_published_human_ratings()
RETURNS TABLE (
 id uuid, appraisal_id uuid, assessment_entry_id uuid, profile_id uuid,
 reviewer_id uuid, cadence text, rubric_version integer, category_ratings jsonb,
 overall_rating text, overall_narrative text, strengths text, challenges text,
 next_actions text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $published$
 SELECT r.id,r.appraisal_id,r.assessment_entry_id,r.profile_id,r.reviewer_id,r.cadence,
  r.rubric_version,r.category_ratings,r.overall_rating,r.overall_narrative,
  r.strengths,r.challenges,r.next_actions,r.created_at
 FROM public.appraisal_human_rating_versions r
 JOIN public.appraisals a
  ON a.id=r.appraisal_id AND a.org_id=r.org_id AND a.profile_id=r.profile_id
 JOIN public.performance_review_release_requests d
  ON d.appraisal_id=a.id AND d.org_id=a.org_id
  AND d.requested_assessment_id=r.assessment_entry_id
 WHERE auth.uid() IS NOT NULL
  AND a.profile_id=auth.uid()
  AND a.org_id=public.app_org_id()
  AND public.app_stage2_universal_aal_allowed()
  AND a.status IN ('shared','closed')
  AND d.state='approved';
$published$;
REVOKE ALL ON FUNCTION private.stage2_self_published_human_ratings() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.stage2_self_published_human_ratings() TO authenticated,service_role;
COMMENT ON FUNCTION private.stage2_self_published_human_ratings() IS
 'Reviewed self-only published-rating reader: no parameters, no HR decision notes, no unpublished versions, active actor/tenant/assurance enforced. Kept outside the public REST schema.';

-- Identical public relation, column names/types and reader grants. Do not grant
-- employees access to the confidential HR request relation to satisfy the view.
CREATE OR REPLACE VIEW public.stage2_employee_published_human_ratings
WITH (security_invoker=true,security_barrier=true)
AS SELECT * FROM private.stage2_self_published_human_ratings();
REVOKE ALL ON public.stage2_employee_published_human_ratings FROM PUBLIC,anon;
GRANT SELECT ON public.stage2_employee_published_human_ratings TO authenticated;
COMMENT ON VIEW public.stage2_employee_published_human_ratings IS
 'Security-invoker self-only projection of the exact independently HR-approved immutable rating version; protected decision notes and unpublished reviews remain inaccessible.';
