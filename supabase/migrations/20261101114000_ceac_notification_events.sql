-- Private, role-scoped in-app notifications for Compliance, Memos and assignments.
-- Notification bodies are never copies of restricted case or Memo content.
CREATE TABLE public.ceac_notification_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id),
 recipient_id uuid NOT NULL REFERENCES public.profiles(id),
 context_kind text NOT NULL CHECK (context_kind IN ('compliance_case','memo','work_item')),
 context_id uuid NOT NULL,
 event_kind text NOT NULL CHECK (event_kind IN ('case_opened','case_response','case_referred','case_resolved','memo_sent','memo_response','work_assigned')),
 source_event_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 read_at timestamptz,
 UNIQUE(org_id,recipient_id,event_kind,source_event_id)
);
CREATE INDEX ceac_notifications_inbox ON public.ceac_notification_events(org_id,recipient_id,created_at DESC);
ALTER TABLE public.ceac_notification_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ceac_notification_events FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.ceac_notification_context_visible(p_kind text,p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE
 WHEN p_kind='compliance_case' THEN EXISTS (
  SELECT 1 FROM public.compliance_attendance_cases c WHERE c.id=p_id
  AND c.org_id=public.app_org_id() AND public.compliance_attendance_case_visible(c.employee_id))
 WHEN p_kind='memo' THEN public.app_can_access_memo(p_id)
 WHEN p_kind='work_item' THEN EXISTS (
  SELECT 1 FROM public.work_items w WHERE w.id=p_id AND w.org_id=public.app_org_id()
  AND w.assignee_id=auth.uid() AND w.visibility<>'private')
 ELSE false END
$$;
REVOKE ALL ON FUNCTION private.ceac_notification_context_visible(text,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.my_ceac_notifications()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.app_org_id() IS NULL OR NOT public.app_stage2_universal_aal_allowed()
 OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.org_id=public.app_org_id() AND p.active)
 THEN RAISE EXCEPTION 'Account verification required.' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.event_kind,
 'context_kind',n.context_kind,'context_id',n.context_id,'created_at',n.created_at,
 'read_at',n.read_at) ORDER BY n.created_at DESC,n.id DESC),'[]'::jsonb)
 INTO v FROM (
  SELECT id,context_kind,context_id,event_kind,created_at,read_at
  FROM public.ceac_notification_events n
  WHERE n.org_id=public.app_org_id() AND n.recipient_id=auth.uid()
  AND private.ceac_notification_context_visible(n.context_kind,n.context_id)
  ORDER BY n.created_at DESC,n.id DESC LIMIT 60
 ) n;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.my_ceac_notifications() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_ceac_notifications() TO authenticated;

