-- Durable, permission-scoped Technical Support request notifications.
ALTER TABLE public.ceac_notification_events DROP CONSTRAINT ceac_notification_events_context_kind_check;
ALTER TABLE public.ceac_notification_events ADD CONSTRAINT ceac_notification_events_context_kind_check CHECK (context_kind IN ('compliance_case','memo','work_item','compliance_policy','compliance_evidence','compliance_exception','support_case'));
ALTER TABLE public.ceac_notification_events DROP CONSTRAINT ceac_notification_events_event_kind_check;
ALTER TABLE public.ceac_notification_events ADD CONSTRAINT ceac_notification_events_event_kind_check CHECK (event_kind IN ('case_opened','case_response','case_referred','case_resolved','memo_sent','memo_response','work_assigned','policy_published','evidence_submitted','evidence_reviewed','exception_requested','exception_decided','support_request_opened'));
CREATE OR REPLACE FUNCTION private.ceac_notification_context_visible(p_kind text, p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT auth.uid() IS NOT NULL AND public.app_org_id() IS NOT NULL
 AND public.app_stage2_universal_aal_allowed()
 AND CASE
 WHEN p_kind='compliance_case' THEN EXISTS (
  SELECT 1 FROM public.compliance_attendance_cases c WHERE c.id=p_id
  AND c.org_id=public.app_org_id() AND public.compliance_attendance_case_visible(c.employee_id))
 WHEN p_kind='support_case' THEN EXISTS (
  SELECT 1 FROM public.support_cases sc WHERE sc.id=p_id AND sc.org_id=public.app_org_id()
  AND public.app_has_capability('support.case.manage',NULL)
  AND EXISTS(SELECT 1 FROM public.support_team_memberships stm WHERE stm.org_id=sc.org_id
    AND stm.profile_id=auth.uid() AND stm.active)
 )
 WHEN p_kind='memo' THEN public.app_can_access_memo(p_id)
 WHEN p_kind='work_item' THEN EXISTS (
  SELECT 1 FROM public.work_items w WHERE w.id=p_id AND w.org_id=public.app_org_id()
  AND w.assignee_id=auth.uid() AND w.visibility<>'private')
 WHEN p_kind='compliance_evidence' THEN EXISTS (
  SELECT 1 FROM public.compliance_evidence_versions e
  WHERE e.id=p_id AND e.org_id=public.app_org_id()
  AND private.content_record_is_live('compliance_evidence_versions',to_jsonb(e.*))
  AND (e.profile_id=auth.uid() OR public.app_has_capability('compliance.manage',NULL)
   OR EXISTS(SELECT 1 FROM public.employment_records er
    WHERE er.org_id=e.org_id AND er.profile_id=e.profile_id
    AND er.unit_id IN (SELECT public.app_managed_units()))))
 WHEN p_kind='compliance_exception' THEN EXISTS (
  SELECT 1 FROM public.compliance_exception_versions e
  WHERE e.id=p_id AND e.org_id=public.app_org_id()
  AND private.content_record_is_live('compliance_exception_versions',to_jsonb(e.*))
  AND (e.profile_id=auth.uid() OR public.app_has_capability('compliance.manage',NULL)
   OR EXISTS(SELECT 1 FROM public.employment_records er
    WHERE er.org_id=e.org_id AND er.profile_id=e.profile_id
    AND er.unit_id IN (SELECT public.app_managed_units()))))
 WHEN p_kind='compliance_policy' THEN EXISTS (
  SELECT 1 FROM public.compliance_policy_versions p
  WHERE p.id=p_id AND p.org_id=public.app_org_id()
  AND private.content_record_is_live('compliance_policy_versions',to_jsonb(p.*))
  AND (public.app_has_capability('compliance.manage',NULL) OR EXISTS(
   SELECT 1 FROM public.compliance_policy_applicability a
   WHERE a.policy_version_id=p.id AND a.org_id=p.org_id
   AND (a.scope_kind='organisation'
    OR (a.scope_kind='person' AND a.profile_id=auth.uid())
    OR (a.scope_kind='unit' AND
      (a.unit_id IN(SELECT er.unit_id FROM public.employment_records er
        WHERE er.profile_id=auth.uid() AND er.org_id=p.org_id)
       OR a.unit_id IN(SELECT public.app_managed_units()) OR a.unit_id IN(SELECT public.app_my_units())))
    OR (a.scope_kind='employment_type' AND EXISTS(
      SELECT 1 FROM public.employment_records er WHERE er.profile_id=auth.uid()
      AND er.org_id=p.org_id AND er.employment_type=a.employment_type))
    OR (a.scope_kind='person' AND EXISTS(
      SELECT 1 FROM public.employment_records er
      WHERE er.profile_id=a.profile_id AND er.org_id=p.org_id
      AND er.unit_id IN(SELECT public.app_managed_units())))
   )))
  )
 ELSE false END;
$function$
;
CREATE OR REPLACE FUNCTION private.ceac_support_case_opened_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_recipient uuid;
BEGIN
  FOR v_recipient IN
    SELECT DISTINCT stm.profile_id FROM public.support_team_memberships stm
    JOIN public.profiles p ON p.id=stm.profile_id AND p.org_id=stm.org_id AND p.active
    WHERE stm.org_id=NEW.org_id AND stm.active
  LOOP
    PERFORM private.ceac_emit_notification(NEW.org_id,v_recipient,'support_case',NEW.id,'support_request_opened',NEW.id);
  END LOOP;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION private.ceac_support_case_opened_notification() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ceac_support_case_opened_notification ON public.support_cases;
CREATE TRIGGER ceac_support_case_opened_notification
AFTER INSERT ON public.support_cases FOR EACH ROW
EXECUTE FUNCTION private.ceac_support_case_opened_notification();
