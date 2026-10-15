-- 135 — approved Technical Support access-assistance decision/execution ledger.
-- Reviewed contract: docs/security/CEAC_TECHNICAL_SUPPORT_BACKEND_CONTRACT_2026-10-07.md
-- Layered on completed, independently tested migrations 133 and 134.
-- This ledger permits only bounded assistance, not the creation of CEAC
-- accounts, capability grants, role changes or business entitlements.
-- Those mutations remain exclusively in their established business-authority
-- APIs, with separate approval, audit and MFA controls.
-- Does not affect ordinary incident cases or re-grant business authority.
-- Production remains unchanged until actual isolated SQL acceptance.

CREATE TABLE public.support_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id),
  case_id uuid NOT NULL UNIQUE REFERENCES public.support_cases(id),
  requested_action text NOT NULL CHECK (requested_action IN (
    'unit_access_assistance','invitation_delivery_assistance','account_recovery_assistance'
  )),
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  target_unit_id uuid REFERENCES public.units(id),
  access_object text NOT NULL CHECK (char_length(btrim(access_object)) BETWEEN 6 AND 120),
  requested_by uuid NOT NULL REFERENCES public.profiles(id),
  required_approver text NOT NULL CHECK (required_approver IN ('unit_manager','people_administration')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','declined','executed')),
  decision_reason text CHECK (decision_reason IS NULL OR char_length(btrim(decision_reason)) BETWEEN 10 AND 1000),
  approved_by uuid REFERENCES public.profiles(id),
  decided_at timestamptz,
  executed_by uuid REFERENCES public.profiles(id),
  executed_at timestamptz,
  execution_result text CHECK (execution_result IS NULL OR char_length(btrim(execution_result)) BETWEEN 10 AND 1000),
  execution_reference text CHECK (execution_reference IS NULL OR char_length(btrim(execution_reference)) BETWEEN 8 AND 180),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_access_decision_consistency CHECK (
    (state='pending' AND approved_by IS NULL AND decided_at IS NULL
      AND executed_by IS NULL AND executed_at IS NULL)
    OR (state='declined' AND approved_by IS NOT NULL AND decided_at IS NOT NULL
      AND executed_by IS NULL AND executed_at IS NULL)
    OR (state='approved' AND approved_by IS NOT NULL AND decided_at IS NOT NULL
      AND executed_by IS NULL AND executed_at IS NULL)
    OR (state='executed' AND approved_by IS NOT NULL AND decided_at IS NOT NULL
      AND executed_by IS NOT NULL AND executed_at IS NOT NULL
      AND approved_by<>executed_by)
  )
);
CREATE INDEX support_access_org_state ON public.support_access_requests(org_id,state,created_at DESC);
ALTER TABLE public.support_access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_access_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.support_access_requests TO authenticated;

CREATE TABLE public.support_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id),
  request_id uuid NOT NULL REFERENCES public.support_access_requests(id),
  case_id uuid NOT NULL REFERENCES public.support_cases(id),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL CHECK (action IN ('requested','approved','declined','executed')),
  note text NOT NULL CHECK (char_length(btrim(note)) BETWEEN 8 AND 1000),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_access_history ON public.support_access_events(org_id,request_id,occurred_at DESC);
ALTER TABLE public.support_access_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_access_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.support_access_events TO authenticated;
CREATE TRIGGER support_access_events_immutable
  BEFORE UPDATE OR DELETE ON public.support_access_events
  FOR EACH ROW EXECUTE FUNCTION public.platform_audit_immutable();

-- Only current Support case operators see the full action ledger; unit
-- managers see unit-scoped requests they can legitimately approve, and
-- People Administration sees its business approval queue.
CREATE POLICY support_access_read ON public.support_access_requests
 FOR SELECT TO authenticated USING (
   org_id=public.app_org_id() AND (
     (public.app_has_capability('support.case.manage',NULL)
       AND EXISTS(SELECT 1 FROM public.support_team_memberships tm
         WHERE tm.org_id=support_access_requests.org_id
           AND tm.profile_id=auth.uid() AND tm.active))
     OR (required_approver='unit_manager'
       AND target_unit_id IN (SELECT public.app_managed_units()))
     OR (required_approver='people_administration'
       AND public.app_has_capability('people.manage',NULL))
   )
 );
CREATE POLICY support_access_create ON public.support_access_requests
 FOR INSERT TO authenticated WITH CHECK (
   org_id=public.app_org_id()
   AND requested_by=auth.uid()
   AND public.app_has_capability('support.case.manage',NULL)
   AND EXISTS(SELECT 1 FROM public.support_team_memberships tm
     WHERE tm.org_id=support_access_requests.org_id
       AND tm.profile_id=auth.uid() AND tm.active)
 );
CREATE POLICY support_access_transition ON public.support_access_requests
 FOR UPDATE TO authenticated USING (
   org_id=public.app_org_id() AND (
     (required_approver='unit_manager'
       AND target_unit_id IN (SELECT public.app_managed_units()))
     OR (required_approver='people_administration'
       AND public.app_has_capability('people.manage',NULL))
     OR (public.app_has_capability('support.access.apply_approved',NULL)
       AND EXISTS(SELECT 1 FROM public.support_team_memberships tm
         WHERE tm.org_id=support_access_requests.org_id
           AND tm.profile_id=auth.uid() AND tm.active))
   )
 ) WITH CHECK (org_id=public.app_org_id());
