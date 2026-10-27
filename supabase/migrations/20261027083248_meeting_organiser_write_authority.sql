-- Owner correction: viewing a meeting through Admin, Executive or contextual
-- management authority does not make that viewer its author. Keep the existing
-- read/archive delegation; narrow the three content-write policies only.
-- SECURITY INVOKER deliberately retains the caller's existing read/RLS scope.
create or replace function public.app_can_author_meeting(p_meeting_id uuid)
returns boolean language sql stable security invoker set search_path=public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.meeting_sessions m
    where m.id=p_meeting_id and m.org_id=public.app_org_id()
      and (m.created_by=auth.uid() or exists (
        select 1 from public.meeting_participants mp
        where mp.meeting_id=m.id and mp.profile_id=auth.uid() and mp.role='organiser'
      ))
  );
$$;
revoke all on function public.app_can_author_meeting(uuid) from public,anon,authenticated;
grant execute on function public.app_can_author_meeting(uuid) to authenticated,service_role;

drop policy if exists meeting_sessions_update on public.meeting_sessions;
create policy meeting_sessions_update on public.meeting_sessions for update to authenticated
using (org_id=public.app_org_id() and public.app_can_author_meeting(id))
with check (org_id=public.app_org_id() and public.app_can_author_meeting(id));

drop policy if exists meeting_records_insert on public.meeting_records;
create policy meeting_records_insert on public.meeting_records for insert to authenticated
with check (
  auth.uid() is not null and org_id=public.app_org_id() and author_id=auth.uid()
  and kind='decision' and public.app_can_author_meeting(meeting_id)
  and exists (select 1 from public.meeting_sessions m where m.id=meeting_id
    and m.org_id=public.app_org_id() and now()>=m.starts_at and m.status<>'cancelled')
);

drop policy if exists meeting_work_links_insert on public.meeting_work_links;
create policy meeting_work_links_insert on public.meeting_work_links for insert to authenticated
with check (linked_by=auth.uid() and public.app_can_see_item(work_item_id)
  and public.app_can_author_meeting(meeting_id));
