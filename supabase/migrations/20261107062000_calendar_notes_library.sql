-- Preserve ON CONFLICT (profile_id,note_date) for older installed PWA clients.
-- Multiple new dated notes use dated_for; the Daily Journal retains note_date.
ALTER TABLE public.personal_day_notes ADD COLUMN IF NOT EXISTS dated_for date;
ALTER TABLE public.personal_day_notes ADD CONSTRAINT personal_day_notes_dated_for_kind_check
  CHECK (dated_for IS NULL OR (note_kind IN ('personal','general') AND note_date IS NULL));
CREATE INDEX IF NOT EXISTS personal_day_notes_owner_recent_idx
  ON public.personal_day_notes (profile_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS personal_day_notes_owner_dated_idx
  ON public.personal_day_notes (profile_id, dated_for) WHERE dated_for IS NOT NULL;
