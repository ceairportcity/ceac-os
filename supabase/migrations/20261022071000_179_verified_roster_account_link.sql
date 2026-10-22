-- Forward-only: manually verified link of an existing employee roster person to
-- an EXISTING email-confirmed account. Never create users, roles or permissions.
-- No automated name matching. Not applied to production in this correction PR.
CREATE TABLE public.employee_roster_identity_link_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
 employee_id uuid NOT NULL REFERENCES public.employee_roster(id) ON DELETE RESTRICT,
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 evidence_file_id uuid NOT NULL REFERENCES public.operational_files(id) ON DELETE RESTRICT,
 confirmed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 12 AND 2000),
 earlier_state text NOT NULL
);
CREATE UNIQUE INDEX employee_roster_identity_link_event_once_idx
 ON public.employee_roster_identity_link_events(org_id,employee_id);
ALTER TABLE public.employee_roster_identity_link_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_roster_identity_link_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.employee_roster_identity_link_events TO authenticated;
CREATE POLICY employee_roster_identity_link_events_hr_read
 ON public.employee_roster_identity_link_events FOR SELECT TO authenticated
 USING (org_id=public.app_org_id() AND public.app_is_admin()
  AND public.app_stage2_universal_aal_allowed());
COMMENT ON TABLE public.employee_roster_identity_link_events IS
 'Append-only HR confirmation of one existing roster-person ↔ existing profile link, with preexisting private employee document evidence. No Auth, capability or membership grant.';

CREATE FUNCTION public.admin_confirm_existing_roster_account_link(
 p_employee_id uuid,
 p_profile_id uuid,
 p_expected_updated_at timestamptz,
 p_evidence_file_id uuid,
 p_confirmed_account_email text,
 p_independently_verified boolean,
 p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $link$
DECLARE
 v_org uuid:=public.app_org_id();
 v_employee public.employee_roster%ROWTYPE;
 v_profile public.profiles%ROWTYPE;
 v_auth_email text;
 v_confirmed_at timestamptz;
 v_matching_unit_count integer;
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.app_is_admin()
  OR NOT public.app_stage2_universal_aal_allowed() THEN
  RAISE EXCEPTION 'Only authorised Administration may link a verified existing employee identity.' USING errcode='42501';
 END IF;
 IF p_employee_id IS NULL OR p_profile_id IS NULL
  OR p_expected_updated_at IS NULL OR p_evidence_file_id IS NULL
  OR p_independently_verified IS DISTINCT FROM true
  OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 12 AND 2000
  OR length(btrim(coalesce(p_confirmed_account_email,'')))<5 THEN
  RAISE EXCEPTION 'Confirm the person, existing account, private documentary proof and independent HR review.' USING errcode='22023';
 END IF;
 SELECT * INTO v_employee FROM public.employee_roster
  WHERE id=p_employee_id AND org_id=v_org FOR UPDATE;
 IF NOT FOUND OR v_employee.profile_id IS NOT NULL THEN
  RAISE EXCEPTION 'Employee is missing or already linked; no existing identity can be overwritten.' USING errcode='42501';
 END IF;
 IF v_employee.employment_status<>'active'
  OR v_employee.updated_at IS DISTINCT FROM p_expected_updated_at THEN
  RAISE EXCEPTION 'Employee state has changed. Verify the current HR record before linking.' USING errcode='40001';
 END IF;
 SELECT * INTO v_profile FROM public.profiles
  WHERE id=p_profile_id AND org_id=v_org AND active FOR SHARE;
 IF NOT FOUND OR EXISTS (
  SELECT 1 FROM public.employee_roster r WHERE r.profile_id=p_profile_id
 ) THEN
  RAISE EXCEPTION 'This existing account is unavailable or already belongs to another employee.' USING errcode='42501';
 END IF;
 SELECT u.email,u.email_confirmed_at INTO v_auth_email,v_confirmed_at
 FROM auth.users u WHERE u.id=p_profile_id;
 IF v_confirmed_at IS NULL OR v_auth_email IS NULL
  OR lower(btrim(v_auth_email)) IS DISTINCT FROM lower(btrim(v_profile.email))
  OR lower(btrim(v_auth_email)) IS DISTINCT FROM lower(btrim(p_confirmed_account_email)) THEN
  RAISE EXCEPTION 'Existing confirmed account identity does not match HR independent verification.' USING errcode='42501';
 END IF;
 -- Evidence must be a FINAL, already private, same-organisation document
 -- specifically attached to the existing canonical employee. A name alone
 -- or an unfinalised/free-text reference can never authorise a link.
 IF NOT EXISTS (
  SELECT 1 FROM public.operational_file_links l
  JOIN public.operational_files f ON f.id=l.file_id AND f.org_id=l.org_id
  WHERE l.org_id=v_org AND l.context_type='employee_document'
   AND l.context_id=p_employee_id AND l.file_id=p_evidence_file_id
   AND f.state='active' AND f.storage_bucket='ceac-operational-private'
   AND f.finalised_at IS NOT NULL
 ) THEN
  RAISE EXCEPTION 'Verified, finalised private employee document evidence is required.' USING errcode='42501';
 END IF;
 -- Cross-check actual operational unit membership, NOT job title or names.
 -- Roster placement must first be reconciled with the existing account.
 SELECT count(*) INTO v_matching_unit_count
 FROM public.employee_unit_memberships em
 JOIN public.unit_memberships m ON m.unit_id=em.unit_id AND m.org_id=em.org_id
 WHERE em.org_id=v_org AND em.employee_id=p_employee_id
  AND m.profile_id=p_profile_id;
 IF v_matching_unit_count=0 THEN
  RAISE EXCEPTION 'The existing account has no matching verified operational unit. Reconcile units before linking.' USING errcode='42501';
 END IF;
 UPDATE public.employee_roster
  SET profile_id=p_profile_id,identity_state='linked',
    updated_by=auth.uid(),updated_at=clock_timestamp()
 WHERE id=p_employee_id AND org_id=v_org AND profile_id IS NULL;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Employee identity changed during verification.' USING errcode='40001';
 END IF;
 INSERT INTO public.employee_roster_identity_link_events(
  org_id,employee_id,profile_id,evidence_file_id,confirmed_by,reason,earlier_state)
 VALUES(v_org,p_employee_id,p_profile_id,p_evidence_file_id,auth.uid(),
  btrim(p_reason),v_employee.identity_state);
 RETURN jsonb_build_object('employee_id',p_employee_id,'profile_id',p_profile_id,
  'linked',true,'confirmed',true);
END
$link$;
REVOKE ALL ON FUNCTION public.admin_confirm_existing_roster_account_link(
 uuid,uuid,timestamptz,uuid,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_existing_roster_account_link(
 uuid,uuid,timestamptz,uuid,text,boolean,text) TO authenticated;
COMMENT ON FUNCTION public.admin_confirm_existing_roster_account_link(
 uuid,uuid,timestamptz,uuid,text,boolean,text) IS
 'HR-authorised manual employee-to-existing-account linking, requiring finalised employee-document evidence, exact email confirmation, linked unit and stale-write check; preserves Auth user/role/grants.';
