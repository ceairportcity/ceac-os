\set ON_ERROR_STOP on

begin;

do $stage7_tables$
declare n integer;
begin
  select count(*) into n
  from pg_class c
  join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='public'
    and c.relname in (
      'appraisal_evidence_items',
      'appraisal_entries',
      'development_plan_versions',
      'feedback_responses'
    )
    and c.relkind='r'
    and c.relrowsecurity;

  if n<>4 then
    raise exception 'Stage 7 gate failure: expected 4 Stage 7 RLS tables, found %.',n;
  end if;

  if not exists(
    select 1 from public.capability_definitions
    where capability='performance.admin'
  ) then
    raise exception 'Stage 7 gate failure: performance.admin capability is missing.';
  end if;
end
$stage7_tables$;

do $stage7_privileges$
begin
  if has_table_privilege('anon','public.appraisal_cycles','SELECT')
     or has_table_privilege('anon','public.appraisals','SELECT')
     or has_table_privilege('anon','public.feedback_notes','SELECT')
     or has_table_privilege('anon','public.appraisal_evidence_items','SELECT')
     or has_table_privilege('anon','public.appraisal_entries','SELECT')
     or has_table_privilege('anon','public.development_plan_versions','SELECT')
     or has_table_privilege('anon','public.feedback_responses','SELECT') then
    raise exception 'Stage 7 gate failure: anon can read performance-development records.';
  end if;

  if has_table_privilege('authenticated','public.appraisal_cycles','INSERT')
     or has_table_privilege('authenticated','public.appraisals','UPDATE')
     or has_table_privilege('authenticated','public.appraisal_entries','INSERT')
     or has_table_privilege('authenticated','public.appraisal_entries','UPDATE')
     or has_table_privilege('authenticated','public.development_plan_versions','INSERT')
     or has_table_privilege('authenticated','public.feedback_notes','INSERT')
     or has_table_privilege('authenticated','public.feedback_responses','INSERT') then
    raise exception 'Stage 7 gate failure: authenticated can bypass reviewed performance RPCs.';
  end if;
end
$stage7_privileges$;

-- Real factual source records for the generated evidence pack.
insert into public.work_items(
  id,org_id,ref,kind,unit_id,project_id,assignee_id,assigned_by,
  title,purpose,origin,visibility,confidential,status,due_at,completed_at,
  first_time_approved
) values (
  '27000000-0000-4000-8000-000000000071',
  '10000000-0000-4000-8000-000000000010',
  'TUA-PD7-001',
  'task',
  '20000000-0000-4000-8000-000000000011',
  '25000000-0000-4000-8000-000000000011',
  '31000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000002',
  'Stage 7 evidence work',
  'Factual review evidence probe.',
  'assigned',
  'unit',
  false,
  'completed',
  now()-interval '1 day',
  now(),
  true
);

insert into public.training_records(
  id,org_id,profile_id,name,completed_on,note
) values (
  '28000000-0000-4000-8000-000000000071',
  '10000000-0000-4000-8000-000000000010',
  '31000000-0000-4000-8000-000000000001',
  'Stage 7 existing training evidence',
  current_date,
  'Historical training evidence only; Stage 8 learning is not being built here.'
);

-- Administration opens the review period through explicit capability authority.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $stage7_admin_open$
declare
  v_cycle uuid;
  v_appraisal uuid;
  v_evidence integer;
