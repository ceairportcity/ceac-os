-- 120 — Phase 6B: private personal day planning.
-- These records are private to their owner. They are not organisational Work,
-- Manager evidence, HR data, performance evidence or report inputs.

create table if not exists public.personal_day_tasks(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_date date not null,
  title text not null check(length(btrim(title)) between 1 and 220),
  details text check(details is null or length(details)<=4000),
  planned_time time,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_day_tasks_owner_date_idx
  on public.personal_day_tasks(profile_id,plan_date,completed_at,created_at);

create table if not exists public.personal_day_notes(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  note_date date not null,
  body text not null default '' check(length(body)<=12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id,note_date)
);

create index if not exists personal_day_notes_owner_date_idx
  on public.personal_day_notes(profile_id,note_date);

alter table public.personal_day_tasks enable row level security;
alter table public.personal_day_notes enable row level security;

drop policy if exists personal_day_tasks_owner_all on public.personal_day_tasks;
create policy personal_day_tasks_owner_all
on public.personal_day_tasks
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

drop policy if exists personal_day_notes_owner_all on public.personal_day_notes;
create policy personal_day_notes_owner_all
on public.personal_day_notes
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

revoke all on public.personal_day_tasks,public.personal_day_notes
  from public,anon,authenticated;
grant select,insert,update,delete on public.personal_day_tasks
  to authenticated;
grant select,insert,update,delete on public.personal_day_notes
  to authenticated;

create or replace function public.personal_day_task_touch()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at:=now();
  return new;
end;
$$;

revoke all on function public.personal_day_task_touch() from public,anon,authenticated;

drop trigger if exists personal_day_tasks_touch on public.personal_day_tasks;
create trigger personal_day_tasks_touch
before update on public.personal_day_tasks
for each row execute function public.personal_day_task_touch();

drop trigger if exists personal_day_notes_touch on public.personal_day_notes;
create trigger personal_day_notes_touch
before update on public.personal_day_notes
for each row execute function public.personal_day_task_touch();

comment on table public.personal_day_tasks is
  'Private self-owned calendar planning. Never organisational Work or performance evidence.';
comment on table public.personal_day_notes is
  'Private self-owned day notes. Never visible through Manager/Admin role authority.';
