\set ON_ERROR_STOP on
begin;

do $contract$
begin
  if to_regprocedure('public.close_profile_authority_on_deactivation()') is null then
    raise exception 'S3 JML gate failure: profile deactivation authority closer is missing.';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.close_profile_authority_on_deactivation()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.close_profile_authority_on_deactivation()',
       'EXECUTE'
     ) then
    raise exception 'S3 JML gate failure: internal deactivation trigger function is browser executable.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='profiles'
      and t.tgname='profiles_close_authority_on_deactivation'
      and not t.tgisinternal
  ) then
    raise exception 'S3 JML gate failure: profile deactivation trigger is missing.';
  end if;

  if pg_get_functiondef('public.app_led_sub_teams()'::regprocedure)
       not ilike '%unit_memberships%'
     or pg_get_functiondef('public.app_led_sub_teams()'::regprocedure)
       not ilike '%s.active%' then
    raise exception 'S3 JML gate failure: lane-lead authority is not bound to active current membership.';
  end if;

  if pg_get_functiondef('public.guard_last_authority()'::regprocedure)
       not ilike '%ap.active%'
     or pg_get_functiondef('public.revoke_capability(uuid,text)'::regprocedure)
       not ilike '%ap.active%' then
    raise exception 'S3 JML gate failure: inactive permanent authority holders can still satisfy anti-lockout.';
  end if;
end
$contract$;

-- Give the Same Unit fixture explicit authority, then prove controlled
-- offboarding closes that authority and its current unit membership.
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
  'S3 JML offboarding authority probe',
  now()+interval '1 day'
)).id as jml_grant_id
\gset

select set_config('ceac.test.jml_grant_id', :'jml_grant_id', true);

do $offboarding$
declare
  v_case uuid;
  v_step uuid;
  v_pos integer;
begin
  insert into public.employee_lifecycle_cases(
    org_id,profile_id,lifecycle_type,planned_effective_on,reason,state,created_by
  ) values (
    '10000000-0000-4000-8000-000000000010',
    '31000000-0000-4000-8000-000000000002',
    'offboarding',
    current_date,
    'S3 JML authority closure gate',
    'active',
    '31000000-0000-4000-8000-000000000003'
  )
  returning id into v_case;

  for v_pos in 1..4 loop
    select id into v_step
    from public.employee_lifecycle_steps
    where lifecycle_case_id=v_case
      and position=v_pos;

    update public.employee_lifecycle_steps
    set state='completed',
        completed_by='31000000-0000-4000-8000-000000000003',
        completed_at=now(),
        note='S3 JML gate step '||v_pos
    where id=v_step;
  end loop;
end
$offboarding$;

reset role;

do $offboarding_closed_authority$
begin
  if exists (
    select 1
    from public.profiles
    where id='31000000-0000-4000-8000-000000000002'
      and active
  ) then
    raise exception 'S3 JML gate failure: offboarded profile remained active.';
  end if;

  if not exists (
    select 1
    from public.capability_grants
    where id=current_setting('ceac.test.jml_grant_id')::uuid
      and revoked_at is not null
      and revoke_reason='Profile deactivated; operational authority closed'
  ) then
    raise exception 'S3 JML gate failure: offboarding did not close the active capability grant.';
  end if;

  if exists (
    select 1
    from public.unit_memberships
    where org_id='10000000-0000-4000-8000-000000000010'
      and profile_id='31000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'S3 JML gate failure: offboarding retained a current unit membership.';
  end if;

  if exists (
    select 1
    from public.sub_teams
    where id='22000000-0000-4000-8000-000000000011'
      and lead_id='31000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'S3 JML gate failure: offboarding retained the live Sub-team lead assignment.';
  end if;

  if not exists (
    select 1
    from public.platform_audit_events
    where resource_type='sub_team'
      and resource_id='22000000-0000-4000-8000-000000000011'
      and actor_id='31000000-0000-4000-8000-000000000003'
      and 'lead_id'=any(changed_fields)
  ) then
    raise exception 'S3 JML gate failure: Sub-team lead removal was not audited.';
  end if;
end
$offboarding_closed_authority$;

-- Independently prove stale lane attribution cannot confer authority when
-- current unit membership is absent. Restore only the stale lead pointer.
update public.sub_teams
set lead_id='31000000-0000-4000-8000-000000000002'
where id='22000000-0000-4000-8000-000000000011';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

do $stale_lane_lead_denied$
begin
  if exists (
    select 1
    from public.app_led_sub_teams() led(id)
    where led.id='22000000-0000-4000-8000-000000000011'
  ) then
    raise exception 'S3 JML gate failure: stale lane-lead attribution retained authority without current membership.';
  end if;
end
$stale_lane_lead_denied$;

reset role;
rollback;

select 'CEAC OS S3 JML authority gate passed' as result;
