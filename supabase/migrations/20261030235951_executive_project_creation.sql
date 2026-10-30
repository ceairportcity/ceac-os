-- Executive project creation parity: authorise only verified Executive actors
-- through the same atomic, audited operation already used by HR/Managers.
-- app_is_exec() enforces active profile, confirmed identity and privileged AAL.
CREATE OR REPLACE FUNCTION public.create_project_with_participants(
 p_lead_unit_id uuid,
 p_name text,
 p_purpose text DEFAULT NULL::text,
 p_starts_on date DEFAULT NULL::date,
 p_ends_on date DEFAULT NULL::date,
 p_participant_unit_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
 v_org uuid:=public.app_org_id();
 v_id uuid:=gen_random_uuid();
 v_unit uuid;
 v_units uuid[];
begin
 if auth.uid() is null then raise exception 'Sign in to create a project.' using errcode='42501'; end if;
 if not (
  public.app_is_admin()
  or public.app_is_exec()
  or exists(select 1 from public.capabilities c where c.profile_id=auth.uid() and c.org_id=v_org and c.capability='create_project')
 ) then raise exception 'You do not have permission to create projects.' using errcode='42501'; end if;
 if p_lead_unit_id not in(select public.app_managed_units()) and not public.app_is_admin() and not public.app_is_exec() then
  raise exception 'You must manage the lead unit.' using errcode='42501';
 end if;
 if nullif(btrim(coalesce(p_name,'')),'') is null then raise exception 'Enter a project name.'; end if;
 if p_starts_on is not null and p_ends_on is not null and p_ends_on<p_starts_on then raise exception 'Project end cannot be before its start.'; end if;

 v_units:=array(select distinct x from unnest(array_append(coalesce(p_participant_unit_ids,'{}'::uuid[]),p_lead_unit_id)) x);
 foreach v_unit in array v_units loop
  if not exists(select 1 from public.units u where u.id=v_unit and u.org_id=v_org and u.active) then
   raise exception 'Every participating unit must be active in your organisation.';
  end if;
 end loop;

 insert into public.projects(id,org_id,kind,lead_unit_id,name,purpose,starts_on,ends_on,status,created_by)
 values(v_id,v_org,'project',p_lead_unit_id,btrim(p_name),nullif(btrim(coalesce(p_purpose,'')),''),p_starts_on,p_ends_on,'planned',auth.uid());

 foreach v_unit in array v_units loop
  insert into public.project_units(project_id,unit_id,role)
  values(v_id,v_unit,case when v_unit=p_lead_unit_id then 'lead' else 'participating' end);
 end loop;

 insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 values(v_org,auth.uid(),'project_created','project',v_id,jsonb_build_object('participant_count',cardinality(v_units)));

 return v_id;
end;
$function$;
