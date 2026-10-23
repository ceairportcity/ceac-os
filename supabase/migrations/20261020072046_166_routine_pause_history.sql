-- Preserve real pause windows; no occurrence outcomes are fabricated or rewritten.
create table public.routine_pause_periods (
 id uuid primary key default gen_random_uuid(),
 operation_id uuid not null references public.recurring_operations(id) on delete cascade,
 org_id uuid not null references public.organisations(id) on delete cascade,
 paused_at timestamptz not null,
 resumed_at timestamptz,
 paused_by uuid references public.profiles(id) on delete set null,
 resumed_by uuid references public.profiles(id) on delete set null,
 pause_reason text,
 resume_reason text,
 source_event_id uuid unique references public.activity_events(id) on delete set null,
 check (resumed_at is null or resumed_at >= paused_at)
);
create unique index routine_pause_periods_one_open on public.routine_pause_periods(operation_id) where resumed_at is null;
create index routine_pause_periods_dates on public.routine_pause_periods(operation_id,paused_at,resumed_at);
alter table public.routine_pause_periods enable row level security;
create policy routine_pause_periods_visible on public.routine_pause_periods for select to authenticated
 using (org_id=public.app_org_id() and public.app_stage2_universal_aal_allowed()
   and exists(select 1 from public.recurring_operations r where r.id=operation_id and r.org_id=routine_pause_periods.org_id));
revoke all on public.routine_pause_periods from public,anon,authenticated;
grant select on public.routine_pause_periods to authenticated;
comment on table public.routine_pause_periods is
 'Actual audited routine pause intervals. Read through existing routine visibility; only the authorised pause RPC writes. Accra date-only schedules exclude pause date through the day before resumption; existing recorded proof is retained.';

-- Recover only recorded state transitions. First pause after each resume opens
-- an interval; repeated legacy pause clicks do not move that opening forward.
-- A same-timestamp resume closes the interval without inventing missed days.
with events as (
 select a.*, r.id operation_id,
  count(*) filter(where a.verb='routine_resumed') over(
   partition by r.id order by a.at,case when a.verb='routine_paused' then 0 else 1 end,a.id
   rows unbounded preceding) as resume_group
 from public.activity_events a join public.recurring_operations r
  on r.work_item_id=a.object_id and r.org_id=a.org_id
 where a.object_type='work_item' and a.verb in ('routine_paused','routine_resumed')
), openings as (
 select distinct on(operation_id,resume_group) *
 from events where verb='routine_paused'
 order by operation_id,resume_group,at,id
)
insert into public.routine_pause_periods(operation_id,org_id,paused_at,resumed_at,paused_by,resumed_by,pause_reason,resume_reason,source_event_id)
select p.operation_id,p.org_id,p.at,c.at,p.actor_id,c.actor_id,p.meta->>'reason',c.meta->>'reason',p.id
from openings p left join lateral (
 select e.at,e.actor_id,e.meta from events e
 where e.operation_id=p.operation_id and e.verb='routine_resumed' and e.resume_group=p.resume_group+1
 order by e.at,e.id limit 1
) c on true;
-- A legacy current pause can exist without an activity event. Its persisted
-- pause timestamp is evidence; earlier unknown intervals are not invented.
insert into public.routine_pause_periods(operation_id,org_id,paused_at,pause_reason)
select r.id,r.org_id,r.paused_at,'Existing persisted pause'
from public.recurring_operations r where r.paused_at is not null
 and not exists(select 1 from public.routine_pause_periods p where p.operation_id=r.id and p.resumed_at is null);

