-- 134 — Technical Support authority and safe-projection hardening.
-- Forward-only repair following independent review of migration 133.
-- Production remains unchanged until the complete release gate is approved.

-- Membership history is append-oriented. People Administration can add or end
-- a membership, but cannot rewrite identity, role, reason, association or time.
CREATE TABLE public.support_membership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id),
  membership_id uuid NOT NULL REFERENCES public.support_team_memberships(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL CHECK (action IN ('added','ended')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 8),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_membership_events_history
  ON public.support_membership_events(org_id,membership_id,occurred_at);
ALTER TABLE public.support_membership_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_membership_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.support_membership_events TO authenticated;
CREATE POLICY support_membership_events_read ON public.support_membership_events
  FOR SELECT TO authenticated
  USING (
    org_id=public.app_org_id()
    AND (
      profile_id=auth.uid()
      OR public.app_has_capability('people.manage',NULL)
    )
  );
CREATE TRIGGER support_membership_events_immutable
BEFORE UPDATE OR DELETE ON public.support_membership_events
FOR EACH ROW EXECUTE FUNCTION public.platform_audit_immutable();

CREATE OR REPLACE FUNCTION public.support_membership_scope_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public AS $$
DECLARE
  v_actor uuid:=auth.uid();
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Technical Support membership history cannot be deleted.' USING ERRCODE='42501';
  END IF;

  IF TG_OP='INSERT' THEN
    IF current_setting('role',true)='authenticated' THEN
      IF v_actor IS NULL OR NOT public.app_has_capability('people.manage',NULL) THEN
        RAISE EXCEPTION 'People Administration authority is required.' USING ERRCODE='42501';
      END IF;
      NEW.org_id:=public.app_org_id();
      NEW.added_by:=v_actor;
      NEW.active:=true;
      NEW.started_at:=now();
      NEW.ended_at:=NULL;
      NEW.ended_by:=NULL;
      NEW.created_at:=now();
    END IF;
  ELSE
    IF ROW(NEW.org_id,NEW.profile_id,NEW.role,NEW.started_at,NEW.added_by,
           NEW.reason,NEW.associated_unit_id,NEW.created_at)
       IS DISTINCT FROM
       ROW(OLD.org_id,OLD.profile_id,OLD.role,OLD.started_at,OLD.added_by,
           OLD.reason,OLD.associated_unit_id,OLD.created_at) THEN
      RAISE EXCEPTION 'Historical membership facts are immutable.' USING ERRCODE='42501';
    END IF;
    IF NOT OLD.active OR NEW.active
       OR NEW.ended_at IS NULL OR NEW.ended_by IS NULL THEN
      RAISE EXCEPTION 'A membership may only transition once from active to ended.' USING ERRCODE='42501';
    END IF;
    IF current_setting('role',true)='authenticated' THEN
      IF v_actor IS NULL OR NOT public.app_has_capability('people.manage',NULL) THEN
        RAISE EXCEPTION 'People Administration authority is required.' USING ERRCODE='42501';
      END IF;
      NEW.ended_by:=v_actor;
      NEW.ended_at:=now();
    END IF;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.profiles p
      WHERE p.id=NEW.profile_id AND p.org_id=NEW.org_id
        AND (NOT NEW.active OR p.active))
     OR NOT EXISTS(SELECT 1 FROM public.profiles p
      WHERE p.id=NEW.added_by AND p.org_id=NEW.org_id)
     OR (NEW.ended_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles p
      WHERE p.id=NEW.ended_by AND p.org_id=NEW.org_id))
     OR (NEW.associated_unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.units u
      WHERE u.id=NEW.associated_unit_id AND u.org_id=NEW.org_id))
  THEN RAISE EXCEPTION 'Support membership organisation does not match verified CEAC identity.' USING ERRCODE='42501'; END IF;

  NEW.updated_at:=now();
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.support_membership_scope_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER support_membership_scope_guard ON public.support_team_memberships;
CREATE TRIGGER support_membership_scope_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.support_team_memberships
FOR EACH ROW EXECUTE FUNCTION public.support_membership_scope_guard();

