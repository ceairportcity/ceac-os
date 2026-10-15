-- 147 — owner-locked recurring private planning. Never organisational Work.
-- All operations run as the signed-in owner under RLS. No SECURITY DEFINER.
-- This version follows the approved current-bundle migrations (118–146).

create table public.personal_task_series (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 220),
  details text check (details is null or length(details) <= 4000),
  start_date date not null,
  planned_time time,
  cadence text not null check (cadence in ('daily','weekdays','weekly','monthly','custom')),
  interval_count integer not null default 1 check (interval_count between 1 and 365),
  custom_unit text check (custom_unit in ('days','weeks','months')),
  ends_when text not null default 'never'
    check (ends_when in ('never','on_date','after_count')),
  end_date date,
  occurrence_limit integer check (occurrence_limit between 1 and 5000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint series_custom_unit check (
    (cadence='custom' and custom_unit is not null)
    or (cadence <> 'custom' and custom_unit is null)
  ),
  constraint series_end_rule check (
    (ends_when='never' and end_date is null and occurrence_limit is null)
    or (ends_when='on_date' and end_date>=start_date and occurrence_limit is null)
    or (ends_when='after_count' and occurrence_limit is not null and end_date is null)
  )
);
create index personal_task_series_owner_idx
  on public.personal_task_series(profile_id,start_date,is_active);

alter table public.personal_task_series enable row level security;
create policy personal_task_series_owner_all
on public.personal_task_series for all to authenticated
using (profile_id=auth.uid() and org_id=public.app_org_id())
with check (profile_id=auth.uid() and org_id=public.app_org_id());

revoke all on public.personal_task_series from public,anon,authenticated;
grant select,insert,update,delete on public.personal_task_series to authenticated;

create trigger personal_task_series_touch
before update on public.personal_task_series for each row
execute function public.personal_day_task_touch();

alter table public.personal_day_tasks
  add column series_id uuid references public.personal_task_series(id) on delete set null;

-- Occurrences share their owner's task surface and RLS; a unique index makes
-- repeated materialisation idempotent even under concurrent requests.
create unique index personal_day_tasks_series_occurrence_unique
  on public.personal_day_tasks(series_id,plan_date)
  where series_id is not null;

create index personal_day_tasks_owner_overdue_idx
  on public.personal_day_tasks(profile_id,plan_date)
  where completed_at is null and plan_date is not null;

-- Prevent a personal task from pointing at someone else's series, even if
-- the UUID is guessed. The trigger is INVOKER (RLS applies to the lookup).
create or replace function public.personal_task_series_owner_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.series_id is not null and not exists (
    select 1 from public.personal_task_series s
    where s.id=new.series_id and s.profile_id=new.profile_id and s.org_id=new.org_id
  ) then
    raise exception 'Private task series does not belong to the signed-in owner'
      using errcode='42501';
  end if;
  return new;
end
$$;
revoke all on function public.personal_task_series_owner_guard()
  from public,anon,authenticated;
create trigger personal_day_tasks_series_guard
before insert or update of series_id,profile_id,org_id on public.personal_day_tasks
for each row execute function public.personal_task_series_owner_guard();

-- Explicit materialisation is called when the owner opens/plans a month or
-- creates a series. No scheduled service silently completes or hides misses.
-- The capped horizon protects the public RPC from unbounded work.
create or replace function public.personal_materialize_task_series(
  p_series_id uuid,p_through_date date
) returns integer
language plpgsql security invoker set search_path='' as $$
declare
  s public.personal_task_series%rowtype;
  d date;
  v_due boolean;
  v_days integer;
  v_months integer;
  v_month_start date;
  v_target_day integer;
  v_seen integer:=0;
  v_inserted integer:=0;
  v_rows integer:=0;
  v_monthly boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required for private recurring tasks'
      using errcode='42501';
  end if;
  select * into s from public.personal_task_series
  where id=p_series_id and profile_id=auth.uid()
    and org_id=public.app_org_id();
  if not found then
    raise exception 'Private recurring task not found for this owner'
      using errcode='42501';
  end if;
  if not s.is_active then return 0; end if;
  if p_through_date is null or p_through_date>current_date+370 then
    raise exception 'Recurring task generation must use a bounded one-year future window'
      using errcode='22023';
  end if;
  if p_through_date<s.start_date then return 0; end if;
  if p_through_date-s.start_date>7305 then
    raise exception 'Recurring task history exceeds the supported twenty-year window'
      using errcode='22023';
  end if;

  for d in
    select gs::date
    from pg_catalog.generate_series(
      s.start_date::timestamp,
      least(p_through_date,coalesce(s.end_date,p_through_date))::timestamp,
      interval '1 day'
    ) as gs
  loop
    v_days:=d-s.start_date;
    v_months:=(extract(year from d)::integer-extract(year from s.start_date)::integer)*12
      +(extract(month from d)::integer-extract(month from s.start_date)::integer);
    v_monthly:=s.cadence='monthly'
      or (s.cadence='custom' and s.custom_unit='months');
    if v_monthly then
      v_month_start:=pg_catalog.date_trunc('month',d)::date;
      v_target_day:=least(
        extract(day from s.start_date)::integer,
        extract(day from (v_month_start+interval '1 month - 1 day'))::integer
      );
      v_due:=v_months % s.interval_count=0
        and d=v_month_start+(v_target_day-1);
    elsif s.cadence='weekdays' then
      v_due:=extract(isodow from d) between 1 and 5;
    elsif s.cadence='weekly'
       or (s.cadence='custom' and s.custom_unit='weeks') then
      v_due:=v_days % (7*s.interval_count)=0;
    else
      v_due:=v_days % s.interval_count=0;
    end if;
    if not v_due then continue; end if;
    v_seen:=v_seen+1;
    if s.ends_when='after_count' and v_seen>s.occurrence_limit then
      exit;
    end if;
    insert into public.personal_day_tasks(
      org_id,profile_id,plan_date,title,details,planned_time,series_id
    ) values (
      s.org_id,s.profile_id,d,s.title,s.details,s.planned_time,s.id
    )
    on conflict (series_id,plan_date) where series_id is not null
    do nothing;
    get diagnostics v_rows=row_count;
    v_inserted:=v_inserted+v_rows;
  end loop;
  return v_inserted;
end
$$;
revoke all on function public.personal_materialize_task_series(uuid,date)
  from public,anon,authenticated;
grant execute on function public.personal_materialize_task_series(uuid,date)
  to authenticated;

comment on table public.personal_task_series is
  'Owner-only recurring personal task templates. No Manager, HR, Executive, performance or payroll visibility.';
comment on column public.personal_day_tasks.series_id is
  'Optional private series origin. Completed occurrences are never overwritten by repeat generation.';
