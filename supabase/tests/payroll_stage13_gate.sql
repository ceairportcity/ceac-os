\set ON_ERROR_STOP on

begin;

do $tables$
declare n integer;
begin
  select count(*) into n
  from pg_class c
  join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='hr_private'
    and c.relname in ('payroll_periods','payroll_runs','payroll_entries','payroll_entry_lines')
    and c.relkind='r'
    and c.relrowsecurity;
  if n<>4 then
    raise exception 'Payroll gate failure: expected 4 protected payroll tables with RLS, found %.',n;
  end if;

  if has_schema_privilege('authenticated','hr_private','USAGE')
     or has_schema_privilege('anon','hr_private','USAGE') then
    raise exception 'Payroll gate failure: browser roles gained hr_private schema usage.';
  end if;

  if has_table_privilege('authenticated','hr_private.payroll_runs','SELECT')
     or has_table_privilege('authenticated','hr_private.payroll_entries','SELECT')
     or has_table_privilege('authenticated','hr_private.payroll_entry_lines','SELECT') then
    raise exception 'Payroll gate failure: authenticated gained direct protected payroll reads.';
  end if;
end
$tables$;

do $rpc_surface$
begin
  if to_regprocedure('public.payroll_list_runs()') is null
     or to_regprocedure('public.payroll_run_detail(uuid)') is null
     or to_regprocedure('public.payroll_create_run(text,date,date,text,date,text)') is null
     or to_regprocedure('public.payroll_set_line(uuid,uuid,uuid,text,text,text,bigint,text)') is null
     or to_regprocedure('public.payroll_submit_run(uuid,text)') is null
     or to_regprocedure('public.payroll_approve_run(uuid,text)') is null
     or to_regprocedure('public.payroll_create_correction(uuid,text)') is null then
    raise exception 'Payroll gate failure: protected Payroll RPC surface is incomplete.';
  end if;

  if has_function_privilege('anon','public.payroll_list_runs()','EXECUTE')
     or has_function_privilege('anon','public.payroll_run_detail(uuid)','EXECUTE')
     or has_function_privilege('anon','public.payroll_create_run(text,date,date,text,date,text)','EXECUTE')
     or has_function_privilege('anon','public.payroll_set_line(uuid,uuid,uuid,text,text,text,bigint,text)','EXECUTE')
     or has_function_privilege('anon','public.payroll_submit_run(uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.payroll_approve_run(uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.payroll_create_correction(uuid,text)','EXECUTE') then
    raise exception 'Payroll gate failure: anon can execute a protected Payroll RPC.';
  end if;
end
$rpc_surface$;

do $capability_guard$
begin
  begin
    insert into public.capability_grants(
      org_id,profile_id,capability,scope_unit_id,granted_by,grant_reason
    ) values (
      '10000000-0000-4000-8000-000000000010',
      '31000000-0000-4000-8000-000000000003',
      'payroll.approve',null,
      '31000000-0000-4000-8000-000000000003',
      'Invalid admin approval probe'
    );
    raise exception 'Payroll gate failure: Administration received payroll approval authority.';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.capability_grants(
      org_id,profile_id,capability,scope_unit_id,granted_by,grant_reason
    ) values (
      '10000000-0000-4000-8000-000000000010',
      '31000000-0000-4000-8000-000000000004',
      'payroll.prepare',null,
      '31000000-0000-4000-8000-000000000004',
      'Invalid executive preparation probe'
    );
    raise exception 'Payroll gate failure: Executive received payroll preparation authority.';
  exception when insufficient_privilege then null;
  end;
end
$capability_guard$;

insert into public.employee_roster(
  org_id,profile_id,full_name,source_display_name,job_title,employment_type,
  employment_status,identity_state,source_system,source_row_key
)
select
  p.org_id,p.id,p.full_name,p.full_name,p.job_title,'not_recorded',
  case when p.active then 'active' else 'inactive' end,
  'linked','payroll_acceptance_fixture',p.id::text
from public.profiles p
where p.org_id='10000000-0000-4000-8000-000000000010'
on conflict(profile_id) do nothing;

-- Phase 6A acceptance fixture: one active volunteer remains a Staff account but
-- is outside ordinary salary Payroll unless Administration formally changes engagement.
update public.employee_roster
set employment_type='volunteer'
where profile_id='31000000-0000-4000-8000-000000000006';

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $staff_denied$
begin
  begin
    perform public.payroll_list_runs();
    raise exception 'Payroll gate failure: Staff listed payroll runs.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.payroll_readiness_summary();
    raise exception 'Payroll gate failure: Staff viewed Payroll readiness.';
  exception when insufficient_privilege then null;
  end;
end
$staff_denied$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $admin_prepare$
declare
  v_run uuid;
  v_entry jsonb;
  v_detail jsonb;
  v_readiness jsonb;