CREATE POLICY support_access_history_read ON public.support_access_events
 FOR SELECT TO authenticated USING (
   org_id=public.app_org_id() AND EXISTS (
     SELECT 1 FROM public.support_access_requests ar
       WHERE ar.id=support_access_events.request_id
         AND ar.org_id=support_access_events.org_id
   )
 );

-- The narrow state machine is a single row-locked UPDATE. The client must
-- send the prior version unmodified; this trigger increments it on success.
-- A stale .eq(version) update returns no rows. No actor fields or timestamps
-- are accepted from the browser.
CREATE OR REPLACE FUNCTION public.support_access_request_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' AS $support_guard$
DECLARE
  actor uuid:=auth.uid();
  org uuid:=public.app_org_id();
  c public.support_cases;
  valid_support boolean;
  valid_apply boolean;
  support_actor boolean;
BEGIN
  IF actor IS NULL OR org IS NULL OR NOT public.app_identity_confirmed()
     OR NEW.org_id IS DISTINCT FROM org THEN
    RAISE EXCEPTION 'Verified CEAC identity is required for access assistance.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO c FROM public.support_cases WHERE id=NEW.case_id FOR UPDATE;
  IF NOT FOUND OR c.org_id IS DISTINCT FROM org OR c.category<>'access_needed' THEN
    RAISE EXCEPTION 'Only a current access-help case may have an access-assistance request.' USING ERRCODE='42501';
  END IF;
  IF c.state IN ('resolved','closed') THEN
    RAISE EXCEPTION 'Completed support cases cannot be used for new access actions.' USING ERRCODE='42501';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.support_team_memberships tm
    WHERE tm.profile_id=actor AND tm.org_id=org AND tm.active)
    INTO support_actor;
  valid_support:=support_actor AND public.app_has_capability('support.case.manage',NULL);
  valid_apply:=support_actor AND public.app_has_capability('support.access.apply_approved',NULL);

  IF TG_OP='INSERT' THEN
    IF NOT valid_support OR c.assigned_to IS DISTINCT FROM actor
       OR c.state NOT IN ('open','in_progress','waiting_approval') THEN
      RAISE EXCEPTION 'The assigned Support operator must prepare the request.' USING ERRCODE='42501';
    END IF;
    IF NEW.target_profile_id IS DISTINCT FROM coalesce(c.affected_profile_id,c.reported_by)
      OR NOT EXISTS (SELECT 1 FROM public.profiles p
          WHERE p.id=NEW.target_profile_id AND p.org_id=org)
      OR (NEW.target_unit_id IS NOT NULL AND NOT EXISTS(
          SELECT 1 FROM public.units u WHERE u.id=NEW.target_unit_id AND u.org_id=org))
    THEN
      RAISE EXCEPTION 'Access assistance target must match the case and organisation.' USING ERRCODE='42501';
    END IF;
    IF NEW.requested_action='unit_access_assistance' THEN
      IF NEW.target_unit_id IS NULL OR NEW.required_approver<>'unit_manager' THEN
        RAISE EXCEPTION 'Unit assistance requires its actual Unit Manager.' USING ERRCODE='42501';
      END IF;
    ELSIF NEW.target_unit_id IS NOT NULL OR NEW.required_approver<>'people_administration' THEN
      RAISE EXCEPTION 'Account/invitation assistance requires People Administration.' USING ERRCODE='42501';
    END IF;
    -- The business approver sees only reviewed, fixed safe object labels.
    -- Arbitrary case text, credentials and protected records cannot be
    -- laundered through this broader-visibility approval ledger.
    NEW.access_object:=CASE NEW.requested_action
      WHEN 'unit_access_assistance' THEN 'Unit workspace access troubleshooting'
      WHEN 'invitation_delivery_assistance' THEN 'Invitation delivery troubleshooting'
      ELSE 'Account access recovery assistance' END;
    NEW.requested_by:=actor;
    NEW.state:='pending';
    NEW.approved_by:=NULL;
    NEW.decided_at:=NULL;
    NEW.decision_reason:=NULL;
    NEW.executed_by:=NULL;
    NEW.executed_at:=NULL;
    NEW.execution_result:=NULL;
    NEW.execution_reference:=NULL;
    NEW.version:=1;
    NEW.created_at:=now();
  ELSE
    IF ROW(NEW.id,NEW.org_id,NEW.case_id,NEW.requested_action,
           NEW.target_profile_id,NEW.target_unit_id,NEW.access_object,
           NEW.requested_by,NEW.required_approver,NEW.created_at,
           NEW.approved_by,NEW.decided_at,NEW.executed_by,NEW.executed_at)
       IS DISTINCT FROM
       ROW(OLD.id,OLD.org_id,OLD.case_id,OLD.requested_action,
           OLD.target_profile_id,OLD.target_unit_id,OLD.access_object,
           OLD.requested_by,OLD.required_approver,OLD.created_at,
           OLD.approved_by,OLD.decided_at,OLD.executed_by,OLD.executed_at)
       OR NEW.version IS DISTINCT FROM OLD.version THEN
       RAISE EXCEPTION 'Access request identity, decision provenance and revision are immutable.' USING ERRCODE='42501';
    END IF;
    IF OLD.state='pending' AND NEW.state IN ('approved','declined') THEN
      IF support_actor OR actor=OLD.requested_by OR actor=c.assigned_to THEN
        RAISE EXCEPTION 'Support cannot business-approve its own access request.' USING ERRCODE='42501';
      END IF;
      IF NOT (
        (OLD.required_approver='unit_manager'
          AND OLD.target_unit_id IN (SELECT public.app_managed_units()))
        OR (OLD.required_approver='people_administration'
          AND public.app_has_capability('people.manage',NULL))
      ) THEN
        RAISE EXCEPTION 'Only the designated business approver may decide.' USING ERRCODE='42501';
      END IF;
      IF char_length(btrim(coalesce(NEW.decision_reason,'')))<10
         OR NEW.execution_result IS NOT NULL OR NEW.execution_reference IS NOT NULL THEN
        RAISE EXCEPTION 'A business decision needs a substantive reason, not a technical result.' USING ERRCODE='42501';
      END IF;
      NEW.approved_by:=actor;
      NEW.decided_at:=now();
    ELSIF OLD.state='approved' AND NEW.state='executed' THEN
      IF NOT valid_apply OR c.assigned_to IS DISTINCT FROM actor
         OR actor=OLD.approved_by
         OR char_length(btrim(coalesce(NEW.execution_result,'')))<10
         OR char_length(btrim(coalesce(NEW.execution_reference,'')))<8
         OR NEW.decision_reason IS DISTINCT FROM OLD.decision_reason THEN
        RAISE EXCEPTION 'Approved access assistance requires independent authorised execution evidence.' USING ERRCODE='42501';
      END IF;
      NEW.executed_by:=actor;
      NEW.executed_at:=now();
    ELSE
      RAISE EXCEPTION 'Duplicate, stale or unauthorised access transition.' USING ERRCODE='42501';
    END IF;
    NEW.version:=OLD.version+1;
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END
$support_guard$;
REVOKE ALL ON FUNCTION public.support_access_request_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER support_access_request_guard
BEFORE INSERT OR UPDATE ON public.support_access_requests
FOR EACH ROW EXECUTE FUNCTION public.support_access_request_guard();

