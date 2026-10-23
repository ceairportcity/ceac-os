-- Follow-up security review of the new HR-head exception: preserve the
-- dormant privileged-MFA switch as well as universal app_org_id gating.
-- Both switches stay off for this release. No existing migration is rewritten.

CREATE OR REPLACE FUNCTION public.performance_hr_decide_release(
 p_request_id uuid,p_approve boolean,p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_org uuid:=public.app_org_id();
 v_actor uuid:=auth.uid();
 v_request public.performance_review_release_requests%rowtype;
 v_review public.appraisals%rowtype;
 v_latest uuid;
 v_ok boolean:=coalesce(p_approve,false);
 v_pastor_exception boolean:=false;
 v_hr boolean:=false;
BEGIN
 v_hr:=coalesce(public.app_is_admin() AND public.app_has_capability('people.manage',NULL),false);
 IF v_actor IS NULL OR v_org IS NULL
    OR NOT public.app_privileged_aal_allowed() OR NOT (
    v_hr OR EXISTS(SELECT 1 FROM public.profiles p
      WHERE p.id=v_actor AND p.org_id=v_org AND p.active
        AND p.is_exec AND NOT p.is_admin
        AND lower(btrim(coalesce(p.job_title,'')))='group pastor')
 ) THEN
   RAISE EXCEPTION 'Assessment publication authority is required.' USING ERRCODE='42501';
 END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 1000 THEN
   RAISE EXCEPTION 'Record the HR release decision and reason.';
 END IF;
 SELECT * INTO v_request FROM public.performance_review_release_requests
 WHERE id=p_request_id AND org_id=v_org AND state='pending' FOR UPDATE;
 IF v_request.id IS NULL THEN
   RAISE EXCEPTION 'This pending assessment release request is unavailable.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_review FROM public.appraisals
 WHERE id=v_request.appraisal_id AND org_id=v_org FOR UPDATE;
 -- Owner approval, 23 Oct: only the assigned Group Pastor may publish
 -- the active HR head's own review. No general HR publication/read grant.
 v_pastor_exception:=EXISTS(
   SELECT 1 FROM public.profiles actor
   JOIN public.profiles subject ON subject.id=v_review.profile_id
      AND subject.org_id=actor.org_id AND subject.active AND subject.is_admin
   JOIN public.employment_records er ON er.profile_id=subject.id
      AND er.org_id=subject.org_id AND er.employment_status='active'
   WHERE actor.id=v_actor AND actor.org_id=v_org AND actor.active
     AND actor.is_exec AND NOT actor.is_admin
     AND lower(btrim(coalesce(actor.job_title,'')))='group pastor'
     AND subject.id<>actor.id
     AND v_review.manager_id=actor.id
     AND v_review.reviewer_assigned_by IS NOT NULL
     AND length(btrim(coalesce(v_review.reviewer_assignment_reason,'')))>=3
     AND v_request.requested_by=actor.id
 );
 IF v_review.id IS NULL OR v_review.status='closed'
    OR v_actor=v_review.profile_id
    OR NOT (v_hr OR v_pastor_exception)
    OR (v_actor=v_request.requested_by AND NOT v_pastor_exception)
    OR (v_ok AND v_review.manager_id IS DISTINCT FROM v_request.requested_by) THEN
   RAISE EXCEPTION 'Authorised publication authority is required for this review.' USING ERRCODE='42501';
 END IF;
 SELECT id INTO v_latest FROM public.appraisal_entries
 WHERE appraisal_id=v_review.id AND org_id=v_org AND entry_type='manager_assessment'
 ORDER BY created_at DESC,id DESC LIMIT 1;
 IF v_ok AND v_latest IS DISTINCT FROM v_request.requested_assessment_id THEN
   RAISE EXCEPTION 'The manager assessment changed. Request HR review of the latest version.' USING ERRCODE='42501';
 END IF;
 UPDATE public.performance_review_release_requests
 SET state=CASE WHEN v_ok THEN 'approved' ELSE 'declined' END,
     decided_by=v_actor,decided_at=now(),decision_reason=btrim(p_reason)
 WHERE id=v_request.id;
 IF v_ok THEN
   UPDATE public.appraisals
   SET status='shared',shared_at=now(),shared_by=v_actor
   WHERE id=v_review.id;
 END IF;
 INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 VALUES(v_org,v_actor,'performance_hr_release_decided','performance_review',v_review.id,
    jsonb_build_object('request_id',v_request.id,'approved',v_ok,'assessment_id',v_latest,
      'subject_id',v_review.profile_id,'authority_scope',
      CASE WHEN v_pastor_exception THEN 'assigned_hr_head_group_pastor' ELSE 'independent_hr' END));
 RETURN jsonb_build_object('request_id',v_request.id,'approved',v_ok,
    'appraisal_id',v_review.id,'manager_assessment_id',v_latest);
END;
$function$;

