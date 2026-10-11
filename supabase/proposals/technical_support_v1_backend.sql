-- CEAC Technical Support v1 — SCHEMA PROPOSAL ONLY, NOT A CANONICAL MIGRATION.
-- DO NOT apply to production. Generate a canonical migration via Supabase CLI
-- AFTER Security S3 PR #14 is integrated, exact 129+ migration ancestry
-- is reconciled, encrypted backup is restored, and independent SQL gates pass.
-- Source: docs/security/CEAC_TECHNICAL_SUPPORT_BACKEND_CONTRACT_2026-10-07.md
-- Review scope: basic self-help, bounded support queue, immutable status history.
-- Deliberately excludes access execution, external service health claims,
-- confidential HR/payroll reads and file evidence until separate gated review.

INSERT INTO public.capability_definitions(capability,label,description,sensitive)
VALUES
('support.case.manage','Technical Support cases','Manage approved organisation technical support cases only.',true),
('support.access.apply_approved','Execute approved technical access','Apply only pre-approved technical access actions through a future narrow reviewed path.',true),
('support.system.inspect','Technical service inspection','Inspect approved support-safe diagnostics only.',true),
('support.recovery.verify','Recovery evidence','Verify recovery evidence; cannot restore production.',true),
('support.integration.operate','Approved technical integrations','Operate only reviewed support-safe integrations.',true),
('support.guides.manage','Technical guides','Maintain approved technical support guides.',true)
ON CONFLICT(capability) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.support_team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  role text NOT NULL CHECK (role IN ('lead','member')),
  active boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  added_by uuid NOT NULL REFERENCES public.profiles(id),
  ended_by uuid REFERENCES public.profiles(id),
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 8),
  associated_unit_id uuid REFERENCES public.units(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_membership_active_end_consistency CHECK (
    (active AND ended_at IS NULL AND ended_by IS NULL)
    OR (NOT active AND ended_at IS NOT NULL AND ended_by IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS support_team_one_active_membership
  ON public.support_team_memberships(profile_id) WHERE active;
CREATE INDEX IF NOT EXISTS support_team_org_membership
  ON public.support_team_memberships(org_id,profile_id,active);
-- Enforce organisational scope independently of browser privileges; never
-- treat the Media & Technical association as a unit-membership grant.
CREATE OR REPLACE FUNCTION public.support_membership_scope_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public AS $
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles p
      WHERE p.id=NEW.profile_id AND p.org_id=NEW.org_id AND p.active)
     OR NOT EXISTS(SELECT 1 FROM public.profiles p
      WHERE p.id=NEW.added_by AND p.org_id=NEW.org_id)
     OR (NEW.ended_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles p
      WHERE p.id=NEW.ended_by AND p.org_id=NEW.org_id))
     OR (NEW.associated_unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.units u
      WHERE u.id=NEW.associated_unit_id AND u.org_id=NEW.org_id))
  THEN RAISE EXCEPTION 'Support membership organisation does not match verified CEAC identity.' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND (NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.added_by IS DISTINCT FROM OLD.added_by
     OR NEW.started_at IS DISTINCT FROM OLD.started_at) THEN
    RAISE EXCEPTION 'Historical membership ownership is immutable.' USING ERRCODE='42501';
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END
$;
REVOKE ALL ON FUNCTION public.support_membership_scope_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS support_membership_scope_guard ON public.support_team_memberships;
CREATE TRIGGER support_membership_scope_guard
BEFORE INSERT OR UPDATE ON public.support_team_memberships
FOR EACH ROW EXECUTE FUNCTION public.support_membership_scope_guard();
ALTER TABLE public.support_team_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_team_memberships FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.support_team_memberships TO authenticated;
CREATE POLICY support_team_self_read ON public.support_team_memberships
  FOR SELECT TO authenticated
  USING (org_id=public.app_org_id() AND public.app_identity_confirmed()
    AND profile_id=auth.uid());
-- No direct browser INSERT/UPDATE/DELETE. Business-authorised membership
-- transition, expiry cleanup and case reassignment remain separate migrations.

