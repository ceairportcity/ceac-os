-- Owner decision 28 October: off-site attendance records location, independently
-- of projects/responsibilities. Existing rows and office guard are unchanged.
-- Reuse the existing session evidence JSON; no new table, grant or public RPC.
CREATE OR REPLACE FUNCTION private.guard_offsite_session_start()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE location_name text; previous_session public.work_sessions;
BEGIN
  IF NEW.place <> 'elsewhere' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.profile_id IS DISTINCT FROM auth.uid() OR NEW.org_id IS DISTINCT FROM public.app_org_id() THEN
    RAISE EXCEPTION 'Only your own active work session can be started.' USING ERRCODE='42501';
  END IF;
  -- Existing server-owned stale-session reconciliation may continue historical
  -- rows without a new place-name prompt. A client-supplied flags key alone
  -- cannot take this path: it must run inside the postgres-owned recovery RPC.
  IF current_user='postgres' AND NEW.flags ? 'continued_from_session_id' THEN
    SELECT * INTO previous_session FROM public.work_sessions
      WHERE id=(NEW.flags->>'continued_from_session_id')::uuid
        AND org_id=NEW.org_id AND profile_id=NEW.profile_id AND ended_at IS NOT NULL;
    IF previous_session.id IS NOT NULL THEN
      IF previous_session.flags ? 'offsite_location_name' THEN
        NEW.flags:=NEW.flags||jsonb_build_object('offsite_location_name',previous_session.flags->>'offsite_location_name');
      END IF;
      RETURN NEW;
    END IF;
  END IF;
  location_name:=btrim(NEW.flags->>'offsite_location_name');
  IF jsonb_typeof(NEW.flags->'offsite_location_name') IS DISTINCT FROM 'string'
    OR location_name IS NULL OR length(location_name) NOT BETWEEN 1 AND 200
    OR location_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Enter where you are working from, using up to 200 characters.';
  END IF;
  -- The existing office guard runs first, normalises timestamps and rejects
  -- malformed coordinates. Do not accept its historical unverified fallback
  -- for NEW off-site starts under the revised owner contract.
  IF NEW.lat IS NULL OR NEW.lng IS NULL OR NEW.lat NOT BETWEEN -90 AND 90
    OR NEW.lng NOT BETWEEN -180 AND 180 OR NEW.location_captured_at IS NULL
    OR NEW.location_captured_at < now()-interval '2 minutes'
    OR NEW.location_captured_at > now()+interval '30 seconds' OR NEW.device_time IS NULL THEN
    RAISE EXCEPTION 'A fresh location is required. Allow location access and try Start work again.';
  END IF;
  IF NEW.work_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.work_items w WHERE w.id=NEW.work_item_id
      AND w.org_id=NEW.org_id AND w.assignee_id=NEW.profile_id
      AND w.status IN ('not_started','in_progress','returned')
  ) THEN
    RAISE EXCEPTION 'Choose your own active responsibility or start without linking one.' USING ERRCODE='42501';
  END IF;
  NEW.flags:=(coalesce(NEW.flags,'{}'::jsonb)-'start_location_not_verified')
    ||jsonb_build_object('offsite_location_name',location_name);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_offsite_session_start() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER work_sessions_offsite_start_guard BEFORE INSERT ON public.work_sessions
FOR EACH ROW EXECUTE FUNCTION private.guard_offsite_session_start();