begin
  v_cycle:=public.open_performance_review_cycle(
    'Stage 7 acceptance review',
    current_date-30,
    current_date,
    'Stage 7 gate review period'
  );

  select id into v_appraisal
  from public.appraisals
  where cycle_id=v_cycle
    and profile_id='31000000-0000-4000-8000-000000000001';

  if v_appraisal is null then
    raise exception 'Stage 7 gate failure: staff review case was not created.';
  end if;

  if not exists(
    select 1 from public.appraisals
    where id=v_appraisal
      and manager_id='31000000-0000-4000-8000-000000000002'
      and unit_id='20000000-0000-4000-8000-000000000011'
  ) then
    raise exception 'Stage 7 gate failure: reviewer/reporting-line snapshot is wrong.';
  end if;

  if exists(
    select 1 from public.appraisals
    where cycle_id=v_cycle
      and profile_id in (
        '31000000-0000-4000-8000-000000000003',
        '31000000-0000-4000-8000-000000000004'
      )
  ) then
    raise exception 'Stage 7 gate failure: Admin or Executive received an in-system review case.';
  end if;

  select count(*) into v_evidence
  from public.appraisal_evidence_items
  where appraisal_id=v_appraisal;

  if v_evidence<2 then
    raise exception 'Stage 7 gate failure: factual evidence pack did not assemble expected source rows.';
  end if;

  perform set_config('ceac.stage7_cycle_id',v_cycle::text,true);
  perform set_config('ceac.stage7_appraisal_id',v_appraisal::text,true);
  perform set_config('ceac.stage7_evidence_count',v_evidence::text,true);
end
$stage7_admin_open$;

reset role;

-- Staff can see their own case and evidence from the beginning, and can reflect.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $stage7_staff_reflection$
declare
  v_appraisal uuid:=nullif(current_setting('ceac.stage7_appraisal_id',true),'')::uuid;
  v_entry uuid;
  v_count integer;
begin
  select count(*) into v_count
  from public.appraisals
  where id=v_appraisal;

  if v_count<>1 then
    raise exception 'Stage 7 gate failure: employee cannot read own review case.';
  end if;

  select count(*) into v_count
  from public.appraisal_evidence_items
  where appraisal_id=v_appraisal;

  if v_count<2 then
    raise exception 'Stage 7 gate failure: employee cannot read own evidence pack.';
  end if;

  v_entry:=public.record_appraisal_entry(
    v_appraisal,
    'employee_reflection',
    'I completed the recorded work and want to improve how I plan the next cycle.',
    null
  );

  if v_entry is null then
    raise exception 'Stage 7 gate failure: employee reflection was not recorded.';
  end if;

  begin
    perform public.record_appraisal_entry(
      v_appraisal,
      'manager_assessment',
      'Employee should not be able to write this.',
      null
    );
    raise exception 'Stage 7 gate failure: employee wrote manager assessment.';
  exception when insufficient_privilege then null;
  end;
end
$stage7_staff_reflection$;

reset role;

-- Another-unit manager cannot read or assess this case.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000007',true);

do $stage7_other_manager_denied$
declare
  v_appraisal uuid:=nullif(current_setting('ceac.stage7_appraisal_id',true),'')::uuid;
  v_count integer;
begin
  select count(*) into v_count
  from public.appraisals
  where id=v_appraisal;

  if v_count<>0 then
    raise exception 'Stage 7 gate failure: another-unit manager can read this review.';
  end if;

  begin
    perform public.record_appraisal_entry(
      v_appraisal,
      'manager_assessment',
      'Cross-unit write denial probe.',
      null
    );
    raise exception 'Stage 7 gate failure: another-unit manager wrote assessment.';
  exception when insufficient_privilege then null;
  end;
end
$stage7_other_manager_denied$;

reset role;

-- Assigned reviewer records narrative, conversation, development plan and factual feedback.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);

do $stage7_manager_flow$
declare
  v_appraisal uuid:=nullif(current_setting('ceac.stage7_appraisal_id',true),'')::uuid;
  v_assessment uuid;
  v_conversation uuid;
  v_plan uuid;
  v_plan2 uuid;
  v_feedback uuid;
  v_release_request uuid;
  v_before integer;
  v_after integer;
