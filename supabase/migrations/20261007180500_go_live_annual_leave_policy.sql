-- Go-live annual-leave policy implementation.
-- Owner lock: 24 working days per leave year; 6 days per completed quarter;
-- joiners are pro-rated within their join quarter; no routine carry-forward.
-- Secondary leave quantities remain intentionally unconfigured.
--
-- Annual working-day calculations use the attributable workforce schedule.
-- If the required schedule is missing, the system returns an unavailable balance
-- rather than guessing Monday-Friday or a legacy default.

-- Privileged implementations live outside the exposed public API surface.
-- Public RPCs below are SECURITY INVOKER wrappers with deliberately narrow grants.
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated,service_role;

alter table public.leave_policy_rules
  drop constraint if exists leave_policy_rules_accrual_method_check;

alter table public.leave_policy_rules
  add constraint leave_policy_rules_accrual_method_check
  check(accrual_method is null or accrual_method in ('none','monthly','quarterly','annual','manual'));

alter table public.leave_policy_rules
  add constraint leave_policy_rules_complete_rate_check
  check(
    not complete
    or accrual_method not in ('monthly','quarterly')
    or accrual_rate is not null
  );

alter table public.leave_requests
  add column if not exists working_days numeric;

alter table public.leave_requests
  add column if not exists working_days_basis text;

alter table public.leave_requests
  drop constraint if exists leave_requests_working_days_check;

alter table public.leave_requests
  add constraint leave_requests_working_days_check
  check(working_days is null or working_days>=0);

alter table public.leave_requests
  drop constraint if exists leave_requests_working_days_basis_check;

alter table public.leave_requests
  add constraint leave_requests_working_days_basis_check
  check(
    (working_days is null and working_days_basis is null)
    or (
      working_days is not null
      and working_days_basis in ('recorded_workforce_schedule')
    )
  );

