\set ON_ERROR_STOP on

begin;

-- An empty historical migration replay has no production organisation or
-- existing owner-routing record. Create a confirmed synthetic owner policy
-- THROUGH the same authorised RPC inside this transaction. The fixture is
-- rolled back at the end; it never seeds production or weakens access checks.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
do $annual_owner_fixture$
declare v_policy uuid;
begin
  v_policy:=public.workforce_record_leave_policy(
    'CEAC annual leave owner lock fixture',
    date '2026-01-01',date '2026-12-31',
    'CEAC_OWNER_LEAVE_ROUTING_2026-10-02',
    'Exercise approved owner lock on clean replay',
    jsonb_build_array(jsonb_build_object(
      'leave_kind','annual',
      'entitlement_amount',24,
      'entitlement_unit','days',
      'accrual_method','quarterly',
      'accrual_rate',6,
      'carryover_method','none',
      'approval_route','manager_then_admin',
      'opening_balance_required',false
    )),
    true,null
  );
  if v_policy is null then
    raise exception 'Annual-leave owner fixture was not activated.';
  end if;
end
$annual_owner_fixture$;
reset role;

-- Migration 107 already seeded routing_confirmed for organisations existing at
-- that historical point. This synthetic organisation was created AFTER the
-- replay, so simulate that prerequisite explicitly, within this rollback-only
-- test transaction. The next assertions still require the exact 24/6 policy.
update public.leave_policy_rules r
set routing_confirmed=true
from public.leave_policy_versions p
where r.policy_version_id=p.id
  and p.org_id='10000000-0000-4000-8000-000000000010'
  and p.source_reference='CEAC_OWNER_LEAVE_ROUTING_2026-10-02'
  and r.leave_kind='annual'
  and r.complete
  and r.approval_route='manager_then_admin';

do $annual_policy_shape$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.leave_policy_rules r
  join public.leave_policy_versions p on p.id=r.policy_version_id
  where p.source_reference='CEAC_OWNER_LEAVE_ROUTING_2026-10-02'
    and r.leave_kind='annual'
    and r.entitlement_amount=24
    and r.entitlement_unit='days'
    and r.accrual_method='quarterly'
    and r.accrual_rate=6
    and r.carryover_method='none'
    and r.carryover_limit is null
    and not r.opening_balance_required
    and r.complete
    and r.routing_confirmed
    and r.approval_route='manager_then_admin';

  if v_count<>1 then
    raise exception 'Annual-leave gate failure: the 24-day / 6-day-quarter owner rule is not recorded exactly once.';
  end if;

  if not exists(
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='leave_balance_adjustments'
      and c.relrowsecurity
  ) then
    raise exception 'Annual-leave gate failure: exception/carry-over adjustment table is missing RLS.';
  end if;

  if has_table_privilege('anon','public.leave_balance_adjustments','SELECT')
     or has_table_privilege('authenticated','public.leave_balance_adjustments','INSERT')
     or has_table_privilege('authenticated','public.leave_balance_adjustments','UPDATE')
     or has_table_privilege('authenticated','public.leave_balance_adjustments','DELETE') then
    raise exception 'Annual-leave gate failure: adjustment-table privileges exceed the reviewed surface.';
  end if;
end
$annual_policy_shape$;

do $annual_rpc_boundary$
declare
  v_request_definer boolean;
  v_summary_definer boolean;
  v_adjustment_definer boolean;
