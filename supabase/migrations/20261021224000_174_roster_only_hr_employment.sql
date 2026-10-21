-- Canonical employee roster without login: HR employment facts and organisational placement.
-- No Auth invitation, operational membership, capability, payroll, salary or job-title elevation.
-- Existing platform audit triggers record roster and unit-membership changes.
alter table public.employee_roster
 add column manager_profile_id uuid references public.profiles(id) on delete restrict;

comment on column public.employee_roster.manager_profile_id is
 'HR-recorded administrative reporting supervisor for a roster-only employee. Not a login account, unit manager grant, or performance reviewer permission.';

create function public.admin_record_roster_employment(
 p_employee_id uuid,
 p_expected_updated_at timestamptz,
 p_full_name text,
 p_preferred_name text,
 p_job_title text,
 p_employment_type text,
 p_employment_status text,
 p_primary_unit_id uuid,
 p_secondary_unit_ids uuid[],
 p_manager_profile_id uuid,
 p_reason text
) returns jsonb
language plpgsql security definer set search_path = ''
as $roster$
declare
 v_org uuid := public.app_org_id();
 v_record public.employee_roster%rowtype;
 v_units uuid[] := coalesce(p_secondary_unit_ids,'{}'::uuid[]);
 v_ids uuid[];
 v_expected integer;
 v_actual integer;
 v_updated_at timestamptz;
begin
 if auth.uid() is null or v_org is null or not public.app_is_admin()
  or not public.app_stage2_universal_aal_allowed() then
  raise exception 'Only authorised Administration and HR can update employee records.' using errcode='42501';
 end if;
 if p_employee_id is null or p_expected_updated_at is null then
  raise exception 'Reload the employee record before recording a change.' using errcode='22023';
 end if;
 select * into v_record from public.employee_roster
  where id=p_employee_id and org_id=v_org for update;
 if not found then
  raise exception 'Employee record not found in this organisation.' using errcode='42501';
 end if;
 if v_record.profile_id is not null then
  raise exception 'This employee has a linked account. Use the audited employment change workflow.' using errcode='42501';
 end if;
 if v_record.updated_at is distinct from p_expected_updated_at then
  raise exception 'This employee record has changed. Reload before saving.' using errcode='40001';
 end if;
 if length(btrim(coalesce(p_full_name,''))) not between 2 and 180
  or length(coalesce(p_preferred_name,''))>180
  or length(coalesce(p_job_title,''))>180
  or length(btrim(coalesce(p_reason,'')))<8
  or length(p_reason)>2000 then
  raise exception 'Enter a valid employee name, title and reason of at least eight characters.' using errcode='22023';
 end if;
 if p_employment_type is null or p_employment_type not in ('permanent','fixed_term','volunteer','not_recorded')
  or p_employment_status is null or p_employment_status not in ('active','inactive') then
  raise exception 'Choose an approved employment type and current status. Exits use the formal employee lifecycle.' using errcode='22023';
 end if;
 if cardinality(v_units)>24 or array_position(v_units,null) is not null
  or (select count(distinct u) from unnest(v_units) u)<>cardinality(v_units)
  or p_primary_unit_id=any(v_units) then
  raise exception 'Choose distinct authorised units, without repeating the primary unit.' using errcode='22023';
 end if;
 if p_primary_unit_id is null and (cardinality(v_units)>0 or p_manager_profile_id is not null) then
  raise exception 'Choose a primary unit before additional placement or manager.' using errcode='22023';
 end if;
 select coalesce(array_agg(u), '{}'::uuid[]) into v_ids from (
  select p_primary_unit_id as u where p_primary_unit_id is not null
  union all select unnest(v_units)
 ) selected;
 v_expected:=cardinality(v_ids);
 select count(*) into v_actual from public.units u
  where u.org_id=v_org and u.active and u.id=any(v_ids);
 if v_actual<>v_expected then
  raise exception 'A selected unit is unavailable in this organisation.' using errcode='42501';
 end if;
 if p_manager_profile_id is not null and not exists (
  select 1 from public.profiles p join public.unit_memberships m
   on m.profile_id=p.id and m.org_id=p.org_id and m.unit_id=p_primary_unit_id
  where p.id=p_manager_profile_id and p.org_id=v_org and p.active and m.role='manager'
 ) then
  raise exception 'Choose an active manager of the employee primary unit.' using errcode='42501';
 end if;

 -- Demote before promoting; the existing unique primary-membership index is preserved.
 update public.employee_unit_memberships
  set is_primary=false,updated_at=clock_timestamp(),updated_by=auth.uid()
  where employee_id=p_employee_id and org_id=v_org and is_primary=true
   and unit_id is distinct from p_primary_unit_id;

 if p_primary_unit_id is not null then
  insert into public.employee_unit_memberships(org_id,employee_id,unit_id,is_primary,created_by,updated_by)
  values(v_org,p_employee_id,p_primary_unit_id,true,auth.uid(),auth.uid())
  on conflict(employee_id,unit_id) do update
   set is_primary=true,updated_at=clock_timestamp(),updated_by=auth.uid();
 end if;

 insert into public.employee_unit_memberships(org_id,employee_id,unit_id,is_primary,created_by,updated_by)
 select v_org,p_employee_id,ids.unit_id,false,auth.uid(),auth.uid() from unnest(v_units) as ids(unit_id)
 on conflict(employee_id,unit_id) do update
  set is_primary=false,updated_at=clock_timestamp(),updated_by=auth.uid();

 delete from public.employee_unit_memberships
  where employee_id=p_employee_id and org_id=v_org and not(unit_id=any(v_ids));

 update public.employee_roster
  set full_name=btrim(p_full_name),
      preferred_name=nullif(btrim(coalesce(p_preferred_name,'')),''),
      job_title=nullif(btrim(coalesce(p_job_title,'')),''),
      employment_type=p_employment_type,
      employment_status=p_employment_status,
      manager_profile_id=p_manager_profile_id,
      review_note=nullif(btrim(p_reason),''),
      updated_at=clock_timestamp(),updated_by=auth.uid()
  where id=p_employee_id and org_id=v_org and profile_id is null
  returning updated_at into v_updated_at;
 if not found then raise exception 'Employee identity changed while saving.' using errcode='40001'; end if;

 return jsonb_build_object(
  'employee_id',p_employee_id,
  'updated_at',v_updated_at,
  'profile_id',null,
  'manager_profile_id',p_manager_profile_id,
  'units',(select coalesce(jsonb_agg(jsonb_build_object(
   'unit_id',m.unit_id,'unit_name',u.name,'is_primary',m.is_primary,'context_label',m.context_label
   ) order by m.is_primary desc,u.name),'[]'::jsonb)
   from public.employee_unit_memberships m join public.units u on u.id=m.unit_id
   where m.org_id=v_org and m.employee_id=p_employee_id)
 );
end;
$roster$;

revoke all on function public.admin_record_roster_employment(
 uuid,timestamptz,text,text,text,text,text,uuid,uuid[],uuid,text) from public,anon,authenticated;
grant execute on function public.admin_record_roster_employment(
 uuid,timestamptz,text,text,text,text,text,uuid,uuid[],uuid,text) to authenticated;
comment on function public.admin_record_roster_employment(
 uuid,timestamptz,text,text,text,text,text,uuid,uuid[],uuid,text) is
 'Admin-only optimistic and auditable roster-only employment and primary/secondary unit updates; no account, capability or operational-role mutations.';
