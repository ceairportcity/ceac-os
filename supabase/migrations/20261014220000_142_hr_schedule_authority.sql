-- Next-bundle HR-only schedule authority: no changes to approved history.
-- Manager/staff may request schedule changes; HR authorises the recorded
-- effective-dated workforce pattern. Enforce at SECURITY DEFINER RPC.

CREATE OR REPLACE FUNCTION public.workforce_record_pattern(p_profile_id uuid, p_unit_id uuid, p_effective_from date, p_effective_to date, p_day_map jsonb, p_clock_map jsonb, p_reason text, p_supersedes_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_org uuid:=public.app_org_id(); v_id uuid; prior public.workforce_schedule_versions; pair record; t_start time; t_end time;
begin
  if auth.uid() is null or not public.app_is_admin() or not public.app_has_capability('workforce.manage',null) then raise exception 'Workforce administration is required.' using errcode='42501'; end if;
  if jsonb_typeof(p_clock_map) is distinct from 'object' or jsonb_typeof(p_day_map) is distinct from 'object' then raise exception 'Choose a valid working pattern.'; end if;
  for pair in select * from jsonb_each(p_day_map) loop
    if pair.key not in ('sun','mon','tue','wed','thu','fri','sat') or not exists(select 1 from public.workforce_day_types where id=(pair.value#>>'{}')::uuid and org_id=v_org and active) then raise exception 'Choose an active day type in this organisation.'; end if;
  end loop;
  for pair in select * from jsonb_each(p_clock_map) loop
    if pair.key not in ('sun','mon','tue','wed','thu','fri','sat') or not p_day_map ? pair.key or jsonb_typeof(pair.value) is distinct from 'object'
       or exists(select 1 from jsonb_object_keys(pair.value) k where k not in ('start','end')) then raise exception 'Choose valid daily hours.'; end if;
    t_start:=nullif(pair.value->>'start','')::time; t_end:=nullif(pair.value->>'end','')::time;
    if (t_start is null)<>(t_end is null) or (t_start is not null and t_end<=t_start) then raise exception 'Daily hours need a start and a later end on the same day.'; end if;
  end loop;
  if not exists(select 1 from public.profiles where id=p_profile_id and org_id=v_org and active) then raise exception 'Choose an active person in your organisation.' using errcode='42501'; end if;
  if p_unit_id is not null and not exists(select 1 from public.unit_memberships where profile_id=p_profile_id and unit_id=p_unit_id and org_id=v_org) then raise exception 'Choose the person’s recorded unit.' using errcode='42501'; end if;
  if p_effective_from is null or (p_effective_to is not null and p_effective_to<p_effective_from) or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Choose valid effective dates and record a reason.'; end if;
  if p_supersedes_id is not null then
    select * into prior from public.workforce_schedule_versions where id=p_supersedes_id and org_id=v_org and profile_id=p_profile_id for update;
    if prior.id is null or exists(select 1 from public.workforce_schedule_versions where supersedes_id=prior.id) then raise exception 'The pattern has changed. Reload before recording a new version.'; end if;
  end if;
  insert into public.workforce_schedule_versions(org_id,schedule_key,version,profile_id,unit_id,effective_from,effective_to,source,day_map,clock_map,supersedes_id,reason,created_by)
    values(v_org,coalesce(prior.schedule_key,gen_random_uuid()),coalesce(prior.version+1,1),p_profile_id,p_unit_id,p_effective_from,p_effective_to,'person',p_day_map,p_clock_map,p_supersedes_id,btrim(p_reason),auth.uid()) returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.workforce_record_pattern(uuid,uuid,date,date,jsonb,jsonb,text,uuid)
  from public,anon;
grant execute on function public.workforce_record_pattern(uuid,uuid,date,date,jsonb,jsonb,text,uuid)
  to authenticated,service_role;
