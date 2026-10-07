-- 117 — Security S1: privileged MFA/AAL2 enforcement readiness.
-- The switch remains OFF until real privileged accounts finish MFA enrollment.

alter table public.organisations
  add column if not exists privileged_mfa_required boolean not null default false;

comment on column public.organisations.privileged_mfa_required is
  'When true, elevated CEAC authority requires a signed Supabase aal2 session. Keep false until go-live enrollment is complete.';

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
    where p.id=auth.uid()
      and p.active
  ),false);
$$;

revoke all on function public.app_privileged_aal_allowed() from public,anon,authenticated;

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
      and public.app_privileged_aal_allowed()
  ),false);
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
        and cg.capability=p_capability
        and (
          cg.scope_unit_id is null
          or (p_unit_id is not null and cg.scope_unit_id=p_unit_id)
        )
    );
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
    and public.app_privileged_aal_allowed();
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
  join public.profiles p on p.id=s.lead_id
  where p.id=auth.uid()
    and p.active
    and public.app_privileged_aal_allowed();
$$;

create or replace function public.app_can_review_item(item_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.work_items w
    where w.id=item_id
      and w.org_id=public.app_org_id()
      and w.kind in ('task','deliverable','meeting_outcome')
      and w.visibility<>'private'
      and w.assignee_id is distinct from auth.uid()
      and (
        public.app_is_admin()
        or (
          public.app_privileged_aal_allowed()
          and public.app_responsible_reviewer_id(w.id)=auth.uid()
        )
      )
  );
$$;

-- Legacy calendar policy had a direct role='manager' authority path.
drop policy if exists mev_write on public.ministry_events;

create policy mev_write
on public.ministry_events
for all
to authenticated
using (
  org_id=public.app_org_id()
  and (
    public.app_is_admin()
    or public.app_is_exec()
    or exists (
      select 1
      from public.units u
      where u.org_id=public.app_org_id()
        and u.owns_calendar
        and u.id in (select public.app_managed_units())
    )
  )
)
with check (
  org_id=public.app_org_id()
  and (
    public.app_is_admin()
    or public.app_is_exec()
    or exists (
      select 1
      from public.units u
      where u.org_id=public.app_org_id()
        and u.owns_calendar
        and u.id in (select public.app_managed_units())
    )
  )
);
