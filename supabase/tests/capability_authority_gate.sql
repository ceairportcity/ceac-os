\set ON_ERROR_STOP on

begin;

do $authority_tables$
declare n integer;
begin
  select count(*) into n
  from pg_class c
  join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='public'
    and c.relname in ('capability_definitions','capability_grants')
    and c.relkind='r'
    and c.relrowsecurity;
  if n<>2 then
    raise exception 'Capability authority gate failure: expected both authority tables with RLS, found %.',n;
  end if;

  select count(*) into n from public.capability_definitions;
  if n<>23 then
    raise exception 'Capability authority gate failure: expected 23 canonical capabilities including bounded Technical Support, found %.',n;
  end if;

  if not exists(
    select 1 from public.capability_definitions
    where capability='learning.manage'
  ) then
    raise exception 'Capability authority gate failure: Stage 8 learning.manage capability is missing.';
  end if;

  if not exists(
    select 1 from public.capability_definitions
    where capability='workforce.manage'
  ) then
    raise exception 'Capability authority gate failure: Stage 9 workforce.manage capability is missing.';
  end if;

  if not exists(
    select 1 from public.capability_definitions
    where capability='asset.manage'
  ) then
    raise exception 'Capability authority gate failure: Stage 10 asset.manage capability is missing.';
  end if;

  if not exists(
    select 1 from public.capability_definitions
    where capability='compliance.manage'
  ) then
    raise exception 'Capability authority gate failure: Stage 11 compliance.manage capability is missing.';
  end if;

  if not exists(
    select 1 from public.capability_definitions
    where capability='post_announcement'
  ) then
    raise exception 'Capability authority gate failure: Phase 3 post_announcement capability is missing.';
  end if;
end
$authority_tables$;

do $authority_privileges$
begin
  if has_table_privilege('anon','public.capability_definitions','SELECT')
     or has_table_privilege('anon','public.capability_grants','SELECT')
     or has_table_privilege('anon','public.capability_grants','INSERT')
     or has_table_privilege('anon','public.capability_grants','UPDATE')
     or has_table_privilege('anon','public.capability_grants','DELETE') then
    raise exception 'Capability authority gate failure: anon has authority-table privileges.';
  end if;

  if has_table_privilege('authenticated','public.capability_grants','INSERT')
     or has_table_privilege('authenticated','public.capability_grants','UPDATE')
     or has_table_privilege('authenticated','public.capability_grants','DELETE') then
    raise exception 'Capability authority gate failure: authenticated can directly mutate capability grants.';
  end if;

  if not has_table_privilege('authenticated','public.capability_grants','SELECT')
     or not has_table_privilege('authenticated','public.capability_definitions','SELECT') then
    raise exception 'Capability authority gate failure: reviewed read grants are missing.';
  end if;
end
$authority_privileges$;

do $authority_rpc_privileges$
begin
  if has_function_privilege('anon','public.app_has_capability(text,uuid)','EXECUTE')
     or has_function_privilege('anon','public.grant_capability(uuid,text,uuid,text,timestamp with time zone)','EXECUTE')
     or has_function_privilege('anon','public.revoke_capability(uuid,text)','EXECUTE') then
    raise exception 'Capability authority gate failure: anon can execute authority functions.';
  end if;

  if not has_function_privilege('authenticated','public.app_has_capability(text,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.grant_capability(uuid,text,uuid,text,timestamp with time zone)','EXECUTE')
     or not has_function_privilege('authenticated','public.revoke_capability(uuid,text)','EXECUTE') then
    raise exception 'Capability authority gate failure: reviewed authority functions are unavailable.';
  end if;
end
$authority_rpc_privileges$;

do $authority_audit$
begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public'
      and c.relname='capability_grants'
      and t.tgname='audit_capability_grants'
      and not t.tgisinternal
  ) then
    raise exception 'Capability authority gate failure: capability grant audit trigger is missing.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='platform_audit_events'
      and policyname='platform_audit_events_admin_read'
  ) then
    raise exception 'Capability authority gate failure: legacy role-only audit policy still exists.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='platform_audit_events'
      and policyname='platform_audit_events_capability_read'
      and coalesce(qual,'') ilike '%app_has_capability%'
      and coalesce(qual,'') ilike '%audit.view%'
  ) then
    raise exception 'Capability authority gate failure: audit.view capability policy is missing.';
  end if;
