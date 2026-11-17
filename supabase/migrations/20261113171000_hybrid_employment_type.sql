-- Accept Hybrid in the roster constraint and both existing HR write functions.
ALTER TABLE public.employee_roster
  DROP CONSTRAINT employee_roster_employment_type_check,
  ADD CONSTRAINT employee_roster_employment_type_check
    CHECK (employment_type IN ('permanent','fixed_term','hybrid','volunteer','not_recorded'));

CREATE OR REPLACE FUNCTION public.admin_create_roster_employee(
 p_full_name text,
 p_preferred_name text,
 p_job_title text,
 p_employment_type text,
 p_employment_status text,
 p_primary_unit_id uuid,
 p_secondary_unit_ids uuid[],
 p_manager_profile_id uuid,
 p_contact_email text,
 p_contact_phone text,
 p_started_on date,
 p_reason text,
 p_confirm_distinct_person boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $create_roster$
DECLARE
 v_org uuid:=public.app_org_id();
 v_name text:=btrim(coalesce(p_full_name,''));
 v_email text:=nullif(lower(btrim(coalesce(p_contact_email,''))),'');
 v_phone text:=nullif(btrim(coalesce(p_contact_phone,'')),'');
 v_secondary uuid[]:=coalesce(p_secondary_unit_ids,'{}'::uuid[]);
 v_unit_ids uuid[];
 v_employee_id uuid;
 v_updated_at timestamptz;
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.app_is_admin()
   OR NOT public.app_stage2_universal_aal_allowed() THEN
   RAISE EXCEPTION 'Only authorised Administration and HR can create an employee record.' USING errcode='42501';
 END IF;
 IF length(v_name) NOT BETWEEN 2 AND 180
   OR length(coalesce(p_preferred_name,''))>180
   OR length(coalesce(p_job_title,''))>180
   OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 12 AND 2000 THEN
   RAISE EXCEPTION 'Enter a name and a documented creation reason of at least twelve characters.' USING errcode='22023';
 END IF;
 IF p_employment_type IS NULL OR p_employment_type NOT IN ('permanent','fixed_term','hybrid','volunteer','not_recorded')
   OR p_employment_status IS NULL OR p_employment_status NOT IN ('active','inactive') THEN
   RAISE EXCEPTION 'Choose a supported employment type and active/inactive status.' USING errcode='22023';
 END IF;
 IF v_email IS NOT NULL AND (length(v_email)>254
     OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN
   RAISE EXCEPTION 'Enter a valid HR contact email or leave it empty.' USING errcode='22023';
 END IF;
 IF v_phone IS NOT NULL AND length(v_phone) NOT BETWEEN 4 AND 40 THEN
   RAISE EXCEPTION 'Enter a valid contact telephone or leave it empty.' USING errcode='22023';
 END IF;
 IF cardinality(v_secondary)>24 OR array_position(v_secondary,null) IS NOT NULL
   OR (SELECT count(DISTINCT u) FROM unnest(v_secondary) u)<>cardinality(v_secondary)
   OR p_primary_unit_id=ANY(v_secondary) THEN
   RAISE EXCEPTION 'Choose distinct primary/secondary organisation units.' USING errcode='22023';
 END IF;
 IF p_primary_unit_id IS NULL AND (cardinality(v_secondary)>0 OR p_manager_profile_id IS NOT NULL) THEN
   RAISE EXCEPTION 'A primary unit is required for additional placement or a manager.' USING errcode='22023';
 END IF;
 SELECT coalesce(array_agg(u),'{}'::uuid[]) INTO v_unit_ids FROM (
   SELECT p_primary_unit_id AS u WHERE p_primary_unit_id IS NOT NULL
   UNION ALL SELECT unnest(v_secondary)
 ) selected;
 IF (SELECT count(*) FROM public.units u
     WHERE u.org_id=v_org AND u.active AND u.id=ANY(v_unit_ids)) <> cardinality(v_unit_ids) THEN
   RAISE EXCEPTION 'One or more selected units are unavailable in this organisation.' USING errcode='42501';
 END IF;
 IF p_manager_profile_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.profiles p
   JOIN public.unit_memberships m ON m.profile_id=p.id AND m.org_id=p.org_id
   JOIN public.employment_records e ON e.profile_id=p.id AND e.org_id=v_org
   WHERE p.id=p_manager_profile_id AND p.org_id=v_org AND p.active
     AND m.unit_id=p_primary_unit_id AND m.role='manager' AND e.employment_status='active'
 ) THEN
   RAISE EXCEPTION 'Choose an active authorised manager in the primary unit.' USING errcode='42501';
 END IF;
 -- Avoid silent creation of a second employee for an existing operational
 -- identity or previously recorded HR contact. Names can genuinely coincide,
 -- but a second exact-name record requires explicit independent confirmation.
 -- Serialise HR manual creation for this organisation to prevent check/insert
 -- races between concurrent administrators. No lock affects unrelated tenants.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text || '/manual-roster-create',0));
 IF v_email IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.employee_roster r WHERE r.org_id=v_org
     AND lower(btrim(r.hr_contact_email))=v_email
 ) THEN
   RAISE EXCEPTION 'This HR contact email belongs to an existing employee record. Review that person instead.' USING errcode='23505';
 END IF;
 -- An EXISTING login without a roster record must not create a dead end.
 -- HR may create a roster-only identity only after manual acknowledgement,
 -- and linking still requires independent documentary verification.
 IF v_email IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.profiles p
   JOIN public.employee_roster r ON r.profile_id=p.id AND r.org_id=p.org_id
   WHERE p.org_id=v_org AND lower(btrim(p.email))=v_email
 ) THEN
   RAISE EXCEPTION 'This account is already linked to an HR employee. Open that existing record instead of creating another.' USING errcode='23505';
 END IF;
 IF v_email IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.profiles p WHERE p.org_id=v_org
     AND lower(btrim(p.email))=v_email
 ) AND p_confirm_distinct_person IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'An operational account uses this email. Verify the correct employee record and explicitly acknowledge separate roster creation before later evidence-backed linking.' USING errcode='23505';
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.employee_roster r WHERE r.org_id=v_org
     AND lower(btrim(r.full_name))=lower(v_name)
 ) AND p_confirm_distinct_person IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'A roster employee has this name. Review existing records and confirm a distinct person before creating another.' USING errcode='23505';
 END IF;
 INSERT INTO public.employee_roster(
   org_id,full_name,preferred_name,job_title,employment_type,employment_status,
   identity_state,source_system,manager_profile_id,hr_contact_email,hr_contact_phone,
   hr_started_on,created_by,updated_by
 ) VALUES (
   v_org,v_name,nullif(btrim(coalesce(p_preferred_name,'')),''),
   nullif(btrim(coalesce(p_job_title,'')),''),
   p_employment_type,p_employment_status,'roster_only','hr_manual',
   p_manager_profile_id,v_email,v_phone,p_started_on,auth.uid(),auth.uid()
 ) RETURNING id,updated_at INTO v_employee_id,v_updated_at;

 INSERT INTO public.employee_unit_memberships(
   org_id,employee_id,unit_id,is_primary,created_by,updated_by)
 SELECT v_org,v_employee_id,u, (u=p_primary_unit_id),auth.uid(),auth.uid()
 FROM unnest(v_unit_ids) u;

 INSERT INTO public.employee_roster_change_events(
   org_id,employee_id,actor_id,reason,before_record,after_record)
 VALUES(v_org,v_employee_id,auth.uid(),btrim(p_reason),'{}'::jsonb,
   jsonb_build_object(
     'event','employee_created','full_name',v_name,
     'preferred_name',nullif(btrim(coalesce(p_preferred_name,'')),''),
     'job_title',nullif(btrim(coalesce(p_job_title,'')),''),
     'employment_type',p_employment_type,'employment_status',p_employment_status,
     'manager_profile_id',p_manager_profile_id,'hr_contact_email',v_email,
     'hr_contact_phone',v_phone,'hr_started_on',p_started_on,
     'confirm_distinct_person',coalesce(p_confirm_distinct_person,false),
     'units',(SELECT coalesce(jsonb_agg(jsonb_build_object(
        'unit_id',u.unit_id,'is_primary',u.is_primary)),'[]'::jsonb)
        FROM public.employee_unit_memberships u
        WHERE u.org_id=v_org AND u.employee_id=v_employee_id)
   ));
 RETURN jsonb_build_object('employee_id',v_employee_id,'updated_at',v_updated_at,
   'profile_id',null,'created',true);