CREATE TABLE IF NOT EXISTS public.support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('TS-'||upper(substr(gen_random_uuid()::text,1,10))),
  org_id uuid NOT NULL REFERENCES public.organisations(id),
  reported_by uuid NOT NULL REFERENCES public.profiles(id),
  affected_profile_id uuid REFERENCES public.profiles(id),
  affected_unit_id uuid REFERENCES public.units(id),
  category text NOT NULL CHECK (category IN (
    'cannot_sign_in','something_not_working','cannot_upload',
    'access_needed','information_looks_wrong','other'
  )),
  summary text NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 8 AND 160),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 12 AND 3000),
  affected_service text CHECK (affected_service IS NULL OR char_length(affected_service)<=120),
  impact text NOT NULL DEFAULT 'normal' CHECK (impact IN ('normal','work_blocked')),
  state text NOT NULL DEFAULT 'open' CHECK (state IN (
    'open','in_progress','waiting_approval','resolved','closed'
  )),
  assigned_to uuid REFERENCES public.profiles(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution_summary text CHECK (resolution_summary IS NULL OR char_length(resolution_summary)<=2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_case_resolution_required CHECK (
    state NOT IN ('resolved','closed') OR char_length(btrim(coalesce(resolution_summary,''))) >= 10
  )
);
CREATE INDEX IF NOT EXISTS support_cases_by_reporter
  ON public.support_cases(org_id,reported_by,opened_at DESC);
CREATE INDEX IF NOT EXISTS support_cases_by_queue
  ON public.support_cases(org_id,state,opened_at DESC);
ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_cases FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.support_cases TO authenticated;

-- Support authority requires BOTH a current membership and a separately
-- approved organisation capability. A normal unit/management role never
-- implies support authority.
CREATE POLICY support_cases_visible ON public.support_cases
  FOR SELECT TO authenticated
  USING (org_id=public.app_org_id() AND public.app_identity_confirmed() AND (
    reported_by=auth.uid()
    OR (
      public.app_has_capability('support.case.manage',NULL)
      AND EXISTS (
        SELECT 1 FROM public.support_team_memberships tm
        WHERE tm.org_id=support_cases.org_id AND tm.profile_id=auth.uid()
          AND tm.active
      )
    )
  ));

CREATE POLICY support_cases_report_self ON public.support_cases
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id=public.app_org_id()
    AND public.app_identity_confirmed()
    AND reported_by=auth.uid()
    AND affected_profile_id=auth.uid()
    AND affected_unit_id IS NULL
    AND assigned_to IS NULL
    AND state='open'
    AND impact='normal'
    AND resolution_summary IS NULL
    AND resolved_at IS NULL AND closed_at IS NULL
  );

CREATE POLICY support_cases_manage ON public.support_cases
  FOR UPDATE TO authenticated
  USING (
    org_id=public.app_org_id()
    AND public.app_identity_confirmed()
    AND public.app_has_capability('support.case.manage',NULL)
    AND EXISTS (
      SELECT 1 FROM public.support_team_memberships tm
      WHERE tm.org_id=support_cases.org_id AND tm.profile_id=auth.uid()
        AND tm.active
    )
  )
  WITH CHECK (
    org_id=public.app_org_id()
    AND public.app_identity_confirmed()
    AND public.app_has_capability('support.case.manage',NULL)
    AND EXISTS (
      SELECT 1 FROM public.support_team_memberships tm
      WHERE tm.org_id=support_cases.org_id AND tm.profile_id=auth.uid()
        AND tm.active
    )
  );

CREATE TABLE IF NOT EXISTS public.support_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id),
  case_id uuid NOT NULL REFERENCES public.support_cases(id),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL CHECK (action IN ('opened','state_changed','assigned','resolution_updated')),
  note text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_events_by_case
  ON public.support_case_events(case_id,occurred_at DESC);
