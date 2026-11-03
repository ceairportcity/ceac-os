-- A Room being readable never implies its entire traffic must notify its reader.
-- Each account explicitly controls Room notification delivery, independently of
-- room access, participants, and the existing per-room read cursor.
CREATE TABLE public.room_notification_preferences (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  notification_level text NOT NULL
    CHECK (notification_level IN ('all', 'mentions', 'mute')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, profile_id)
);

CREATE INDEX room_notification_preferences_profile_idx
  ON public.room_notification_preferences (org_id, profile_id);

ALTER TABLE public.room_notification_preferences ENABLE ROW LEVEL SECURITY;

-- This policy is an additional safeguard; callers cannot use notification
-- preferences to gain access to a Room, or edit somebody else's preferences.
CREATE POLICY room_notification_preferences_read
  ON public.room_notification_preferences FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    AND org_id = (SELECT public.app_org_id())
    AND public.app_can_access_room(room_id)
    AND public.app_stage2_universal_aal_allowed()
  );

CREATE POLICY room_notification_preferences_write
  ON public.room_notification_preferences FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND org_id = (SELECT public.app_org_id())
    AND public.app_can_access_room(room_id)
    AND public.app_stage2_universal_aal_allowed()
  );

CREATE POLICY room_notification_preferences_update
  ON public.room_notification_preferences FOR UPDATE TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    AND org_id = (SELECT public.app_org_id())
    AND public.app_can_access_room(room_id)
    AND public.app_stage2_universal_aal_allowed()
  )
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND org_id = (SELECT public.app_org_id())
    AND public.app_can_access_room(room_id)
    AND public.app_stage2_universal_aal_allowed()
  );

CREATE POLICY room_notification_preferences_delete
  ON public.room_notification_preferences FOR DELETE TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    AND org_id = (SELECT public.app_org_id())
    AND public.app_can_access_room(room_id)
    AND public.app_stage2_universal_aal_allowed()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_notification_preferences
  TO authenticated;

COMMENT ON TABLE public.room_notification_preferences IS
  'User-specific Room notification settings; access to the Room remains governed by existing RLS.';
