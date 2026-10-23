-- Owner correction, 23 October 2026: 15 annual + ONE shared 9-day allowance.
-- Both accrue gradually using the retained completed-quarter/joiner rules:
-- 3.75 annual + 2.25 shared = 6 total per completed full quarter.
-- Shared membership confirmed here: sick and study. Do not infer a 9-day cap
-- for maternity/paternity or other protected entitlements.
-- Additive code only. No policy is activated, no history/request is rewritten,
-- no impersonated user, no automatic approval, deduction or payroll write.
-- Activation must use the existing authorised, attributable HR workflow.

CREATE OR REPLACE FUNCTION private.workforce_leave_pool_summary_impl(p_profile_id uuid, p_as_of date, p_pool text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_entitlement numeric;
  v_rate numeric;
  v_policy_id uuid;
  v_annual_rate numeric:=0;
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
  if p_pool is null or p_pool not in ('annual','shared_other') then
    raise exception 'Choose an existing leave balance.';
  end if;
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
    r.entitlement_amount,
    r.accrual_rate,r.policy_version_id
  into v_entitlement,v_rate,v_policy_id
  from public.leave_policy_rules r
  join public.leave_policy_versions p on p.id=r.policy_version_id
  where p.org_id=v_org
    and r.leave_kind=p_pool
    and p.state='active' and r.complete
    and p.effective_from<=p_as_of
    and (p.effective_to is null or p.effective_to>=p_as_of)
    and r.entitlement_amount is not null and r.accrual_rate is not null
  order by
    case when p.state='active' then 0 else 1 end,
    p.effective_from desc,
    p.version desc,
    p.created_at desc
  limit 1;

  -- A draft, routing-only or missing pool rule cannot issue a balance.
  if v_entitlement is null or v_rate is null then
    return jsonb_build_object(
      'leave_year',extract(year from p_as_of)::integer,
      'entitlement_days',null,'quarter_credit',null,
      'accrual_method',null,'carryover_method',null,'joined_on',v_joined,
      'accrued_days',null,'approved_days',null,'adjustment_days',null,
      'available_days',null,'balance_available',false,
      'reason',case when p_pool='annual' then 'annual_leave_policy_not_active' else 'shared_leave_policy_not_active' end
    );
  end if;
  v_year:=extract(year from p_as_of)::integer;
  v_year_start:=make_date(v_year,1,1);
  v_year_end:=make_date(v_year,12,31);

  if v_joined is null then
    return jsonb_build_object(
      'leave_year',v_year,
      'entitlement_days',v_entitlement,
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

  if p_pool='shared_other' then
    select coalesce(r.accrual_rate,0) into v_annual_rate
    from public.leave_policy_rules r
    where r.policy_version_id=v_policy_id and r.leave_kind='annual' and r.complete;
    v_annual_rate:=coalesce(v_annual_rate,0);
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
        -- Allocate rounding remainder to the shared pool so both pool credits
        -- sum to the original six-day quarter's pro-rated total.
        v_accrued:=v_accrued
          +round((v_rate+v_annual_rate)*(v_served_days/v_quarter_days),2)
          -round(v_annual_rate*(v_served_days/v_quarter_days),2);
      end if;
    end if;
  end loop;

  for v_leave in
    select lr.start_date,lr.end_date
    from public.leave_requests lr
    where lr.org_id=v_org
      and lr.profile_id=v_profile
      and ((p_pool='annual' and lower(lr.kind)='annual')
        or (p_pool='shared_other' and lower(lr.kind) in ('sick','study')))
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
    and a.leave_kind=p_pool;

  if v_schedule_complete then
    v_available:=v_accrued+v_adjustments-v_approved;
  end if;

  return jsonb_build_object(
    'leave_year',v_year,
    'entitlement_days',v_entitlement,
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
$function$;

-- Keep the existing browser RPC and its visibility checks. The two balances are
-- calculated independently from approved requests, not mutable taken counters.
CREATE OR REPLACE FUNCTION private.workforce_annual_leave_summary_impl(
 p_profile_id uuid DEFAULT NULL, p_as_of date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_annual jsonb; v_shared jsonb;
BEGIN
 v_annual:=private.workforce_leave_pool_summary_impl(p_profile_id,p_as_of,'annual');
 v_shared:=private.workforce_leave_pool_summary_impl(p_profile_id,p_as_of,'shared_other');
 RETURN (v_annual-'entitlement_days') || jsonb_build_object(
  'annual_entitlement',v_annual->'entitlement_days',
  'shared_other',v_shared || jsonb_build_object('covered_kinds',jsonb_build_array('sick','study')),
  'combined_entitlement',CASE WHEN v_annual->>'entitlement_days' IS NOT NULL
    AND v_shared->>'entitlement_days' IS NOT NULL
    THEN (v_annual->>'entitlement_days')::numeric+(v_shared->>'entitlement_days')::numeric END
 );
END; $$;
REVOKE ALL ON FUNCTION private.workforce_leave_pool_summary_impl(uuid,date,text) FROM public,anon,authenticated,service_role;
-- Only the existing guarded private entry point calls the internal helper.
REVOKE ALL ON FUNCTION private.workforce_annual_leave_summary_impl(uuid,date) FROM public,anon;
GRANT EXECUTE ON FUNCTION private.workforce_annual_leave_summary_impl(uuid,date) TO authenticated,service_role;

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
  if v_kind in ('annual','sick','study') then
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
      or v_entitlement is distinct from 15::numeric
      or v_entitlement_unit is distinct from 'days'
      or v_accrual_method is distinct from 'quarterly'
      or v_accrual_rate is distinct from 3.75::numeric
      or v_carryover_method is distinct from 'none'
      or v_carryover_limit is not null
      or v_approval_route is distinct from 'manager_then_admin'
      or v_opening_balance_required
    ) then
      raise exception 'Annual leave is 15 working days, 3.75 per completed quarter, no routine carry-over, Manager then Administration approval.';
    end if;

    -- Sick and study consume ONE shared allowance, not nine days each.
    -- Maternity/paternity are not silently capped by this owner clarification.
    if v_kind in ('sick','study') then
      raise exception 'Sick and study use the shared_other policy rule; do not give them separate allowances.';
    end if;
    if v_kind='shared_other' and (
      nullif(btrim(coalesce(v_rule->>'employment_type','')),'') is not null
      or v_entitlement is distinct from 9::numeric
      or v_entitlement_unit is distinct from 'days'
      or v_accrual_method is distinct from 'quarterly'
      or v_accrual_rate is distinct from 2.25::numeric
      or v_carryover_method is distinct from 'none'
      or v_carryover_limit is not null
      or v_approval_route is distinct from 'manager_then_admin'
      or v_opening_balance_required
    ) then
      raise exception 'Sick and study share 9 working days, 2.25 per completed quarter, no routine carry-over, Manager then Administration approval.';
    end if;
    if exists(select 1 from public.leave_policy_rules where policy_version_id=v_id and leave_kind=v_kind
       and employment_type is not distinct from nullif(btrim(coalesce(v_rule->>'employment_type','')),'')) then
      raise exception 'A policy must not contain duplicate leave rules.';
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
        and entitlement_amount=15
        and entitlement_unit='days'
        and accrual_method='quarterly'
        and accrual_rate=3.75
        and carryover_method='none'
        and carryover_limit is null
        and approval_route='manager_then_admin'
        and not opening_balance_required
        and complete
    ) then
      raise exception 'An active CEAC leave policy must preserve the locked annual-leave rule.';
    end if;

    if not exists(select 1 from public.leave_policy_rules where policy_version_id=v_id
      and leave_kind='shared_other' and employment_type is null
      and entitlement_amount=9 and entitlement_unit='days'
      and accrual_method='quarterly' and accrual_rate=2.25
      and carryover_method='none' and carryover_limit is null
      and approval_route='manager_then_admin' and not opening_balance_required and complete) then
      raise exception 'An active policy must include the single shared 9-day sick/study allowance.';
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
