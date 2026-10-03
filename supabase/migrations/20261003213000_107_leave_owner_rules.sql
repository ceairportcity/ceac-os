-- 107 — Owner-confirmed CEAC leave categories and routing.
-- Confirmed business rules:
--   annual, sick, maternity, paternity and study leave;
--   Manager review -> Administration final approval.
-- Entitlement quantities, accrual, carry-over, unpaid-leave behavior and detailed
-- maternity/paternity/study eligibility remain intentionally unconfigured.

alter table public.leave_policy_rules
  add column if not exists routing_confirmed boolean not null default false;

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='leave_policy_rules_routing_confirmed_check'
      and conrelid='public.leave_policy_rules'::regclass
  ) then
    alter table public.leave_policy_rules
      add constraint leave_policy_rules_routing_confirmed_check
      check(not routing_confirmed or approval_route is not null);
  end if;
end
$constraint$;

-- Persist the confirmed routing subset for existing organisations without
-- inventing entitlement mathematics. This remains a draft policy because the
-- numerical policy is not confirmed.
with admin_actor as (
  select distinct on (p.org_id)
    p.org_id,
    p.id actor_id
  from public.profiles p
  where p.active and p.is_admin
  order by p.org_id, p.is_exec asc, p.created_at, p.id
),
inserted_policy as (
  insert into public.leave_policy_versions(
    org_id,policy_key,version,name,effective_from,effective_to,state,
    source_reference,reason,confirmed_by,confirmed_at,created_by
  )
  select
    a.org_id,
    gen_random_uuid(),
    1,
    'CEAC owner-confirmed leave routing',
    date '2026-10-02',
    null,
    'draft',
    'CEAC_OWNER_LEAVE_ROUTING_2026-10-02',
    'Leave categories and Manager-to-Administration routing confirmed; entitlement mathematics remains unconfigured.',
    null,
    null,
    a.actor_id
  from admin_actor a
  where not exists (
    select 1
    from public.leave_policy_versions p
    where p.org_id=a.org_id
      and p.source_reference='CEAC_OWNER_LEAVE_ROUTING_2026-10-02'
  )
  returning id,org_id
)
insert into public.leave_policy_rules(
  org_id,policy_version_id,leave_kind,employment_type,
  entitlement_amount,entitlement_unit,accrual_method,accrual_rate,
  carryover_method,carryover_limit,approval_route,opening_balance_required,
  complete,routing_confirmed
)
select
  p.org_id,
  p.id,
  kinds.leave_kind,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  'manager_then_admin',
  false,
  false,
  true
from inserted_policy p
cross join (
  values
    ('annual'::text),
    ('sick'::text),
    ('maternity'::text),
    ('paternity'::text),
    ('study'::text)
) kinds(leave_kind);