end
$authority_audit$;

do $people_capability_binding$
declare n integer;
begin
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public'
    and p.proname in (
      'admin_people_summary','admin_person_detail',
      'admin_employment_detail','admin_update_employment','assign_unit_head'
    )
    and pg_get_functiondef(p.oid) ilike '%app_has_capability(''people.manage''%';

  if n<>5 then
    raise exception 'Capability authority gate failure: only % of 5 sensitive People functions use people.manage.',n;
  end if;
end
$people_capability_binding$;

-- The local fixture Admin must be explicitly authorised; is_admin alone is not enough.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $admin_baseline$
begin
  if not public.app_has_capability('authority.manage',null)
     or not public.app_has_capability('people.manage',null)
     or not public.app_has_capability('audit.view',null) then
    raise exception 'Capability authority gate failure: Admin fixture lacks explicit baseline grants.';
  end if;
end
$admin_baseline$;

do $grant_revoke$
declare
  v_grant public.capability_grants;
begin
  v_grant:=public.grant_capability(
    '31000000-0000-4000-8000-000000000002',
    'performance.admin',
    '20000000-0000-4000-8000-000000000011',
    'Stage 1C gate grant'
  );

  if v_grant.id is null then
    raise exception 'Capability authority gate failure: grant RPC returned no grant.';
  end if;

  perform public.revoke_capability(v_grant.id,'Stage 1C gate revoke');

  if not exists (
    select 1 from public.capability_grants
    where id=v_grant.id and revoked_at is not null
  ) then
    raise exception 'Capability authority gate failure: revoke RPC did not preserve revoked history.';
  end if;
end
$grant_revoke$;

do $payroll_separation$
begin
  if not public.app_has_capability('payroll.prepare',null) then
    raise exception 'Capability authority gate failure: Administration fixture lacks payroll.prepare.';
  end if;

  begin
    perform public.grant_capability(
      '31000000-0000-4000-8000-000000000003',
      'payroll.approve',
      null,
      'FPG5 conflicting Administration payroll probe'
    );
    raise exception 'Capability authority gate failure: Administration received payroll approval authority.';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.grant_capability(
      '31000000-0000-4000-8000-000000000004',
      'payroll.prepare',
      null,
      'FPG5 conflicting Executive payroll probe'
    );
    raise exception 'Capability authority gate failure: Executive received payroll preparation authority.';
  exception when insufficient_privilege then
    null;
  end;
end
$payroll_separation$;

do $last_authority_manager$
declare
  v_id uuid;
begin
  select id into v_id
  from public.capability_grants
  where profile_id='31000000-0000-4000-8000-000000000003'
    and capability='authority.manage'
    and scope_unit_id is null
    and revoked_at is null
  limit 1;

  begin
    perform public.revoke_capability(v_id,'Stage 1C lockout probe');
    raise exception 'Capability authority gate failure: final authority manager could be revoked.';
  exception when insufficient_privilege then
    null;
  end;
end
$last_authority_manager$;

reset role;

-- Prove the role label itself does not retain People authority.
update public.capability_grants
set revoked_at=now(),
    revoked_by='31000000-0000-4000-8000-000000000003',
    revoke_reason='Stage 1C role-only denial probe'
where profile_id='31000000-0000-4000-8000-000000000003'
  and capability='people.manage'
  and scope_unit_id is null
  and revoked_at is null;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $role_alone_denied$
begin
  begin
    perform public.admin_people_summary();
    raise exception 'Capability authority gate failure: is_admin alone still grants People authority.';
  exception when insufficient_privilege then
    null;
  end;
end
$role_alone_denied$;

reset role;

rollback;

select 'CEAC OS Stage 1C capability authority gate passed' as result;