begin
  if not public.app_has_capability('payroll.prepare',null) then
    raise exception 'Payroll gate failure: Administration fixture lacks payroll.prepare.';
  end if;
  if public.app_has_capability('payroll.approve',null) then
    raise exception 'Payroll gate failure: Administration fixture also has payroll.approve.';
  end if;

  v_readiness:=public.payroll_readiness_summary();
  if (v_readiness->>'employee_count')::int<>(
    select count(*) from public.employee_roster
    where org_id=public.app_org_id()
      and employment_status='active'
      and employment_type<>'volunteer'
  ) then
    raise exception 'Payroll gate failure: readiness summary does not match the active salary-eligible roster.';
  end if;

  if (v_readiness->>'volunteer_count')::int<>(
    select count(*) from public.employee_roster
    where org_id=public.app_org_id()
      and employment_status='active'
      and employment_type='volunteer'
  ) then
    raise exception 'Payroll gate failure: readiness does not report excluded active volunteers.';
  end if;

  v_run:=public.payroll_create_run(
    'September 2026 fixture',
    '2026-09-01','2026-09-30','GHS','2026-10-01',
    'Synthetic Payroll acceptance run'
  );
  perform set_config('ceac.test.payroll_run',v_run::text,true);

  v_detail:=public.payroll_run_detail(v_run);
  if jsonb_array_length(v_detail->'entries')=0 then
    raise exception 'Payroll gate failure: draft run did not snapshot active employees.';
  end if;

  if jsonb_array_length(v_detail->'entries')<>(
    select count(*) from public.employee_roster
    where org_id=public.app_org_id()
      and employment_status='active'
      and employment_type<>'volunteer'
  ) then
    raise exception 'Payroll gate failure: draft run did not include the complete salary-eligible roster.';
  end if;

  if exists(
    select 1
    from jsonb_array_elements(v_detail->'entries') entry
    join public.employee_roster er on er.id=(entry->>'employee_id')::uuid
    where er.employment_type='volunteer'
  ) then
    raise exception 'Payroll gate failure: an active volunteer entered ordinary salary Payroll.';
  end if;

  for v_entry in select value from jsonb_array_elements(v_detail->'entries')
  loop
    if nullif(v_entry->>'employee_id','') is null then
      raise exception 'Payroll gate failure: payroll entry lacks canonical employee_id.';
    end if;

    if not exists(
      select 1 from jsonb_array_elements(v_entry->'lines') line
      where line->>'category'='base_salary'
    ) then
      perform public.payroll_set_line(
        v_run,
        (v_entry->>'employee_id')::uuid,
        null,
        'base_salary','addition','Base salary',
        100000,
        'Synthetic acceptance salary'
      );
    end if;
  end loop;

  perform public.payroll_submit_run(v_run,'Administration review completed');

  if (public.payroll_run_detail(v_run)->'run'->>'status')<>'in_review' then
    raise exception 'Payroll gate failure: submitted run did not enter in_review.';
  end if;

  begin
    perform public.payroll_approve_run(v_run,'Invalid Administration approval');
    raise exception 'Payroll gate failure: Administration approved payroll.';
  exception when insufficient_privilege then null;
  end;
end
$admin_prepare$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);

do $executive_approve$
declare
  v_run uuid:=current_setting('ceac.test.payroll_run')::uuid;
begin
  if not public.app_has_capability('payroll.approve',null)
     or not public.app_has_capability('hr_private.access',null) then
    raise exception 'Payroll gate failure: Executive fixture lacks approval/protected-HR authority.';
  end if;
  if public.app_has_capability('payroll.prepare',null) then
    raise exception 'Payroll gate failure: Executive fixture also has payroll.prepare.';
  end if;

  perform public.payroll_run_detail(v_run);

  begin
    perform public.payroll_set_line(
      v_run,
      '31000000-0000-4000-8000-000000000001',
      null,'bonus','addition','Invalid bonus',1000,'Executive edit probe'
    );
    raise exception 'Payroll gate failure: Executive edited draft payroll.';
  exception when insufficient_privilege then null;
  end;

  perform public.payroll_approve_run(v_run,'Group Pastor fixture approval');

  if (public.payroll_run_detail(v_run)->'run'->>'status')<>'approved' then
    raise exception 'Payroll gate failure: Executive approval did not lock the run.';
  end if;

  begin
    perform public.payroll_create_correction(v_run,'Executive correction probe');
    raise exception 'Payroll gate failure: Executive created payroll correction.';
  exception when insufficient_privilege then null;
  end;
end
$executive_approve$;

reset role;

do $approved_immutable$
declare
  v_run uuid:=current_setting('ceac.test.payroll_run')::uuid;
  v_entry uuid;
begin
  begin
    update hr_private.payroll_runs
    set total_net_minor=total_net_minor+1
    where id=v_run;
    raise exception 'Payroll gate failure: approved payroll run was mutable.';
  exception when insufficient_privilege then null;
  end;

  select id into v_entry from hr_private.payroll_entries where run_id=v_run limit 1;
  begin
    update hr_private.payroll_entries
    set note='immutable probe'
    where id=v_entry;
    raise exception 'Payroll gate failure: approved payroll entry was mutable.';
  exception when insufficient_privilege then null;
  end;
end
$approved_immutable$;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $correction_flow$
declare
  v_run uuid:=current_setting('ceac.test.payroll_run')::uuid;
  v_correction uuid;
  v_detail jsonb;
begin
  v_correction:=public.payroll_create_correction(v_run,'Correct one or more approved Payroll entries');
  perform set_config('ceac.test.payroll_correction',v_correction::text,true);

  v_detail:=public.payroll_run_detail(v_correction);
  if v_detail->'run'->>'status'<>'draft'
     or v_detail->'run'->>'correction_of'<>v_run::text
     or jsonb_array_length(v_detail->'entries')=0 then
    raise exception 'Payroll gate failure: correction run did not preserve attributable history.';
  end if;
end
$correction_flow$;

reset role;

do $audit_evidence$
declare
  v_run uuid:=current_setting('ceac.test.payroll_run')::uuid;
  n integer;
begin
  select count(*) into n
  from hr_private.audit_events
  where resource_id in (v_run,current_setting('ceac.test.payroll_correction')::uuid)
    and action in (
      'payroll_run_created','payroll_submitted','payroll_approved','payroll_correction_created'
    );
  if n<4 then
    raise exception 'Payroll gate failure: expected attributable Payroll audit evidence, found %.',n;
  end if;
end
$audit_evidence$;

rollback;

select 'CEAC OS FPG5 Payroll gate passed' as result;