begin
  select p.prosecdef into v_request_definer
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='workforce_request_leave'
    and pg_get_function_identity_arguments(p.oid)='p_kind text, p_start_date date, p_end_date date, p_reason text';

  select p.prosecdef into v_summary_definer
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='workforce_annual_leave_summary'
    and pg_get_function_identity_arguments(p.oid)='p_profile_id uuid, p_as_of date';

  select p.prosecdef into v_adjustment_definer
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='workforce_record_annual_leave_adjustment'
    and pg_get_function_identity_arguments(p.oid)='p_profile_id uuid, p_leave_year integer, p_days numeric, p_adjustment_type text, p_reason text, p_source_reference text, p_reverses_id uuid';

  if coalesce(v_request_definer,true)
     or coalesce(v_summary_definer,true)
     or coalesce(v_adjustment_definer,true) then
    raise exception 'Annual-leave gate failure: a browser-facing annual-leave RPC is SECURITY DEFINER.';
  end if;

  if has_function_privilege('anon','private.workforce_request_leave_impl(text,date,date,text)','EXECUTE')
     or has_function_privilege('anon','private.workforce_annual_leave_summary_impl(uuid,date)','EXECUTE')
     or has_function_privilege('anon','private.workforce_record_annual_leave_adjustment_impl(uuid,integer,numeric,text,text,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.workforce_count_scheduled_working_days(uuid,date,date)','EXECUTE') then
    raise exception 'Annual-leave gate failure: privileged private implementation/helper grants are too broad.';
  end if;

  if not has_function_privilege('authenticated','public.workforce_request_leave(text,date,date,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.workforce_annual_leave_summary(uuid,date)','EXECUTE')
     or not has_function_privilege('authenticated','public.workforce_record_annual_leave_adjustment(uuid,integer,numeric,text,text,text,uuid)','EXECUTE') then
    raise exception 'Annual-leave gate failure: required authenticated invoker RPC grant is missing.';
  end if;
end
$annual_rpc_boundary$;

-- Give the Staff acceptance fixture an attributable full-year schedule so a
-- working-day leave count can be tested without assuming Monday-Friday in code.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $annual_schedule_fixture$
declare
  v_work uuid;
  v_rest uuid;
  v_pattern uuid;
begin
  v_work:=public.workforce_record_day_type(
    null,
    'Annual leave gate work day',
    'Acceptance working day for annual leave calculations',
    true,
    true,
    true
  );
  v_rest:=public.workforce_record_day_type(
    null,
    'Annual leave gate rest day',
    'Acceptance non-working day for annual leave calculations',
    false,
    true,
    true
  );

  v_pattern:=public.workforce_record_pattern(
    '31000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000011',
    date '2026-01-01',
    date '2026-12-31',
    jsonb_build_object(
      'mon',v_work::text,
      'tue',v_work::text,
      'wed',v_work::text,
      'thu',v_work::text,
      'fri',v_work::text,
      'sat',v_rest::text,
      'sun',v_rest::text
    ),
    '{}'::jsonb,
    'Annual leave go-live acceptance pattern',
    null
  );

  if v_pattern is null then
    raise exception 'Annual-leave gate failure: workforce pattern fixture was not recorded.';
  end if;
end
$annual_schedule_fixture$;

reset role;

-- Fix the fixture join date within this rolled-back transaction.
update public.employment_records
set joined_on=date '2026-01-01'
where profile_id='31000000-0000-4000-8000-000000000001';

update public.profiles
set started_on=date '2026-01-01',
    joined_at=date '2026-01-01'
where id='31000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $annual_staff_request$
declare
  v_leave uuid;
  v_summary jsonb;
begin
  v_summary:=public.workforce_annual_leave_summary(
    '31000000-0000-4000-8000-000000000001',
    date '2026-10-07'
  );

  if (v_summary->>'annual_entitlement')::numeric<>24
     or (v_summary->>'quarter_credit')::numeric<>6
     or (v_summary->>'accrued_days')::numeric<>18
     or v_summary->>'accrual_method'<>'quarterly'
     or v_summary->>'carryover_method'<>'none'
     or coalesce((v_summary->>'balance_available')::boolean,false) is not true then
    raise exception 'Annual-leave gate failure: full-service quarterly accrual summary is incorrect: %',v_summary;
  end if;

  perform set_config('ceac.annual_before_approved',coalesce(v_summary->>'approved_days','0'),true);
  perform set_config('ceac.annual_before_available',coalesce(v_summary->>'available_days','0'),true);

  v_leave:=public.workforce_request_leave(
    'annual',
    date '2026-08-03',
    date '2026-08-07',
    'Annual leave go-live gate request'
  );

  if not exists(
    select 1
    from public.leave_requests
    where id=v_leave
      and days=5
      and working_days=5
      and working_days_basis='recorded_workforce_schedule'
      and status='pending'
  ) then
    raise exception 'Annual-leave gate failure: annual request did not persist a five-working-day schedule count.';
  end if;

  perform set_config('ceac.annual_leave_id',v_leave::text,true);
end
$annual_staff_request$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);

do $annual_manager_approval$
declare
  v_leave uuid:=nullif(current_setting('ceac.annual_leave_id',true),'')::uuid;