-- Preserve explicit protected/contractual carry-over or other annual-leave
-- exceptions without creating routine automatic carry-forward.
create table if not exists public.leave_balance_adjustments(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  leave_year integer not null check(leave_year between 2000 and 2200),
  leave_kind text not null default 'annual' check(leave_kind='annual'),
  adjustment_type text not null
    check(adjustment_type in ('protected_carryover','contractual_exception','correction','reversal')),
  days numeric not null check(days<>0),
  reason text not null check(length(btrim(reason)) between 3 and 1000),
  source_reference text,
  reverses_id uuid references public.leave_balance_adjustments(id) on delete restrict,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists leave_balance_adjustment_reversal_uidx
  on public.leave_balance_adjustments(reverses_id)
  where reverses_id is not null;

create index if not exists leave_balance_adjustment_subject_idx
  on public.leave_balance_adjustments(org_id,profile_id,leave_year,created_at);

alter table public.leave_balance_adjustments enable row level security;
revoke all on public.leave_balance_adjustments from public,anon,authenticated;
grant select on public.leave_balance_adjustments to authenticated;
grant all on public.leave_balance_adjustments to service_role;

drop policy if exists leave_balance_adjustments_read on public.leave_balance_adjustments;
create policy leave_balance_adjustments_read
on public.leave_balance_adjustments
for select
to authenticated
using(
  org_id=public.app_org_id()
  and (
    profile_id=auth.uid()
    or public.app_has_capability('workforce.manage',null)
    or exists(
      select 1
      from public.employment_records er
      where er.profile_id=leave_balance_adjustments.profile_id
        and er.org_id=leave_balance_adjustments.org_id
        and er.unit_id in(select public.app_managed_units())
    )
  )
);

drop trigger if exists leave_balance_adjustments_immutable on public.leave_balance_adjustments;
create trigger leave_balance_adjustments_immutable
before update or delete on public.leave_balance_adjustments
for each row execute function public.platform_audit_immutable();

drop trigger if exists audit_leave_balance_adjustments on public.leave_balance_adjustments;
create trigger audit_leave_balance_adjustments
after insert on public.leave_balance_adjustments
for each row execute function public.platform_audit_capture('leave_balance_adjustment','id','profile_id');

-- Upgrade the owner-confirmed routing record to the now-confirmed annual values.
-- Keep the policy version itself draft/partial because sick, maternity, paternity
-- and study entitlement quantities remain unconfirmed.
update public.leave_policy_rules r
set entitlement_amount=24,
    entitlement_unit='days',
    accrual_method='quarterly',
    accrual_rate=6,
    carryover_method='none',
    carryover_limit=null,
    opening_balance_required=false,
    complete=true
from public.leave_policy_versions p
where r.policy_version_id=p.id
  and r.leave_kind='annual'
  and r.routing_confirmed
  and p.source_reference='CEAC_OWNER_LEAVE_ROUTING_2026-10-02';

create or replace function private.workforce_count_scheduled_working_days(
  p_profile_id uuid,
  p_start_date date,
  p_end_date date
)
returns numeric
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_org uuid;
  v_missing integer;
  v_days numeric;
begin
  if p_profile_id is null or p_start_date is null or p_end_date is null or p_end_date<p_start_date then
    return null;
  end if;

  select p.org_id into v_org
  from public.profiles p
  where p.id=p_profile_id;

  if v_org is null then
    return null;
  end if;

  with calendar_days as (
    select d::date as work_date,
           lower(to_char(d::date,'Dy')) as day_key
    from generate_series(p_start_date::timestamp,p_end_date::timestamp,interval '1 day') d
  ),
  schedule_by_day as (
    select
      c.work_date,
      c.day_key,
      s.id as schedule_id,
      s.day_map
    from calendar_days c
    left join lateral (
      select v.id,v.day_map
      from public.workforce_schedule_versions v
      where v.org_id=v_org
        and v.profile_id=p_profile_id
        and v.effective_from<=c.work_date
        and (v.effective_to is null or v.effective_to>=c.work_date)
        and not exists(
          select 1
          from public.workforce_schedule_versions successor
          where successor.supersedes_id=v.id
            and successor.effective_from<=c.work_date
            and (successor.effective_to is null or successor.effective_to>=c.work_date)
        )
      order by v.created_at desc,v.id desc
      limit 1
    ) s on true
  ),
  facts as (
    select
      s.work_date,
      s.schedule_id,
      dt.session_expected,
      dt.leave_overlay_allowed
    from schedule_by_day s
    left join public.workforce_day_types dt
      on dt.id=nullif(s.day_map->>s.day_key,'')::uuid
      and dt.org_id=v_org
  )
  select
    count(*) filter(where schedule_id is null),
    count(*) filter(where coalesce(session_expected,false) and coalesce(leave_overlay_allowed,false))
  into v_missing,v_days
  from facts;

  if v_missing>0 then
    return null;
  end if;

  return coalesce(v_days,0);
end;
$$;

revoke all on function private.workforce_count_scheduled_working_days(uuid,date,date)
  from public,anon,authenticated;
grant execute on function private.workforce_count_scheduled_working_days(uuid,date,date)
  to service_role;

create or replace function private.workforce_record_annual_leave_adjustment_impl(
  p_profile_id uuid,
  p_leave_year integer,
  p_days numeric,
  p_adjustment_type text,
  p_reason text,
  p_source_reference text default null,
  p_reverses_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_prior public.leave_balance_adjustments%rowtype;
  v_id uuid;
begin
  if v_actor is null or not public.app_has_capability('workforce.manage',null) then
    raise exception 'Workforce Administration authority is required.' using errcode='42501';
  end if;
  if p_profile_id is null or not exists(
    select 1 from public.profiles p
    where p.id=p_profile_id and p.org_id=v_org
  ) then
    raise exception 'Choose a person in your organisation.' using errcode='42501';
  end if;
  if p_leave_year is null or p_leave_year not between 2000 and 2200 then
    raise exception 'Choose a valid leave year.';
  end if;
  if p_days is null or p_days=0 then
    raise exception 'Adjustment days cannot be zero.';
  end if;
  if length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'Record the reason for this leave adjustment.';
  end if;

  if p_reverses_id is not null then
    select * into v_prior
    from public.leave_balance_adjustments
    where id=p_reverses_id and org_id=v_org and profile_id=p_profile_id
    for update;

    if v_prior.id is null then
      raise exception 'The leave adjustment being reversed was not found.';
    end if;
    if exists(select 1 from public.leave_balance_adjustments where reverses_id=v_prior.id) then
      raise exception 'That leave adjustment has already been reversed.';
    end if;
    if p_adjustment_type<>'reversal' or p_days<>-v_prior.days or p_leave_year<>v_prior.leave_year then
      raise exception 'A reversal must exactly negate the original adjustment in the same leave year.';
    end if;
  elsif p_adjustment_type not in ('protected_carryover','contractual_exception','correction') then
    raise exception 'Choose a supported annual-leave adjustment type.';
  end if;

  insert into public.leave_balance_adjustments(
    org_id,profile_id,leave_year,leave_kind,adjustment_type,days,
    reason,source_reference,reverses_id,recorded_by
  ) values(
    v_org,p_profile_id,p_leave_year,'annual',p_adjustment_type,p_days,
    btrim(p_reason),nullif(btrim(coalesce(p_source_reference,'')),''),p_reverses_id,v_actor
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.workforce_record_annual_leave_adjustment_impl(uuid,integer,numeric,text,text,text,uuid)
  from public,anon;
grant execute on function private.workforce_record_annual_leave_adjustment_impl(uuid,integer,numeric,text,text,text,uuid)
  to authenticated,service_role;

create or replace function public.workforce_record_annual_leave_adjustment(
  p_profile_id uuid,
  p_leave_year integer,
  p_days numeric,
  p_adjustment_type text,
  p_reason text,
  p_source_reference text default null,
  p_reverses_id uuid default null
)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.workforce_record_annual_leave_adjustment_impl(
    p_profile_id,p_leave_year,p_days,p_adjustment_type,p_reason,p_source_reference,p_reverses_id
  )
$$;

revoke all on function public.workforce_record_annual_leave_adjustment(uuid,integer,numeric,text,text,text,uuid)
  from public,anon;
grant execute on function public.workforce_record_annual_leave_adjustment(uuid,integer,numeric,text,text,text,uuid)
  to authenticated,service_role;

create or replace function private.workforce_annual_leave_summary_impl(
  p_profile_id uuid default null,
  p_as_of date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_profile uuid:=coalesce(p_profile_id,v_actor);
  v_joined date;
  v_year integer;
  v_year_start date;
  v_year_end date;
  v_service_start date;
  v_quarter integer;
  v_q_start date;
  v_q_end date;
  v_entitlement numeric:=24;
  v_rate numeric:=6;
  v_accrued numeric:=0;
  v_adjustments numeric:=0;
  v_approved numeric:=0;
  v_available numeric;
  v_segment_working numeric;
  v_quarter_days numeric;
  v_served_days numeric;
  v_schedule_complete boolean:=true;
  v_proration_applied boolean:=false;
  v_leave record;
begin
  if v_actor is null or v_org is null or v_profile is null then
    raise exception 'Sign in to view leave.' using errcode='42501';
  end if;
  if p_as_of is null then
    raise exception 'Choose a valid as-of date.';
  end if;

  if v_profile<>v_actor
     and not public.app_has_capability('workforce.manage',null)
     and not exists(
       select 1
       from public.employment_records er
       where er.profile_id=v_profile
         and er.org_id=v_org
         and er.unit_id in(select public.app_managed_units())
     ) then
    raise exception 'You do not have authority to view that leave balance.' using errcode='42501';
  end if;

  select coalesce(er.joined_on,p.started_on,p.joined_at)
  into v_joined
  from public.profiles p
  left join public.employment_records er
    on er.profile_id=p.id and er.org_id=p.org_id
  where p.id=v_profile and p.org_id=v_org;

  if not found then
    raise exception 'Leave subject not found.' using errcode='42501';
  end if;

  select
    coalesce(r.entitlement_amount,24),
    coalesce(r.accrual_rate,6)
  into v_entitlement,v_rate
  from public.leave_policy_rules r
  join public.leave_policy_versions p on p.id=r.policy_version_id
  where p.org_id=v_org
    and r.leave_kind='annual'
    and (
      (p.state='active' and r.complete)
      or r.routing_confirmed
    )
    and (p.effective_to is null or p.effective_to>=p_as_of)
  order by
    case when p.state='active' then 0 else 1 end,
    p.effective_from desc,
    p.version desc,
    p.created_at desc
  limit 1;

  v_entitlement:=coalesce(v_entitlement,24);
  v_rate:=coalesce(v_rate,6);
  v_year:=extract(year from p_as_of)::integer;
  v_year_start:=make_date(v_year,1,1);
  v_year_end:=make_date(v_year,12,31);

  if v_joined is null then
    return jsonb_build_object(
      'leave_year',v_year,
      'annual_entitlement',v_entitlement,
      'accrual_method','quarterly',
      'quarter_credit',v_rate,
      'carryover_method','none',
      'joined_on',null,
      'accrued_days',null,
      'approved_days',null,
      'adjustment_days',null,
      'available_days',null,
      'balance_available',false,
      'reason','join_date_not_recorded'
    );
  end if;

  v_service_start:=greatest(v_joined,v_year_start);

  for v_quarter in 0..3 loop
    v_q_start:=(v_year_start + make_interval(months=>v_quarter*3))::date;
    v_q_end:=(v_q_start + interval '3 months - 1 day')::date;

    if v_q_end<=p_as_of and v_service_start<=v_q_end then
      if v_service_start<=v_q_start then
        v_accrued:=v_accrued+v_rate;
      else
        -- "portion of the quarter served" is implemented literally as the
        -- calendar-day fraction from the join date through quarter end.
        -- The credited result remains working-day entitlement.
        v_proration_applied:=true;
        v_quarter_days:=(v_q_end-v_q_start)+1;
        v_served_days:=(v_q_end-v_service_start)+1;
        v_accrued:=v_accrued+round(v_rate*(v_served_days/v_quarter_days),2);
      end if;
    end if;
  end loop;

  for v_leave in
    select lr.start_date,lr.end_date
    from public.leave_requests lr
    where lr.org_id=v_org
      and lr.profile_id=v_profile
      and lower(lr.kind)='annual'
      and lr.status='approved'
      and lr.end_date>=v_year_start
      and lr.start_date<=v_year_end
  loop
    v_segment_working:=private.workforce_count_scheduled_working_days(
      v_profile,
      greatest(v_leave.start_date,v_year_start),
      least(v_leave.end_date,v_year_end)
    );
    if v_segment_working is null then
      v_schedule_complete:=false;
    else
      v_approved:=v_approved+v_segment_working;
    end if;
  end loop;

  select coalesce(sum(a.days),0)
  into v_adjustments
  from public.leave_balance_adjustments a
  where a.org_id=v_org
    and a.profile_id=v_profile
    and a.leave_year=v_year
    and a.leave_kind='annual';

  if v_schedule_complete then
    v_available:=v_accrued+v_adjustments-v_approved;
  end if;

  return jsonb_build_object(
    'leave_year',v_year,
    'annual_entitlement',v_entitlement,
    'accrual_method','quarterly',
    'quarter_credit',v_rate,
    'carryover_method','none',
    'joined_on',v_joined,
    'accrued_days',case when v_schedule_complete then round(v_accrued,2) else null end,
    'approved_days',case when v_schedule_complete then round(v_approved,2) else null end,
    'adjustment_days',round(v_adjustments,2),
    'available_days',case when v_schedule_complete then round(v_available,2) else null end,
    'balance_available',v_schedule_complete,
    'joiner_proration_applied',v_proration_applied,
    'proration_basis','calendar-day portion of the completed join quarter',
    'year_end_expiry',true
  );
end;
$$;

revoke all on function private.workforce_annual_leave_summary_impl(uuid,date)
  from public,anon;
grant execute on function private.workforce_annual_leave_summary_impl(uuid,date)
  to authenticated,service_role;

create or replace function public.workforce_annual_leave_summary(
  p_profile_id uuid default null,
  p_as_of date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
  select private.workforce_annual_leave_summary_impl(p_profile_id,p_as_of)
$$;

revoke all on function public.workforce_annual_leave_summary(uuid,date) from public,anon;
grant execute on function public.workforce_annual_leave_summary(uuid,date)
  to authenticated,service_role;

-- Recreate the request RPC so new annual requests retain the legacy date-span
-- field for compatibility and additionally record a schedule-based working-day
-- total when CEAC has enough schedule evidence.
create or replace function private.workforce_request_leave_impl(
  p_kind text,
  p_start_date date,
  p_end_date date,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_days numeric;
  v_working_days numeric;
  v_id uuid;
  v_kind text:=lower(btrim(coalesce(p_kind,'')));
  v_route text;
begin
  if v_actor is null then raise exception 'Sign in to request leave.' using errcode='42501'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then
    raise exception 'Choose a valid leave date range.';
  end if;
  if length(v_kind)<2 then raise exception 'Choose a leave kind.'; end if;
  if v_kind not in ('annual','sick','maternity','paternity','study') then
    raise exception 'That leave type is not confirmed for CEAC requests yet.';
  end if;

  select r.approval_route into v_route
  from public.leave_policy_versions p
  join public.leave_policy_rules r on r.policy_version_id=p.id
  where p.org_id=v_org
    and r.leave_kind=v_kind
    and (
      r.routing_confirmed
      or (p.state='active' and r.complete)
    )
    and (p.effective_to is null or p.effective_to>=current_date)
  order by
    case when p.state='active' then 0 else 1 end,
    p.effective_from desc,
    p.version desc,
    p.created_at desc
  limit 1;

  -- The owner-confirmed category route remains authoritative independently of
  -- unresolved secondary entitlement quantities.
  v_route:='manager_then_admin';

  v_days:=(p_end_date-p_start_date)+1;
  if v_kind='annual' then
    v_working_days:=private.workforce_count_scheduled_working_days(v_actor,p_start_date,p_end_date);
  end if;

  insert into public.leave_requests(
    org_id,profile_id,kind,start_date,end_date,days,working_days,working_days_basis,
    reason,status,requested_at
  ) values (
    v_org,v_actor,v_kind,p_start_date,p_end_date,v_days,v_working_days,
    case when v_working_days is not null then 'recorded_workforce_schedule' end,
    nullif(btrim(coalesce(p_reason,'')),''),'pending',now()
  )
  returning id into v_id;

  insert into public.leave_request_events(
    org_id,leave_request_id,profile_id,action,from_status,to_status,reason,actor_id
  ) values (
    v_org,v_id,v_actor,'requested',null,'pending',nullif(btrim(coalesce(p_reason,'')),''),v_actor
  );

  return v_id;
end;
$$;

revoke all on function private.workforce_request_leave_impl(text,date,date,text)
  from public,anon;
grant execute on function private.workforce_request_leave_impl(text,date,date,text)
  to authenticated,service_role;

create or replace function public.workforce_request_leave(
  p_kind text,
  p_start_date date,
  p_end_date date,
  p_reason text default null
)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.workforce_request_leave_impl(p_kind,p_start_date,p_end_date,p_reason)
$$;

revoke all on function public.workforce_request_leave(text,date,date,text) from public,anon;
grant execute on function public.workforce_request_leave(text,date,date,text)
  to authenticated,service_role;

-- Best-effort historical annual-leave enrichment. Rows with incomplete schedule
-- evidence remain null and are surfaced as unavailable rather than guessed.
update public.leave_requests lr
set working_days=private.workforce_count_scheduled_working_days(lr.profile_id,lr.start_date,lr.end_date),
    working_days_basis='recorded_workforce_schedule'
where lower(lr.kind)='annual'
  and lr.working_days is null
  and private.workforce_count_scheduled_working_days(lr.profile_id,lr.start_date,lr.end_date) is not null;

comment on column public.leave_requests.working_days is
  'Annual-leave working-day count derived from the attributable recorded workforce schedule; null means CEAC lacks sufficient schedule evidence.';

comment on table public.leave_balance_adjustments is
  'Append-only explicit annual-leave exceptions/corrections. No routine automatic carry-forward is created here.';


-- GO-LIVE LOCK: future policy writes must not weaken the confirmed annual rule.
-- Historical policy versions remain preserved; this controls new reviewed writes.
create or replace function public.workforce_record_leave_policy(
  p_name text,
  p_effective_from date,
  p_effective_to date,
  p_source_reference text,
  p_reason text,
  p_rules jsonb,
  p_activate boolean default false,
  p_supersedes_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_prior public.leave_policy_versions;
  v_key uuid;
  v_version integer;
  v_id uuid;
  v_rule jsonb;
  v_kind text;
  v_complete boolean;
  v_entitlement numeric;
  v_entitlement_unit text;
  v_accrual_method text;
  v_accrual_rate numeric;
  v_carryover_method text;
  v_carryover_limit numeric;
  v_approval_route text;
  v_opening_balance_required boolean;
begin
  if v_actor is null or not public.app_has_capability('workforce.manage',null) then
    raise exception 'You do not have authority to configure leave policy.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_name,'')))<3 or length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'Policy name and reason are required.';
  end if;
  if p_effective_from is null or (p_effective_to is not null and p_effective_to<p_effective_from) then
    raise exception 'Choose a valid policy date range.';
  end if;
  if jsonb_typeof(coalesce(p_rules,'[]'::jsonb))<>'array' then
    raise exception 'Policy rules must be a JSON array.';
  end if;
  if p_activate and jsonb_array_length(coalesce(p_rules,'[]'::jsonb))=0 then
    raise exception 'An active leave policy requires at least one complete confirmed rule.';
  end if;

  if p_supersedes_id is not null then
    select * into v_prior
    from public.leave_policy_versions
    where id=p_supersedes_id and org_id=v_org;
    if v_prior.id is null then raise exception 'Policy version being superseded was not found.'; end if;
    if exists(select 1 from public.leave_policy_versions where supersedes_id=v_prior.id) then
      raise exception 'That policy version has already been superseded.';
    end if;
    v_key:=v_prior.policy_key;
    v_version:=v_prior.version+1;
  else
    v_key:=gen_random_uuid();
    v_version:=1;
  end if;

  insert into public.leave_policy_versions(
    org_id,policy_key,version,name,effective_from,effective_to,state,supersedes_id,
    source_reference,reason,confirmed_by,confirmed_at,created_by
  ) values (
    v_org,v_key,v_version,btrim(p_name),p_effective_from,p_effective_to,
    'draft',p_supersedes_id,
    nullif(btrim(coalesce(p_source_reference,'')),''),btrim(p_reason),
    null,null,v_actor
  )
  returning id into v_id;

  for v_rule in select value from jsonb_array_elements(p_rules)
  loop
    v_kind:=lower(btrim(coalesce(v_rule->>'leave_kind','')));
    if length(v_kind)<2 then
      raise exception 'Every leave-policy rule needs a leave kind.';
    end if;

    v_entitlement:=nullif(v_rule->>'entitlement_amount','')::numeric;
    v_entitlement_unit:=nullif(v_rule->>'entitlement_unit','');
    v_accrual_method:=nullif(v_rule->>'accrual_method','');
    v_accrual_rate:=nullif(v_rule->>'accrual_rate','')::numeric;
    v_carryover_method:=nullif(v_rule->>'carryover_method','');
    v_carryover_limit:=nullif(v_rule->>'carryover_limit','')::numeric;
    v_approval_route:=nullif(v_rule->>'approval_route','');
    v_opening_balance_required:=coalesce((v_rule->>'opening_balance_required')::boolean,false);

    if v_kind='annual' and (
      nullif(btrim(coalesce(v_rule->>'employment_type','')),'') is not null
      or v_entitlement is distinct from 24::numeric
      or v_entitlement_unit is distinct from 'days'
      or v_accrual_method is distinct from 'quarterly'
      or v_accrual_rate is distinct from 6::numeric
      or v_carryover_method is distinct from 'none'
      or v_carryover_limit is not null
      or v_approval_route is distinct from 'manager_then_admin'
      or v_opening_balance_required
    ) then
      raise exception 'Annual leave is locked at 24 working days, 6 days per completed quarter, no routine carry-over, Manager then Administration approval.';
    end if;

    v_complete:=
      v_entitlement is not null
      and v_entitlement>=0
      and v_entitlement_unit is not null
      and v_accrual_method is not null
      and v_carryover_method is not null
      and v_approval_route is not null
      and (v_accrual_method not in ('monthly','quarterly') or v_accrual_rate is not null)
      and (v_carryover_method<>'limited' or v_carryover_limit is not null);

    insert into public.leave_policy_rules(
      org_id,policy_version_id,leave_kind,employment_type,
      entitlement_amount,entitlement_unit,accrual_method,accrual_rate,
      carryover_method,carryover_limit,approval_route,opening_balance_required,complete
    ) values (
      v_org,v_id,v_kind,nullif(btrim(coalesce(v_rule->>'employment_type','')),''),
      v_entitlement,v_entitlement_unit,v_accrual_method,v_accrual_rate,
      v_carryover_method,v_carryover_limit,v_approval_route,
      v_opening_balance_required,v_complete
    );
  end loop;

  if p_activate then
    if exists(
      select 1 from public.leave_policy_rules
      where policy_version_id=v_id and not complete
    ) then
      raise exception 'Only fully configured leave rules can be activated.';
    end if;

    if not exists(
      select 1
      from public.leave_policy_rules
      where policy_version_id=v_id
        and leave_kind='annual'
        and employment_type is null
        and entitlement_amount=24
        and entitlement_unit='days'
        and accrual_method='quarterly'
        and accrual_rate=6
        and carryover_method='none'
        and carryover_limit is null
        and approval_route='manager_then_admin'
        and not opening_balance_required
        and complete
    ) then
      raise exception 'An active CEAC leave policy must preserve the locked annual-leave rule.';
    end if;

    update public.leave_policy_versions
    set state='retired'
    where org_id=v_org and state='active';

    update public.leave_policy_versions
    set state='active',confirmed_by=v_actor,confirmed_at=now()
    where id=v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.workforce_record_leave_policy(text,date,date,text,text,jsonb,boolean,uuid) from public,anon;
grant execute on function public.workforce_record_leave_policy(text,date,date,text,text,jsonb,boolean,uuid)
to authenticated,service_role;
