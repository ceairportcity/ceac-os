-- Stage 2 owner approval, 22 Oct 2026: the Group Pastor may conduct the
-- Administration/Head of HR employee's own review ONLY when assigned to the
-- specific appraisal. No generic protected HR, payroll or HR-release authority.
-- Forward-only changes to existing RPC bodies and client workflows. Historical
-- appraisals, issued reviews, auth identities and capability grants are untouched.
--
-- Preserve the existing owner separation: the assigned reviewer writes a human
-- review; only an independent authorised HR decision may publish it. In
-- particular, an HR employee must never approve their own review publication.

CREATE OR REPLACE FUNCTION public.open_performance_review_cycle(
  p_name text,p_starts_on date,p_ends_on date,p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_cycle_id uuid;
  v_appraisal_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.app_has_capability('performance.admin',NULL) THEN
    RAISE EXCEPTION 'You do not have authority to open review periods.' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_name,'')))<3 THEN
    RAISE EXCEPTION 'Review period name is required.';
  END IF;
  IF p_starts_on IS NULL OR p_ends_on IS NULL OR p_ends_on<p_starts_on THEN
    RAISE EXCEPTION 'Choose a valid review period.';
  END IF;
  IF length(btrim(coalesce(p_reason,'')))<3 THEN
    RAISE EXCEPTION 'A reason is required.';
  END IF;

  INSERT INTO public.appraisal_cycles(
    org_id,name,starts_on,ends_on,status,opened_by,opened_reason
  ) VALUES (
    v_org,btrim(p_name),p_starts_on,p_ends_on,'open',v_actor,btrim(p_reason)
  ) RETURNING id INTO v_cycle_id;

  FOR v_appraisal_id IN
    INSERT INTO public.appraisals(
      org_id,cycle_id,profile_id,manager_id,unit_id,status,opened_by,
      reviewer_assigned_by,reviewer_assigned_at,reviewer_assignment_reason
    )
    SELECT
      er.org_id,v_cycle_id,er.profile_id,
      CASE WHEN p.is_admin OR er.manager_profile_id=er.profile_id
           THEN NULL ELSE er.manager_profile_id END,
      er.unit_id,'evidence',v_actor,
      CASE WHEN NOT p.is_admin AND er.manager_profile_id IS NOT NULL
                     AND er.manager_profile_id<>er.profile_id THEN v_actor ELSE NULL END,
      CASE WHEN NOT p.is_admin AND er.manager_profile_id IS NOT NULL
                     AND er.manager_profile_id<>er.profile_id THEN now() ELSE NULL END,
      CASE WHEN NOT p.is_admin AND er.manager_profile_id IS NOT NULL
                     AND er.manager_profile_id<>er.profile_id
        THEN 'Reviewer copied from the current employment record when the review period opened.'
        ELSE NULL END
    FROM public.employment_records er
    JOIN public.profiles p ON p.id=er.profile_id AND p.org_id=er.org_id
    WHERE er.org_id=v_org AND er.employment_status='active'
      AND p.active
      -- This includes employed Administration/HR; the Group Pastor is NOT
      -- an employee appraisal subject, even if an Executive employment row exists.
      AND NOT p.is_exec
    ON CONFLICT(cycle_id,profile_id) DO NOTHING RETURNING id
  LOOP
    PERFORM public.performance_generate_evidence_internal(v_appraisal_id,v_actor);
  END LOOP;

  RETURN v_cycle_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_performance_reviewer(
 p_appraisal_id uuid,p_reviewer_id uuid,p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_appraisal public.appraisals;
  v_subject public.profiles;
  v_reviewer public.profiles;
  v_ok boolean:=false;
BEGIN
  IF v_actor IS NULL OR NOT public.app_has_capability('performance.admin',NULL) THEN
    RAISE EXCEPTION 'You do not have authority to assign review responsibility.' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_reason,'')))<3 THEN
    RAISE EXCEPTION 'A reason is required.';
  END IF;
  SELECT * INTO v_appraisal FROM public.appraisals
    WHERE id=p_appraisal_id AND org_id=v_org FOR UPDATE;
  IF v_appraisal.id IS NULL OR v_appraisal.status IN ('shared','closed') THEN
    RAISE EXCEPTION 'Open review case not found.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_subject FROM public.profiles
    WHERE id=v_appraisal.profile_id AND org_id=v_org AND active;
  SELECT * INTO v_reviewer FROM public.profiles
    WHERE id=p_reviewer_id AND org_id=v_org AND active;
  IF v_subject.id IS NULL OR v_reviewer.id IS NULL
     OR v_subject.id=v_reviewer.id THEN
    RAISE EXCEPTION 'Only a different active authorised person may review this employee.' USING ERRCODE='42501';
  END IF;

  IF v_subject.is_admin THEN
    -- The Group Pastor is the reviewed *individual* exception. Executive role
    -- alone or a job title alone grants nothing: both must hold and HR must
    -- explicitly assign this particular case, with an attributable reason.
    -- No capability or access to any other HR record is granted.
    v_ok:=v_reviewer.is_exec
      AND lower(btrim(coalesce(v_reviewer.job_title,'')))='group pastor'
      AND NOT v_reviewer.is_admin;
  ELSE
    -- All ordinary employee reviews retain the former Administration/Manager
    -- eligibility, with an additional no-self-review constraint.
    v_ok:=v_reviewer.is_admin OR EXISTS(
      SELECT 1 FROM public.unit_memberships um
      WHERE um.profile_id=v_reviewer.id AND um.org_id=v_org
        AND um.unit_id=v_appraisal.unit_id AND um.role='manager'
    );
  END IF;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'The requested reviewer is not authorised for this employee review.' USING ERRCODE='42501';
  END IF;

  UPDATE public.appraisals
  SET manager_id=v_reviewer.id,
      reviewer_assigned_by=v_actor,
      reviewer_assigned_at=now(),
      reviewer_assignment_reason=btrim(p_reason)
  WHERE id=v_appraisal.id;

  -- Preserve an attributable record even if the person initially had no
  -- employment-record Manager; assigning this case does not change the roster.
  INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  VALUES(v_org,v_actor,'performance_reviewer_assigned','appraisal',v_appraisal.id,
         jsonb_build_object('reviewer_id',v_reviewer.id,
          'subject_id',v_appraisal.profile_id,'reason',btrim(p_reason)));
