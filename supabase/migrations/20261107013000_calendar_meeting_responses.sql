-- Explicit invitation responses. Joining a meeting is not attendance approval.
-- Private preparation notes retain the same owner and invitation boundary.
begin;
create table public.meeting_responses (
  meeting_id uuid not null references public.meeting_sessions(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  org_id uuid not null default public.app_org_id() references public.organisations(id),
  response text not null check(response in ('accepted','tentative','declined')),
  updated_at timestamptz not null default now(),
  primary key(meeting_id,profile_id)
);
alter table public.meeting_responses enable row level security;
create policy meeting_responses_read on public.meeting_responses for select to authenticated using (
 org_id=public.app_org_id() and exists (
  select 1 from public.meeting_sessions m where m.id=meeting_responses.meeting_id and m.org_id=meeting_responses.org_id and (
   meeting_responses.profile_id=auth.uid() or m.created_by=auth.uid() or exists (
    select 1 from public.meeting_participants mp where mp.meeting_id=m.id and mp.profile_id=auth.uid() and mp.role='organiser'
   )
  )
 )
);
create policy meeting_responses_insert on public.meeting_responses for insert to authenticated with check (
 org_id=public.app_org_id() and profile_id=auth.uid() and exists (
  select 1 from public.meeting_sessions m join public.meeting_participants mp on mp.meeting_id=m.id
  where m.id=meeting_responses.meeting_id and m.org_id=meeting_responses.org_id and mp.profile_id=auth.uid() and m.status<>'cancelled'
 )
);
create policy meeting_responses_update on public.meeting_responses for update to authenticated using (
 org_id=public.app_org_id() and profile_id=auth.uid()
) with check (
 org_id=public.app_org_id() and profile_id=auth.uid() and exists (
  select 1 from public.meeting_sessions m join public.meeting_participants mp on mp.meeting_id=m.id
  where m.id=meeting_responses.meeting_id and m.org_id=meeting_responses.org_id and mp.profile_id=auth.uid() and m.status<>'cancelled'
 )
);
revoke all on public.meeting_responses from public,anon,authenticated;
grant select,insert,update on public.meeting_responses to authenticated;
grant all on public.meeting_responses to service_role;

-- A participant may prepare their own private notes before the scheduled start.
-- Shared decisions/agenda authority and their time gates are unchanged.
drop policy meeting_private_notes_insert on public.meeting_private_notes;
create policy meeting_private_notes_insert on public.meeting_private_notes for insert to authenticated with check (
 auth.uid() is not null and org_id=public.app_org_id() and author_id=auth.uid() and exists (
  select 1 from public.meeting_sessions m join public.meeting_participants mp on mp.meeting_id=m.id
  where m.id=meeting_private_notes.meeting_id and m.org_id=meeting_private_notes.org_id and mp.profile_id=auth.uid() and m.status<>'cancelled'
 )
);
drop policy meeting_private_notes_update on public.meeting_private_notes;
create policy meeting_private_notes_update on public.meeting_private_notes for update to authenticated using (
 org_id=public.app_org_id() and author_id=auth.uid()
) with check (
 org_id=public.app_org_id() and author_id=auth.uid() and exists (
  select 1 from public.meeting_sessions m join public.meeting_participants mp on mp.meeting_id=m.id
  where m.id=meeting_private_notes.meeting_id and m.org_id=meeting_private_notes.org_id and mp.profile_id=auth.uid() and m.status<>'cancelled'
 )
);
commit;
