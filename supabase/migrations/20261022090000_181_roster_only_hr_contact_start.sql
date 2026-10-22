-- The canonical roster-only employment record also needs contact and
-- joined-date facts. These are HUMAN RESOURCES details, never Auth credentials.
-- Works in the SAME transaction as the existing employee/placement operation.
ALTER TABLE public.employee_roster
  ADD COLUMN hr_contact_email text,
  ADD COLUMN hr_contact_phone text,
  ADD COLUMN hr_started_on date;
ALTER TABLE public.employee_roster
  ADD CONSTRAINT employee_roster_hr_contact_email_check CHECK (
    hr_contact_email IS NULL OR (length(hr_contact_email)<=254
      AND hr_contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
  ),
  ADD CONSTRAINT employee_roster_hr_contact_phone_check CHECK (
    hr_contact_phone IS NULL OR length(hr_contact_phone) BETWEEN 4 AND 40
  );
COMMENT ON COLUMN public.employee_roster.hr_contact_email IS
 'HR-only contact reference, NOT Auth sign-in email or a verified invited account.';
COMMENT ON COLUMN public.employee_roster.hr_contact_phone IS
 'HR-only contact telephone; no implied Auth phone verification.';
COMMENT ON COLUMN public.employee_roster.hr_started_on IS
 'HR-recorded employee start date, not derived from account activation.';

CREATE FUNCTION public.admin_record_roster_employment_profile(
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
 p_contact_email text,
 p_contact_phone text,
 p_started_on date,
 p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $record_hr_profile$
DECLARE
 v_org uuid:=public.app_org_id();
 v_old public.employee_roster%rowtype;
 v_base jsonb;
 v_updated_at timestamptz;
 v_email text:=nullif(lower(btrim(coalesce(p_contact_email,''))),'');
 v_phone text:=nullif(btrim(coalesce(p_contact_phone,'')),'');
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL
    OR NOT public.app_is_admin()
    OR NOT public.app_stage2_universal_aal_allowed() THEN
  RAISE EXCEPTION 'Authorised HR employee record access required.' USING errcode='42501';
 END IF;
 IF p_employee_id IS NULL OR p_expected_updated_at IS NULL THEN
  RAISE EXCEPTION 'Reload the selected employee before saving.' USING errcode='22023';
 END IF;
 IF v_email IS NOT NULL AND (length(v_email)>254
      OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN
  RAISE EXCEPTION 'Enter a valid HR contact email or leave it empty.' USING errcode='22023';
 END IF;
 IF v_phone IS NOT NULL AND length(v_phone) NOT BETWEEN 4 AND 40 THEN
  RAISE EXCEPTION 'Enter a valid contact phone length or leave it empty.' USING errcode='22023';
 END IF;
 SELECT * INTO v_old FROM public.employee_roster
 WHERE org_id=v_org AND id=p_employee_id FOR UPDATE;
 IF NOT FOUND OR v_old.profile_id IS NOT NULL THEN
  RAISE EXCEPTION 'An existing unlinked employee in this organisation is required.' USING errcode='42501';
 END IF;
 IF v_old.updated_at IS DISTINCT FROM p_expected_updated_at THEN
  RAISE EXCEPTION 'Employee record changed. Reload before saving.' USING errcode='40001';
 END IF;

 -- Same transaction: existing validated primary/secondary unit, authorised
 -- manager, employment and audited historical snapshot operation.
 v_base:=public.admin_record_roster_employment(
  p_employee_id,p_expected_updated_at,p_full_name,p_preferred_name,
  p_job_title,p_employment_type,p_employment_status,p_primary_unit_id,
  p_secondary_unit_ids,p_manager_profile_id,p_reason
 );
 v_updated_at:=(v_base->>'updated_at')::timestamptz;
 IF v_old.hr_contact_email IS DISTINCT FROM v_email
  OR v_old.hr_contact_phone IS DISTINCT FROM v_phone
  OR v_old.hr_started_on IS DISTINCT FROM p_started_on THEN
  UPDATE public.employee_roster
    SET hr_contact_email=v_email, hr_contact_phone=v_phone,
      hr_started_on=p_started_on, updated_at=clock_timestamp(), updated_by=auth.uid()
    WHERE id=p_employee_id AND org_id=v_org AND profile_id IS NULL
    RETURNING updated_at INTO v_updated_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee identity changed during HR save.' USING errcode='40001'; END IF;
  INSERT INTO public.employee_roster_change_events (
   org_id,employee_id,actor_id,reason,before_record,after_record
  ) VALUES (
   v_org,p_employee_id,auth.uid(),btrim(p_reason),
   jsonb_build_object('hr_contact_email',v_old.hr_contact_email,
      'hr_contact_phone',v_old.hr_contact_phone,'hr_started_on',v_old.hr_started_on),
   jsonb_build_object('hr_contact_email',v_email,'hr_contact_phone',v_phone,
      'hr_started_on',p_started_on)
  );
 END IF;
 RETURN v_base || jsonb_build_object('updated_at',v_updated_at,
  'hr_contact_email',v_email,'hr_contact_phone',v_phone,'hr_started_on',p_started_on);
END;
$record_hr_profile$;

REVOKE ALL ON FUNCTION public.admin_record_roster_employment_profile(
 uuid,timestamptz,text,text,text,text,text,uuid,uuid[],uuid,text,text,date,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_roster_employment_profile(
 uuid,timestamptz,text,text,text,text,text,uuid,uuid[],uuid,text,text,date,text)
 TO authenticated;
COMMENT ON FUNCTION public.admin_record_roster_employment_profile(
 uuid,timestamptz,text,text,text,text,text,uuid,uuid[],uuid,text,text,date,text)
 IS 'Atomic canonical HR roster-only employment, unit, contact and start-date edit. App Auth identities and access grants never change.';
