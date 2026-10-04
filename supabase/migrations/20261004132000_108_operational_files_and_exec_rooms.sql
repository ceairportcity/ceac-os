-- 108 — OCR3 operational files and Executive organisational Room authority.
--
-- Ordinary CEAC work files live in a separate private bucket. Protected HR
-- remains isolated in ceac-hr-private and is not referenced by this domain.
-- One metadata/link model is reused by Work, Projects, Rooms and Announcements.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'ceac-operational-private',
  'ceac-operational-private',
  false,
  52428800,
  array[
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
  ]::text[]
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

create table public.operational_files(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  filename text not null check(length(btrim(filename)) between 1 and 240),
  mime_type text not null check(length(btrim(mime_type)) between 1 and 160),
  size_bytes bigint not null check(size_bytes > 0 and size_bytes <= 52428800),
  storage_bucket text not null default 'ceac-operational-private'
    check(storage_bucket='ceac-operational-private'),
  storage_path text not null unique,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  state text not null default 'pending'
    check(state in ('pending','active','archived')),
  created_at timestamptz not null default now(),
  finalised_at timestamptz,
  archived_at timestamptz,
  check(
    (state='pending' and finalised_at is null and archived_at is null)
    or (state='active' and finalised_at is not null and archived_at is null)
    or (state='archived' and finalised_at is not null and archived_at is not null)
  )
);

create table public.operational_file_links(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  file_id uuid not null references public.operational_files(id) on delete restrict,
  context_type text not null
    check(context_type in ('work_item','project','room_message','announcement')),
  context_id uuid not null,
  relation text not null
    check(relation in ('assignment_source','project_file','room_media','announcement_attachment')),
  linked_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(file_id,context_type,context_id,relation),
  check(
    (context_type='work_item' and relation='assignment_source')
    or (context_type='project' and relation='project_file')
    or (context_type='room_message' and relation='room_media')
    or (context_type='announcement' and relation='announcement_attachment')
  )
);

create index operational_files_org_created_idx
  on public.operational_files(org_id,created_at desc);
create index operational_file_links_context_idx
  on public.operational_file_links(org_id,context_type,context_id,created_at desc);
create index operational_file_links_file_idx
  on public.operational_file_links(file_id);