CREATE OR REPLACE FUNCTION public.support_membership_history_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.support_membership_events(
      org_id,membership_id,profile_id,actor_id,action,reason,occurred_at
    ) VALUES(NEW.org_id,NEW.id,NEW.profile_id,NEW.added_by,'added',NEW.reason,NEW.started_at);
  ELSIF OLD.active AND NOT NEW.active THEN
    INSERT INTO public.support_membership_events(
      org_id,membership_id,profile_id,actor_id,action,reason,occurred_at
    ) VALUES(NEW.org_id,NEW.id,NEW.profile_id,NEW.ended_by,'ended',NEW.reason,NEW.ended_at);

    -- Ending membership atomically closes support-only power while preserving
    -- every historical grant row and completed-case attribution.
    UPDATE public.capability_grants
    SET revoked_by=NEW.ended_by,
        revoked_at=NEW.ended_at,
        revoke_reason='Technical Support membership ended: '||NEW.reason
    WHERE org_id=NEW.org_id AND profile_id=NEW.profile_id
      AND capability LIKE 'support.%' AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.support_membership_history_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER support_membership_history_guard
AFTER INSERT OR UPDATE ON public.support_team_memberships
FOR EACH ROW EXECUTE FUNCTION public.support_membership_history_guard();

GRANT INSERT,UPDATE ON public.support_team_memberships TO authenticated;
CREATE POLICY support_team_people_read ON public.support_team_memberships
  FOR SELECT TO authenticated
  USING (org_id=public.app_org_id() AND public.app_has_capability('people.manage',NULL));
CREATE POLICY support_team_people_add ON public.support_team_memberships
  FOR INSERT TO authenticated
  WITH CHECK (org_id=public.app_org_id() AND public.app_has_capability('people.manage',NULL));
CREATE POLICY support_team_people_end ON public.support_team_memberships
  FOR UPDATE TO authenticated
  USING (org_id=public.app_org_id() AND active AND public.app_has_capability('people.manage',NULL))
  WITH CHECK (org_id=public.app_org_id() AND NOT active AND public.app_has_capability('people.manage',NULL));

-- Support capabilities are organisation scoped, require an active membership,
-- and can never be self-granted even by a Lead who separately holds authority.manage.
CREATE OR REPLACE FUNCTION public.support_capability_grant_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public AS $$
BEGIN
  IF NEW.capability LIKE 'support.%' AND NEW.revoked_at IS NULL THEN
    IF NEW.scope_unit_id IS NOT NULL THEN
      RAISE EXCEPTION 'Technical Support capabilities are organisation scoped.' USING ERRCODE='42501';
    END IF;
    IF NEW.profile_id=NEW.granted_by THEN
      RAISE EXCEPTION 'Technical Support capability cannot be self-granted.' USING ERRCODE='42501';
    END IF;
    IF NOT EXISTS(
      SELECT 1 FROM public.support_team_memberships m
      WHERE m.org_id=NEW.org_id AND m.profile_id=NEW.profile_id AND m.active
    ) THEN
      RAISE EXCEPTION 'Technical Support capability requires active team membership.' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.support_capability_grant_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER support_capability_grant_guard
BEFORE INSERT OR UPDATE ON public.capability_grants
FOR EACH ROW EXECUTE FUNCTION public.support_capability_grant_guard();

-- The base relation is support-only. Reporter and affected-person visibility is
-- available solely through an explicit safe-field projection.
DROP POLICY support_cases_visible ON public.support_cases;
CREATE POLICY support_cases_support_read ON public.support_cases
  FOR SELECT TO authenticated
  USING (
    org_id=public.app_org_id()
    AND public.app_has_capability('support.case.manage',NULL)
    AND EXISTS (
      SELECT 1 FROM public.support_team_memberships tm
      WHERE tm.org_id=support_cases.org_id AND tm.profile_id=auth.uid() AND tm.active
    )
  );

CREATE VIEW public.support_case_safe_status
WITH (security_barrier=true) AS
SELECT id,reference,category,summary,description,affected_service,state,
       opened_at,resolved_at,closed_at,resolution_summary
FROM public.support_cases sc
WHERE sc.org_id=public.app_org_id()
  AND (sc.reported_by=auth.uid() OR sc.affected_profile_id=auth.uid());
REVOKE ALL ON public.support_case_safe_status FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.support_case_safe_status TO authenticated;

