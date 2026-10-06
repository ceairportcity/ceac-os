\set ON_ERROR_STOP on
begin;

do $indexes$
begin
  if to_regclass('public.unit_memberships_org_id_idx') is null
     or to_regclass('public.capability_grants_scope_unit_id_idx') is null
     or to_regclass('public.work_items_assigned_by_idx') is null
     or to_regclass('public.work_items_phase_id_idx') is null
     or to_regclass('public.work_items_responsibility_id_idx') is null
     or to_regclass('public.work_sessions_work_item_id_idx') is null
     or to_regclass('public.submissions_session_id_idx') is null
     or to_regclass('public.alerts_org_id_idx') is null then
    raise exception 'S6 hot-path gate failure: one or more reviewed FK indexes are missing.';
  end if;
end
$indexes$;

do $membership_policy$
declare v_qual text;
begin
  select qual into v_qual
  from pg_policies
  where schemaname='public'
    and tablename='unit_memberships'
    and policyname='memberships_read';

  if v_qual is null
     or v_qual not ilike '%select auth.uid()%'
     or v_qual not ilike '%select app_org_id()%'
     or v_qual not ilike '%select app_visible_units()%'
     or v_qual ilike '%profile_id = auth.uid()%' then
    raise exception 'S6 hot-path gate failure: memberships_read lost the reviewed init-plan shape.';
  end if;
end
$membership_policy$;

do $capability_policy$
declare v_qual text;
begin
  select qual into v_qual
  from pg_policies
  where schemaname='public'
    and tablename='capability_grants'
    and policyname='capability_grants_read';

  if v_qual is null
     or v_qual not ilike '%select auth.uid()%'
     or v_qual not ilike '%select app_org_id()%'
     or v_qual not ilike '%select app_has_capability%'
     or v_qual ilike '%profile_id = auth.uid()%' then
    raise exception 'S6 hot-path gate failure: capability_grants_read lost the reviewed init-plan shape.';
  end if;
end
$capability_policy$;

do $workforce_session_policy$
declare v_qual text;
begin
  select qual into v_qual
  from pg_policies
  where schemaname='public'
    and tablename='work_sessions'
    and policyname='stage9_work_sessions_workforce_read';

  if v_qual is null
     or v_qual not ilike '%select auth.uid()%'
     or v_qual not ilike '%select app_org_id()%'
     or v_qual not ilike '%select app_has_capability%'
     or v_qual not ilike '%select app_managed_units()%'
     or v_qual ilike '%profile_id = auth.uid()%' then
    raise exception 'S6 hot-path gate failure: workforce session read policy lost the reviewed init-plan shape.';
  end if;
end
$workforce_session_policy$;

-- Preserve the capability boundary while changing only evaluation shape.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $staff_capability_boundary$
declare n integer;
begin
  select count(*) into n
  from public.capability_grants
  where profile_id='31000000-0000-4000-8000-000000000003'::uuid;

  if n<>0 then
    raise exception 'S6 hot-path gate failure: Staff gained visibility into another profile capability grants.';
  end if;
end
$staff_capability_boundary$;

reset role;
rollback;

select 'CEAC OS S6 hot-path security/performance gate passed' as result;