create or replace function public.set_routine_paused(
  p_work_item_id uuid,
  p_paused boolean,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare ro record; v_changed_at timestamptz;
begin
  if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed() then
    raise exception 'Sign in with the required account verification.' using errcode='42501';
  end if;
  select * into ro from recurring_operations where work_item_id=p_work_item_id for update;
  if ro is null then raise exception 'That routine does not exist.'; end if;
  if ro.org_id is distinct from app_org_id() then raise exception 'That belongs to another organisation.' using errcode='42501'; end if;
  if not (ro.unit_id in (select app_managed_units()) or app_is_admin() or exists (
    select 1 from public.work_items w join public.unit_memberships m
      on m.profile_id=auth.uid() and m.unit_id=w.unit_id and m.org_id=w.org_id
    where w.id=ro.work_item_id and w.org_id=app_org_id() and w.origin='self_created'
      and w.assignee_id=auth.uid() and w.assigned_by=auth.uid()
  )) then
    raise exception 'Only its creator, the department head or Administration can pause or resume this routine.' using errcode='42501';
  end if;
  if p_paused is null then raise exception 'Choose pause or resume.' using errcode='22023'; end if;
  if p_reason is null or length(btrim(p_reason))=0 then
    raise exception 'Record why the routine is being paused or resumed.';
  end if;

  -- Retries retain the original anchor and never create duplicate transitions.
  if (p_paused and not ro.active and ro.paused_at is not null)
    or (not p_paused and ro.active and ro.paused_at is null) then return p_work_item_id; end if;
  v_changed_at:=clock_timestamp();
  if p_paused then
    insert into public.routine_pause_periods(operation_id,org_id,paused_at,paused_by,pause_reason)
    values(ro.id,ro.org_id,v_changed_at,auth.uid(),btrim(p_reason));
  else
    update public.routine_pause_periods
      set resumed_at=v_changed_at,resumed_by=auth.uid(),resume_reason=btrim(p_reason)
      where operation_id=ro.id and resumed_at is null;
  end if;
  update recurring_operations
  set active=not p_paused,
      paused_at=case when p_paused then v_changed_at else null end
  where id=ro.id;

  insert into activity_events(org_id,actor_id,verb,object_type,object_id,meta,at)
  values(ro.org_id,auth.uid(),case when p_paused then 'routine_paused' else 'routine_resumed' end,
         'work_item',p_work_item_id,jsonb_build_object('reason',btrim(p_reason),'changed_at',v_changed_at),v_changed_at);

  return p_work_item_id;
end;
$$;



create or replace function public.record_routine_occurrence(
  p_work_item_id uuid,
  p_occurred_on date,
  p_value numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  ro record;
  sv record;
  v_id uuid;
  v_dow integer;
begin
  if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed() then
    raise exception 'Sign in with the required account verification.' using errcode='42501';
  end if;
  select r.* into ro
  from recurring_operations r
  where r.work_item_id=p_work_item_id
  for update;

  if ro is null then raise exception 'That routine does not exist.'; end if;
  if ro.org_id is distinct from app_org_id() then raise exception 'That routine belongs to another organisation.' using errcode='42501'; end if;
  if p_occurred_on is null or p_occurred_on>current_date then
    raise exception 'Record an occurrence for today or an earlier date.';
  end if;
  if ro.starts_on is not null and p_occurred_on<ro.starts_on then
    raise exception 'That date is before the routine started.';
  end if;
  if ro.ends_on is not null and p_occurred_on>ro.ends_on then
    raise exception 'That date is after the routine ended.';
  end if;
  if not (
    ro.unit_id in (select app_my_units())
    or ro.unit_id in (select app_managed_units())
    or app_is_admin()
  ) then
    raise exception 'You cannot record this routine.' using errcode='42501';
  end if;

  if not ro.active or ro.paused_at is not null then
    raise exception 'Resume this routine before recording another occurrence.' using errcode='22023';
  end if;
  if exists (select 1 from public.work_items w where w.id=p_work_item_id
      and w.assignee_id is not null and w.assignee_id<>auth.uid())
    and not (ro.unit_id in (select app_managed_units()) or app_is_admin()) then
    raise exception 'Only the responsible person or authorised department reviewer can record this occurrence.' using errcode='42501';
  end if;

  if not exists(select 1 from public.operation_occurrences o where o.operation_id=ro.id and o.occurred_on=p_occurred_on)
    and exists(select 1 from public.routine_pause_periods p where p.operation_id=ro.id
      and p_occurred_on >= (p.paused_at at time zone 'Africa/Accra')::date
      and (p.resumed_at is null or p_occurred_on < (p.resumed_at at time zone 'Africa/Accra')::date)) then
    raise exception 'That date fell within a recorded routine pause.' using errcode='22023';
  end if;

  select * into sv
  from routine_schedule_versions
  where operation_id=ro.id
    and effective_from<=p_occurred_on
    and (effective_to is null or effective_to>=p_occurred_on)
  order by version desc
  limit 1;

  if sv is null then raise exception 'No schedule version covers that date.'; end if;

  v_dow := extract(isodow from p_occurred_on)::int;
  if sv.schedule_kind in ('weekly','weekdays') and not (v_dow=any(sv.weekdays)) then
    raise exception 'That date is not scheduled for this routine.';
  end if;
  if sv.schedule_kind='monthly' and extract(day from p_occurred_on)::int<>sv.day_of_month then
    raise exception 'That date is not the scheduled monthly day.';
  end if;

  if ro.records_value and p_value is null then
    raise exception 'Record the % for this occurrence.',coalesce(ro.value_label,'value');
  end if;
  if not ro.records_value and p_value is not null then
    raise exception 'This routine is not configured to record a number.';
  end if;

  insert into operation_occurrences(org_id,operation_id,occurred_on,value,note,recorded_by)
  values(ro.org_id,ro.id,p_occurred_on,p_value,nullif(btrim(p_note),''),auth.uid())
  returning id into v_id;

  insert into activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(ro.org_id,auth.uid(),'routine_recorded','work_item',p_work_item_id,
         jsonb_build_object('occurrence_id',v_id,'occurred_on',p_occurred_on,'value',p_value));

  return v_id;
end;
$$;


-- Existing unique (operation_id,occurred_on) and row lock preserve retry/concurrency safety.