-- Replace the case guard only to tighten reassignment: the target must hold
-- both active membership and an unexpired, unrevoked case-management grant.
CREATE OR REPLACE FUNCTION public.support_case_audit_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_lead boolean := false;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'An authenticated actor is required.' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.reported_by IS DISTINCT FROM v_actor OR NEW.org_id IS DISTINCT FROM public.app_org_id()
    THEN RAISE EXCEPTION 'Only your own support request can be filed.' USING ERRCODE='42501'; END IF;
    INSERT INTO public.support_case_events(org_id,case_id,actor_id,action,note)
      VALUES(NEW.org_id,NEW.id,v_actor,'opened',NULL);
    RETURN NEW;
  END IF;
  IF ROW(NEW.id,NEW.reference,NEW.org_id,NEW.reported_by,
       NEW.affected_profile_id,NEW.affected_unit_id,NEW.category,
       NEW.summary,NEW.description,NEW.affected_service,NEW.impact,NEW.opened_at)
     IS DISTINCT FROM
     ROW(OLD.id,OLD.reference,OLD.org_id,OLD.reported_by,
       OLD.affected_profile_id,OLD.affected_unit_id,OLD.category,
       OLD.summary,OLD.description,OLD.affected_service,OLD.impact,OLD.opened_at)
  THEN RAISE EXCEPTION 'Support-case source facts are immutable.' USING ERRCODE='42501'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.support_team_memberships m
    WHERE m.org_id=NEW.org_id AND m.profile_id=v_actor AND m.active AND m.role='lead')
    INTO v_is_lead;
  IF NOT v_is_lead THEN
    IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Only the current case holder or Support Lead can change this case.' USING ERRCODE='42501';
    END IF;
    IF OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'A support member can claim only for themselves.' USING ERRCODE='42501';
    END IF;
    IF OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Only a Support Lead can reassign a held case.' USING ERRCODE='42501';
    END IF;
    IF (NEW.state IS DISTINCT FROM OLD.state OR NEW.resolution_summary IS DISTINCT FROM OLD.resolution_summary)
       AND NEW.assigned_to IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Take the case before recording its outcome.' USING ERRCODE='42501';
    END IF;
  END IF;

  IF OLD.category='access_needed' AND NEW.state IN ('resolved','closed') THEN
    RAISE EXCEPTION 'Access requests require recorded business approval and a reviewed execution path.' USING ERRCODE='42501';
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL
     AND NOT EXISTS(
       SELECT 1 FROM public.support_team_memberships m
       JOIN public.capability_grants cg ON cg.org_id=m.org_id AND cg.profile_id=m.profile_id
       JOIN public.profiles p ON p.id=m.profile_id AND p.org_id=m.org_id AND p.active
       WHERE m.org_id=NEW.org_id AND m.profile_id=NEW.assigned_to AND m.active
         AND cg.capability='support.case.manage' AND cg.scope_unit_id IS NULL
         AND cg.revoked_at IS NULL AND (cg.expires_at IS NULL OR cg.expires_at>now())
     )
  THEN RAISE EXCEPTION 'Case assignment requires active Technical Support case authority.' USING ERRCODE='42501'; END IF;

  IF NEW.state IS DISTINCT FROM OLD.state THEN
    IF NEW.state='resolved' THEN NEW.resolved_at:=now(); NEW.closed_at:=NULL;
    ELSIF NEW.state='closed' THEN NEW.resolved_at:=coalesce(OLD.resolved_at,now()); NEW.closed_at:=now();
    ELSE NEW.resolved_at:=NULL; NEW.closed_at:=NULL; END IF;
    INSERT INTO public.support_case_events(org_id,case_id,actor_id,action,note)
      VALUES(NEW.org_id,NEW.id,v_actor,'state_changed',left(OLD.state||' -> '||NEW.state,200));
  ELSIF NEW.resolved_at IS DISTINCT FROM OLD.resolved_at OR NEW.closed_at IS DISTINCT FROM OLD.closed_at THEN
    RAISE EXCEPTION 'Closure times are server-controlled.' USING ERRCODE='42501';
  END IF;
  IF NEW.resolution_summary IS DISTINCT FROM OLD.resolution_summary THEN
    INSERT INTO public.support_case_events(org_id,case_id,actor_id,action,note)
      VALUES(NEW.org_id,NEW.id,v_actor,'resolution_updated',left(coalesce(NEW.resolution_summary,'Resolution note cleared'),2000));
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.support_case_events(org_id,case_id,actor_id,action,note)
      VALUES(NEW.org_id,NEW.id,v_actor,'assigned','Assignment changed');
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.support_case_audit_guard() FROM PUBLIC,anon,authenticated;

COMMENT ON VIEW public.support_case_safe_status IS
  'Reporter and affected-person support status projection; internal assignments and object identifiers are deliberately excluded.';