alter table public.operational_files enable row level security;
alter table public.operational_file_links enable row level security;

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
      select 1
      from public.room_messages rm
      where rm.id=p_context_id
        and rm.org_id=public.app_org_id()
        and public.app_can_access_room(rm.room_id)
    )
    when 'announcement' then exists(
      select 1
      from public.announcements a
      where a.id=p_context_id
        and a.org_id=public.app_org_id()
        and (
          public.app_is_admin()
          or public.app_is_exec()
          or a.author_id=auth.uid()
          or public.app_can_read_announcement(a.id)
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
    else false
  end;
$$;

create or replace function public.app_can_access_operational_file(p_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null and exists(
    select 1
    from public.operational_files f
    where f.id=p_file_id
      and f.org_id=public.app_org_id()
      and f.state='active'
      and exists(
        select 1
        from public.operational_file_links l
        where l.file_id=f.id
          and l.org_id=f.org_id
          and public.app_can_read_operational_context(l.context_type,l.context_id)
      )
  );
$$;

create policy operational_files_read
on public.operational_files for select to authenticated
using (
  org_id=public.app_org_id()
  and (
    public.app_can_access_operational_file(id)
    or (uploaded_by=auth.uid() and state='pending')
  )
);

create policy operational_file_links_read
on public.operational_file_links for select to authenticated
using (
  org_id=public.app_org_id()
  and public.app_can_read_operational_context(context_type,context_id)
  and exists(
    select 1 from public.operational_files f
    where f.id=file_id and f.org_id=public.app_org_id() and f.state='active'
  )
);

revoke all on public.operational_files,public.operational_file_links
  from public,anon,authenticated;
grant select on public.operational_files,public.operational_file_links
  to authenticated,service_role;
grant select,insert,update on public.operational_files to service_role;
grant select,insert on public.operational_file_links to service_role;

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
     or p_context_type not in ('work_item','project','room_message','announcement') then
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
     or p_context_type not in ('work_item','project','room_message','announcement') then
    raise exception 'That file relation does not match its record.';
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

create or replace function public.finalize_operational_file(p_file_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public,storage
as $$
declare
  v_file public.operational_files;
begin
  if auth.uid() is null then
    raise exception 'Sign in to finish the file upload.' using errcode='42501';
  end if;

  select * into v_file
  from public.operational_files
  where id=p_file_id
  for update;

  if v_file.id is null
     or v_file.org_id is distinct from public.app_org_id()
     or v_file.uploaded_by is distinct from auth.uid()
     or v_file.state<>'pending' then
    raise exception 'That pending file is not available to you.' using errcode='42501';
  end if;

  if not exists(
    select 1 from storage.objects o
    where o.bucket_id=v_file.storage_bucket
      and o.name=v_file.storage_path
  ) then
    raise exception 'The file upload is not present in private storage.';
  end if;

  update public.operational_files
  set state='active',finalised_at=now()
  where id=v_file.id;

  return v_file.id;
end;
$$;

revoke all on function public.app_can_read_operational_context(text,uuid) from public,anon;
revoke all on function public.app_can_write_operational_context(text,uuid) from public,anon;
revoke all on function public.app_can_access_operational_file(uuid) from public,anon;
revoke all on function public.register_operational_file(text,uuid,text,text,text,bigint) from public,anon;
revoke all on function public.finalize_operational_file(uuid) from public,anon;
revoke all on function public.link_operational_file(uuid,text,uuid,text) from public,anon;

grant execute on function public.app_can_read_operational_context(text,uuid) to authenticated,service_role;
grant execute on function public.app_can_write_operational_context(text,uuid) to authenticated,service_role;
grant execute on function public.app_can_access_operational_file(uuid) to authenticated,service_role;
grant execute on function public.register_operational_file(text,uuid,text,text,text,bigint) to authenticated,service_role;
grant execute on function public.finalize_operational_file(uuid) to authenticated,service_role;
grant execute on function public.link_operational_file(uuid,text,uuid,text) to authenticated,service_role;

-- Storage rows are created only for a registered pending metadata record owned
-- by the signed-in user. Reads inherit the linked CEAC context.
drop policy if exists ceac_operational_storage_insert on storage.objects;
create policy ceac_operational_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='ceac-operational-private'
  and exists(
    select 1 from public.operational_files f
    where f.storage_bucket=bucket_id
      and f.storage_path=name
      and f.org_id=public.app_org_id()
      and f.uploaded_by=auth.uid()
      and f.state='pending'
  )
);

drop policy if exists ceac_operational_storage_read on storage.objects;
create policy ceac_operational_storage_read
on storage.objects for select to authenticated
using (
  bucket_id='ceac-operational-private'
  and exists(
    select 1 from public.operational_files f
    where f.storage_bucket=bucket_id
      and f.storage_path=name
      and public.app_can_access_operational_file(f.id)
  )
);

-- OCR3E — explicit amendment: the Group Pastor / Executive may discover and
-- enter every active Unit Room and Sub-team Room. This does not add DMs.
create or replace function public.app_can_access_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.rooms r
    where r.id=p_room_id
      and r.org_id=public.app_org_id()
      and (
        (
          r.kind='unit'
          and exists(select 1 from public.units u where u.id=r.unit_id and u.org_id=r.org_id and u.active)
          and (
            public.app_is_exec()
            or exists (
              select 1 from public.unit_memberships um
              where um.profile_id=auth.uid()
                and um.unit_id=r.unit_id
                and um.org_id=r.org_id
            )
          )
        )
        or
        (
          r.kind='sub_team'
          and exists (
            select 1 from public.sub_teams st
            where st.id=r.sub_team_id
              and st.unit_id=r.unit_id
              and st.org_id=r.org_id
              and st.active
              and (
                public.app_is_exec()
                or st.lead_id=auth.uid()
                or exists (
                  select 1 from public.sub_team_members stm
                  where stm.sub_team_id=st.id and stm.profile_id=auth.uid()
                )
                or exists (
                  select 1 from public.unit_memberships um
                  where um.unit_id=st.unit_id
                    and um.profile_id=auth.uid()
                    and um.role='manager'
                )
              )
          )
        )
        or
        (
          r.kind='project'
          and exists (
            select 1
            from public.unit_memberships um
            join public.projects p on p.id=r.project_id
            where um.profile_id=auth.uid()
              and um.org_id=r.org_id
              and (
                um.unit_id=p.lead_unit_id
                or exists (
                  select 1 from public.project_units pu
                  where pu.project_id=p.id and pu.unit_id=um.unit_id
                )
              )
          )
        )
      )
  );
$$;

revoke all on function public.app_can_access_room(uuid) from public,anon;
grant execute on function public.app_can_access_room(uuid) to authenticated,service_role;
