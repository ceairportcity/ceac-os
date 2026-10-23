-- CEAC owner-approved human attendance observations. Separate from attendance correction,
-- HR employment and appraisal authority. NO changes to original work-session evidence.
-- Forward-only, isolated qualification required before production application.
CREATE TABLE public.compliance_attendance_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
 employee_id uuid NOT NULL REFERENCES public.employee_roster(id) ON DELETE RESTRICT,
 work_date date NOT NULL,
 category text NOT NULL CHECK (category IN ('missing_evidence','disputed_attendance','schedule_discrepancy','other')),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','referred','disputed','resolved')),
 opened_by uuid NOT NULL REFERENCES public.profiles(id),
 opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX compliance_attendance_cases_active_unique ON public.compliance_attendance_cases(org_id,employee_id,work_date,category) WHERE status<>'resolved';
CREATE INDEX compliance_attendance_cases_register_idx
 ON public.compliance_attendance_cases(org_id,work_date DESC,status,employee_id);
CREATE TABLE public.compliance_attendance_case_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
 case_id uuid NOT NULL REFERENCES public.compliance_attendance_cases(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 event_type text NOT NULL CHECK (event_type IN ('observation','referral','officer_note','manager_response','hr_response','employee_response','dispute','resolution')),
 factual_note text,
 interpretation_note text,
 explanation text,
 evidence_reference text,
 referral_target text CHECK (referral_target IS NULL OR referral_target IN ('manager','hr')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (length(coalesce(factual_note,''))<=4000 AND length(coalesce(interpretation_note,''))<=4000
  AND length(coalesce(explanation,''))<=4000 AND length(coalesce(evidence_reference,''))<=2000)
);
CREATE INDEX compliance_attendance_case_events_history_idx
 ON public.compliance_attendance_case_events(org_id,case_id,created_at,id);
ALTER TABLE public.compliance_attendance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_attendance_case_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compliance_attendance_cases,public.compliance_attendance_case_events FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.compliance_attendance_cases IS
 'Human-reviewed observational workflow; never an attendance correction, punishment, automatic KPI or payroll decision.';
COMMENT ON TABLE public.compliance_attendance_case_events IS
 'Append-only dated/attributable officer, manager, HR and employee explanations.';

-- Actor's own case, authorised HR, organisational Compliance or manager of
-- the canonical roster unit. The Compliance volunteer exclusion mirrors
-- attendance_day_evidence; a title or HR reporting line confers no privilege.
CREATE FUNCTION public.compliance_attendance_case_visible(p_employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $visibility$
 SELECT auth.uid() IS NOT NULL AND public.app_org_id() IS NOT NULL
  AND public.app_stage2_universal_aal_allowed()
  AND EXISTS (
   SELECT 1 FROM public.employee_roster er
   WHERE er.id=p_employee_id AND er.org_id=public.app_org_id()
     AND (
      er.profile_id=auth.uid() OR public.app_is_admin()
      OR public.app_has_capability('workforce.manage',NULL)
      OR EXISTS (
        SELECT 1 FROM public.employee_unit_memberships em
        WHERE em.employee_id=er.id AND em.org_id=er.org_id
          AND em.unit_id IN (SELECT public.app_managed_units())
      )
      OR (
       public.app_has_capability('compliance.manage',NULL)
       AND NOT (
        coalesce((SELECT e.employment_type FROM public.employment_records e
                  WHERE e.profile_id=er.profile_id AND e.org_id=er.org_id),er.employment_type)='volunteer'
        AND coalesce((SELECT e.working_pattern->>'kind' FROM public.employment_records e
                      WHERE e.profile_id=er.profile_id AND e.org_id=er.org_id),'not_recorded')
          IN ('no_attendance','not_recorded')
       )
      )
     )
  );
$visibility$;
REVOKE ALL ON FUNCTION public.compliance_attendance_case_visible(uuid) FROM PUBLIC,anon,authenticated;
-- This internal authority predicate is never a browser-callable RPC.

CREATE FUNCTION public.compliance_attendance_case_register(
 p_date_from date DEFAULT NULL,p_date_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $register$
DECLARE v_org uuid:=public.app_org_id(); v_count integer; v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.app_stage2_universal_aal_allowed()
 THEN RAISE EXCEPTION 'Account verification required.' USING errcode='42501'; END IF;
 IF p_date_from IS NOT NULL AND p_date_to IS NOT NULL AND p_date_from>p_date_to
 THEN RAISE EXCEPTION 'Invalid attendance date range.' USING errcode='22023'; END IF;
 SELECT count(*) INTO v_count FROM public.compliance_attendance_cases c
 WHERE c.org_id=v_org AND (p_date_from IS NULL OR c.work_date>=p_date_from)
 AND (p_date_to IS NULL OR c.work_date<=p_date_to)
 AND public.compliance_attendance_case_visible(c.employee_id);
 IF v_count>500 THEN
  RAISE EXCEPTION 'Attendance review exceeds verified query limit. Narrow the date range.' USING errcode='54000';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',c.id,'employee_id',c.employee_id,'employee_name',er.full_name,
   'profile_id',er.profile_id,'work_date',c.work_date,'category',c.category,
   'status',c.status,'opened_at',c.opened_at,'updated_at',c.updated_at,
   'events',coalesce((SELECT jsonb_agg(jsonb_build_object(
     'id',e.id,'event_type',e.event_type,'actor_id',e.actor_id,
     'created_at',e.created_at,'factual_note',e.factual_note,
     'interpretation_note',e.interpretation_note,'explanation',e.explanation,
     'evidence_reference',e.evidence_reference,'referral_target',e.referral_target
   ) ORDER BY e.created_at,e.id) FROM public.compliance_attendance_case_events e
   WHERE e.case_id=c.id AND e.org_id=v_org),'[]'::jsonb)
  ) ORDER BY c.work_date DESC,c.opened_at DESC,c.id),'[]'::jsonb)
 INTO v_result FROM public.compliance_attendance_cases c
 JOIN public.employee_roster er ON er.id=c.employee_id AND er.org_id=c.org_id
 WHERE c.org_id=v_org AND (p_date_from IS NULL OR c.work_date>=p_date_from)
 AND (p_date_to IS NULL OR c.work_date<=p_date_to)
 AND public.compliance_attendance_case_visible(c.employee_id);
 RETURN v_result;
