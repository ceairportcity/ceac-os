\set ON_ERROR_STOP on

begin;

do $stage9_tables$
declare n integer;
begin
  select count(*) into n
  from pg_class c
  join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='public'
    and c.relname in (
      'workforce_day_types',
      'workforce_schedule_versions',
      'attendance_corrections',
      'leave_request_events',
      'leave_policy_versions',
      'leave_policy_rules'
    )
    and c.relkind='r'
    and c.relrowsecurity;

  if n<>6 then
    raise exception 'Stage 9 gate failure: expected 6 Stage 9 RLS tables, found %.',n;
  end if;

  if not exists(select 1 from public.capability_definitions where capability='workforce.manage') then
    raise exception 'Stage 9 gate failure: workforce.manage capability is missing.';
  end if;
end
$stage9_tables$;

do $stage9_privileges$
begin
  if has_table_privilege('anon','public.workforce_day_types','SELECT')
     or has_table_privilege('anon','public.workforce_schedule_versions','SELECT')
     or has_table_privilege('anon','public.attendance_corrections','SELECT')
     or has_table_privilege('anon','public.leave_request_events','SELECT')
     or has_table_privilege('anon','public.leave_policy_versions','SELECT')
     or has_table_privilege('anon','public.leave_policy_rules','SELECT') then
    raise exception 'Stage 9 gate failure: anon can read workforce tables.';
  end if;

  if has_table_privilege('authenticated','public.attendance_corrections','INSERT')
     or has_table_privilege('authenticated','public.leave_request_events','INSERT')
     or has_table_privilege('authenticated','public.leave_requests','UPDATE') then
    raise exception 'Stage 9 gate failure: browser can bypass reviewed workforce actions.';
  end if;
end
$stage9_privileges$;

-- Baseline Administration must receive explicit workforce authority.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $stage9_admin_authority$
begin
  if not public.app_has_capability('workforce.manage',null)
     or not public.app_has_capability('attendance.correct',null) then
    raise exception 'Stage 9 gate failure: Admin fixture lacks explicit workforce/attendance authority.';
  end if;
end
$stage9_admin_authority$;

do $stage9_day_schedule$
declare
  v_day uuid;
  v_schedule uuid;
  v_schedule2 uuid;
begin
  v_day:=public.workforce_record_day_type(
    null,'Stage 9 working day','Acceptance working day',true,true,true
  );

  if v_day is null then
    raise exception 'Stage 9 gate failure: day type was not created.';
  end if;

  v_schedule:=public.workforce_record_schedule(
    '31000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000011',
    current_date,current_date+30,'person',
    jsonb_build_object('mon',v_day::text,'tue',v_day::text),
    '09:00'::time,'17:00'::time,
    'Stage 9 acceptance schedule',null
  );

  v_schedule2:=public.workforce_record_schedule(
    '31000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000011',
    current_date,current_date+30,'person',
    jsonb_build_object('mon',v_day::text,'tue',v_day::text),
    '08:30'::time,'17:00'::time,
    'Stage 9 acceptance schedule correction',v_schedule
  );

  if not exists(
    select 1 from public.workforce_schedule_versions
    where id=v_schedule2 and supersedes_id=v_schedule and version=2
  ) then
    raise exception 'Stage 9 gate failure: schedule history was not preserved.';
  end if;

  perform set_config('ceac.stage9_schedule_id',v_schedule2::text,true);
end
$stage9_day_schedule$;

reset role;

-- Owner-confirmed routing can exist before entitlement mathematics is configured.
-- Seed the confirmed annual route for the clean acceptance database. It remains
-- draft/incomplete, so no entitlement amount, accrual or carry-over is implied.
do $stage9_owner_routing$
declare
  v_policy uuid:=gen_random_uuid();