CREATE FUNCTION public.mark_ceac_notification_read(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.app_stage2_universal_aal_allowed()
 THEN RAISE EXCEPTION 'Account verification required.' USING ERRCODE='42501'; END IF;
 UPDATE public.ceac_notification_events n SET read_at=COALESCE(read_at,clock_timestamp())
 WHERE n.id=p_id AND n.org_id=public.app_org_id() AND n.recipient_id=auth.uid()
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.org_id=n.org_id AND p.active)
 AND private.ceac_notification_context_visible(n.context_kind,n.context_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'This update is no longer available to your account.' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mark_ceac_notification_read(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_ceac_notification_read(uuid) TO authenticated;

CREATE FUNCTION private.ceac_emit_notification(p_org uuid,p_to uuid,p_kind text,p_context uuid,p_event text,p_source uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_to IS NULL OR p_org IS NULL OR p_source IS NULL OR p_context IS NULL THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_to AND p.org_id=p_org AND p.active) THEN RETURN; END IF;
 INSERT INTO public.ceac_notification_events(org_id,recipient_id,context_kind,context_id,event_kind,source_event_id)
 VALUES(p_org,p_to,p_kind,p_context,p_event,p_source)
 ON CONFLICT(org_id,recipient_id,event_kind,source_event_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION private.ceac_emit_notification(uuid,uuid,text,uuid,text,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.ceac_case_opened_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_person uuid;
BEGIN
 SELECT profile_id INTO v_person FROM public.employee_roster WHERE id=NEW.employee_id AND org_id=NEW.org_id;
 IF v_person IS DISTINCT FROM NEW.opened_by THEN
  PERFORM private.ceac_emit_notification(NEW.org_id,v_person,'compliance_case',NEW.id,'case_opened',NEW.id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.ceac_case_opened_notification() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ceac_case_opened_notification AFTER INSERT ON public.compliance_attendance_cases
FOR EACH ROW EXECUTE FUNCTION private.ceac_case_opened_notification();

CREATE FUNCTION private.ceac_case_event_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_case public.compliance_attendance_cases; v_person uuid; v_recipient uuid;
BEGIN
 SELECT * INTO v_case FROM public.compliance_attendance_cases WHERE id=NEW.case_id AND org_id=NEW.org_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT profile_id INTO v_person FROM public.employee_roster WHERE id=v_case.employee_id AND org_id=NEW.org_id;
 IF NEW.event_type IN ('employee_response','manager_response','hr_response','dispute')
 AND v_case.opened_by IS DISTINCT FROM NEW.actor_id THEN
  PERFORM private.ceac_emit_notification(NEW.org_id,v_case.opened_by,'compliance_case',NEW.case_id,'case_response',NEW.id);
 END IF;
 IF NEW.event_type='resolution' AND v_person IS DISTINCT FROM NEW.actor_id THEN
  PERFORM private.ceac_emit_notification(NEW.org_id,v_person,'compliance_case',NEW.case_id,'case_resolved',NEW.id);
 END IF;
 IF NEW.event_type='referral' AND NEW.referral_target='hr' THEN
  FOR v_recipient IN
   SELECT DISTINCT p.id FROM public.profiles p
   LEFT JOIN public.capability_grants g ON g.org_id=p.org_id AND g.profile_id=p.id
    AND g.capability='workforce.manage' AND g.scope_unit_id IS NULL
    AND (g.expires_at IS NULL OR g.expires_at>now())
   WHERE p.org_id=NEW.org_id AND p.active AND (p.is_admin OR g.id IS NOT NULL)
  LOOP
   IF v_recipient IS DISTINCT FROM NEW.actor_id THEN
    PERFORM private.ceac_emit_notification(NEW.org_id,v_recipient,'compliance_case',NEW.case_id,'case_referred',NEW.id);
   END IF;
  END LOOP;
 ELSIF NEW.event_type='referral' AND NEW.referral_target='manager' THEN
  FOR v_recipient IN
   SELECT DISTINCT um.profile_id FROM public.employee_unit_memberships em
   JOIN public.unit_memberships um ON um.org_id=em.org_id AND um.unit_id=em.unit_id AND um.role='manager'
   JOIN public.profiles p ON p.id=um.profile_id AND p.org_id=um.org_id AND p.active
   WHERE em.employee_id=v_case.employee_id AND em.org_id=NEW.org_id
  LOOP
   IF v_recipient IS DISTINCT FROM NEW.actor_id THEN
    PERFORM private.ceac_emit_notification(NEW.org_id,v_recipient,'compliance_case',NEW.case_id,'case_referred',NEW.id);
   END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.ceac_case_event_notification() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ceac_case_event_notification AFTER INSERT ON public.compliance_attendance_case_events
FOR EACH ROW EXECUTE FUNCTION private.ceac_case_event_notification();

CREATE FUNCTION private.ceac_memo_sent_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_to uuid;
BEGIN
 IF NEW.status IN ('sent','pending_decision') AND OLD.status IS DISTINCT FROM NEW.status THEN
  FOR v_to IN SELECT profile_id FROM public.memo_recipients WHERE memo_id=NEW.id
  LOOP
   IF v_to IS DISTINCT FROM NEW.sender_id THEN
    PERFORM private.ceac_emit_notification(NEW.org_id,v_to,'memo',NEW.id,'memo_sent',NEW.current_version_id);
   END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.ceac_memo_sent_notification() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ceac_memo_sent_notification AFTER UPDATE OF status ON public.memos
FOR EACH ROW EXECUTE FUNCTION private.ceac_memo_sent_notification();

CREATE FUNCTION private.ceac_memo_response_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_memo public.memos;
BEGIN
 SELECT * INTO v_memo FROM public.memos WHERE id=NEW.memo_id;
 IF FOUND AND v_memo.sender_id IS DISTINCT FROM NEW.author_id THEN
  PERFORM private.ceac_emit_notification(v_memo.org_id,v_memo.sender_id,'memo',v_memo.id,'memo_response',NEW.id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.ceac_memo_response_notification() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ceac_memo_response_notification AFTER INSERT ON public.memo_exchanges
FOR EACH ROW EXECUTE FUNCTION private.ceac_memo_response_notification();

CREATE FUNCTION private.ceac_assigned_work_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.assignee_id IS NOT NULL AND NEW.visibility<>'private'
 AND NEW.origin IN ('assigned','assigned_by_exec') THEN
  PERFORM private.ceac_emit_notification(NEW.org_id,NEW.assignee_id,'work_item',NEW.id,'work_assigned',NEW.id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.ceac_assigned_work_notification() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ceac_assigned_work_notification AFTER INSERT ON public.work_items
FOR EACH ROW EXECUTE FUNCTION private.ceac_assigned_work_notification();
