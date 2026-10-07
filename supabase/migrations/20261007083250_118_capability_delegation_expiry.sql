-- 118 — Security S3: temporary capability delegation expiry.
-- Expiry ends authority automatically while retaining the grant row for audit history.

alter table public.capability_grants
  add column if not exists expires_at timestamp with time zone;

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.capability_grants'::regclass
      and conname='capability_grants_expiry_after_grant'
  ) then
    alter table public.capability_grants
      add constraint capability_grants_expiry_after_grant
      check (expires_at is null or expires_at > granted_at);
  end if;
end
$constraint$;

comment on column public.capability_grants.expires_at is
  'Optional end of delegated authority. Expired grants remain as historical audit records but confer no capability.';

create or replace function public.app_identity_confirmed()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id=p.id
    where p.id=auth.uid()
      and p.active
      and u.email_confirmed_at is not null
  );
$$;

revoke all on function public.app_identity_confirmed()
  from public,anon,authenticated;

create or replace function public.app_org_id()
returns uuid
language sql
stable
security definer
set search_path=public
as $$
  select p.org_id
  from public.profiles p
  join auth.users u on u.id=p.id
  where p.id=auth.uid()
    and p.active
    and u.email_confirmed_at is not null;
$$;

create or replace function public.app_privileged_aal_allowed()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select
      not o.privileged_mfa_required
      or (
        coalesce(auth.jwt()->>'aal','aal1')='aal2'
        and exists (
          select 1
          from auth.mfa_factors mf
          where mf.user_id=auth.uid()
            and mf.status='verified'::auth.factor_status
        )
      )
    from public.profiles p
    join public.organisations o on o.id=p.org_id
    join auth.users u on u.id=p.id
    where p.id=auth.uid()
      and p.active
      and u.email_confirmed_at is not null
  ),false);
$$;

create or replace function public.app_is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select p.is_admin
    from public.profiles p
    where p.id=auth.uid()
      and p.active
      and public.app_identity_confirmed()
      and public.app_privileged_aal_allowed()
  ),false);
$$;

create or replace function public.app_is_exec()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select p.is_exec
    from public.profiles p
    where p.id=auth.uid()
      and p.active
      and public.app_identity_confirmed()
      and public.app_privileged_aal_allowed()
  ),false);
$$;

create or replace function public.app_my_units()
returns setof uuid
language sql
stable
security definer
set search_path=public
as $$
  select m.unit_id
  from public.unit_memberships m
  join public.profiles p on p.id=m.profile_id
  where p.id=auth.uid()
    and p.active
    and public.app_identity_confirmed();
$$;

create or replace function public.app_managed_units()
returns setof uuid
language sql
stable
security definer
set search_path=public
as $$
  select m.unit_id
  from public.unit_memberships m
  join public.profiles p on p.id=m.profile_id
  where p.id=auth.uid()
    and p.active
    and m.role='manager'
    and public.app_identity_confirmed()
    and public.app_privileged_aal_allowed();
$$;