begin
  insert into public.leave_policy_versions(
    id,org_id,policy_key,version,name,effective_from,state,
    source_reference,reason,created_by
  ) values (
    v_policy,
    '10000000-0000-4000-8000-000000000010',
    gen_random_uuid(),
    1,
    'Owner-confirmed acceptance routing',
    current_date,
    'draft',
    'STAGE9_OWNER_ROUTING_FIXTURE',
    'Acceptance fixture for confirmed Manager-to-Administration routing without entitlement mathematics.',
    '31000000-0000-4000-8000-000000000003'
  );

  insert into public.leave_policy_rules(
    org_id,policy_version_id,leave_kind,employment_type,
    entitlement_amount,entitlement_unit,accrual_method,accrual_rate,
    carryover_method,carryover_limit,approval_route,opening_balance_required,
    complete,routing_confirmed
  )
  select
    '10000000-0000-4000-8000-000000000010',
    v_policy,
    k.leave_kind,
    null,
    null,null,null,null,null,null,
    'manager_then_admin',
    false,
    false,
    true
  from (values
    ('annual'::text),
    ('sick'::text),
    ('maternity'::text),
    ('paternity'::text),
    ('study'::text)
  ) k(leave_kind);

  if (
    select count(*)
    from public.leave_policy_rules
    where policy_version_id=v_policy and routing_confirmed
  )<>5 then
    raise exception 'Stage 9 gate failure: owner-confirmed leave-category set is incomplete.';
  end if;
end
$stage9_owner_routing$;

-- Staff can request leave with confirmed routing while entitlement/balance remains unconfigured.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $stage9_staff_leave$
declare
  v_leave uuid;
  n integer;
begin
  v_leave:=public.workforce_request_leave(
    'annual',current_date+10,current_date+12,'Stage 9 acceptance leave request'
  );

  if v_leave is null then
    raise exception 'Stage 9 gate failure: staff leave request failed with confirmed routing.';
  end if;

  begin
    perform public.workforce_request_leave(
      'other',current_date+30,current_date+30,'Unconfirmed leave type probe'
    );
    raise exception 'Stage 9 gate failure: an unconfirmed leave type was accepted.';
  exception when others then
    if sqlerrm like 'Stage 9 gate failure:%' then raise; end if;
  end;

  if exists(select 1 from public.leave_policy_versions where org_id=public.app_org_id() and state='active') then
    raise exception 'Stage 9 gate failure: a leave policy was activated implicitly.';
  end if;

  select count(*) into n
  from public.leave_request_events
  where leave_request_id=v_leave and action='requested';

  if n<>1 then
    raise exception 'Stage 9 gate failure: leave request history is missing.';
  end if;

  perform set_config('ceac.stage9_leave_id',v_leave::text,true);
end
$stage9_staff_leave$;

reset role;

-- Manager handles the first leave step and may not bypass Administration final approval.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);

do $stage9_manager$
declare
  v_leave uuid:=nullif(current_setting('ceac.stage9_leave_id',true),'')::uuid;
begin
  perform public.workforce_leave_action(
    v_leave,'manager_approved','Manager approved; Administration final decision required'
  );

  if not exists(select 1 from public.leave_requests where id=v_leave and status='escalated') then
    raise exception 'Stage 9 gate failure: Manager approval did not move the request to Administration review.';
  end if;

  if not exists(
    select 1 from public.leave_request_events
    where leave_request_id=v_leave and action='manager_approved'
      and from_status='pending' and to_status='escalated'
  ) then
    raise exception 'Stage 9 gate failure: Manager approval history is missing.';
  end if;

  begin
    perform public.workforce_record_attendance_correction(
      '31000000-0000-4000-8000-000000000001',
      current_date,null,'context_note','{}'::jsonb,
      jsonb_build_object('note','manager should not be able to correct'),
      'Stage 9 manager correction denial',null
    );
    raise exception 'Stage 9 gate failure: manager corrected attendance without attendance.correct.';
  exception when insufficient_privilege then null;
  end;
end
$stage9_manager$;

reset role;

