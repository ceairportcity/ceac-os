-- Stage 2 additional correction: allow explicit roster creation for an unlinked operational account.
-- Identity creation does not invite, provision, link or grant operational authority.
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
 IF p_employment_type IS NULL OR p_employment_type NOT IN ('permanent','fixed_term','volunteer','not_recorded')
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
-- Existing restricted function ACLs are preserved by CREATE OR REPLACE.