END;
$create_roster$;

create or replace function public.admin_record_roster_employment(
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
 v_before_units jsonb;
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
 if p_employment_type is null or p_employment_type not in ('permanent','fixed_term','hybrid','volunteer','not_recorded')
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
  join public.employment_records er on er.profile_id=p.id and er.org_id=v_org
  where p.id=p_manager_profile_id and p.org_id=v_org and p.active and m.role='manager'
   and er.employment_status='active'
 ) then
  raise exception 'Choose an active manager of the employee primary unit.' using errcode='42501';
 end if;

 select coalesce(jsonb_agg(jsonb_build_object('unit_id',m.unit_id,'is_primary',m.is_primary) order by m.unit_id),'[]'::jsonb)
 into v_before_units from public.employee_unit_memberships m
 where m.employee_id=p_employee_id and m.org_id=v_org;

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
      updated_at=clock_timestamp(),updated_by=auth.uid()
  where id=p_employee_id and org_id=v_org and profile_id is null
  returning updated_at into v_updated_at;
 if not found then raise exception 'Employee identity changed while saving.' using errcode='40001'; end if;

 insert into public.employee_roster_change_events (
  org_id,employee_id,actor_id,reason,before_record,after_record)
 values(v_org,p_employee_id,auth.uid(),btrim(p_reason),
  jsonb_build_object(
   'full_name',v_record.full_name,'preferred_name',v_record.preferred_name,
   'job_title',v_record.job_title,'employment_type',v_record.employment_type,
   'employment_status',v_record.employment_status,'manager_profile_id',v_record.manager_profile_id,
   'units',v_before_units
  ),
  jsonb_build_object(
   'full_name',btrim(p_full_name),'preferred_name',nullif(btrim(coalesce(p_preferred_name,'')),''),
   'job_title',nullif(btrim(coalesce(p_job_title,'')),''),
   'employment_type',p_employment_type,'employment_status',p_employment_status,
   'manager_profile_id',p_manager_profile_id,'units',
   (select coalesce(jsonb_agg(jsonb_build_object('unit_id',m.unit_id,'is_primary',m.is_primary) order by m.unit_id),'[]'::jsonb)
    from public.employee_unit_memberships m where m.employee_id=p_employee_id and m.org_id=v_org)
  )
 );

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
