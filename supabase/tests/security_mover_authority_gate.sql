\set ON_ERROR_STOP on
begin;

do $contract$
begin
  if to_regprocedure('public.close_lane_authority_on_membership_end()') is null then
    raise exception 'S3 mover gate failure: membership-end lane closer is missing.';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.close_lane_authority_on_membership_end()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.close_lane_authority_on_membership_end()',
       'EXECUTE'
     ) then
    raise exception 'S3 mover gate failure: internal membership-end trigger is browser executable.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='unit_memberships'
      and t.tgname='unit_memberships_close_lane_on_delete'
      and not t.tgisinternal
  ) then
    raise exception 'S3 mover gate failure: membership-delete authority trigger is missing.';
  end if;
end
$contract$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);
select set_config('ceac.employment_sync','skip',true);

delete from public.unit_memberships
where org_id='10000000-0000-4000-8000-000000000010'
  and profile_id='31000000-0000-4000-8000-000000000002'
  and unit_id='20000000-0000-4000-8000-000000000011';

do $membership_end$
begin
  if exists (
    select 1
    from public.sub_teams
    where id='22000000-0000-4000-8000-000000000011'
      and lead_id='31000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'S3 mover gate failure: ended Unit A membership retained Video Team lead authority.';
  end if;

  if not exists (
    select 1
    from public.platform_audit_events
    where resource_type='sub_team'
      and resource_id='22000000-0000-4000-8000-000000000011'
      and actor_id='31000000-0000-4000-8000-000000000003'
      and 'lead_id'=any(changed_fields)
  ) then
    raise exception 'S3 mover gate failure: lane-lead removal was not audited to the acting Admin.';
  end if;
end
$membership_end$;

reset role;
rollback;

select 'CEAC OS S3 mover authority gate passed' as result;
