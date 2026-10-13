-- 139 — keep Support capability-revocation attribution aligned with the
-- separately recorded membership end reason introduced by migration 136.
--
-- Migration 136 correctly writes NEW.end_reason to the immutable membership
-- event, but its capability revocation note still copied NEW.reason (the
-- original joining reason). Replace only the trigger function so every future
-- membership closure records the actual exit decision in both audit trails.
-- Existing historical rows are preserved and production remains unchanged
-- until this forward migration is separately approved and applied.

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

    UPDATE public.capability_grants
    SET revoked_by=NEW.ended_by,
        revoked_at=NEW.ended_at,
        revoke_reason='Technical Support membership ended: '||NEW.end_reason
    WHERE org_id=NEW.org_id AND profile_id=NEW.profile_id
      AND capability LIKE 'support.%' AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.support_membership_history_guard()
  FROM PUBLIC,anon,authenticated;

COMMENT ON FUNCTION public.support_membership_history_guard() IS
  'Appends immutable membership history and revokes Support-only grants using the separately attributable membership end reason.';