begin
  select count(*) into v_before
  from public.appraisal_evidence_items
  where appraisal_id=v_appraisal;

  perform public.refresh_performance_evidence(v_appraisal);

  select count(*) into v_after
  from public.appraisal_evidence_items
  where appraisal_id=v_appraisal;

  if v_after<>v_before then
    raise exception 'Stage 7 gate failure: evidence refresh duplicated existing source rows.';
  end if;

  v_assessment:=public.record_appraisal_entry(
    v_appraisal,
    'manager_assessment',
    'The recorded outcomes show reliable completion; next focus is clearer planning before deadlines.',
    null
  );

  v_conversation:=public.record_appraisal_entry(
    v_appraisal,
    'conversation_record',
    'We reviewed the evidence together and agreed on the development focus below.',
    null
  );

  v_plan:=public.record_development_plan_version(
    v_appraisal,
    'Planning before execution',
    'Make weekly commitments explicit before work starts.',
    'Set the week plan on Monday and review it with the manager.',
    current_date,
    current_date+30,
    'active',
    'Initial plan agreed in Stage 7 acceptance review.',
    null
  );

  v_plan2:=public.record_development_plan_version(
    v_appraisal,
    'Planning before execution',
    'Make weekly commitments explicit before work starts.',
    'Set the week plan on Monday, review it with the manager, and record changes.',
    current_date,
    current_date+30,
    'active',
    'Clarified the agreed next step.',
    v_plan
  );

  if not exists(
    select 1 from public.development_plan_versions
    where id=v_plan2 and supersedes_id=v_plan and version=2
  ) then
    raise exception 'Stage 7 gate failure: development-plan history was not preserved.';
  end if;

  v_feedback:=public.record_performance_feedback(
    '31000000-0000-4000-8000-000000000001',
    'guidance',
    'Keep the planning note attached to the work before execution starts.',
    current_date,
    '27000000-0000-4000-8000-000000000071',
    null,
    null
  );

  -- The legacy direct Manager publication function must be inaccessible.
  if has_function_privilege('authenticated','public.share_performance_review(uuid)','EXECUTE') then
    raise exception 'Stage 7 gate failure: Manager still has legacy direct publication authority.';
  end if;

  v_release_request:=public.performance_request_release(
    v_appraisal,'Manager assessment is ready for independent HR publication review.'
  );
  if v_release_request is null then
    raise exception 'Stage 7 gate failure: Manager request for HR publication is missing.';
  end if;
  perform set_config('ceac.stage7_release_request_id',v_release_request::text,true);

  perform set_config('ceac.stage7_assessment_id',v_assessment::text,true);
  perform set_config('ceac.stage7_conversation_id',v_conversation::text,true);
  perform set_config('ceac.stage7_plan_id',v_plan::text,true);
  perform set_config('ceac.stage7_plan2_id',v_plan2::text,true);
  perform set_config('ceac.stage7_feedback_id',v_feedback::text,true);
end
$stage7_manager_flow$;

reset role;

-- Employee must NOT see the Manager assessment or conversation before HR releases
-- that exact assessment version. A missing direct share permission is intentional.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
do $stage7_pre_hr_privacy$
declare
  v_appraisal uuid:=nullif(current_setting('ceac.stage7_appraisal_id',true),'')::uuid;
  n integer;
begin
  select count(*) into n from public.appraisal_entries
  where appraisal_id=v_appraisal
    and entry_type in ('manager_assessment','conversation_record');
  if n<>0 then
    raise exception 'Stage 7 gate failure: employee read unpublished Manager narrative (% rows).',n;
  end if;
end
$stage7_pre_hr_privacy$;
reset role;

-- Only Administration/HR may publish the exact current assessment after
-- the Manager requests it. Publication remains separately attributable.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
do $stage7_hr_approve$
declare
  v_request uuid:=nullif(current_setting('ceac.stage7_release_request_id',true),'')::uuid;
  v_result jsonb;
