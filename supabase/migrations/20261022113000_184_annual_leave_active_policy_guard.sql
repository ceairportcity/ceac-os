-- Stage 2: Fail closed when no active, complete, in-period annual leave policy exists.
-- An owner-described 24/6 process is NOT an enacted calculation policy.
-- Preserve existing invoker checks, subject-scoping, historical data and RPC signature.
CREATE OR REPLACE FUNCTION private.workforce_annual_leave_summary_impl(p_profile_id uuid DEFAULT NULL::uuid, p_as_of date DEFAULT CURRENT_DATE)
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
    r.entitlement_amount,
    r.accrual_rate
  into v_entitlement,v_rate
  from public.leave_policy_rules r
  join public.leave_policy_versions p on p.id=r.policy_version_id
  where p.org_id=v_org
    and r.leave_kind='annual'
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

  -- No draft, routing-only or hardcoded 24/6 fallback can issue a balance.
  if v_entitlement is null or v_rate is null then
    return jsonb_build_object(
      'leave_year',extract(year from p_as_of)::integer,
      'annual_entitlement',null,'quarter_credit',null,
      'accrual_method',null,'carryover_method',null,'joined_on',v_joined,
      'accrued_days',null,'approved_days',null,'adjustment_days',null,
      'available_days',null,'balance_available',false,
      'reason','annual_leave_policy_not_active'
    );
  end if;
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
$function$;
COMMENT ON FUNCTION private.workforce_annual_leave_summary_impl(uuid,date)
 IS 'Annual leave summary requires an effective active complete annual rule. Unconfigured policies return no balance. HR and employee visibility checks remain enforced.';
