-- Isolated standard fixture only. Every row and decision is rolled back.
\set ON_ERROR_STOP on
begin;
insert into public.meeting_sessions(id,org_id,scope,unit_id,title,starts_at,created_by)
values
 ('a7270000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','unit','20000000-0000-4000-8000-000000000011','Synthetic future author gate','2099-01-01','31000000-0000-4000-8000-000000000003'),
 ('a7270000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','organisation',null,'Synthetic started author gate','2000-01-01','31000000-0000-4000-8000-000000000004');
insert into public.meeting_participants(meeting_id,profile_id,role,source_type,invited_by)
values
 ('a7270000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','organiser','selected','31000000-0000-4000-8000-000000000003'),
 ('a7270000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000001','organiser','selected','31000000-0000-4000-8000-000000000004');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
do $gate$
declare n integer;
begin
 if public.app_can_author_meeting('a7270000-0000-4000-8000-000000000001') then raise exception 'Executive viewer became author';end if;
 begin
  insert into public.meeting_participants(meeting_id,profile_id,role,source_type,invited_by)
  values('a7270000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000004','organiser','selected','31000000-0000-4000-8000-000000000004');
  raise exception 'Viewer promoted itself to organiser';
 exception when insufficient_privilege then null;
 end;
 update public.meeting_sessions set agenda='unauthorised viewer edit' where id='a7270000-0000-4000-8000-000000000001';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Executive viewer changed agenda';end if;
end $gate$;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
do $gate$
begin
 if public.app_can_author_meeting('a7270000-0000-4000-8000-000000000002') then raise exception 'Admin viewer became author';end if;
 begin
  insert into public.meeting_records(meeting_id,org_id,kind,body,author_id)
  values('a7270000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','decision','Denied admin viewer decision','31000000-0000-4000-8000-000000000003');
  raise exception 'Admin viewer recorded a shared decision';
 exception when insufficient_privilege then null;
 end;
 if not public.app_can_author_meeting('a7270000-0000-4000-8000-000000000001') then raise exception 'Creator lost authorship';end if;
end $gate$;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
do $gate$
begin
 if public.app_can_author_meeting('a7270000-0000-4000-8000-000000000001') then raise exception 'Contextual manager became author';end if;
end $gate$;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
do $gate$
declare n integer;
begin
 if not public.app_can_author_meeting('a7270000-0000-4000-8000-000000000001') then raise exception 'Recorded organiser lost authorship';end if;
 update public.meeting_sessions set agenda='Authorised organiser agenda' where id='a7270000-0000-4000-8000-000000000001';
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Recorded organiser could not prepare agenda';end if;
 insert into public.meeting_records(meeting_id,org_id,kind,body,author_id)
 values('a7270000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','decision','Authorised organiser decision','31000000-0000-4000-8000-000000000001');
end $gate$;
reset role;
do $gate$
begin
 if (select prosecdef from pg_proc where oid='public.app_can_author_meeting(uuid)'::regprocedure) then raise exception 'Author helper must preserve RLS';end if;
 if has_function_privilege('anon','public.app_can_author_meeting(uuid)','EXECUTE') then raise exception 'Anonymous author helper access';end if;
 if exists(select 1 from pg_policy where polrelid='public.meeting_participants'::regclass and polpermissive and polcmd in ('a','w','d','*')) then raise exception 'Participant browser write permits organiser self-escalation';end if;
end $gate$;
rollback;
