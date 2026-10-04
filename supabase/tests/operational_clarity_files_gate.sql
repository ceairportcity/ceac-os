\set ON_ERROR_STOP on
begin;

do $schema$
declare
  v_def text;
  v_constraint text;
begin
  if not exists (
    select 1 from storage.buckets
    where id='ceac-operational-private' and public=false and file_size_limit=52428800
  ) then
    raise exception 'OCR3 file gate: private operational bucket is missing or public.';
  end if;

  if exists (
    select 1 from storage.buckets
    where id='ceac-hr-private' and public=true
  ) then
    raise exception 'OCR3 file gate: protected HR bucket became public.';
  end if;

  if to_regclass('public.operational_files') is null
     or to_regclass('public.operational_file_links') is null then
    raise exception 'OCR3 file gate: operational file metadata tables are missing.';
  end if;

  if to_regprocedure('public.link_operational_file(uuid,text,uuid,text)') is null
     or to_regprocedure('public.register_operational_file(text,uuid,text,text,text,bigint)') is null
     or to_regprocedure('public.finalize_operational_file(uuid)') is null then
    raise exception 'OCR3 file gate: operational file RPCs are incomplete.';
  end if;

  if has_function_privilege('anon','public.register_operational_file(text,uuid,text,text,text,bigint)','EXECUTE')
     or has_function_privilege('anon','public.finalize_operational_file(uuid)','EXECUTE')
     or has_function_privilege('anon','public.link_operational_file(uuid,text,uuid,text)','EXECUTE') then
    raise exception 'OCR3 file gate: anonymous operational file execution leaked.';
  end if;

  select pg_get_functiondef('public.app_can_write_operational_context(text,uuid)'::regprocedure)
    into v_def;
  if v_def ilike '%w.created_by%'
     or v_def not ilike '%w.assigned_by%' then
    raise exception 'OCR3 file gate: Work source-file authority is not bound to assigned_by/review authority.';
  end if;

  select pg_get_constraintdef(c.oid) into v_constraint
  from pg_constraint c
  join pg_class t on t.oid=c.conrelid
  join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname='rooms' and c.contype='c'
    and pg_get_constraintdef(c.oid) ilike '%kind%';

  if coalesce(v_constraint,'') ilike '%direct%'
     or coalesce(v_constraint,'') ilike '%dm%' then
    raise exception 'OCR3 Room gate: direct-message room kind was introduced.';
  end if;
end
$schema$;

insert into public.projects(
  id,org_id,kind,lead_unit_id,name,purpose,status,created_by
) values(
  '49000000-0000-4000-8000-000000000108',
  '10000000-0000-4000-8000-000000000010',
  'project',
  '20000000-0000-4000-8000-000000000011',
  'OCR3 File Isolation Fixture',
  'Security acceptance only',
  'active',
  '31000000-0000-4000-8000-000000000002'
);

insert into public.operational_files(
  id,org_id,filename,mime_type,size_bytes,storage_path,uploaded_by,state,finalised_at
) values(
  '4f000000-0000-4000-8000-000000000108',
  '10000000-0000-4000-8000-000000000010',
  'ocr3-private.pdf',
  'application/pdf',
  1024,
  '10000000-0000-4000-8000-000000000010/4f000000-0000-4000-8000-000000000108/ocr3-private.pdf',
  '31000000-0000-4000-8000-000000000002',
  'active',
  now()
);

insert into public.operational_file_links(
  org_id,file_id,context_type,context_id,relation,linked_by
) values(
  '10000000-0000-4000-8000-000000000010',
  '4f000000-0000-4000-8000-000000000108',
  'project',
  '49000000-0000-4000-8000-000000000108',
  'project_file',
  '31000000-0000-4000-8000-000000000002'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);

do $unrelated$
declare n integer;
begin
  select count(*) into n
  from public.operational_files
  where id='4f000000-0000-4000-8000-000000000108'::uuid;
  if n<>0 then
    raise exception 'OCR3 file gate: unrelated profile can read another project file.';
  end if;
end
$unrelated$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $authorised$
declare n integer;
begin
  select count(*) into n
  from public.operational_files
  where id='4f000000-0000-4000-8000-000000000108'::uuid;
  if n<>1 then
    raise exception 'OCR3 file gate: authorised project participant cannot read project file.';
  end if;
end
$authorised$;

reset role;

do $capture_project_room$
declare v_project_room uuid;
begin
  select id into v_project_room
  from public.rooms
  where kind='project'
    and project_id='49000000-0000-4000-8000-000000000108'::uuid
  limit 1;

  if v_project_room is null then
    raise exception 'OCR3 Room gate: fixture Project Room was not created.';
  end if;

  perform set_config('ceac.ocr3_project_room_id',v_project_room::text,true);
end
$capture_project_room$;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);

do $executive_rooms$
declare
  v_unit_room uuid;
  v_subteam_room uuid;
  v_project_room uuid:=nullif(current_setting('ceac.ocr3_project_room_id',true),'')::uuid;
begin
  select id into v_unit_room from public.rooms
    where kind='unit' and unit_id='20000000-0000-4000-8000-000000000011'::uuid limit 1;
  select id into v_subteam_room from public.rooms
    where kind='sub_team' and sub_team_id='22000000-0000-4000-8000-000000000011'::uuid limit 1;

  if v_unit_room is null or not public.app_can_access_room(v_unit_room) then
    raise exception 'OCR3 Room gate: Executive cannot access active Unit Room.';
  end if;
  if v_subteam_room is null or not public.app_can_access_room(v_subteam_room) then
    raise exception 'OCR3 Room gate: Executive cannot access active Sub-team Room.';
  end if;
  if v_project_room is not null and public.app_can_access_room(v_project_room) then
    raise exception 'OCR3 Room gate: Executive received blanket Project Room access.';
  end if;

  update public.projects
  set sponsor_profile_id=auth.uid(),
      delivery_change_reason='OCR3 security acceptance: explicit Executive project context'
  where id='49000000-0000-4000-8000-000000000108'::uuid;

  if v_project_room is null or not public.app_can_access_room(v_project_room) then
    raise exception 'OCR3 Room gate: explicitly sponsored Executive cannot access contextual Project Room.';
  end if;
end
$executive_rooms$;

rollback;

select 'OCR3 operational file and Room authority gate passed' as result;