begin
  if v_request is null then
    raise exception 'Stage 7 gate failure: release request was not recorded.';
  end if;
  v_result:=public.performance_hr_decide_release(
    v_request,true,'HR has reviewed the manager-authored narrative for publication.'
  );
  if coalesce((v_result->>'approved')::boolean,false) is not true then
    raise exception 'Stage 7 gate failure: HR release decision was not approved.';
  end if;
  if not exists(
    select 1 from public.performance_review_release_requests
    where id=v_request and state='approved'
      and decided_by='31000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Stage 7 gate failure: independent HR release audit is missing.';
  end if;
end
$stage7_hr_approve$;
reset role;

-- Only after approved HR publication can the employee read the manager narrative
-- and exercise the recorded right of reply.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $stage7_staff_reply$
declare
  v_appraisal uuid:=nullif(current_setting('ceac.stage7_appraisal_id',true),'')::uuid;
  v_feedback uuid:=nullif(current_setting('ceac.stage7_feedback_id',true),'')::uuid;
  v_response uuid;
  v_reply uuid;
  v_count integer;
begin
  select count(*) into v_count
  from public.appraisal_entries
  where appraisal_id=v_appraisal
    and entry_type in ('manager_assessment','conversation_record');

  if v_count<>2 then
    raise exception 'Stage 7 gate failure: employee cannot see manager review records.';
  end if;

  if not exists(
    select 1 from public.appraisals
    where id=v_appraisal and status='shared'
  ) then
    raise exception 'Stage 7 gate failure: shared review state is not visible to employee.';
  end if;

  if not exists(
    select 1 from public.development_plan_versions
    where appraisal_id=v_appraisal and version=2
  ) then
    raise exception 'Stage 7 gate failure: employee cannot see development-plan history.';
  end if;

  v_reply:=public.record_appraisal_entry(
    v_appraisal,
    'staff_response',
    'I agree with the next step and will record changes during the week.',
    null
  );

  v_response:=public.respond_to_performance_feedback(
    v_feedback,
    'Understood. I will keep the planning note with the work record.'
  );

  if v_reply is null or v_response is null then
    raise exception 'Stage 7 gate failure: employee right of reply was not recorded.';
  end if;
end
$stage7_staff_reply$;

reset role;

-- Verify audit and semantic event evidence outside RLS.
do $stage7_audit_events$
declare
  v_appraisal uuid:=nullif(current_setting('ceac.stage7_appraisal_id',true),'')::uuid;
  v_feedback uuid:=nullif(current_setting('ceac.stage7_feedback_id',true),'')::uuid;
  n integer;
begin
  select count(*) into n
  from public.platform_audit_events
  where resource_type='appraisal_entry'
    and subject_profile_id='31000000-0000-4000-8000-000000000001';

  if n<4 then
    raise exception 'Stage 7 gate failure: review-entry audit history is incomplete (%).',n;
  end if;

  select count(*) into n
  from public.platform_events
  where aggregate_type='appraisal'
    and aggregate_id=v_appraisal
    and event_type='performance.review_entry_recorded';

  if n<4 then
    raise exception 'Stage 7 gate failure: review-entry semantic events are incomplete (%).',n;
  end if;

  -- The new Manager-request → independent HR approval path audits both
  -- decisions in immutable activity_events, rather than legacy direct-share.
  select count(*) into n
  from public.activity_events
  where object_type='performance_review' and object_id=v_appraisal
    and verb in ('performance_release_requested','performance_hr_release_decided');

  if n<>2 then
    raise exception 'Stage 7 gate failure: expected Manager request and HR publication audit events, found %.',n;
  end if;

  select count(*) into n
  from public.platform_events
  where event_type='performance.feedback_recorded'
    and aggregate_id=v_feedback;

  if n<>1 then
    raise exception 'Stage 7 gate failure: expected one feedback event, found %.',n;
  end if;

  if exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name in ('appraisals','appraisal_entries','development_plan_versions')
      and column_name in ('score','rating','rank','performance_percentage')
  ) then
    raise exception 'Stage 7 gate failure: prohibited performance-scoring column exists.';
  end if;
end
$stage7_audit_events$;

rollback;

select 'CEAC OS Stage 7 performance and development gate passed' as result;
