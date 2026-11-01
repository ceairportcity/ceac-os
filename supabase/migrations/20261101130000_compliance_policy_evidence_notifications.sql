-- Extend CEAC private notifications to evidence, exceptions and applicable policy versions.
-- Never copy confidential case, evidence or policy text into notification rows.
ALTER TABLE public.ceac_notification_events DROP CONSTRAINT ceac_notification_events_context_kind_check;
ALTER TABLE public.ceac_notification_events ADD CONSTRAINT ceac_notification_events_context_kind_check CHECK
 (context_kind IN ('compliance_case','memo','work_item','compliance_policy','compliance_evidence','compliance_exception'));
ALTER TABLE public.ceac_notification_events DROP CONSTRAINT ceac_notification_events_event_kind_check;
ALTER TABLE public.ceac_notification_events ADD CONSTRAINT ceac_notification_events_event_kind_check CHECK
 (event_kind IN ('case_opened','case_response','case_referred','case_resolved',
                 'memo_sent','memo_response','work_assigned',
                 'policy_published','evidence_submitted','evidence_reviewed',
                 'exception_requested','exception_decided'));

CREATE OR REPLACE FUNCTION private.ceac_notification_context_visible(p_kind text,p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT auth.uid() IS NOT NULL AND public.app_org_id() IS NOT NULL
 AND public.app_stage2_universal_aal_allowed()
 AND CASE
 WHEN p_kind='compliance_case' THEN EXISTS (
  SELECT 1 FROM public.compliance_attendance_cases c WHERE c.id=p_id
  AND c.org_id=public.app_org_id() AND public.compliance_attendance_case_visible(c.employee_id))
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
       OR a.unit_id IN(SELECT public.app_managed_units())))
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
$body$;
REVOKE ALL ON FUNCTION private.ceac_notification_context_visible(text,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.ceac_notify_reviewers(p_org uuid,p_context text,p_context_id uuid,p_event_kind text,p_event_id uuid,p_author uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE v_reviewer uuid;
BEGIN
 FOR v_reviewer IN SELECT DISTINCT p.id
  FROM public.profiles p JOIN public.capability_grants g
   ON g.org_id=p.org_id AND g.profile_id=p.id
  WHERE p.org_id=p_org AND p.active AND g.capability='compliance.manage'
    AND g.scope_unit_id IS NULL AND (g.expires_at IS NULL OR g.expires_at>clock_timestamp())
 LOOP
  IF v_reviewer IS DISTINCT FROM p_author THEN
   PERFORM private.ceac_emit_notification(p_org,v_reviewer,p_context,p_context_id,p_event_kind,p_event_id);
  END IF;
 END LOOP;
END $body$;
REVOKE ALL ON FUNCTION private.ceac_notify_reviewers(uuid,text,uuid,text,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.ceac_notify_evidence_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
 IF NEW.state='submitted' THEN
  PERFORM private.ceac_notify_reviewers(NEW.org_id,'compliance_evidence',NEW.id,'evidence_submitted',NEW.id,NEW.created_by);
 ELSIF NEW.state IN('verified','rejected','declined') AND NEW.profile_id IS DISTINCT FROM NEW.created_by THEN
  PERFORM private.ceac_emit_notification(NEW.org_id,NEW.profile_id,'compliance_evidence',NEW.id,'evidence_reviewed',NEW.id);
 END IF;
 RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION private.ceac_notify_evidence_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ceac_notify_evidence_change AFTER INSERT ON public.compliance_evidence_versions
FOR EACH ROW EXECUTE FUNCTION private.ceac_notify_evidence_change();

CREATE FUNCTION private.ceac_notify_exception_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
 IF NEW.state='requested' THEN
  PERFORM private.ceac_notify_reviewers(NEW.org_id,'compliance_exception',NEW.id,'exception_requested',NEW.id,NEW.actor_id);
 ELSIF NEW.state IN('approved','declined','rejected','resolved') AND NEW.profile_id IS DISTINCT FROM NEW.actor_id THEN
  PERFORM private.ceac_emit_notification(NEW.org_id,NEW.profile_id,'compliance_exception',NEW.id,'exception_decided',NEW.id);
 END IF;
 RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION private.ceac_notify_exception_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ceac_notify_exception_change AFTER INSERT ON public.compliance_exception_versions
FOR EACH ROW EXECUTE FUNCTION private.ceac_notify_exception_change();

-- Applicability rows are inserted after their policy version. A single version ID
-- is used for the event source, so overlapping audiences receive only one alert.
CREATE FUNCTION private.ceac_notify_policy_applicability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE v_policy public.compliance_policy_versions; v_person uuid;
BEGIN
 SELECT * INTO v_policy FROM public.compliance_policy_versions
 WHERE id=NEW.policy_version_id AND org_id=NEW.org_id;
 IF NOT FOUND OR v_policy.state<>'active' THEN RETURN NEW; END IF;
 FOR v_person IN SELECT DISTINCT p.id FROM public.profiles p
  WHERE p.org_id=NEW.org_id AND p.active
   AND (
    NEW.scope_kind='organisation'
    OR (NEW.scope_kind='person' AND NEW.profile_id=p.id)
    OR (NEW.scope_kind='unit' AND EXISTS(
      SELECT 1 FROM public.employment_records e
      WHERE e.org_id=NEW.org_id AND e.profile_id=p.id AND e.unit_id=NEW.unit_id))
    OR (NEW.scope_kind='employment_type' AND EXISTS(
      SELECT 1 FROM public.employment_records e
      WHERE e.org_id=NEW.org_id AND e.profile_id=p.id AND e.employment_type=NEW.employment_type))
   )
 LOOP
  IF v_person IS DISTINCT FROM v_policy.created_by THEN
   PERFORM private.ceac_emit_notification(NEW.org_id,v_person,'compliance_policy',
     NEW.policy_version_id,'policy_published',NEW.policy_version_id);
  END IF;
 END LOOP;
 RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION private.ceac_notify_policy_applicability() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ceac_notify_policy_applicability AFTER INSERT ON public.compliance_policy_applicability
FOR EACH ROW EXECUTE FUNCTION private.ceac_notify_policy_applicability();
