-- Project readers can see the recorded creator's name through project RLS.
-- The staff directory continues to apply its own profile visibility rules.
alter table public.projects add column creator_display_name text;

update public.projects as project
set creator_display_name = nullif(btrim(creator.full_name), '')
from public.profiles as creator
where creator.id = project.created_by
  and creator.org_id = project.org_id
  and nullif(btrim(creator.full_name), '') is not null;

create function private.record_project_creator_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by
      or new.creator_display_name is distinct from old.creator_display_name
      or new.org_id is distinct from old.org_id then
      raise exception 'Project creation attribution cannot be changed.' using errcode = '42501';
    end if;
    return new;
  end if;

  if actor_id is not null then
    if new.created_by is not null and new.created_by <> actor_id then
      raise exception 'Projects must record the signed-in creator.' using errcode = '42501';
    end if;
    new.created_by := actor_id;
  end if;

  -- Resolve a single display name from the creator's same-organisation profile.
  -- Ignore any creator name supplied in the insert payload.
  select nullif(btrim(creator.full_name), '')
  into new.creator_display_name
  from public.profiles as creator
  where creator.id = new.created_by and creator.org_id = new.org_id;
  return new;
end;
$$;

revoke all on function private.record_project_creator_name() from public, anon, authenticated;

create trigger projects_record_creator_name
before insert or update of created_by, creator_display_name, org_id on public.projects
for each row execute function private.record_project_creator_name();