END;
$function$;

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
BEGIN
 IF v_actor IS NULL OR v_org IS NULL
    OR NOT public.app_is_admin()
    OR NOT public.app_has_capability('people.manage',NULL) THEN
   RAISE EXCEPTION 'HR release authority is required.' USING ERRCODE='42501';
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
 -- Explicitly reject HR publication or decline of the actor's own appraisal,
 -- including the sole HR administrator. Do not promote the reviewing Pastor to
 -- HR publisher; independent HR release needs separately approved authority.
 IF v_review.id IS NULL OR v_review.status='closed'
    OR v_actor=v_request.requested_by OR v_actor=v_review.profile_id
    OR (v_ok AND v_review.manager_id IS DISTINCT FROM v_request.requested_by) THEN
   RAISE EXCEPTION 'Independent HR publication authority is required for this review.' USING ERRCODE='42501';
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
    jsonb_build_object('request_id',v_request.id,'approved',v_ok,'assessment_id',v_latest));
 RETURN jsonb_build_object('request_id',v_request.id,'approved',v_ok,
    'appraisal_id',v_review.id,'manager_assessment_id',v_latest);
END;
$function$;

-- No grants, RLS policies or protected HR permissions are broadened here.
-- Existing exact-signature security allowlist remains unchanged (159).

-- Narrow self-case confidentiality: Administration still reviews OTHER
-- employees' draft records, but their own review follows employee publication
-- visibility. Assignment of the Group Pastor must not reveal his draft to
-- the employee under review merely because that employee holds HR privileges.
-- No role grants, new callable functions or broader RLS read permissions.
ALTER POLICY stage7_entries_read ON public.appraisal_entries
 USING (
   org_id=public.app_org_id()
   AND EXISTS(
     SELECT 1 FROM public.appraisals a
     WHERE a.id=appraisal_entries.appraisal_id AND a.org_id=appraisal_entries.org_id
       AND (
         a.manager_id=auth.uid()
         OR (public.app_is_admin() AND public.app_has_capability('people.manage',NULL)
             AND a.profile_id<>auth.uid())
         OR (a.profile_id=auth.uid() AND (
               appraisal_entries.entry_type NOT IN ('manager_assessment','conversation_record')
               OR public.performance_employee_release_visible(a.id,appraisal_entries.created_at)
             ))
       )
   )
 );

ALTER POLICY stage7_development_read ON public.development_plan_versions
 USING (
   org_id=public.app_org_id()
   AND (
     manager_id=auth.uid()
     OR (public.app_is_admin() AND public.app_has_capability('people.manage',NULL)
         AND profile_id<>auth.uid())
     OR (profile_id=auth.uid() AND
         public.performance_employee_release_visible(appraisal_id,created_at))
   )
 );

ALTER POLICY stage2_appraisal_human_rating_select ON public.appraisal_human_rating_versions
 USING (
   org_id=public.app_org_id()
   AND (
     reviewer_id=auth.uid()
     OR (public.app_is_admin() AND public.app_has_capability('people.manage',NULL)
         AND profile_id<>auth.uid())
     OR (profile_id=auth.uid() AND EXISTS(
       SELECT 1 FROM public.performance_review_release_requests p
       WHERE p.appraisal_id=appraisal_human_rating_versions.appraisal_id
         AND p.org_id=appraisal_human_rating_versions.org_id
         AND p.requested_assessment_id=appraisal_human_rating_versions.assessment_entry_id
         AND p.state='approved'
         AND p.decided_at>=appraisal_human_rating_versions.created_at
     ))
   )
 );

ALTER POLICY performance_release_request_read ON public.performance_review_release_requests
 USING (
   org_id=public.app_org_id()
   AND (
     (public.app_is_admin() AND public.app_has_capability('people.manage',NULL)
      AND EXISTS(
        SELECT 1 FROM public.appraisals a
        WHERE a.id=performance_review_release_requests.appraisal_id
          AND a.org_id=performance_review_release_requests.org_id
          AND a.profile_id<>auth.uid()
      ))
     OR EXISTS(
       SELECT 1 FROM public.appraisals a
       WHERE a.id=performance_review_release_requests.appraisal_id
         AND a.org_id=performance_review_release_requests.org_id
         AND a.manager_id=auth.uid()
     )
   )
 );

ALTER POLICY stage2_appraisal_review_exception_read ON public.appraisal_review_exceptions
 USING (
   org_id=public.app_org_id()
   AND (
     (public.app_is_admin() AND public.app_has_capability('people.manage',NULL)
      AND EXISTS(
        SELECT 1 FROM public.appraisals a
        WHERE a.id=appraisal_review_exceptions.appraisal_id
          AND a.org_id=appraisal_review_exceptions.org_id
          AND a.profile_id<>auth.uid()
      ))
     OR EXISTS(
       SELECT 1 FROM public.appraisals a
       WHERE a.id=appraisal_review_exceptions.appraisal_id
         AND a.org_id=appraisal_review_exceptions.org_id
         AND a.manager_id=auth.uid()
     )
   )
 );