begin
  perform public.workforce_leave_action(
    v_leave,
    'manager_approved',
    'Manager approval for annual-leave go-live gate'
  );

  if not exists(select 1 from public.leave_requests where id=v_leave and status='escalated') then
    raise exception 'Annual-leave gate failure: Manager approval did not escalate to Administration.';
  end if;
end
$annual_manager_approval$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $annual_admin_approval_and_adjustment$
declare
  v_leave uuid:=nullif(current_setting('ceac.annual_leave_id',true),'')::uuid;
  v_before_approved numeric:=coalesce(nullif(current_setting('ceac.annual_before_approved',true),''),'0')::numeric;
  v_before_available numeric:=coalesce(nullif(current_setting('ceac.annual_before_available',true),''),'0')::numeric;
  v_summary jsonb;
  v_adjustment uuid;
  v_adjusted jsonb;
  v_reversed jsonb;
begin
  perform public.workforce_leave_action(
    v_leave,
    'admin_approved',
    'Administration final approval for annual-leave go-live gate'
  );

  v_summary:=public.workforce_annual_leave_summary(
    '31000000-0000-4000-8000-000000000001',
    date '2026-10-07'
  );

  if (v_summary->>'approved_days')::numeric<>v_before_approved+5
     or (v_summary->>'available_days')::numeric<>v_before_available-5 then
    raise exception 'Annual-leave gate failure: approved working days did not reduce available balance by five: %',v_summary;
  end if;

  v_adjustment:=public.workforce_record_annual_leave_adjustment(
    '31000000-0000-4000-8000-000000000001',
    2026,
    2,
    'protected_carryover',
    'Acceptance protected carry-over exception',
    'ANNUAL_LEAVE_GATE',
    null
  );

  v_adjusted:=public.workforce_annual_leave_summary(
    '31000000-0000-4000-8000-000000000001',
    date '2026-10-07'
  );

  if (v_adjusted->>'available_days')::numeric<>(v_summary->>'available_days')::numeric+2 then
    raise exception 'Annual-leave gate failure: explicit protected exception did not add two days.';
  end if;

  perform public.workforce_record_annual_leave_adjustment(
    '31000000-0000-4000-8000-000000000001',
    2026,
    -2,
    'reversal',
    'Acceptance reversal of protected carry-over exception',
    'ANNUAL_LEAVE_GATE_REVERSAL',
    v_adjustment
  );

  v_reversed:=public.workforce_annual_leave_summary(
    '31000000-0000-4000-8000-000000000001',
    date '2026-10-07'
  );

  if (v_reversed->>'available_days')::numeric<>(v_summary->>'available_days')::numeric then
    raise exception 'Annual-leave gate failure: adjustment reversal did not restore the prior balance.';
  end if;
end
$annual_admin_approval_and_adjustment$;

reset role;

-- A mid-quarter joiner earns only the served portion once that quarter completes.
update public.employment_records
set joined_on=date '2026-02-15'
where profile_id='31000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $annual_joiner_proration$
declare
  v_summary jsonb;
begin
  v_summary:=public.workforce_annual_leave_summary(
    '31000000-0000-4000-8000-000000000001',
    date '2026-03-31'
  );

  if (v_summary->>'accrued_days')::numeric<>3
     or coalesce((v_summary->>'joiner_proration_applied')::boolean,false) is not true
     or v_summary->>'proration_basis'<>'calendar-day portion of the completed join quarter' then
    raise exception 'Annual-leave gate failure: mid-quarter joiner pro-rating is incorrect: %',v_summary;
  end if;
end
$annual_joiner_proration$;

-- Staff cannot create their own protected carry-over/correction.
do $annual_staff_adjustment_denial$
begin
  begin
    perform public.workforce_record_annual_leave_adjustment(
      '31000000-0000-4000-8000-000000000001',
      2026,
      10,
      'correction',
      'Staff self-adjustment denial probe',
      'ANNUAL_LEAVE_GATE_DENIAL',
      null
    );
    raise exception 'Annual-leave gate failure: Staff created an annual-leave balance adjustment.';
  exception when insufficient_privilege then null;
  end;
end
$annual_staff_adjustment_denial$;

reset role;

rollback;

select 'CEAC OS go-live annual-leave policy gate passed' as result;