END
$register$;
REVOKE ALL ON FUNCTION public.compliance_attendance_case_register(date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.compliance_attendance_case_register(date,date) TO authenticated;

CREATE FUNCTION public.compliance_record_attendance_observation(
 p_employee_id uuid,p_work_date date,p_category text,p_factual_note text,
 p_interpretation_note text,p_evidence_reference text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $observe$
DECLARE v_org uuid:=public.app_org_id(); v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.app_stage2_universal_aal_allowed()
  OR NOT public.app_has_capability('compliance.manage',NULL)
  OR NOT public.compliance_attendance_case_visible(p_employee_id)
 THEN RAISE EXCEPTION 'Not authorised to record attendance observations.' USING errcode='42501'; END IF;
 IF p_employee_id IS NULL OR p_work_date IS NULL OR p_category NOT IN
   ('missing_evidence','disputed_attendance','schedule_discrepancy','other')
  OR length(btrim(coalesce(p_factual_note,''))) NOT BETWEEN 8 AND 4000
  OR length(btrim(coalesce(p_interpretation_note,''))) NOT BETWEEN 8 AND 4000
  OR length(coalesce(p_evidence_reference,''))>2000
 THEN RAISE EXCEPTION 'Specify a date, category, observed facts and separate interpretation.' USING errcode='22023'; END IF;
 INSERT INTO public.compliance_attendance_cases(org_id,employee_id,work_date,category,opened_by)
 VALUES(v_org,p_employee_id,p_work_date,p_category,auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.compliance_attendance_case_events(org_id,case_id,actor_id,event_type,factual_note,interpretation_note,evidence_reference)
 VALUES(v_org,v_id,auth.uid(),'observation',btrim(p_factual_note),btrim(p_interpretation_note),nullif(btrim(coalesce(p_evidence_reference,'')),''));
 RETURN v_id;
END
$observe$;
REVOKE ALL ON FUNCTION public.compliance_record_attendance_observation(uuid,date,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.compliance_record_attendance_observation(uuid,date,text,text,text,text) TO authenticated;

CREATE FUNCTION public.compliance_attendance_case_action(
 p_case_id uuid,p_expected_status text,p_action text,p_explanation text,
 p_evidence_reference text DEFAULT NULL,p_referral_target text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $action$
DECLARE v_org uuid:=public.app_org_id(); v_case public.compliance_attendance_cases%ROWTYPE;
 v_employee_profile uuid; v_officer boolean; v_hr boolean; v_manager boolean; v_self boolean;
 v_next text; v_kind text; v_event uuid;
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.app_stage2_universal_aal_allowed()
 THEN RAISE EXCEPTION 'Account verification required.' USING errcode='42501'; END IF;
 SELECT * INTO v_case FROM public.compliance_attendance_cases
 WHERE id=p_case_id AND org_id=v_org FOR UPDATE;
 IF NOT FOUND OR NOT public.compliance_attendance_case_visible(v_case.employee_id)
 THEN RAISE EXCEPTION 'Case is unavailable within this account scope.' USING errcode='42501'; END IF;
 IF v_case.status IS DISTINCT FROM p_expected_status
 THEN RAISE EXCEPTION 'This case changed. Reload before recording another action.' USING errcode='40001'; END IF;
 IF v_case.status='resolved' THEN
  RAISE EXCEPTION 'Resolved case history is preserved. Open a new observation for subsequent facts.' USING errcode='22023'; END IF;
 IF length(btrim(coalesce(p_explanation,''))) NOT BETWEEN 8 AND 4000
  OR length(coalesce(p_evidence_reference,''))>2000 THEN
  RAISE EXCEPTION 'Provide a meaningful explanation and valid evidence reference.' USING errcode='22023';
 END IF;
 SELECT profile_id INTO v_employee_profile FROM public.employee_roster
 WHERE id=v_case.employee_id AND org_id=v_org;
 v_officer:=public.app_has_capability('compliance.manage',NULL);
 v_hr:=public.app_is_admin() OR public.app_has_capability('workforce.manage',NULL);
 v_manager:=EXISTS(SELECT 1 FROM public.employee_unit_memberships m
  WHERE m.org_id=v_org AND m.employee_id=v_case.employee_id
   AND m.unit_id IN(SELECT public.app_managed_units()));
 v_self:=v_employee_profile=auth.uid();
 IF p_action='refer' AND v_officer AND p_referral_target IN ('manager','hr') THEN
  IF p_referral_target='manager' AND NOT EXISTS (
    SELECT 1 FROM public.employee_unit_memberships em
    JOIN public.unit_memberships um ON um.org_id=em.org_id AND um.unit_id=em.unit_id AND um.role='manager'
    JOIN public.profiles p ON p.id=um.profile_id AND p.org_id=um.org_id AND p.active
    WHERE em.org_id=v_org AND em.employee_id=v_case.employee_id
  ) THEN RAISE EXCEPTION 'No verified active manager is assigned for referral.' USING errcode='22023'; END IF;
  v_next:='referred';v_kind:='referral';
 ELSIF p_action='dispute' AND (v_self OR v_manager OR v_hr) THEN
  v_next:='disputed';v_kind:='dispute';
 ELSIF p_action='respond' AND (v_self OR v_manager OR v_hr OR v_officer) THEN
  v_next:=v_case.status;
  v_kind:=CASE WHEN v_self THEN 'employee_response' WHEN v_hr THEN 'hr_response'
    WHEN v_manager THEN 'manager_response' ELSE 'officer_note' END;
 ELSIF p_action='resolve' AND (v_hr OR v_manager) AND v_case.status IN ('referred','disputed') THEN
  v_next:='resolved';v_kind:='resolution';
 ELSE
  RAISE EXCEPTION 'This action is not authorised for the current case state.' USING errcode='42501';
 END IF;
 INSERT INTO public.compliance_attendance_case_events(
  org_id,case_id,actor_id,event_type,explanation,evidence_reference,referral_target)
 VALUES(v_org,p_case_id,auth.uid(),v_kind,btrim(p_explanation),
   nullif(btrim(coalesce(p_evidence_reference,'')),''),
   CASE WHEN v_kind='referral' THEN p_referral_target ELSE NULL END)
 RETURNING id INTO v_event;
 UPDATE public.compliance_attendance_cases SET status=v_next,updated_at=clock_timestamp()
 WHERE id=p_case_id AND org_id=v_org;
 RETURN v_event;
END
$action$;
REVOKE ALL ON FUNCTION public.compliance_attendance_case_action(uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.compliance_attendance_case_action(uuid,text,text,text,text,text) TO authenticated;

-- Function-only writes are attributable and append only. No public SELECT,
-- INSERT, UPDATE or DELETE on case/evidence tables. No attendance, payroll,
-- schedule, KPI or protected-appraisal writes occur anywhere in these RPCs.