CREATE OR REPLACE FUNCTION public.support_access_history_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' AS $support_history$
DECLARE actor uuid;
BEGIN
  actor:=CASE WHEN TG_OP='INSERT' THEN NEW.requested_by
    WHEN NEW.state='executed' THEN NEW.executed_by ELSE NEW.approved_by END;
  INSERT INTO public.support_access_events(
    org_id,request_id,case_id,actor_id,action,note)
  VALUES(NEW.org_id,NEW.id,NEW.case_id,actor,
    CASE WHEN TG_OP='INSERT' THEN 'requested' ELSE NEW.state END,
    CASE WHEN TG_OP='INSERT' THEN 'Assistance requested: '||NEW.requested_action
      WHEN NEW.state='executed' THEN left(NEW.execution_result||' ['||NEW.execution_reference||']',1000)
      ELSE NEW.decision_reason END);
  RETURN NEW;
END
$support_history$;
REVOKE ALL ON FUNCTION public.support_access_history_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER support_access_history_guard
AFTER INSERT OR UPDATE ON public.support_access_requests
FOR EACH ROW EXECUTE FUNCTION public.support_access_history_guard();

-- Normal incidents retain the existing full audited case lifecycle. Access
-- requests now close ONLY after an independent business decision AND
-- completed, attributable technical assistance evidence.
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

  IF OLD.category='access_needed' AND NEW.state IN ('resolved','closed')
     AND NOT EXISTS (
       SELECT 1 FROM public.support_access_requests ar
       WHERE ar.case_id=OLD.id AND ar.org_id=OLD.org_id
         AND ar.state='executed'
         AND ar.approved_by IS NOT NULL AND ar.decided_at IS NOT NULL
         AND ar.executed_by IS NOT NULL AND ar.executed_at IS NOT NULL
         AND ar.approved_by IS DISTINCT FROM ar.requested_by
         AND ar.approved_by IS DISTINCT FROM ar.executed_by
         AND char_length(btrim(coalesce(ar.execution_reference,''))) >= 8
     )
  THEN
    RAISE EXCEPTION 'Access requests need independent business approval and attributable technical execution evidence before closure.' USING ERRCODE='42501';
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

COMMENT ON TABLE public.support_access_requests IS
  'Bounded access assistance only. Execution evidence is not a capability grant, invitation delivery proof or authority to change account roles.';
COMMENT ON TABLE public.support_access_events IS
  'Append-only attributable Support access decisions and technical assistance history, visible only through approved request RLS.';
