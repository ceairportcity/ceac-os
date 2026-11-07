-- Existing isolated fixture only; all created records are rolled back.
\set ON_ERROR_STOP on
begin;
insert into public.meeting_sessions(id,org_id,scope,unit_id,title,starts_at,created_by) values
 ('a7070000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','unit','20000000-0000-4000-8000-000000000011','Synthetic Calendar invitation','2099-01-01','31000000-0000-4000-8000-000000000002');
insert into public.meeting_participants(meeting_id,profile_id,role,source_type,invited_by) values
 ('a7070000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','participant','selected','31000000-0000-4000-8000-000000000002'),
 ('a7070000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000002','organiser','organiser','31000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into public.meeting_responses(meeting_id,response) values('a7070000-0000-4000-8000-000000000001','accepted');
insert into public.meeting_private_notes(meeting_id,org_id,author_id,body) values('a7070000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000001','Private preparation before start');
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
do $gate$ begin
 if (select count(*) from public.meeting_responses where meeting_id='a7070000-0000-4000-8000-000000000001')<>1 then raise exception 'Organiser cannot read invitation response';end if;
 if exists(select 1 from public.meeting_private_notes where meeting_id='a7070000-0000-4000-8000-000000000001') then raise exception 'Organiser read another participant private notes';end if;
end $gate$;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
do $gate$ begin
 if exists(select 1 from public.meeting_responses where meeting_id='a7070000-0000-4000-8000-000000000001') then raise exception 'Uninvited Admin read invitation responses';end if;
 if exists(select 1 from public.meeting_private_notes where meeting_id='a7070000-0000-4000-8000-000000000001') then raise exception 'Admin read private preparation';end if;
 begin
  insert into public.meeting_responses(meeting_id,response) values('a7070000-0000-4000-8000-000000000001','accepted');
  raise exception 'Uninvited Admin accepted meeting';
 exception when insufficient_privilege then null;end;
end $gate$;
reset role;
do $gate$ begin
 if has_table_privilege('anon','public.meeting_responses','SELECT') or has_table_privilege('anon','public.meeting_responses','INSERT') then raise exception 'Anonymous response access';end if;
 if not (select relrowsecurity from pg_class where oid='public.meeting_responses'::regclass) then raise exception 'Response RLS disabled';end if;
end $gate$;
rollback;
