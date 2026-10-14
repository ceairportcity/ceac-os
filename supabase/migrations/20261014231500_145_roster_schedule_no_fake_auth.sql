-- HR may record agreed schedules for roster-only staff before Auth activation.
-- Preserve actual employee_roster identity; never manufacture auth.users.
alter table public.workforce_schedule_versions
  add column if not exists employee_id uuid
    references public.employee_roster(id) on delete restrict;
alter table public.workforce_schedule_versions
  alter column profile_id drop not null;
alter table public.workforce_schedule_versions
  drop constraint if exists workforce_schedule_subject_required;
alter table public.workforce_schedule_versions
  add constraint workforce_schedule_subject_required
    check(profile_id is not null or employee_id is not null);
create index if not exists workforce_schedule_employee_version_idx
  on public.workforce_schedule_versions(org_id,employee_id,created_at desc);

create or replace function public.workforce_record_roster_pattern(
  p_employee_id uuid, p_effective_from date, p_effective_to date,
  p_day_map jsonb, p_clock_map jsonb, p_reason text,
  p_supersedes_id uuid default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_roster public.employee_roster%rowtype;
  v_prior public.workforce_schedule_versions%rowtype;
  v_id uuid;
  v_day record;
  v_hours record;
  v_start time;
  v_end time;
begin
  if v_actor is null or v_org is null
     or not public.app_is_admin()
     or not public.app_has_capability('workforce.manage',null) then
    raise exception 'HR workforce authority is required.' using errcode='42501';
  end if;
  select * into v_roster from public.employee_roster
  where id=p_employee_id and org_id=v_org for share;
  if v_roster.id is null then
    raise exception 'An existing verified roster record is required.' using errcode='42501';
  end if;
  if p_effective_from is null or
     (p_effective_to is not null and p_effective_to<p_effective_from)
     or length(btrim(coalesce(p_reason,''))) not between 8 and 600
     or jsonb_typeof(p_day_map) is distinct from 'object'
     or jsonb_typeof(p_clock_map) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_day_map))<>7 then
    raise exception 'Choose valid dates, seven day types and an HR reason.';
  end if;
  for v_day in select * from jsonb_each_text(p_day_map) loop
    if v_day.key not in ('mon','tue','wed','thu','fri','sat','sun')
       or not exists(select 1 from public.workforce_day_types t
         where t.id=v_day.value::uuid and t.org_id=v_org and t.active) then
      raise exception 'Choose approved organisational day types.';
    end if;
  end loop;
  for v_hours in select * from jsonb_each(p_clock_map) loop
    if v_hours.key not in ('mon','tue','wed','thu','fri','sat','sun')
       or not p_day_map ? v_hours.key
       or jsonb_typeof(v_hours.value) is distinct from 'object'
       or exists(select 1 from jsonb_object_keys(v_hours.value) k
         where k not in ('start','end')) then
      raise exception 'Choose valid daily clock hours.';
    end if;
    v_start:=nullif(v_hours.value->>'start','')::time;
    v_end:=nullif(v_hours.value->>'end','')::time;
    if (v_start is null)<>(v_end is null)
       or (v_start is not null and v_end<=v_start) then
      raise exception 'Daily end time must follow start time.';
    end if;
  end loop;
  if p_supersedes_id is not null then
    select * into v_prior from public.workforce_schedule_versions
    where id=p_supersedes_id and org_id=v_org
      and (employee_id=v_roster.id
        or (employee_id is null and profile_id=v_roster.profile_id
            and v_roster.profile_id is not null))
    for update;
    if v_prior.id is null or exists(select 1
      from public.workforce_schedule_versions s where s.supersedes_id=v_prior.id) then
      raise exception 'Schedule history changed. Reload before recording another version.';
    end if;
  end if;
  insert into public.workforce_schedule_versions(
    org_id,schedule_key,version,profile_id,employee_id,unit_id,
    effective_from,effective_to,source,day_map,clock_map,
    supersedes_id,reason,created_by
  ) values(
    v_org,coalesce(v_prior.schedule_key,gen_random_uuid()),
    coalesce(v_prior.version+1,1),v_roster.profile_id,v_roster.id,
    null,p_effective_from,p_effective_to,'person',p_day_map,p_clock_map,
    p_supersedes_id,btrim(p_reason),v_actor
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.workforce_record_roster_pattern(
  uuid,date,date,jsonb,jsonb,text,uuid) from public,anon;
grant execute on function public.workforce_record_roster_pattern(
  uuid,date,date,jsonb,jsonb,text,uuid) to authenticated;

-- Linking a roster identity later attaches schedule identity metadata without
-- altering historical schedule meaning, versions, day types or timestamps.
create or replace function public.workforce_link_roster_schedule_identity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.profile_id is distinct from old.profile_id
     and new.profile_id is not null then
    if not exists(select 1 from public.profiles p
      where p.id=new.profile_id and p.org_id=new.org_id) then
      raise exception 'Linked profile belongs to another organisation.' using errcode='42501';
    end if;
    update public.workforce_schedule_versions
    set profile_id=new.profile_id
    where org_id=new.org_id and employee_id=new.id
      and profile_id is null;
  end if;
  return new;
end;
$$;
revoke all on function public.workforce_link_roster_schedule_identity()
  from public,anon,authenticated;
drop trigger if exists workforce_roster_schedule_link on public.employee_roster;
create trigger workforce_roster_schedule_link
  after update of profile_id on public.employee_roster
  for each row execute function public.workforce_link_roster_schedule_identity();
