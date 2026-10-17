-- CEAC Stage 2 P6: show only the exact independently HR-approved Manager
-- rating version, regardless of transaction-start timestamp semantics.
-- Existing rating INSERT trigger uses clock_timestamp(); existing HR approval
-- uses now() (transaction start). In a single rollback-only acceptance
-- transaction, comparing decided_at >= rating.created_at falsely hides an
-- otherwise valid HR-approved rating version.
--
-- Exact immutable assessment_entry_id binding, one rating per entry, insert
-- rejection for pending/approved HR requests, actual independent HR approval
-- and shared/closed appraisal state preserve the publication boundary.
-- No broader HR grant, direct employee request-table access or MFA bypass.
-- Production migration remains subject to distinct owner P9 approval.
CREATE OR REPLACE VIEW public.stage2_employee_published_human_ratings
WITH (security_barrier=true)
AS
SELECT
  r.id,r.appraisal_id,r.assessment_entry_id,r.profile_id,r.reviewer_id,r.cadence,
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
 AND d.state='approved';

COMMENT ON VIEW public.stage2_employee_published_human_ratings IS
 'Self-only, AAL2-aware, exact immutable HR-approved assessment version. Omits HR request notes, unpublished revisions and transaction-start timestamp false negatives.';
