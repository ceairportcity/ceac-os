\set ON_ERROR_STOP on
begin;

do $contract$
declare
  callable_count integer;
  anon_count integer;
  v_qual text;
  v_check text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='organisations'
      and column_name='privileged_mfa_required'
      and data_type='boolean'
      and is_nullable='NO'
      and column_default ilike '%false%'
  ) then
    raise exception 'S1 MFA gate failure: organisation enforcement flag is missing or not default-off.';
  end if;

  if to_regprocedure('public.app_privileged_aal_allowed()') is null then
    raise exception 'S1 MFA gate failure: internal assurance helper is missing.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='app_privileged_aal_allowed'
      and p.prosecdef
  ) then
    raise exception 'S1 MFA gate failure: internal assurance helper must remain SECURITY DEFINER.';
  end if;

  if has_function_privilege('authenticated','public.app_privileged_aal_allowed()','EXECUTE')
     or has_function_privilege('anon','public.app_privileged_aal_allowed()','EXECUTE') then
    raise exception 'S1 MFA gate failure: internal SECURITY DEFINER assurance helper is directly browser-callable.';
  end if;

  if pg_get_functiondef('public.app_privileged_aal_allowed()'::regprocedure)
       not ilike '%factor_type%totp%' then
    raise exception 'S1 MFA gate failure: privileged server authority is not pinned to verified TOTP.';
  end if;

  if pg_get_functiondef('public.app_privileged_aal_allowed()'::regprocedure)
       not ilike '%amr%'
     or pg_get_functiondef('public.app_privileged_aal_allowed()'::regprocedure)
       not ilike '%method == "totp"%' then
    raise exception 'S1 MFA gate failure: privileged server authority does not require TOTP in the current session AMR.';
  end if;

  select count(*) into callable_count
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and has_function_privilege('authenticated',p.oid,'EXECUTE');
  -- Later reviewed Work, HR and attendance migrations expanded the
  -- authenticated surface to 176 exact signatures, including the reviewed Executive project-department RPC. A separate test,
  -- security_definer_surface_gate.sql, locks every signature by name.
  -- This is only an independent count regression check: never relax the
  -- anonymous-callability test or the verified-TOTP/AAL2 assertions below.
  if callable_count<>176 then
    raise exception 'S1 MFA gate failure: expected 176 independently reviewed authenticated SECURITY DEFINER interfaces; found %.',callable_count;
  end if;

  select count(*) into anon_count
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and has_function_privilege('anon',p.oid,'EXECUTE');
  if anon_count<>0 then
    raise exception 'S1 MFA gate failure: % anonymous SECURITY DEFINER functions are callable.',anon_count;
  end if;

  if pg_get_functiondef('public.app_is_admin()'::regprocedure) not ilike '%app_privileged_aal_allowed%'
     or pg_get_functiondef('public.app_is_exec()'::regprocedure) not ilike '%app_privileged_aal_allowed%'
     or pg_get_functiondef('public.app_has_capability(text,uuid)'::regprocedure) not ilike '%app_privileged_aal_allowed%'
     or pg_get_functiondef('public.app_managed_units()'::regprocedure) not ilike '%app_privileged_aal_allowed%'
     or pg_get_functiondef('public.app_led_sub_teams()'::regprocedure) not ilike '%app_privileged_aal_allowed%'
     or pg_get_functiondef('public.app_can_review_item(uuid)'::regprocedure) not ilike '%app_privileged_aal_allowed%' then
    raise exception 'S1 MFA gate failure: an elevated authority helper is not MFA-aware.';
  end if;

  select qual,with_check into v_qual,v_check
  from pg_policies
  where schemaname='public' and tablename='ministry_events' and policyname='mev_write';

  if v_qual is null or v_check is null
     or v_qual not ilike '%app_managed_units%'
     or v_check not ilike '%app_managed_units%'
     or v_qual ilike '%role = ''manager''%'
     or v_check ilike '%role = ''manager''%' then
    raise exception 'S1 MFA gate failure: ministry_events Manager write path bypasses reviewed authority helpers.';
  end if;
end
$contract$;

-- Rolled-back test-only factors prove both the signed AAL2 claim and current
-- verified-factor state. No production factor is changed.
insert into auth.mfa_factors(
  id,user_id,friendly_name,factor_type,status,created_at,updated_at,secret
) values
  (
    '51000000-0000-4000-8000-000000000002',
    '31000000-0000-4000-8000-000000000002',
    'S1 Manager gate fixture',
    'totp'::auth.factor_type,
    'verified'::auth.factor_status,
    now(),now(),'local-gate-not-used'
  ),
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

-- Test-phase compatibility: switch defaults off.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
do $default_off$
begin
  if not public.app_is_admin() or not public.app_has_capability('people.manage',null) then
    raise exception 'S1 MFA gate failure: default-off changed current Administration authority.';
  end if;
end
$default_off$;
reset role;

update public.organisations
set privileged_mfa_required=true
where id='10000000-0000-4000-8000-000000000010';

