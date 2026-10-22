-- Forward repair for migration180, matching the exact-assessment publication
-- boundary established in155/165. Rating insertion uses clock_timestamp(),
-- while HR approval uses transaction-start now(); ordering those two clocks
-- hides a valid independent approval in a single transaction. Retain the
-- immutable assessment binding, approved decision, shared/closed state,
-- org/admin/capability/AAL checks, retrieval limit and existing ACL.
-- Scoped People/HR employee dossier: return ONLY independently HR-published
-- human-entered rating versions. The ordinary client must never load unreleased
-- reviewer versions and try to filter them after retrieval.
-- Keep employee self-view, protected manager reviews and formal HR release unchanged.
CREATE OR REPLACE FUNCTION public.admin_employee_published_development(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $published_hr$
DECLARE v_org uuid:=public.app_org_id(); v_rows jsonb;
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL
  OR NOT public.app_stage2_universal_aal_allowed()
  OR NOT public.app_is_admin()
  OR NOT public.app_has_capability('people.manage',NULL) THEN
  RAISE EXCEPTION 'Authorised HR employee dossier access required.' USING errcode='42501';
 END IF;
 IF p_profile_id IS NULL THEN
  RAISE EXCEPTION 'Select a linked employee before opening development history.' USING errcode='22023';
 END IF;

 SELECT coalesce(jsonb_agg(
   jsonb_build_object(
    'id',rated.id,'cadence',rated.cadence,'overall_rating',rated.overall_rating,
    'overall_narrative',rated.overall_narrative,'strengths',rated.strengths,
    'challenges',rated.challenges,'next_actions',rated.next_actions,
    'created_at',rated.created_at
   ) ORDER BY rated.created_at DESC,rated.id DESC
 ),'[]'::jsonb)
 INTO v_rows
 FROM (
  SELECT r.id,r.cadence,r.overall_rating,r.overall_narrative,
   r.strengths,r.challenges,r.next_actions,r.created_at
  FROM public.appraisal_human_rating_versions r
  JOIN public.appraisals a ON a.id=r.appraisal_id
    AND a.org_id=r.org_id AND a.profile_id=r.profile_id
  WHERE a.org_id=v_org AND a.profile_id=p_profile_id
   AND a.status IN ('shared','closed')
   AND EXISTS(
    SELECT 1 FROM public.performance_review_release_requests d
    WHERE d.appraisal_id=a.id AND d.org_id=a.org_id
     AND d.requested_assessment_id=r.assessment_entry_id
     AND d.state='approved' AND d.decided_at IS NOT NULL
   )
  ORDER BY r.created_at DESC,r.id DESC
  LIMIT 501
 ) rated;
 IF jsonb_array_length(v_rows)>500 THEN
  RAISE EXCEPTION 'Published employee development history exceeds verified retrieval limit.' USING errcode='54000';
 END IF;
 RETURN v_rows;
END
$published_hr$;
REVOKE ALL ON FUNCTION public.admin_employee_published_development(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_employee_published_development(uuid) TO authenticated;
COMMENT ON FUNCTION public.admin_employee_published_development(uuid) IS
 'Independent HR People/Access read of employee published human assessments; returns no unpublished versions, draft appraisals, or raw reviewer records to the browser.';
