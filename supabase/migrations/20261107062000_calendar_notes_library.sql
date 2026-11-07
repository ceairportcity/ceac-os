-- Preserve existing journals while permitting multiple dated private notes.
-- RLS remains owner-only. The former unique constraint blocked additional dated notes.
CREATE UNIQUE INDEX IF NOT EXISTS personal_day_notes_daily_date_unique
  ON public.personal_day_notes (profile_id, note_date) WHERE note_kind = 'daily';
ALTER TABLE public.personal_day_notes
  DROP CONSTRAINT IF EXISTS personal_day_notes_profile_id_note_date_key;
CREATE INDEX IF NOT EXISTS personal_day_notes_owner_recent_idx
  ON public.personal_day_notes (profile_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS personal_day_notes_owner_dated_idx
  ON public.personal_day_notes (profile_id, note_date)
  WHERE note_date IS NOT NULL;
