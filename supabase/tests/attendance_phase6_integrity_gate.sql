\set ON_ERROR_STOP on
begin;

do $surface$
begin
  if has_table_privilege('authenticated','public.attendance_integrity_settings','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.attendance_verification_codes','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.attendance_network_sources','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.attendance_corroboration_events','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Phase 6C gate failure: raw corroboration tables opened to authenticated.';
  end if;
  if has_function_privilege('authenticated','public.attendance_record_network_corroboration(text,uuid,uuid,boolean,text)','EXECUTE') then
    raise exception 'Phase 6C gate failure: browser/user can forge trusted network corroboration.';
  end if;
  if not has_function_privilege('service_role','public.attendance_record_network_corroboration(text,uuid,uuid,boolean,text)','EXECUTE') then
    raise exception 'Phase 6C gate failure: trusted network hook unavailable to service role.';
  end if;
end
$surface$;

create temporary table phase6_integrity_fixture(name text primary key,value text) on commit drop;
grant all on phase6_integrity_fixture to authenticated,service_role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $admin_code$
declare body jsonb;
begin
  body:=public.attendance_set_office_code(true,10);
  if coalesce((body->>'enabled')::boolean,false) is not true
     or length(coalesce(body->>'code',''))<>6 then
    raise exception 'Phase 6C gate failure: Workforce Administration could not issue a short-lived code.';
  end if;
  insert into phase6_integrity_fixture(name,value) values('code',body->>'code');
  if public.attendance_integrity_status()->>'front_desk_code' is distinct from body->>'code' then
    raise exception 'Phase 6C gate failure: authorised Workforce status lost the current code.';
  end if;
end
$admin_code$;

select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $staff_boundary$
declare
  s uuid;
  bad jsonb;
  good jsonb;
  body jsonb;
begin
  if public.attendance_integrity_status()->>'front_desk_code' is not null then
    raise exception 'Phase 6C gate failure: ordinary Staff received the front-desk code.';
  end if;

  begin
    perform public.attendance_set_office_code(true,10);
    raise exception 'Phase 6C gate failure: Staff configured office verification.';
  exception when insufficient_privilege then null;
  end;

  insert into public.work_sessions(org_id,profile_id,place)
  values(public.app_org_id(),auth.uid(),'office')
  returning id into s;
  insert into phase6_integrity_fixture(name,value) values('session',s::text);

  bad:=public.attendance_verify_office_code('FFFFFF',s);
  if coalesce((bad->>'verified')::boolean,false) then
    raise exception 'Phase 6C gate failure: invalid office code verified.';
  end if;

  good:=public.attendance_verify_office_code(
    (select value from phase6_integrity_fixture where name='code'),s
  );
  if coalesce((good->>'verified')::boolean,false) is not true then
    raise exception 'Phase 6C gate failure: valid office code did not verify.';
  end if;

  body:=public.attendance_corroboration_for_day(current_date);
  if not exists(
    select 1 from jsonb_array_elements(body) e
    where e->>'profile_id'=auth.uid()::text
      and e->>'evidence_type'='front_desk_code'
      and e->>'result'='verified'
  ) then
    raise exception 'Phase 6C gate failure: self corroboration evidence missing.';
  end if;
end
$staff_boundary$;

reset role;

update public.employment_records
set employment_type='volunteer',working_pattern='{"kind":"no_attendance"}'::jsonb
where profile_id='31000000-0000-4000-8000-000000000006';
update public.employee_roster
set employment_type='volunteer'
where profile_id='31000000-0000-4000-8000-000000000006';

insert into public.capability_grants(org_id,profile_id,capability,grant_reason)
values(
  '10000000-0000-4000-8000-000000000010',
  '31000000-0000-4000-8000-000000000005',
  'compliance.manage',
  'Phase 6C isolated Compliance fixture'
)
on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);

do $volunteer_compliance_boundary$
declare body jsonb;
begin
  body:=public.attendance_day_evidence(current_date);
  if exists(
    select 1 from jsonb_array_elements(body) e
    where e->>'profile_id'='31000000-0000-4000-8000-000000000006'
  ) then
    raise exception 'Phase 6C gate failure: no-attendance volunteer entered ordinary Compliance attendance monitoring.';
  end if;
end
$volunteer_compliance_boundary$;

reset role;

do $immutability$
begin
  begin
    update public.attendance_corroboration_events set source_label='rewritten';
    raise exception 'Phase 6C gate failure: corroboration history was mutable.';
  exception when insufficient_privilege then null;
  end;
end
$immutability$;

rollback;
select 'Phase 6C attendance-integrity authority/privacy gate passed' as result;