-- Administration records and reverses attendance correction without rewriting work_sessions.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $stage9_attendance$
declare
  v_before integer;
  v_after integer;
  v_corr uuid;
  v_rev uuid;
begin
  select count(*) into v_before
  from public.work_sessions
  where profile_id='31000000-0000-4000-8000-000000000001';

  v_corr:=public.workforce_record_attendance_correction(
    '31000000-0000-4000-8000-000000000001',
    current_date,null,'context_note','{}'::jsonb,
    jsonb_build_object('context','Recorded context corrected by Administration'),
    'Stage 9 attendance correction',null
  );

  v_rev:=public.workforce_record_attendance_correction(
    '31000000-0000-4000-8000-000000000001',
    current_date,null,'reversal','{}'::jsonb,'{}'::jsonb,
    'Stage 9 attendance correction reversal',v_corr
  );

  if not exists(select 1 from public.attendance_corrections where id=v_corr and correction_type='context_note')
     or not exists(select 1 from public.attendance_corrections where id=v_rev and reverses_id=v_corr and correction_type='reversal') then
    raise exception 'Stage 9 gate failure: append-only attendance correction reversal history is incomplete.';
  end if;

  select count(*) into v_after
  from public.work_sessions
  where profile_id='31000000-0000-4000-8000-000000000001';

  if v_after<>v_before then
    raise exception 'Stage 9 gate failure: attendance correction rewrote work session evidence.';
  end if;
end
$stage9_attendance$;

do $stage9_policy$
declare
  v_policy uuid;
  v_blocked boolean:=false;
begin
  begin
    perform public.workforce_record_leave_policy(
      'Stage 9 incomplete policy',
      current_date,current_date+365,
      'Acceptance incomplete policy reference',
      'Stage 9 incomplete activation denial',
      jsonb_build_array(
        jsonb_build_object(
          'leave_kind','annual',
          'entitlement_amount',20,
          'entitlement_unit','days',
          'approval_route','manager_then_admin'
        )
      ),
      true,
      null
    );
  exception when others then
    v_blocked:=true;
  end;

  if not v_blocked then
    raise exception 'Stage 9 gate failure: incomplete policy activated.';
  end if;

  v_policy:=public.workforce_record_leave_policy(
    'Stage 9 acceptance policy',
    current_date,current_date+365,
    'Acceptance policy reference',
    'Stage 9 explicit policy activation',
    jsonb_build_array(
      jsonb_build_object(
        'leave_kind','annual',
        'entitlement_amount',20,
        'entitlement_unit','days',
        'accrual_method','annual',
        'carryover_method','none',
        'approval_route','manager_then_admin',
        'opening_balance_required',false
      )
    ),
    true,
    null
  );

  if not exists(
    select 1 from public.leave_policy_versions
    where id=v_policy and state='active' and confirmed_by='31000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Stage 9 gate failure: explicit policy activation did not persist.';
  end if;

  if not exists(
    select 1 from public.leave_policy_rules
    where policy_version_id=v_policy
      and leave_kind='annual'
      and complete
      and accrual_method='annual'
      and carryover_method='none'
      and approval_route='manager_then_admin'
  ) then
    raise exception 'Stage 9 gate failure: server did not compute confirmed policy completeness.';
  end if;
end
$stage9_policy$;

reset role;

-- Confirmed manager-then-admin route is enforced as a state machine.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $stage9_routed_leave_request$
declare
  v_leave uuid;
begin
  v_leave:=public.workforce_request_leave(
    'annual',current_date+20,current_date+21,'Stage 9 routed leave request'
  );
  perform set_config('ceac.stage9_routed_leave_id',v_leave::text,true);
end
$stage9_routed_leave_request$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);

do $stage9_routed_manager$
declare
  v_leave uuid:=nullif(current_setting('ceac.stage9_routed_leave_id',true),'')::uuid;
