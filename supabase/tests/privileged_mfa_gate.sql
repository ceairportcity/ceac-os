\set ON_ERROR_STOP on

begin;

-- This gate is wired into CI only with the matching S1 migration.
-- Every mutation is rolled back.
do $contract$
declare
  callable_count integer;
  anon_count integer;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='organisations'
      and column_name='privileged_mfa_enforced'
      and data_type='boolean'
  ) then
    raise exception 'S1 MFA gate failure: organisation enforcement flag is missing.';
  end if;

  if to_regprocedure('public.app_privileged_aal_allowed()') is null then
    raise exception 'S1 MFA gate failure: internal assurance helper is missing.';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='app_privileged_aal_allowed'
      and p.prosecdef
  ) then
    raise exception 'S1 MFA gate failure: assurance helper unnecessarily became SECURITY DEFINER.';
  end if;

  if has_function_privilege('authenticated','public.app_privileged_aal_allowed()','EXECUTE')
     or has_function_privilege('anon','public.app_privileged_aal_allowed()','EXECUTE') then
    raise exception 'S1 MFA gate failure: internal assurance helper is directly browser-callable.';
  end if;

  select count(*) into callable_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.prosecdef
    and has_function_privilege('authenticated',p.oid,'EXECUTE');

  if callable_count<>132 then
    raise exception 'S1 MFA gate failure: authenticated SECURITY DEFINER ceiling changed from 132 to %.',callable_count;
  end if;

  select count(*) into anon_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.prosecdef
    and has_function_privilege('anon',p.oid,'EXECUTE');

  if anon_count<>0 then
    raise exception 'S1 MFA gate failure: % anonymous SECURITY DEFINER functions are callable.',anon_count;
  end if;
end
$contract$;

-- Test-only verified factors prove both the JWT assurance claim and the live Auth
-- factor state. They exist only inside this rolled-back transaction.
insert into auth.mfa_factors(
  id,user_id,friendly_name,factor_type,status,created_at,updated_at,secret
) values
  (
    '51000000-0000-4000-8000-000000000003',
    '31000000-0000-4000-8000-000000000003',
    'S1 Admin gate fixture',
    'totp'::auth.factor_type,
    'verified'::auth.factor_status,
    now(),now(),'local-gate-not-used'
  ),
  (
    '51000000-0000-4000-8000-000000000004',
    '31000000-0000-4000-8000-000000000004',
    'S1 Executive gate fixture',
    'totp'::auth.factor_type,
    'verified'::auth.factor_status,
    now(),now(),'local-gate-not-used'
  );

-- Build/test compatibility: enforcement defaults off, so current AAL1 fixture
-- behavior remains available before final human enrollment.
update public.organisations
set privileged_mfa_enforced=false
where id='10000000-0000-4000-8000-000000000010';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);
do $admin_test_mode$
begin
  if public.app_org_id() is distinct from '10000000-0000-4000-8000-000000000010'::uuid then
    raise exception 'S1 MFA gate failure: Admin lost active organisation with enforcement off.';
  end if;
  if not public.app_is_admin() then
    raise exception 'S1 MFA gate failure: Admin test-phase authority changed while enforcement is off.';
  end if;
  if not public.app_has_capability('authority.manage',null) then
    raise exception 'S1 MFA gate failure: Admin capability changed while enforcement is off.';
  end if;
end
$admin_test_mode$;
reset role;

-- Turn enforcement on only inside this rolled-back acceptance transaction.
update public.organisations
set privileged_mfa_enforced=true
where id='10000000-0000-4000-8000-000000000010';

-- AAL1 Administration remains signed in and organisation-bound, but privileged
-- authority is unavailable.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);
do $admin_aal1$
begin
  if public.app_org_id() is distinct from '10000000-0000-4000-8000-000000000010'::uuid then
    raise exception 'S1 MFA gate failure: AAL1 Admin lost organisation identity needed for verification flow.';
  end if;
  if public.app_is_admin() then
    raise exception 'S1 MFA gate failure: AAL1 Admin retained privileged authority.';
  end if;
  if public.app_has_capability('authority.manage',null) then
    raise exception 'S1 MFA gate failure: AAL1 Admin retained authority.manage.';
  end if;
end
$admin_aal1$;

-- The same deterministic Administration fixture regains approved authority at AAL2.
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);
do $admin_aal2$
begin
  if not public.app_is_admin() then
    raise exception 'S1 MFA gate failure: AAL2 Admin authority was not restored.';
  end if;
  if not public.app_has_capability('authority.manage',null) then
    raise exception 'S1 MFA gate failure: AAL2 Admin capability was not restored.';
  end if;
end
$admin_aal2$;
reset role;

-- A stale AAL2 JWT must not preserve privilege after the verified factor is gone.
update auth.mfa_factors
set status='unverified'::auth.factor_status,updated_at=now()
where id='51000000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);
do $admin_stale_aal2$
begin
  if public.app_org_id() is distinct from '10000000-0000-4000-8000-000000000010'::uuid then
    raise exception 'S1 MFA gate failure: stale-AAL2 Admin lost organisation identity.';
  end if;
  if public.app_is_admin() or public.app_has_capability('authority.manage',null) then
    raise exception 'S1 MFA gate failure: stale AAL2 retained privilege without a verified factor.';
  end if;
end
$admin_stale_aal2$;
reset role;

update auth.mfa_factors
set status='verified'::auth.factor_status,updated_at=now()
where id='51000000-0000-4000-8000-000000000003';

-- Executive and payroll approval authority follow the same central boundary.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  true
);
do $exec_aal1$
begin
  if public.app_org_id() is distinct from '10000000-0000-4000-8000-000000000010'::uuid then
    raise exception 'S1 MFA gate failure: AAL1 Executive lost organisation identity.';
  end if;
  if public.app_is_exec() then
    raise exception 'S1 MFA gate failure: AAL1 Executive retained privileged authority.';
  end if;
  if public.app_has_capability('payroll.approve',null) then
    raise exception 'S1 MFA gate failure: AAL1 Executive retained payroll.approve.';
  end if;
end
$exec_aal1$;

select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',
  true
);
do $exec_aal2$
begin
  if not public.app_is_exec() then
    raise exception 'S1 MFA gate failure: AAL2 Executive authority was not restored.';
  end if;
  if not public.app_has_capability('payroll.approve',null) then
    raise exception 'S1 MFA gate failure: AAL2 Executive payroll approval was not restored.';
  end if;
end
$exec_aal2$;

-- Ordinary Staff keeps ordinary active identity at AAL1 and gains no privilege.
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
do $staff_aal1$
begin
  if public.app_org_id() is distinct from '10000000-0000-4000-8000-000000000010'::uuid then
    raise exception 'S1 MFA gate failure: ordinary Staff lost signed-in organisation access.';
  end if;
  if public.app_is_admin() or public.app_is_exec() or public.app_has_capability('authority.manage',null) then
    raise exception 'S1 MFA gate failure: ordinary Staff gained privileged authority.';
  end if;
end
$staff_aal1$;

reset role;
rollback;

select 'Privileged MFA / AAL2 gate passed' as result;