create or replace function public.app_has_capability(
  p_capability text,
  p_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.app_privileged_aal_allowed()
    and exists (
      select 1
      from public.profiles p
      join public.capability_grants cg
        on cg.profile_id=p.id
       and cg.org_id=p.org_id
      where p.id=auth.uid()
        and p.active
        and cg.revoked_at is null
        and (cg.expires_at is null or cg.expires_at > now())
        and cg.capability=p_capability
        and (
          cg.scope_unit_id is null
          or (p_unit_id is not null and cg.scope_unit_id=p_unit_id)
        )
    );
$$;

create or replace function public.app_led_sub_teams()
returns setof uuid
language sql
stable
security definer
set search_path=public
as $$
  select s.id
  from public.sub_teams s
  join public.profiles p
    on p.id=s.lead_id
   and p.org_id=s.org_id
  join public.unit_memberships m
    on m.profile_id=p.id
   and m.org_id=s.org_id
   and m.unit_id=s.unit_id
  where p.id=auth.uid()
    and p.active
    and s.active
    and public.app_identity_confirmed()
    and public.app_privileged_aal_allowed();
$$;

revoke all on function public.app_led_sub_teams() from public,anon;
grant execute on function public.app_led_sub_teams() to authenticated,service_role;

drop function if exists public.grant_capability(uuid,text,uuid,text);

create function public.grant_capability(
  p_profile_id uuid,
  p_capability text,
  p_scope_unit_id uuid default null,
  p_reason text default null,
  p_expires_at timestamp with time zone default null
)
returns public.capability_grants
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_grant public.capability_grants;
  v_opposite text;
begin
  if v_actor is null or not public.app_has_capability('authority.manage',null) then
    raise exception 'You do not have authority to manage capabilities.' using errcode='42501';
  end if;

  if nullif(btrim(coalesce(p_reason,'')),'') is null or length(btrim(p_reason))<3 then
    raise exception 'A reason is required for capability changes.';
  end if;

  if p_expires_at is not null and p_expires_at<=now() then
    raise exception 'Temporary capability expiry must be in the future.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id=p_profile_id and p.org_id=v_org and p.active
  ) then
    raise exception 'Choose an active person in your organisation.' using errcode='42501';
  end if;

  if not exists (
    select 1 from public.capability_definitions d where d.capability=p_capability
  ) then
    raise exception 'That capability is not part of the approved catalogue.';
  end if;

  if p_scope_unit_id is not null and not exists (
    select 1 from public.units u
    where u.id=p_scope_unit_id and u.org_id=v_org and u.active
  ) then
    raise exception 'Choose an active unit in your organisation.' using errcode='42501';
  end if;

  if p_capability in ('authority.manage','hr_private.access','payroll.prepare','payroll.approve','audit.view')
     and p_scope_unit_id is not null then
    raise exception 'That capability is organisation-scoped.';
  end if;

  -- Close an already-expired same-scope grant before replacement. Authority
  -- ended at expires_at; this update only closes the historical row explicitly.
  update public.capability_grants
  set revoked_by=v_actor,
      revoked_at=now(),
      revoke_reason=coalesce(revoke_reason,'Expired temporary grant closed before replacement')
  where org_id=v_org
    and profile_id=p_profile_id
    and capability=p_capability
    and scope_unit_id is not distinct from p_scope_unit_id
    and revoked_at is null
    and expires_at is not null
    and expires_at<=now();

  if exists (
    select 1 from public.capability_grants cg
    where cg.org_id=v_org
      and cg.profile_id=p_profile_id
      and cg.capability=p_capability
      and cg.scope_unit_id is not distinct from p_scope_unit_id
      and cg.revoked_at is null
      and (cg.expires_at is null or cg.expires_at>now())
  ) then
    raise exception 'That capability is already active for this scope.';
  end if;

  -- Preserve the existing anti-lockout invariant across automatic expiry:
  -- temporary authority.manage may supplement but never replace the last
  -- permanent authority manager.
  if p_capability='authority.manage' and p_scope_unit_id is null and p_expires_at is not null
     and not exists (
       select 1
       from public.capability_grants cg
       join public.profiles ap
         on ap.id=cg.profile_id
        and ap.org_id=cg.org_id
        and ap.active
       where cg.org_id=v_org
         and cg.capability='authority.manage'
         and cg.scope_unit_id is null
         and cg.revoked_at is null
         and cg.expires_at is null
     ) then
    raise exception 'The organisation must retain at least one permanent authority manager.'
      using errcode='42501';
  end if;

  v_opposite:=case
    when p_capability='payroll.prepare' then 'payroll.approve'
    when p_capability='payroll.approve' then 'payroll.prepare'
    else null
  end;

  if v_opposite is not null and exists (
    select 1 from public.capability_grants cg
    where cg.org_id=v_org
      and cg.profile_id=p_profile_id
      and cg.capability=v_opposite
      and cg.revoked_at is null
      and (cg.expires_at is null or cg.expires_at>now())
      and (
        cg.scope_unit_id is null
        or p_scope_unit_id is null
        or cg.scope_unit_id=p_scope_unit_id
      )
  ) then
    raise exception 'Payroll preparation and approval must remain separated.'
      using errcode='42501';
  end if;

  insert into public.capability_grants(
    org_id,profile_id,capability,scope_unit_id,granted_by,grant_reason,expires_at
  ) values (
    v_org,p_profile_id,p_capability,p_scope_unit_id,v_actor,btrim(p_reason),p_expires_at
  )
  returning * into v_grant;

  return v_grant;
end;
$$;

revoke all on function public.grant_capability(uuid,text,uuid,text,timestamp with time zone)
  from public,anon;
grant execute on function public.grant_capability(uuid,text,uuid,text,timestamp with time zone)
  to authenticated,service_role;

