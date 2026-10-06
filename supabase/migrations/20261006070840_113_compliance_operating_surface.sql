-- 113 — Phase 3 Compliance Operating Surface.
-- Reconcile announcement authority with the canonical capability-grant model.

insert into public.capability_definitions(capability,label,description,sensitive)
values (
  'post_announcement',
  'Publish announcements',
  'Create, publish and close attributable organisation announcements.',
  true
)
on conflict(capability) do nothing;

-- Preserve any explicit legacy publisher assignments as canonical grants.
insert into public.capability_grants(
  org_id,profile_id,capability,scope_unit_id,granted_by,granted_at,grant_reason
)
select c.org_id,c.profile_id,'post_announcement',null,c.granted_by,c.granted_at,
       'Migrated from the reviewed legacy announcement capability.'
from public.capabilities c
where c.capability='post_announcement'
  and not exists(
    select 1
    from public.capability_grants g
    where g.org_id=c.org_id
      and g.profile_id=c.profile_id
      and g.capability='post_announcement'
      and g.scope_unit_id is null
      and g.revoked_at is null
  );

create or replace function public.app_can_publish_announcements()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null and (
    public.app_is_admin()
    or public.app_is_exec()
    or public.app_has_capability('post_announcement',null)
  );
$$;

-- This remains an internal helper called by the reviewed announcement RPCs.
revoke all on function public.app_can_publish_announcements() from public,anon,authenticated;
grant execute on function public.app_can_publish_announcements() to service_role;
