\set ON_ERROR_STOP on
begin;

do $contract$
begin
  if to_regprocedure('public.app_identity_confirmed()') is null then
    raise exception 'S3 joiner gate failure: identity confirmation helper is missing.';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.app_identity_confirmed()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.app_identity_confirmed()',
       'EXECUTE'
     ) then
    raise exception 'S3 joiner gate failure: internal identity confirmation helper is browser executable.';
  end if;

  if pg_get_functiondef('public.app_org_id()'::regprocedure)
       not ilike '%email_confirmed_at is not null%'
     or pg_get_functiondef('public.app_privileged_aal_allowed()'::regprocedure)
       not ilike '%email_confirmed_at is not null%'
     or pg_get_functiondef('public.app_is_admin()'::regprocedure)
       not ilike '%app_identity_confirmed%'
     or pg_get_functiondef('public.app_is_exec()'::regprocedure)
       not ilike '%app_identity_confirmed%'
     or pg_get_functiondef('public.app_my_units()'::regprocedure)
       not ilike '%app_identity_confirmed%'
     or pg_get_functiondef('public.app_managed_units()'::regprocedure)
       not ilike '%app_identity_confirmed%'
     or pg_get_functiondef('public.app_led_sub_teams()'::regprocedure)
       not ilike '%app_identity_confirmed%' then
    raise exception 'S3 joiner gate failure: a core authority helper is not confirmation-gated.';
  end if;
end
$contract$;

-- Remove confirmation only inside this rolled-back transaction. Even with an
-- otherwise valid active Admin profile and AAL2-shaped JWT, CEAC authority must
-- fail closed until the Auth identity is confirmed.
update auth.users
set email_confirmed_at=null
where id='31000000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

do $unconfirmed_denied$
begin
  if public.app_org_id() is not null then
    raise exception 'S3 joiner gate failure: unconfirmed identity retained organisation authority.';
  end if;

  if public.app_is_admin() then
    raise exception 'S3 joiner gate failure: unconfirmed identity retained Admin authority.';
  end if;

  if public.app_is_exec() then
    raise exception 'S3 joiner gate failure: unconfirmed identity retained Executive authority.';
  end if;

  if public.app_has_capability('people.manage',null) then
    raise exception 'S3 joiner gate failure: unconfirmed identity retained capability authority.';
  end if;

  if exists (select 1 from public.app_my_units()) then
    raise exception 'S3 joiner gate failure: unconfirmed identity retained unit membership authority.';
  end if;

  if exists (select 1 from public.app_managed_units()) then
    raise exception 'S3 joiner gate failure: unconfirmed identity retained manager authority.';
  end if;

  if exists (select 1 from public.app_led_sub_teams()) then
    raise exception 'S3 joiner gate failure: unconfirmed identity retained work-lane lead authority.';
  end if;
end
$unconfirmed_denied$;

reset role;
rollback;

select 'CEAC OS S3 joiner authority gate passed' as result;
