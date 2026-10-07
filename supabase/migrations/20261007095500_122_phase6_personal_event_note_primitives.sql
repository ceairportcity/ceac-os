-- 122 — Phase 6B: private Event / Task / Note composer primitives.
-- Personal Events and Notes remain owner-only and never grant organisational authority.

create table if not exists public.personal_calendar_events(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(length(btrim(title)) between 1 and 220),
  details text check(details is null or length(details)<=4000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at is null or ends_at>=starts_at)
);

create index if not exists personal_calendar_events_owner_start_idx
  on public.personal_calendar_events(profile_id,starts_at);

alter table public.personal_calendar_events enable row level security;

drop policy if exists personal_calendar_events_owner_all
  on public.personal_calendar_events;
create policy personal_calendar_events_owner_all
on public.personal_calendar_events
for all
to authenticated
using (
  org_id=public.app_org_id()
  and profile_id=auth.uid()
)
with check (
  org_id=public.app_org_id()
  and profile_id=auth.uid()
);

revoke all on public.personal_calendar_events
  from public,anon,authenticated;
grant select,insert,update,delete on public.personal_calendar_events
  to authenticated;

drop trigger if exists personal_calendar_events_touch
  on public.personal_calendar_events;
create trigger personal_calendar_events_touch
before update on public.personal_calendar_events
for each row execute function public.personal_day_task_touch();

alter table public.personal_day_notes
  alter column note_date drop not null,
  add column if not exists reminder_at timestamptz;

alter table public.personal_day_notes
  drop constraint if exists personal_day_notes_kind_date_check;
alter table public.personal_day_notes
  add constraint personal_day_notes_kind_date_check
  check(
    (note_kind='daily' and note_date is not null)
    or note_kind in ('general','personal')
  );

create index if not exists personal_day_notes_owner_general_idx
  on public.personal_day_notes(profile_id,updated_at desc)
  where note_date is null;

comment on table public.personal_calendar_events is
  'Private owner-only calendar events. They are not CEAC meetings, ministry events or organisational Work.';
comment on column public.personal_day_notes.reminder_at is
  'Optional reminder property of a private note.';
