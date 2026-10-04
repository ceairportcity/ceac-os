-- OCR5B — employee photos and ordinary employee documents on the existing
-- private operational-file domain. Protected HR remains on ceac-hr-private.

do $constraints$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid='public.operational_file_links'::regclass
      and contype='c'
  loop
    execute format('alter table public.operational_file_links drop constraint %I',r.conname);
  end loop;
end
$constraints$;

alter table public.operational_file_links
  add constraint operational_file_links_context_type_check
  check(context_type in ('work_item','project','room_message','announcement','employee_photo','employee_document')),
  add constraint operational_file_links_relation_check
  check(relation in ('assignment_source','project_file','room_media','announcement_attachment','employee_photo','employee_document')),
  add constraint operational_file_links_context_relation_check
  check(
    (context_type='work_item' and relation='assignment_source')
    or (context_type='project' and relation='project_file')
    or (context_type='room_message' and relation='room_media')
    or (context_type='announcement' and relation='announcement_attachment')
    or (context_type='employee_photo' and relation='employee_photo')
    or (context_type='employee_document' and relation='employee_document')
  );

create or replace function public.app_can_read_operational_context(
  p_context_type text,
  p_context_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null and case p_context_type
    when 'work_item' then public.app_can_see_item(p_context_id)
    when 'project' then p_context_id in (select public.app_visible_projects())
    when 'room_message' then exists(
      select 1 from public.room_messages rm
      where rm.id=p_context_id
        and rm.org_id=public.app_org_id()
        and public.app_can_access_room(rm.room_id)
    )
    when 'announcement' then exists(
      select 1 from public.announcements a
      where a.id=p_context_id
        and a.org_id=public.app_org_id()
        and (
          public.app_is_admin()
          or public.app_is_exec()
          or a.author_id=auth.uid()
          or public.app_can_read_announcement(a.id)
        )
    )
    when 'employee_photo' then exists(
      select 1 from public.employee_roster e
      where e.id=p_context_id and e.org_id=public.app_org_id()
    )
    when 'employee_document' then (
      public.app_is_admin()
      and exists(
        select 1 from public.employee_roster e
        where e.id=p_context_id and e.org_id=public.app_org_id()
      )
    )
    else false
  end;
$$;

create or replace function public.app_can_write_operational_context(
  p_context_type text,
  p_context_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null and case p_context_type
    when 'work_item' then exists(
      select 1 from public.work_items w
      where w.id=p_context_id
        and w.org_id=public.app_org_id()
        and (
          w.assigned_by=auth.uid()
          or public.app_can_review_item(w.id)
          or public.app_is_admin()
          or public.app_is_exec()
        )
    )
    when 'project' then (
      public.app_is_admin()
      or public.app_is_exec()
      or public.app_can_manage_delivery_project(p_context_id)
    )
    when 'room_message' then exists(
      select 1 from public.room_messages rm
      where rm.id=p_context_id
        and rm.org_id=public.app_org_id()
        and rm.author_id=auth.uid()
        and public.app_can_access_room(rm.room_id)
    )
    when 'announcement' then exists(
      select 1 from public.announcements a
      where a.id=p_context_id
        and a.org_id=public.app_org_id()
        and public.app_can_publish_announcements()
    )
    when 'employee_photo' then (
      public.app_is_admin()
      and exists(
        select 1 from public.employee_roster e
        where e.id=p_context_id and e.org_id=public.app_org_id()
      )
    )
    when 'employee_document' then (
      public.app_is_admin()
      and exists(
        select 1 from public.employee_roster e
        where e.id=p_context_id and e.org_id=public.app_org_id()
      )
    )
    else false
  end;
$$;

create or replace function public.register_operational_file(
  p_context_type text,
  p_context_id uuid,
  p_relation text,
  p_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
returns table(file_id uuid,storage_path text,storage_bucket text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_id uuid:=gen_random_uuid();
  v_filename text:=btrim(coalesce(p_filename,''));
  v_mime text:=lower(btrim(coalesce(p_mime_type,'')));
  v_safe text;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Sign in to attach a file.' using errcode='42501';
  end if;
  if not public.app_can_write_operational_context(p_context_type,p_context_id) then
    raise exception 'You cannot attach a file to that record.' using errcode='42501';
  end if;

  if p_context_type='work_item' and p_relation<>'assignment_source'
     or p_context_type='project' and p_relation<>'project_file'
     or p_context_type='room_message' and p_relation<>'room_media'
     or p_context_type='announcement' and p_relation<>'announcement_attachment'
     or p_context_type='employee_photo' and p_relation<>'employee_photo'
     or p_context_type='employee_document' and p_relation<>'employee_document'
     or p_context_type not in ('work_item','project','room_message','announcement','employee_photo','employee_document') then
    raise exception 'That file relation does not match its record.';
  end if;

  if length(v_filename)<1 or length(v_filename)>240 then
    raise exception 'File names must be between 1 and 240 characters.';
  end if;
  if p_size_bytes is null or p_size_bytes<1 or p_size_bytes>52428800 then
    raise exception 'Files can be up to 50 MB.';
  end if;
  if v_mime not in (
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf','text/plain','text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg',
    'video/mp4','video/webm'
  ) then
    raise exception 'That file type is not supported.';
  end if;
  if p_context_type='employee_photo'
     and v_mime not in ('image/jpeg','image/png','image/webp') then
    raise exception 'Employee photos must be JPEG, PNG or WebP images.';
  end if;

  v_safe:=regexp_replace(v_filename,'[^A-Za-z0-9._-]+','_','g');
  if v_safe='' then v_safe:='file'; end if;

  insert into public.operational_files(
    id,org_id,filename,mime_type,size_bytes,storage_path,uploaded_by
  ) values(
    v_id,v_org,v_filename,v_mime,p_size_bytes,
    v_org::text||'/'||v_id::text||'/'||v_safe,auth.uid()
  );

  insert into public.operational_file_links(
    org_id,file_id,context_type,context_id,relation,linked_by
  ) values(
    v_org,v_id,p_context_type,p_context_id,p_relation,auth.uid()
  );

  return query
    select v_id,
           (select f.storage_path from public.operational_files f where f.id=v_id),
           'ceac-operational-private'::text;
end;
$$;

create or replace function public.link_operational_file(
  p_file_id uuid,
  p_context_type text,
  p_context_id uuid,
  p_relation text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_file public.operational_files;
  v_link uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to link a file.' using errcode='42501';
  end if;

  select * into v_file
  from public.operational_files
  where id=p_file_id
    and org_id=public.app_org_id()
    and state='active';

  if v_file.id is null or not public.app_can_access_operational_file(v_file.id) then
    raise exception 'That file is not available to you.' using errcode='42501';
  end if;
  if not public.app_can_write_operational_context(p_context_type,p_context_id) then
    raise exception 'You cannot attach a file to that record.' using errcode='42501';
  end if;

  if p_context_type='work_item' and p_relation<>'assignment_source'
     or p_context_type='project' and p_relation<>'project_file'
     or p_context_type='room_message' and p_relation<>'room_media'
     or p_context_type='announcement' and p_relation<>'announcement_attachment'
     or p_context_type='employee_photo' and p_relation<>'employee_photo'
     or p_context_type='employee_document' and p_relation<>'employee_document'
     or p_context_type not in ('work_item','project','room_message','announcement','employee_photo','employee_document') then
    raise exception 'That file relation does not match its record.';
  end if;
  if p_context_type='employee_photo'
     and v_file.mime_type not in ('image/jpeg','image/png','image/webp') then
    raise exception 'Employee photos must be JPEG, PNG or WebP images.';
  end if;

  insert into public.operational_file_links(
    org_id,file_id,context_type,context_id,relation,linked_by
  ) values(
    v_file.org_id,v_file.id,p_context_type,p_context_id,p_relation,auth.uid()
  )
  on conflict(file_id,context_type,context_id,relation) do nothing
  returning id into v_link;

  if v_link is null then
    select l.id into v_link
    from public.operational_file_links l
    where l.file_id=v_file.id
      and l.context_type=p_context_type
      and l.context_id=p_context_id
      and l.relation=p_relation;
  end if;

  return v_link;
end;
$$;

revoke all on function public.app_can_read_operational_context(text,uuid) from public,anon;
revoke all on function public.app_can_write_operational_context(text,uuid) from public,anon;
revoke all on function public.register_operational_file(text,uuid,text,text,text,bigint) from public,anon;
revoke all on function public.link_operational_file(uuid,text,uuid,text) from public,anon;

grant execute on function public.app_can_read_operational_context(text,uuid) to authenticated,service_role;
grant execute on function public.app_can_write_operational_context(text,uuid) to authenticated,service_role;
grant execute on function public.register_operational_file(text,uuid,text,text,text,bigint) to authenticated,service_role;
grant execute on function public.link_operational_file(uuid,text,uuid,text) to authenticated,service_role;
