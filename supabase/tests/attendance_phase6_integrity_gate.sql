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
  -- Legacy code-window endpoints must not be callable from the browser once
  -- the reconciled, caller-bound front-desk attendance design is active.
  if to_regprocedure('public.attendance_create_office_code(uuid,integer)') is not null then
    if has_function_privilege('authenticated','public.attendance_create_office_code(uuid,integer)','EXECUTE') then
      raise exception 'Phase 6C gate failure: obsolete code-creation RPC remains browser-executable.';
    end if;
  end if;
  if to_regprocedure('public.attendance_verify_office_code(uuid,text)') is not null then
    if has_function_privilege('authenticated','public.attendance_verify_office_code(uuid,text)','EXECUTE') then
      raise exception 'Phase 6C gate failure: obsolete code-verification RPC remains browser-executable.';
    end if;
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

  -- Office starts must use the same fresh, in-geofence GPS fixture verified
  -- by onboarding_access_presence_gate.sql; never bypass the location trigger.
  insert into public.work_sessions(
    org_id,profile_id,place,lat,lng,location_accuracy_m,location_captured_at,device_time
  ) values(public.app_org_id(),auth.uid(),'office',5.6037,-0.187,10,now(),now())
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
set local role service_role;
-- Simulate the signed PostgREST role claim even within a SECURITY DEFINER call.
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.attendance_network_sources(
  org_id,label,source_key,active
) values(
  '10000000-0000-4000-8000-000000000010',
  'Phase 6 trusted office network',
  'phase6-integrity-source',
  true
);

-- The SQL service role alone does not satisfy the required trusted JWT claim.
do $reject_untrusted_claim$
begin
  begin
    perform public.attendance_record_network_corroboration(
      'phase6-integrity-source',
      '31000000-0000-4000-8000-000000000001',
      (select value::uuid from phase6_integrity_fixture where name='session'),
      true,'unauthorised-claim-probe'
    );
    raise exception 'Phase 6C gate failure: missing service JWT role unexpectedly accepted.';
  exception when insufficient_privilege then null;
  end;
end
$reject_untrusted_claim$;

select set_config('request.jwt.claim.role','service_role',true);

select public.attendance_record_network_corroboration(
  'phase6-integrity-source',
  '31000000-0000-4000-8000-000000000001',
  (select value::uuid from phase6_integrity_fixture where name='session'),
  true,
  'opaque-network-reference'
);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $network_self_read$
declare body jsonb;
begin
  body:=public.attendance_corroboration_for_day(current_date);
  if not exists(
    select 1 from jsonb_array_elements(body) e
    where e->>'evidence_type'='office_network'
      and e->>'result'='verified'
      and e->>'source_label'='Phase 6 trusted office network'
  ) then
    raise exception 'Phase 6C gate failure: trusted-network corroboration was not readable by its subject.';
  end if;
  if body::text like '%opaque-network-reference%' then
    raise exception 'Phase 6C gate failure: opaque trusted-network reference leaked through ordinary evidence read.';
  end if;
end
$network_self_read$;

reset role;

update public.employment_records
set employment_type='volunteer',working_pattern='{"kind":"no_attendance"}'::jsonb
where profile_id='31000000-0000-4000-8000-000000000006';
update public.employee_roster
set employment_type='volunteer'
where profile_id='31000000-0000-4000-8000-000000000006';

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000006',true);

do $volunteer_office_session$
declare v_session uuid;
begin
  -- The no-attendance employment rule does not bypass evidence required to
  -- start a real office session. All test mutations roll back below.
  insert into public.work_sessions(
    org_id,profile_id,place,lat,lng,location_accuracy_m,location_captured_at,device_time
  ) values(
    '10000000-0000-4000-8000-000000000010',
    '31000000-0000-4000-8000-000000000006',
    'office',5.6037,-0.187,10,now(),now()
  ) returning id into v_session;
  insert into phase6_integrity_fixture(name,value)
  values('volunteer_session',v_session::text);
end
$volunteer_office_session$;

select public.attendance_record_network_corroboration(
  'phase6-integrity-source',
  '31000000-0000-4000-8000-000000000006',
  (select value::uuid from phase6_integrity_fixture where name='volunteer_session'),
  true,
  'volunteer-network-reference'
);

reset role;

insert into public.capability_grants(org_id,profile_id,capability,grant_reason)
values(
  '10000000-0000-4000-8000-000000000010',
  '31000000-0000-4000-8000-000000000005',
  'compliance.manage',
  'Phase 6C isolated Compliance fixture'
)
on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
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

  body:=public.attendance_corroboration_for_day(current_date);
  if exists(
    select 1 from jsonb_array_elements(body) e
    where e->>'profile_id'='31000000-0000-4000-8000-000000000006'
  ) then
    raise exception 'Phase 6C gate failure: no-attendance volunteer corroboration leaked to ordinary Compliance monitoring.';
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
