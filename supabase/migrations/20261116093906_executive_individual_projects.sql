-- An individual can own a project independently of department participation.
alter table public.projects
  alter column lead_unit_id drop not null,
  add column assigned_person_id uuid references public.profiles(id),
  add constraint projects_responsible_party_required
    check (lead_unit_id is not null or assigned_person_id is not null);

create index projects_assigned_person_idx on public.projects (org_id, assigned_person_id)
  where assigned_person_id is not null;

create function private.guard_project_individual_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.assigned_person_id is null then return new; end if;
  elsif (new.assigned_person_id is null and old.assigned_person_id is null)
    or (new.assigned_person_id is not distinct from old.assigned_person_id and new.org_id = old.org_id) then
    return new;
  end if;

  if not public.app_is_exec() or public.app_org_id() is distinct from new.org_id then
    raise exception 'Only the Group Pastor can assign a project to an individual.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and not (
    public.app_is_admin() or exists (
      select 1 from public.capabilities c
      where c.profile_id = auth.uid() and c.org_id = new.org_id and c.capability = 'create_project'
    )
  ) then
    raise exception 'You do not have permission to create projects.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (
    old.org_id is distinct from new.org_id
    or old.status not in ('planned', 'active')
    or old.archived_at is not null
    or public.operational_record_is_archived('projects', old.id, old.org_id)
  ) then
    raise exception 'Choose a planned or active project in your organisation.' using errcode = '42501';
  end if;
  if new.assigned_person_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.assigned_person_id and p.org_id = new.org_id and p.active
  ) then
    raise exception 'Choose an active person in your organisation.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_project_individual_assignment() from public, anon, authenticated;

create trigger projects_guard_individual_assignment
before insert or update of assigned_person_id, org_id on public.projects
for each row execute function private.guard_project_individual_assignment();

create function public.create_individually_assigned_project(
  p_assigned_person_id uuid,
  p_name text,
  p_purpose text default null,
  p_starts_on date default null,
  p_ends_on date default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.app_org_id();
  v_project_id uuid;
begin
  if auth.uid() is null or v_org is null or not public.app_is_exec() then
    raise exception 'You do not have permission to create an individually assigned project.' using errcode = '42501';
  end if;
  if p_assigned_person_id is null or nullif(btrim(p_name), '') is null then
    raise exception 'Enter a project name and choose who is responsible.' using errcode = '22023';
  end if;
  if p_starts_on is not null and p_ends_on < p_starts_on then
    raise exception 'Project end cannot be before its start.' using errcode = '22023';
  end if;

  insert into public.projects (
    org_id, kind, assigned_person_id, name, purpose, starts_on, ends_on, status, created_by
  ) values (
    v_org, 'project', p_assigned_person_id, btrim(p_name), nullif(btrim(p_purpose), ''),
    p_starts_on, p_ends_on, 'planned', auth.uid()
  ) returning id into v_project_id;
  insert into public.activity_events (org_id, actor_id, verb, object_type, object_id, meta)
  values (v_org, auth.uid(), 'project_created', 'project', v_project_id,
    jsonb_build_object('participant_count', 0, 'assigned_person_id', p_assigned_person_id));
  return v_project_id;
end;
$$;
revoke all on function public.create_individually_assigned_project(uuid,text,text,date,date) from public, anon;
grant execute on function public.create_individually_assigned_project(uuid,text,text,date,date) to authenticated;

create or replace function public.app_visible_projects()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.projects p
  where p.org_id = public.app_org_id()
    and not public.operational_record_is_archived('projects', p.id, p.org_id)
    and (
      public.app_is_admin()
      or public.app_is_exec()
      or public.app_has_capability('delivery.manage', null)
      or p.assigned_person_id = auth.uid()
      or p.lead_unit_id in (
        select m.unit_id from public.unit_memberships m where m.profile_id = auth.uid()
      )
      or exists (
        select 1 from public.project_units pu
        where pu.project_id = p.id and pu.unit_id in (
          select m.unit_id from public.unit_memberships m where m.profile_id = auth.uid()
        )
      )
    );
$$;
