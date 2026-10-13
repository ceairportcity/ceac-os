-- 136 — Technical Support membership end-reason provenance.
-- Owner contract requires a reason for every People Administration change.
-- Migration 134 correctly preserved the original joining reason, but the
-- history of ending membership would reuse that joining reason instead of
-- the distinct decision to end current Support authority.
-- Forward-only: never rewrite historical memberships or old events. Closed
-- legacy rows may retain end_reason=NULL; all future authenticated closure
-- transitions require a new reason of 8+ non-space characters.
-- Preserve S3 automatic support-grant revocation and historical attribution.
ALTER TABLE public.support_team_memberships ADD COLUMN end_reason text
  CHECK (end_reason IS NULL OR char_length(btrim(end_reason))>=8);

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
      NEW.end_reason:=NULL;
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
       OR NEW.ended_at IS NULL OR NEW.ended_by IS NULL
       OR char_length(btrim(coalesce(NEW.end_reason,'')))<8 THEN
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
    ) VALUES(NEW.org_id,NEW.id,NEW.profile_id,NEW.ended_by,'ended',coalesce(NEW.end_reason,NEW.reason),NEW.ended_at);

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
