-- 121 — Phase 6B: complete private planning data contract.
-- Personal planning stays owner-only and never becomes organisational Work.

alter table public.personal_day_tasks
  alter column plan_date drop not null,
  add column if not exists reminder_at timestamptz,
  add column if not exists linked_work_item_id uuid references public.work_items(id) on delete set null,
  add column if not exists linked_project_id uuid references public.projects(id) on delete set null;

create index if not exists personal_day_tasks_owner_unscheduled_idx
  on public.personal_day_tasks(profile_id,created_at)
  where plan_date is null and completed_at is null;

create index if not exists personal_day_tasks_owner_reminder_idx
  on public.personal_day_tasks(profile_id,reminder_at)
  where reminder_at is not null and completed_at is null;

create table if not exists public.personal_day_task_checklist(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.personal_day_tasks(id) on delete cascade,
  title text not null check(length(btrim(title)) between 1 and 300),
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_day_task_checklist_task_idx
  on public.personal_day_task_checklist(task_id,position,created_at);

alter table public.personal_day_task_checklist enable row level security;

drop policy if exists personal_day_task_checklist_owner_all
  on public.personal_day_task_checklist;
create policy personal_day_task_checklist_owner_all
on public.personal_day_task_checklist
for all
to authenticated
using (
  org_id=public.app_org_id()
  and profile_id=auth.uid()
  and exists(
    select 1
    from public.personal_day_tasks t
    where t.id=personal_day_task_checklist.task_id
      and t.org_id=personal_day_task_checklist.org_id
      and t.profile_id=auth.uid()
  )
)
with check (
  org_id=public.app_org_id()
  and profile_id=auth.uid()
  and exists(
    select 1
    from public.personal_day_tasks t
    where t.id=personal_day_task_checklist.task_id
      and t.org_id=personal_day_task_checklist.org_id
      and t.profile_id=auth.uid()
  )
);

revoke all on public.personal_day_task_checklist
  from public,anon,authenticated;
grant select,insert,update,delete on public.personal_day_task_checklist
  to authenticated;

drop trigger if exists personal_day_task_checklist_touch
  on public.personal_day_task_checklist;
create trigger personal_day_task_checklist_touch
before update on public.personal_day_task_checklist
for each row execute function public.personal_day_task_touch();

alter table public.personal_day_notes
  add column if not exists note_kind text not null default 'daily',
  add column if not exists title text;

alter table public.personal_day_notes
  drop constraint if exists personal_day_notes_note_kind_check;
alter table public.personal_day_notes
  add constraint personal_day_notes_note_kind_check
  check(note_kind in ('daily','general','personal'));

alter table public.personal_day_notes
  drop constraint if exists personal_day_notes_title_check;
alter table public.personal_day_notes
  add constraint personal_day_notes_title_check
  check(title is null or length(btrim(title)) between 1 and 220);

comment on column public.personal_day_tasks.plan_date is
  'Nullable by design. NULL keeps this private task in the explicit unscheduled queue.';
comment on column public.personal_day_tasks.reminder_at is
  'Optional reminder property of a private task. It does not create authoritative Work.';
comment on column public.personal_day_tasks.linked_work_item_id is
  'Optional pointer to authoritative CEAC Work. The personal task never replaces Work authority.';
comment on column public.personal_day_tasks.linked_project_id is
  'Optional pointer to an authorised CEAC Project. Project authority remains unchanged.';
comment on table public.personal_day_task_checklist is
  'Private owner-only checklist rows belonging to a private personal task.';
