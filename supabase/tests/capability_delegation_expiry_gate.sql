\set ON_ERROR_STOP on
begin;

do $contract$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='capability_grants'
      and column_name='expires_at' and data_type='timestamp with time zone'
  ) then
    raise exception 'S3 delegation gate failure: expires_at is missing.';
  end if;

  if to_regprocedure('public.grant_capability(uuid,text,uuid,text,timestamp with time zone)') is null
     or to_regprocedure('public.grant_capability(uuid,text,uuid,text)') is not null then
    raise exception 'S3 delegation gate failure: grant_capability signature was not migrated cleanly.';
  end if;

  if has_function_privilege('anon','public.grant_capability(uuid,text,uuid,text,timestamp with time zone)','EXECUTE')
     or not has_function_privilege('authenticated','public.grant_capability(uuid,text,uuid,text,timestamp with time zone)','EXECUTE') then
    raise exception 'S3 delegation gate failure: capability grant RPC privileges are incorrect.';
  end if;

  if pg_get_functiondef('public.app_has_capability(text,uuid)'::regprocedure) not ilike '%expires_at%'
     or pg_get_functiondef('public.guard_last_authority()'::regprocedure) not ilike '%expires_at%'
     or pg_get_functiondef('public.guard_payroll_capability_grant()'::regprocedure) not ilike '%expires_at%' then
    raise exception 'S3 delegation gate failure: an authority path ignores expiry.';
  end if;
end
$contract$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

select (public.grant_capability(
  '31000000-0000-4000-8000-000000000002',
  'performance.admin',
  '20000000-0000-4000-8000-000000000011',
  'S3 temporary delegation gate',
  now()+interval '1 day'
)).id as temp_grant_id
\gset

select set_config('ceac.test.temp_grant_id', :'temp_grant_id', true);

do $temporary_created$
begin
  if nullif(current_setting('ceac.test.temp_grant_id',true),'') is null then
    raise exception 'S3 delegation gate failure: temporary grant was not created.';
  end if;
end
$temporary_created$;

select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

do $temporary_active$
begin
  if not public.app_has_capability('performance.admin','20000000-0000-4000-8000-000000000011') then
    raise exception 'S3 delegation gate failure: unexpired temporary authority is not effective.';
  end if;
end
$temporary_active$;

reset role;

-- Simulate elapsed time without sleeping; the transaction rolls back.
update public.capability_grants
set granted_at=now()-interval '2 days',
    expires_at=now()-interval '1 day'
where id=current_setting('ceac.test.temp_grant_id')::uuid;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

do $temporary_expired$
begin
  if public.app_has_capability('performance.admin','20000000-0000-4000-8000-000000000011') then
    raise exception 'S3 delegation gate failure: expired temporary authority remained effective.';
  end if;
end
$temporary_expired$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

select (public.grant_capability(
  '31000000-0000-4000-8000-000000000002',
  'performance.admin',
  '20000000-0000-4000-8000-000000000011',
  'S3 replacement after expiry',
  null
)).id as replacement_grant_id
\gset

select set_config('ceac.test.replacement_grant_id', :'replacement_grant_id', true);

do $replacement_history$
begin
  if not exists (
    select 1 from public.capability_grants
    where id=current_setting('ceac.test.temp_grant_id')::uuid
      and revoked_at is not null
      and expires_at is not null
  ) then
    raise exception 'S3 delegation gate failure: expired grant history was not closed before replacement.';
  end if;

  if not exists (
    select 1 from public.capability_grants
    where id=current_setting('ceac.test.replacement_grant_id')::uuid
      and revoked_at is null
      and expires_at is null
  ) then
    raise exception 'S3 delegation gate failure: replacement grant was not active.';
  end if;
end
$replacement_history$;

select (public.grant_capability(
  '31000000-0000-4000-8000-000000000001',
  'authority.manage',
  null,
  'S3 temporary authority supplement',
  now()+interval '1 day'
)).id as temp_authority_id
\gset

do $permanent_authority_invariant$
declare
  v_admin_grant uuid;
begin
  select id into v_admin_grant
  from public.capability_grants
  where profile_id='31000000-0000-4000-8000-000000000003'
    and capability='authority.manage'
    and scope_unit_id is null
    and revoked_at is null
    and expires_at is null
  limit 1;

  begin
    perform public.revoke_capability(v_admin_grant,'S3 permanent-authority lockout probe');
    raise exception 'S3 delegation gate failure: temporary authority replaced the last permanent authority manager.';
  exception when insufficient_privilege then
    null;
  end;
end
$permanent_authority_invariant$;

do $past_expiry_denied$
begin
  begin
    perform public.grant_capability(
      '31000000-0000-4000-8000-000000000002',
      'learning.manage',
      null,
      'S3 past-expiry probe',
      now()-interval '1 minute'
    );
    raise exception 'S3 delegation gate failure: a grant was created already expired.';
  exception when others then
    if sqlerrm not ilike '%expiry must be in the future%' then
      raise;
    end if;
  end;
end
$past_expiry_denied$;

reset role;
rollback;

select 'CEAC OS S3 capability delegation expiry gate passed' as result;