create or replace function public.revoke_capability(p_grant_id uuid,p_reason text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_grant public.capability_grants;
  v_remaining integer;
begin
  if v_actor is null or not public.app_has_capability('authority.manage',null) then
    raise exception 'You do not have authority to manage capabilities.' using errcode='42501';
  end if;

  if nullif(btrim(coalesce(p_reason,'')),'') is null or length(btrim(p_reason))<3 then
    raise exception 'A reason is required for capability changes.';
  end if;

  select * into v_grant
  from public.capability_grants
  where id=p_grant_id and org_id=v_org and revoked_at is null
  for update;

  if v_grant.id is null then
    raise exception 'That capability grant was not found.' using errcode='42501';
  end if;

  if v_grant.capability='authority.manage'
     and v_grant.scope_unit_id is null
     and v_grant.expires_at is null then
    select count(*) into v_remaining
    from public.capability_grants cg
    join public.profiles ap
      on ap.id=cg.profile_id
     and ap.org_id=cg.org_id
     and ap.active
    where cg.org_id=v_org
      and cg.capability='authority.manage'
      and cg.scope_unit_id is null
      and cg.revoked_at is null
      and cg.expires_at is null
      and cg.id<>v_grant.id;

    if v_remaining=0 then
      raise exception 'The organisation must retain at least one permanent authority manager.'
        using errcode='42501';
    end if;
  end if;

  update public.capability_grants
  set revoked_by=v_actor,
      revoked_at=now(),
      revoke_reason=btrim(p_reason)
  where id=v_grant.id;
end;
$$;

create or replace function public.guard_last_authority()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_left int;
begin
  if old.capability='authority.manage'
     and old.scope_unit_id is null
     and old.revoked_at is null
     and old.expires_at is null
     and (new.revoked_at is not null or new.expires_at is not null) then
    select count(*) into v_left
    from public.capability_grants cg
    join public.profiles ap
      on ap.id=cg.profile_id
     and ap.org_id=cg.org_id
     and ap.active
    where cg.org_id=old.org_id
      and cg.capability='authority.manage'
      and cg.scope_unit_id is null
      and cg.revoked_at is null
      and cg.expires_at is null
      and cg.id<>old.id;

    if v_left=0 then
      raise exception 'This is the last permanent authority manager. Grant permanent authority to someone else before ending it.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_payroll_capability_grant()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_admin boolean;
  v_exec boolean;
  v_opposite text;
begin
  if new.revoked_at is not null
     or (new.expires_at is not null and new.expires_at<=now())
     or new.capability not in ('payroll.prepare','payroll.approve') then
    return new;
  end if;

  select p.is_admin,p.is_exec into v_admin,v_exec
  from public.profiles p
  where p.id=new.profile_id and p.org_id=new.org_id and p.active;

  if not found then
    raise exception 'Payroll authority requires an active organisation member.' using errcode='42501';
  end if;

  if new.capability='payroll.prepare' and (not coalesce(v_admin,false) or coalesce(v_exec,false)) then
    raise exception 'Payroll preparation is reserved for Administration and cannot be held by the Group Pastor/CEO.'
      using errcode='42501';
  end if;

  if new.capability='payroll.approve' and not coalesce(v_exec,false) then
    raise exception 'Payroll approval is reserved for the Group Pastor/CEO.'
      using errcode='42501';
  end if;

  v_opposite:=case when new.capability='payroll.prepare' then 'payroll.approve' else 'payroll.prepare' end;
  if exists (
    select 1 from public.capability_grants cg
    where cg.org_id=new.org_id
      and cg.profile_id=new.profile_id
      and cg.capability=v_opposite
      and cg.revoked_at is null
      and (cg.expires_at is null or cg.expires_at>now())
      and cg.id is distinct from new.id
  ) then
    raise exception 'Payroll preparation and approval must remain separated.'
      using errcode='42501';
  end if;

  return new;
end;
$$;

create or replace function public.guard_sub_team_hr_fields()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if current_setting('ceac.security_deactivation',true)='close'
     and tg_op='UPDATE'
     and old.lead_id is not null
     and new.lead_id is null
     and new.org_id is not distinct from old.org_id
     and new.unit_id is not distinct from old.unit_id
     and new.name is not distinct from old.name
     and new.code is not distinct from old.code
     and new.position is not distinct from old.position
     and new.active is not distinct from old.active then
    return new;
  end if;

  if auth.uid() is null or public.app_is_admin() then
    return new;
  end if;

  if tg_op='INSERT' and new.lead_id is not null then
    raise exception 'Only Administration & HR can assign a sub-team lead.'
      using errcode='42501';
  end if;

  if tg_op='UPDATE' and new.lead_id is distinct from old.lead_id then
    raise exception 'Only Administration & HR can change a sub-team lead.'
      using errcode='42501';
  end if;

  return new;
end;
$$;

drop trigger if exists audit_sub_teams on public.sub_teams;
create trigger audit_sub_teams
after insert or update or delete on public.sub_teams
for each row execute function public.platform_audit_capture('sub_team','id','');

create or replace function public.close_profile_authority_on_deactivation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid:=auth.uid();
begin
  if old.active and not new.active then
    if v_actor is null then
      raise exception 'Profile deactivation requires an attributable signed-in actor.'
        using errcode='42501';
    end if;

    update public.capability_grants
    set revoked_by=v_actor,
        revoked_at=now(),
        revoke_reason='Profile deactivated; operational authority closed'
    where org_id=old.org_id
      and profile_id=old.id
      and revoked_at is null;

    perform set_config('ceac.security_deactivation','close',true);
    update public.sub_teams
    set lead_id=null
    where org_id=old.org_id
      and lead_id=old.id;
    perform set_config('ceac.security_deactivation','',true);

    delete from public.unit_memberships
    where org_id=old.org_id
      and profile_id=old.id;
  end if;

  return new;
end;
$$;

revoke all on function public.close_profile_authority_on_deactivation()
  from public,anon,authenticated;

drop trigger if exists profiles_close_authority_on_deactivation
  on public.profiles;
create trigger profiles_close_authority_on_deactivation
after update of active on public.profiles
for each row
when (old.active is true and new.active is false)
execute function public.close_profile_authority_on_deactivation();

comment on function public.close_profile_authority_on_deactivation() is
  'Closes current capability grants, Sub-team lead assignments and unit membership when a profile is deactivated. Historical capability rows are revoked rather than deleted, and Sub-team lead changes are captured in the platform audit trail.';