-- Staff keeps ordinary bootstrap and gains no elevated authority.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $staff_aal1$
begin
  if public.app_org_id() is null or not exists(select 1 from public.app_my_units()) then
    raise exception 'S1 MFA gate failure: ordinary Staff lost organisation/unit bootstrap at AAL1.';
  end if;
  if public.app_is_admin() or public.app_is_exec()
     or public.app_has_capability('people.manage',null)
     or exists(select 1 from public.app_managed_units())
     or exists(select 1 from public.app_led_sub_teams()) then
    raise exception 'S1 MFA gate failure: ordinary Staff gained elevated authority.';
  end if;
end
$staff_aal1$;

-- Manager and work-lane review authority disappear at AAL1.
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $manager_aal1$
begin
  if public.app_org_id() is null or not exists(select 1 from public.app_my_units()) then
    raise exception 'S1 MFA gate failure: Manager lost ordinary bootstrap.';
  end if;
  if exists(select 1 from public.app_managed_units())
     or exists(select 1 from public.app_led_sub_teams())
     or public.app_can_review_item('26000000-0000-4000-8000-000000000011') then
    raise exception 'S1 MFA gate failure: AAL1 Manager retained elevated authority.';
  end if;
end
$manager_aal1$;

select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","amr":[{"method":"totp","timestamp":1700000000}]}',true);
do $manager_aal2$
begin
  if not exists(select 1 from public.app_managed_units() as u(unit_id) where u.unit_id='20000000-0000-4000-8000-000000000011'::uuid)
     or not exists(select 1 from public.app_led_sub_teams() as s(sub_team_id) where s.sub_team_id='22000000-0000-4000-8000-000000000011'::uuid)
     or not public.app_can_review_item('26000000-0000-4000-8000-000000000011') then
    raise exception 'S1 MFA gate failure: AAL2 Manager/work-lane authority was not restored.';
  end if;
end
$manager_aal2$;

-- Administration capability and protected People access disappear at AAL1.
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
do $admin_aal1$
begin
  if public.app_is_admin() or public.app_has_capability('people.manage',null) then
    raise exception 'S1 MFA gate failure: AAL1 Administration retained elevated authority.';
  end if;
  begin
    perform public.admin_people_summary();
    raise exception 'S1 MFA gate failure: AAL1 Administration called protected People summary.';
  exception when insufficient_privilege then null;
  end;
end
$admin_aal1$;

select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","amr":[{"method":"totp","timestamp":1700000000}]}',true);
do $admin_aal2$
begin
  if not public.app_is_admin()
     or not public.app_has_capability('people.manage',null)
     or not public.app_has_capability('authority.manage',null) then
    raise exception 'S1 MFA gate failure: AAL2 Administration authority was not restored.';
  end if;
end
$admin_aal2$;

-- A stale AAL2 JWT must not preserve privilege after its verified factor is removed.
reset role;
update auth.mfa_factors
set status='unverified'::auth.factor_status,updated_at=now()
where id='51000000-0000-4000-8000-000000000003';

insert into auth.mfa_factors(
  id,user_id,friendly_name,factor_type,status,created_at,updated_at,phone
) values (
  '51000000-0000-4000-8000-000000000013',
  '31000000-0000-4000-8000-000000000003',
  'S1 non-TOTP denial fixture',
  'phone'::auth.factor_type,
  'verified'::auth.factor_status,
  now(),now(),'+233000000000'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","amr":[{"method":"totp","timestamp":1700000000}]}',true);
do $admin_stale_aal2$
begin
  if public.app_org_id() is null then
    raise exception 'S1 MFA gate failure: stale-AAL2 Administration lost ordinary organisation bootstrap.';
  end if;
  if public.app_is_admin()
     or public.app_has_capability('people.manage',null)
     or public.app_has_capability('authority.manage',null) then
    raise exception 'S1 MFA gate failure: stale AAL2 retained privilege without a verified TOTP factor.';
  end if;
end
$admin_stale_aal2$;

reset role;
update auth.mfa_factors
set status='verified'::auth.factor_status,updated_at=now()
where id='51000000-0000-4000-8000-000000000003';

set local role authenticated;

-- A verified TOTP on the account is not enough by itself. The current AAL2
-- session must show that TOTP was actually one of its authentication methods.
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","amr":[{"method":"otp","timestamp":1700000000}]}',
  true
);
do $admin_non_totp_aal2$
begin
  if public.app_is_admin()
     or public.app_has_capability('people.manage',null)
     or public.app_has_capability('authority.manage',null) then
    raise exception 'S1 MFA gate failure: non-TOTP AAL2 session retained privileged authority.';
  end if;
end
$admin_non_totp_aal2$;

-- Executive follows the same boundary.
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
do $exec_aal1$
begin
  if public.app_is_exec() or public.app_has_capability('payroll.approve',null) then
    raise exception 'S1 MFA gate failure: AAL1 Executive retained elevated authority.';
  end if;
end
$exec_aal1$;

select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2","amr":[{"method":"totp","timestamp":1700000000}]}',true);
do $exec_aal2$
begin
  if not public.app_is_exec() or not public.app_has_capability('payroll.approve',null) then
    raise exception 'S1 MFA gate failure: AAL2 Executive authority was not restored.';
  end if;
end
$exec_aal2$;

reset role;
rollback;
select 'CEAC OS S1 privileged MFA/AAL2 gate passed' as result;