ALTER TABLE public.support_case_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_case_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.support_case_events TO authenticated;
CREATE POLICY support_case_events_visible ON public.support_case_events
  FOR SELECT TO authenticated
  USING (EXISTS(
    SELECT 1 FROM public.support_cases sc
    WHERE sc.id=support_case_events.case_id
      AND sc.org_id=support_case_events.org_id
  ));

-- Only internal trigger execution can append historical event rows.
-- The function has NO direct browser EXECUTE privilege; the trigger acts
-- after RLS has independently authorised the row insertion/update.
CREATE OR REPLACE FUNCTION public.support_case_audit_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'An authenticated actor is required.' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.reported_by IS DISTINCT FROM v_actor OR NEW.org_id IS DISTINCT FROM public.app_org_id()
    THEN RAISE EXCEPTION 'Only your own support request can be filed.' USING ERRCODE='42501'; END IF;
    INSERT INTO public.support_case_events(org_id,case_id,actor_id,action,note)
      VALUES(NEW.org_id,NEW.id,v_actor,'opened',NULL);
    RETURN NEW;
  END IF;
  -- Browser updates cannot alter reporter/subject, organisation, source facts,
  -- authoritative timestamps or case reference after filing.
  IF ROW(NEW.id,NEW.reference,NEW.org_id,NEW.reported_by,
       NEW.affected_profile_id,NEW.affected_unit_id,NEW.category,
       NEW.summary,NEW.description,NEW.affected_service,NEW.impact,NEW.opened_at)
     IS DISTINCT FROM
     ROW(OLD.id,OLD.reference,OLD.org_id,OLD.reported_by,
       OLD.affected_profile_id,OLD.affected_unit_id,OLD.category,
       OLD.summary,OLD.description,OLD.affected_service,OLD.impact,OLD.opened_at)
  THEN RAISE EXCEPTION 'Support-case source facts are immutable.' USING ERRCODE='42501'; END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL
     AND NOT EXISTS(
       SELECT 1 FROM public.support_team_memberships m
       WHERE m.org_id=NEW.org_id AND m.profile_id=NEW.assigned_to AND m.active
     )
  THEN RAISE EXCEPTION 'Case assignment requires an active support member.' USING ERRCODE='42501'; END IF;
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    IF NEW.state='resolved' THEN NEW.resolved_at:=now();
    ELSIF NEW.state='closed' THEN NEW.closed_at:=now();
    ELSE NEW.resolved_at:=NULL; NEW.closed_at:=NULL; END IF;
    INSERT INTO public.support_case_events(org_id,case_id,actor_id,action,note)
      VALUES(NEW.org_id,NEW.id,v_actor,'state_changed',
        left(OLD.state||' -> '||NEW.state,200));
  ELSIF NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
     OR NEW.closed_at IS DISTINCT FROM OLD.closed_at THEN
    RAISE EXCEPTION 'Closure times are server-controlled.' USING ERRCODE='42501';
  END IF;
  IF NEW.resolution_summary IS DISTINCT FROM OLD.resolution_summary THEN
    INSERT INTO public.support_case_events(org_id,case_id,actor_id,action,note)
      VALUES(NEW.org_id,NEW.id,v_actor,'resolution_updated',
        left(coalesce(NEW.resolution_summary,'Resolution note cleared'),2000));
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
DROP TRIGGER IF EXISTS support_case_audit_insert ON public.support_cases;
CREATE TRIGGER support_case_audit_insert
AFTER INSERT ON public.support_cases
FOR EACH ROW EXECUTE FUNCTION public.support_case_audit_guard();
DROP TRIGGER IF EXISTS support_case_audit_update ON public.support_cases;
CREATE TRIGGER support_case_audit_update
BEFORE UPDATE ON public.support_cases
FOR EACH ROW EXECUTE FUNCTION public.support_case_audit_guard();

COMMENT ON TABLE public.support_team_memberships IS
  'Technical Support membership does not grant HR, Admin, Payroll, Manager or any other business authority.';
COMMENT ON TABLE public.support_case_events IS
  'Audit events are append-only to the browser. Support-specific case history is not ordinary Work Engine data.';
