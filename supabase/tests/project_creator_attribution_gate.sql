\set ON_ERROR_STOP on
begin;

-- Give the Executive no department-directory relationship to the readers.
delete from public.unit_memberships where profile_id = '31000000-0000-4000-8000-000000000004';

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000004', true);

insert into public.projects (id, org_id, lead_unit_id, name, creator_display_name)
values (
  '49000000-0000-4000-8000-000000000140',
  '10000000-0000-4000-8000-000000000010',
  '20000000-0000-4000-8000-000000000011',
  'Attribution fixture',
  'Forged name'
);

do $$
begin
  begin
    update public.projects set creator_display_name = 'Forged name'
    where id = '49000000-0000-4000-8000-000000000140';
    raise exception 'Project creator name was editable.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
do $$
declare
  viewer uuid;
  creator uuid := '31000000-0000-4000-8000-000000000004';
  project_id uuid := '49000000-0000-4000-8000-000000000140';
begin
  foreach viewer in array array[
    '31000000-0000-4000-8000-000000000001'::uuid,
    '31000000-0000-4000-8000-000000000002'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub', viewer::text, true);
    if exists (select from public.profiles where id = creator) then
      raise exception 'Fixture unexpectedly grants directory access to the creator.';
    end if;
    if not exists (
      select from public.projects
      where id = project_id and created_by = creator and creator_display_name = 'Executive Fixture'
    ) then
      raise exception 'An authorised project reader could not see the recorded creator.';
    end if;
  end loop;

  perform set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000005', true);
  if exists (select from public.projects where id = project_id) then
    raise exception 'A viewer outside the project could read the project and its attribution.';
  end if;
end;
$$;

rollback;
