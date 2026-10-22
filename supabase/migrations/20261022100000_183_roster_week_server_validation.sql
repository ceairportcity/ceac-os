-- Owner corrective: enforce authorised seven-day roster session hours on the
-- same canonical schedule RPC. No secondary engine or historical data rewrite.
-- Existing individual and off-day exceptions remain possible with approved
-- day-type vocabulary and effective-dated successor versions.
CREATE OR REPLACE FUNCTION public.workforce_record_roster_pattern(p_employee_id uuid, p_effective_from date, p_effective_to date, p_day_map jsonb, p_clock_map jsonb, p_reason text, p_supersedes_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_requires_session boolean;
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
     or (select count(*) from jsonb_object_keys(p_day_map))<>7
     or jsonb_typeof(p_clock_map) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_clock_map))<>7 then
    raise exception 'Choose valid dates, seven day types and an HR reason.' using errcode='22023';
  end if;
  for v_day in select * from jsonb_each_text(p_day_map) loop
    if v_day.key not in ('mon','tue','wed','thu','fri','sat','sun')
       or not exists(select 1 from public.workforce_day_types t
         where t.id=v_day.value::uuid and t.org_id=v_org and t.active) then
      raise exception 'Choose approved organisational day types.';
    end if;
    select t.session_expected into v_requires_session
    from public.workforce_day_types t
    where t.id=v_day.value::uuid and t.org_id=v_org and t.active;
    v_start:=nullif(p_clock_map->v_day.key->>'start','')::time;
    v_end:=nullif(p_clock_map->v_day.key->>'end','')::time;
    if v_requires_session and (v_start is null or v_end is null or v_end<=v_start) then
      raise exception 'Every scheduled work session requires valid start and end times.' using errcode='22023';
    end if;
    if not v_requires_session and (v_start is not null or v_end is not null) then
      raise exception 'Non-working days cannot carry expected session hours.' using errcode='22023';
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
$function$;

COMMENT ON FUNCTION public.workforce_record_roster_pattern(uuid,date,date,jsonb,jsonb,text,uuid) IS
 'HR-only canonical employee schedule: seven approved day types, complete day clocks, hours required on session days and forbidden on nonwork days, audited successor history.';