begin
  perform public.workforce_leave_action(
    v_leave,'manager_approved','Manager approved; Administration decision required'
  );

  if not exists(select 1 from public.leave_requests where id=v_leave and status='escalated') then
    raise exception 'Stage 9 gate failure: Manager approval did not persist as Administration review.';
  end if;

  begin
    perform public.workforce_leave_action(
      v_leave,'manager_approved','A second Manager approval must fail'
    );
    raise exception 'Stage 9 gate failure: repeated Manager approval was accepted.';
  exception when insufficient_privilege then null;
  end;
end
$stage9_routed_manager$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $stage9_routed_admin$
declare
  v_leave uuid:=nullif(current_setting('ceac.stage9_routed_leave_id',true),'')::uuid;
begin
  perform public.workforce_leave_action(
    v_leave,'admin_approved','Administration approved after Manager approval'
  );

  if not exists(select 1 from public.leave_requests where id=v_leave and status='approved') then
    raise exception 'Stage 9 gate failure: Administration approval did not persist.';
  end if;

  perform public.workforce_leave_action(
    v_leave,'approval_reversed','Acceptance reversal restores pending review'
  );

  if not exists(select 1 from public.leave_requests where id=v_leave and status='pending') then
    raise exception 'Stage 9 gate failure: approval reversal did not restore pending state.';
  end if;

  if not exists(
    select 1 from public.leave_request_events
    where leave_request_id=v_leave and action='approval_reversed'
      and from_status='approved' and to_status='pending'
  ) then
    raise exception 'Stage 9 gate failure: approval reversal history is missing.';
  end if;

  begin
    perform public.workforce_leave_action(
      v_leave,'approval_reversed','A second reversal from pending must fail'
    );
    raise exception 'Stage 9 gate failure: invalid repeated approval reversal was accepted.';
  exception when insufficient_privilege then null;
  end;
end
$stage9_routed_admin$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $stage9_staff_cancel$
declare
  v_leave uuid:=nullif(current_setting('ceac.stage9_routed_leave_id',true),'')::uuid;
begin
  perform public.workforce_leave_action(
    v_leave,'cancelled_by_employee','Cancelled by employee after approval reversal'
  );

  if not exists(select 1 from public.leave_requests where id=v_leave and status='cancelled') then
    raise exception 'Stage 9 gate failure: eligible employee cancellation did not persist.';
  end if;
end
$stage9_staff_cancel$;

reset role;

-- Another staff member cannot see Staff Fixture workforce rows.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);

do $stage9_other_staff$
declare n integer;
begin
  select count(*) into n
  from public.workforce_schedule_versions
  where profile_id='31000000-0000-4000-8000-000000000001';

  if n<>0 then
    raise exception 'Stage 9 gate failure: another staff user can read a colleague schedule.';
  end if;

  select count(*) into n
  from public.attendance_corrections
  where profile_id='31000000-0000-4000-8000-000000000001';

  if n<>0 then
    raise exception 'Stage 9 gate failure: another staff user can read colleague corrections.';
  end if;
end
$stage9_other_staff$;

reset role;

do $stage9_evidence$
declare n integer;
begin
  select count(*) into n
  from public.platform_events
  where event_type='workforce.schedule_changed';
  if n<2 then raise exception 'Stage 9 gate failure: schedule events missing (%).',n; end if;

  select count(*) into n
  from public.platform_events
  where event_type in ('workforce.attendance_corrected','workforce.attendance_correction_reversed');
  if n<2 then raise exception 'Stage 9 gate failure: attendance events missing (%).',n; end if;

  select count(*) into n
  from public.platform_events
  where event_type='workforce.leave_requested';
  if n<1 then raise exception 'Stage 9 gate failure: leave request event missing.'; end if;

  if exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name in ('workforce_schedule_versions','attendance_corrections')
      and column_name in ('score','rating','rank','absence_score','attendance_score')
  ) then
    raise exception 'Stage 9 gate failure: prohibited scoring field exists.';
  end if;
end
$stage9_evidence$;

rollback;

select 'CEAC OS Stage 9 Workforce Management gate passed' as result;
