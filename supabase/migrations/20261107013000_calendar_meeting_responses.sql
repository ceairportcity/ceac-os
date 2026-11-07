-- Explicit invitation responses. Joining a meeting is not attendance approval.
-- Private preparation notes retain the same owner and invitation boundary.
begin;
create table public.meeting_responses (
  meeting_id uuid not null references public.meeting_sessions(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  org_id uuid not null default public.app_org_id() references public.organisations(id),
  response text not null check(response in ('accepted','tentative','declined')),
  meeting_starts_at timestamptz not null,
  meeting_ends_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(meeting_id,profile_id)
);
-- Bind each answer to the actual appointment time, never client-supplied dates.
create function private.bind_meeting_response_time() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 select starts_at,ends_at into new.meeting_starts_at,new.meeting_ends_at from public.meeting_sessions where id=new.meeting_id;
 new.updated_at:=now();return new;
end $$;
revoke all on function private.bind_meeting_response_time() from public,anon,authenticated;
create trigger bind_meeting_response_time before insert or update on public.meeting_responses for each row execute function private.bind_meeting_response_time();
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
-- Extend the existing notification path; no second delivery system or timer.
create or replace function private.ceac_meeting_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare m public.meeting_sessions;recipient uuid;kind text;
begin
 if tg_table_name='meeting_participants' then
  select * into m from public.meeting_sessions where id=new.meeting_id;
  if found and m.created_by is distinct from new.profile_id then
   perform private.ceac_emit_notification(m.org_id,new.profile_id,'meeting',m.id,'meeting_invited',gen_random_uuid());end if;
 else
  if row(old.starts_at,old.ends_at,old.status,old.title,old.location,old.join_url) is not distinct from row(new.starts_at,new.ends_at,new.status,new.title,new.location,new.join_url) then return new;end if;
  kind:=case when new.status ilike '%cancel%' then 'meeting_cancelled' else 'meeting_changed' end;
  for recipient in select profile_id from public.meeting_participants where meeting_id=new.id loop
   perform private.ceac_emit_notification(new.org_id,recipient,'meeting',new.id,kind,gen_random_uuid());end loop;
 end if;return new;
end $$;
revoke all on function private.ceac_meeting_notice() from public,anon,authenticated;
drop trigger if exists ceac_meeting_update on public.meeting_sessions;
create trigger ceac_meeting_update after update of starts_at,ends_at,status,title,location,join_url on public.meeting_sessions for each row execute function private.ceac_meeting_notice();
commit;
