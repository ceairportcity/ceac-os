\set ON_ERROR_STOP on

begin;

do $tables$
declare n integer;
begin
  select count(*) into n
  from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='hr_private'
    and c.relname in ('identifiers','employment_terms','compensation_history','payment_details')
    and c.relkind='r' and c.relrowsecurity;
  if n<>4 then
    raise exception 'Protected HR gate failure: expected 4 Stage 3 protected tables with RLS, found %.',n;
  end if;

  if has_schema_privilege('authenticated','hr_private','USAGE')
     or has_schema_privilege('anon','hr_private','USAGE') then
    raise exception 'Protected HR gate failure: browser roles gained hr_private schema usage.';
  end if;
end
$tables$;

do $rpc_surface$
begin
  if has_function_privilege('anon','public.hr_protected_summary(uuid)','EXECUTE')
     or has_function_privilege('anon','public.hr_protected_record(uuid,text,jsonb,uuid,text)','EXECUTE') then
    raise exception 'Protected HR gate failure: anon can execute protected HR RPCs.';
  end if;
  if not has_function_privilege('authenticated','public.hr_protected_summary(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.hr_protected_record(uuid,text,jsonb,uuid,text)','EXECUTE') then
    raise exception 'Protected HR gate failure: reviewed authenticated RPC surface is missing.';
  end if;
end
$rpc_surface$;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $staff_denied$
begin
  begin
    perform public.hr_protected_summary('31000000-0000-4000-8000-000000000001');
    raise exception 'Protected HR gate failure: Staff read protected HR.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.hr_protected_record(
      '31000000-0000-4000-8000-000000000001','identifier',
      '{"identifier_type":"Test identifier","identifier_value":"STAFF-DENIED"}'::jsonb,
      null,'denial probe'
    );
    raise exception 'Protected HR gate failure: Staff wrote protected HR.';
  exception when insufficient_privilege then null;
  end;
end
$staff_denied$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $admin_flow$
declare
  v_first uuid;
  v_second uuid;
  v_summary jsonb;
  v_before jsonb;
  v_count integer;
begin
  -- The gate may run after a permitted browser acceptance test already wrote
  -- protected fixture history. Assert exactly the records this transaction
  -- creates, not that the account had no earlier history.
  v_before:=public.hr_protected_summary('31000000-0000-4000-8000-000000000001');
  v_first:=public.hr_protected_record(
    '31000000-0000-4000-8000-000000000001','identifier',
    '{"identifier_type":"Fixture ID","identifier_value":"FIXTURE-001"}'::jsonb,
    null,'Stage 3 identifier record'
  );

  v_second:=public.hr_protected_record(
    '31000000-0000-4000-8000-000000000001','identifier',
    '{"identifier_type":"Fixture ID","identifier_value":"FIXTURE-002"}'::jsonb,
    v_first,'Stage 3 identifier correction'
  );

  perform public.hr_protected_record(
    '31000000-0000-4000-8000-000000000001','employment_term',
    '{"term_type":"Fixture term","summary":"Synthetic employment term for security acceptance.","starts_on":"2026-09-01"}'::jsonb,
    null,'Stage 3 employment term'
  );

  perform public.hr_protected_record(
    '31000000-0000-4000-8000-000000000001','compensation',
    '{"amount_minor":650000,"currency":"GHS","basis_label":"Monthly","effective_on":"2026-09-01","note":"Synthetic acceptance amount"}'::jsonb,
    null,'Stage 3 compensation record'
  );

  perform public.hr_protected_record(
    '31000000-0000-4000-8000-000000000001','payment_detail',
    '{"payment_type":"Bank transfer","provider_name":"Fixture Bank","account_name":"Staff Fixture","account_reference":"TEST-0001"}'::jsonb,
    null,'Stage 3 payment record'
  );

  v_summary:=public.hr_protected_summary('31000000-0000-4000-8000-000000000001');

  if not exists(
    select 1
    from jsonb_array_elements(v_summary->'identifiers') item
    where item->>'id'=v_first::text and item->>'status'='replaced'
  ) then
    raise exception 'Protected HR gate failure: replacement did not preserve prior identifier history.';
  end if;

  if not exists(
    select 1
    from jsonb_array_elements(v_summary->'identifiers') item
    where item->>'id'=v_second::text
      and item->>'status'='active'
      and item->>'replaces_id'=v_first::text
  ) then
    raise exception 'Protected HR gate failure: replacement identifier is incorrect.';
  end if;

  if jsonb_array_length(v_summary->'identifiers')<>jsonb_array_length(v_before->'identifiers')+2
     or jsonb_array_length(v_summary->'employment_terms')<>jsonb_array_length(v_before->'employment_terms')+1
     or jsonb_array_length(v_summary->'compensation')<>jsonb_array_length(v_before->'compensation')+1
     or jsonb_array_length(v_summary->'payment_details')<>jsonb_array_length(v_before->'payment_details')+1 then
    raise exception 'Protected HR gate failure: protected summary did not return the recorded history.';
  end if;

end
$admin_flow$;

reset role;

do $audit_evidence$
declare v_count integer;
begin
  select count(*) into v_count
  from hr_private.audit_events
  where subject_profile_id='31000000-0000-4000-8000-000000000001'
    and action in ('protected_hr_recorded','protected_hr_viewed');
  if v_count<6 then
    raise exception 'Protected HR gate failure: sensitive access/write audit is incomplete.';
  end if;
end
$audit_evidence$;

do $storage_boundary$
declare n integer;
begin
  select count(*) into n from pg_policies
  where schemaname='storage' and tablename='objects'
    and policyname in ('ceac_hr_private_select','ceac_hr_private_insert','ceac_hr_private_delete');
  if n<>3 then
    raise exception 'Protected HR gate failure: expected protected Storage read/upload/cleanup policies.';
  end if;
end
$storage_boundary$;

rollback;

select 'CEAC OS Stage 3 protected HR gate passed' as result;
