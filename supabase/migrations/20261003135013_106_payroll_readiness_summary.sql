-- 106 — ERC6: Payroll readiness summary for Administration and Executive.
-- Returns configuration completeness without exposing salary or bank values.

create or replace function public.payroll_readiness_summary()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_result jsonb;
begin
  if v_actor is null or not (
    public.app_has_capability('payroll.prepare',null)
    or public.app_has_capability('payroll.approve',null)
  ) then
    raise exception 'You do not have authority to view Payroll readiness.' using errcode='42501';
  end if;

  with employees as (
    select
      er.id,
      er.profile_id,
      er.full_name,
      er.identity_state,
      exists(
        select 1
        from hr_private.compensation_history ch
        where ch.org_id=v_org
          and ch.status='active'
          and (
            ch.employee_id=er.id
            or (ch.employee_id is null and er.profile_id is not null and ch.profile_id=er.profile_id)
          )
      ) as has_compensation,
      exists(
        select 1
        from hr_private.payment_details pd
        where pd.org_id=v_org
          and pd.status='active'
          and (
            pd.employee_id=er.id
            or (pd.employee_id is null and er.profile_id is not null and pd.profile_id=er.profile_id)
          )
      ) as has_payment
    from public.employee_roster er
    where er.org_id=v_org and er.employment_status='active'
  )
  select jsonb_build_object(
    'employee_count',count(*)::int,
    'linked_count',count(*) filter(where profile_id is not null)::int,
    'roster_only_count',count(*) filter(where identity_state='roster_only')::int,
    'identity_review_count',count(*) filter(where identity_state='needs_review')::int,
    'compensation_recorded_count',count(*) filter(where has_compensation)::int,
    'compensation_missing_count',count(*) filter(where not has_compensation)::int,
    'payment_recorded_count',count(*) filter(where has_payment)::int,
    'payment_missing_count',count(*) filter(where not has_payment)::int,
    'employees',coalesce(jsonb_agg(jsonb_build_object(
      'employee_id',id,
      'employee_name',full_name,
      'identity_state',identity_state,
      'has_compensation',has_compensation,
      'has_payment',has_payment
    ) order by full_name),'[]'::jsonb)
  )
  into v_result
  from employees;

  insert into hr_private.audit_events(
    org_id,actor_id,action,resource_type,detail
  ) values (
    v_org,v_actor,'payroll_readiness_viewed','payroll',
    jsonb_build_object('surface','payroll_readiness')
  );

  return coalesce(v_result,jsonb_build_object(
    'employee_count',0,
    'linked_count',0,
    'roster_only_count',0,
    'identity_review_count',0,
    'compensation_recorded_count',0,
    'compensation_missing_count',0,
    'payment_recorded_count',0,
    'payment_missing_count',0,
    'employees','[]'::jsonb
  ));
end;
$$;

revoke all on function public.payroll_readiness_summary() from public,anon;
grant execute on function public.payroll_readiness_summary() to authenticated,service_role;