create or replace function public.workforce_request_leave(
  p_kind text,
  p_start_date date,
  p_end_date date,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_days numeric;
  v_id uuid;
  v_kind text:=lower(btrim(coalesce(p_kind,'')));
  v_route text;
begin
  if v_actor is null then raise exception 'Sign in to request leave.' using errcode='42501'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then
    raise exception 'Choose a valid leave date range.';
  end if;
  if length(v_kind)<2 then raise exception 'Choose a leave kind.'; end if;

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

  if v_route is null then
    raise exception 'That leave type is not configured for CEAC requests yet.';
  end if;

  v_days:=(p_end_date-p_start_date)+1;

  insert into public.leave_requests(
    org_id,profile_id,kind,start_date,end_date,days,reason,status,requested_at
  ) values (
    v_org,v_actor,v_kind,p_start_date,p_end_date,v_days,
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

revoke all on function public.workforce_request_leave(text,date,date,text) from public,anon;
grant execute on function public.workforce_request_leave(text,date,date,text)
to authenticated,service_role;

create or replace function public.workforce_leave_action(
  p_leave_request_id uuid,
  p_action text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_request public.leave_requests;
  v_record public.employment_records;
  v_from text;
  v_to text;
  v_allowed boolean:=false;
  v_route text;
begin
  if v_actor is null then raise exception 'Sign in to update leave.' using errcode='42501'; end if;
  if p_action not in ('manager_approved','escalated','admin_approved','declined','cancelled_by_employee','approval_reversed','decision_corrected') then
    raise exception 'Choose a supported leave action.';
  end if;
  if p_action<>'cancelled_by_employee' and length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'A reason is required.';
  end if;

  select * into v_request
  from public.leave_requests
  where id=p_leave_request_id and org_id=v_org
  for update;
  if v_request.id is null then raise exception 'Leave request not found.' using errcode='42501'; end if;

  select * into v_record
  from public.employment_records
  where profile_id=v_request.profile_id and org_id=v_org;

  select r.approval_route into v_route
  from public.leave_policy_versions p
  join public.leave_policy_rules r on r.policy_version_id=p.id
  where p.org_id=v_org
    and r.leave_kind=v_request.kind
    and (r.employment_type is null or r.employment_type=v_record.employment_type)
    and (
      r.routing_confirmed
      or (p.state='active' and r.complete)
    )
    and (p.effective_to is null or p.effective_to>=current_date)
  order by
    case when p.state='active' then 0 else 1 end,
    case when r.employment_type=v_record.employment_type then 0 else 1 end,
    p.effective_from desc,
    p.version desc,
    p.created_at desc
  limit 1;

  v_from:=v_request.status;

  if p_action='cancelled_by_employee' then
    v_allowed:=v_actor=v_request.profile_id and v_from in ('pending','escalated');
    v_to:='cancelled';
  else
    if v_route is null then
      raise exception 'Leave routing is not configured for this leave type.'
        using errcode='42501';
    end if;

    if p_action='manager_approved' then
      v_allowed:=(
        public.app_has_capability('workforce.manage',null)
        or (v_record.unit_id is not null and v_record.unit_id in (select public.app_managed_units()))
      )
      and v_from='pending'
      and v_route='manager';
      v_to:='approved';

    elsif p_action='escalated' then
      v_allowed:=(
        public.app_has_capability('workforce.manage',null)
        or (v_record.unit_id is not null and v_record.unit_id in (select public.app_managed_units()))
      )
      and v_from='pending'
      and v_route='manager_then_admin';
      v_to:='escalated';

    elsif p_action='admin_approved' then
      v_allowed:=public.app_has_capability('workforce.manage',null)
        and (
          (v_route='admin' and v_from='pending')
          or (v_route='manager_then_admin' and v_from='escalated')
        );
      v_to:='approved';

    elsif p_action='declined' then
      v_allowed:=(
        public.app_has_capability('workforce.manage',null)
        or (v_record.unit_id is not null and v_record.unit_id in (select public.app_managed_units()))
      )
      and v_from in ('pending','escalated');
      v_to:='declined';

    elsif p_action='approval_reversed' then
      v_allowed:=public.app_has_capability('workforce.manage',null) and v_from='approved';
      v_to:='pending';

    elsif p_action='decision_corrected' then
      v_allowed:=public.app_has_capability('workforce.manage',null)
        and v_from in ('approved','declined','cancelled');
      v_to:=v_from;
    end if;
  end if;

  if not v_allowed then
    raise exception 'That leave action is not permitted from the current state or approval route.'
      using errcode='42501';
  end if;

  update public.leave_requests
  set status=v_to,
      decided_by=case when p_action='cancelled_by_employee' then decided_by else v_actor end,
      decided_at=case when p_action='cancelled_by_employee' then decided_at else now() end,
      decision_note=case when p_action='cancelled_by_employee' then decision_note else btrim(p_reason) end
  where id=v_request.id;

  insert into public.leave_request_events(
    org_id,leave_request_id,profile_id,action,from_status,to_status,reason,actor_id
  ) values (
    v_org,v_request.id,v_request.profile_id,p_action,v_from,v_to,
    nullif(btrim(coalesce(p_reason,'')),''),v_actor
  );
end;
$$;

revoke all on function public.workforce_leave_action(uuid,text,text) from public,anon;
grant execute on function public.workforce_leave_action(uuid,text,text)
to authenticated,service_role;

comment on column public.leave_policy_rules.routing_confirmed is
  'True only when the leave approval route is owner-confirmed independently of unresolved entitlement mathematics.';
