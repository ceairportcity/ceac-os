-- One roster-backed, purpose-limited work-start map feed for HR, Executive and Compliance.
-- No private HR, payroll, absence reasons, personal contacts or live device tracking.
CREATE OR REPLACE FUNCTION public.workforce_map_day(p_date date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := public.app_org_id();
  v_roster jsonb;
  v_sessions jsonb;
  v_unlinked jsonb;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL
     OR NOT public.app_stage2_universal_aal_allowed()
     OR NOT (
       public.app_is_admin() OR public.app_is_exec()
       OR public.app_has_capability('compliance.manage', NULL)
     ) THEN
    RAISE EXCEPTION 'Workforce map access denied' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'A map date is required' USING ERRCODE = '22023';
  END IF;
  v_start := p_date::timestamp AT TIME ZONE 'Africa/Accra';
  v_end := (p_date + 1)::timestamp AT TIME ZONE 'Africa/Accra';

  -- A roster record remains visible without an Auth account or a recorded start.
  -- The same employee ID and department labels are used on every authorised map.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', emp.id,
    'profile_id', emp.profile_id,
    'full_name', COALESCE(NULLIF(btrim(emp.full_name), ''), p.full_name, 'Employee'),
    'units', COALESCE((
      SELECT jsonb_agg(unit_name ORDER BY unit_name)
      FROM (
        SELECT u.name AS unit_name
        FROM public.employee_unit_memberships eum
        JOIN public.units u ON u.id = eum.unit_id AND u.org_id = v_org
        WHERE eum.org_id = v_org AND eum.employee_id = emp.id AND u.active
        UNION
        SELECT u.name FROM public.employment_records e
        JOIN public.units u ON u.id = e.unit_id AND u.org_id = v_org
        WHERE e.org_id = v_org AND e.profile_id = emp.profile_id AND u.active
        UNION
        SELECT u.name FROM public.unit_memberships um
        JOIN public.units u ON u.id = um.unit_id AND u.org_id = v_org
        WHERE um.org_id = v_org AND um.profile_id = emp.profile_id AND u.active
      ) mapped_units
    ), '[]'::jsonb)
  ) ORDER BY emp.full_name, emp.id), '[]'::jsonb)
  INTO v_roster
  FROM public.employee_roster emp
  LEFT JOIN public.profiles p ON p.id = emp.profile_id AND p.org_id = v_org
  WHERE emp.org_id = v_org
    AND emp.employment_status = 'active'
    AND (p.id IS NULL OR p.active IS TRUE);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id, 'profile_id', s.profile_id,
    'started_at', s.started_at, 'ended_at', s.ended_at,
    'place', s.place, 'lat', s.lat, 'lng', s.lng,
    'location_captured_at', s.location_captured_at,
    'location_accuracy_m', s.location_accuracy_m
  ) ORDER BY s.started_at, s.id), '[]'::jsonb)
  INTO v_sessions
  FROM public.work_sessions s
  WHERE s.org_id = v_org
    AND s.started_at >= v_start AND s.started_at < v_end;

  -- Real starts from accounts not yet linked to the roster must not disappear.
  -- Only the minimum name needed to label an unmatched work-start is returned.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'profile_id', p.id, 'full_name', p.full_name
  ) ORDER BY p.full_name, p.id), '[]'::jsonb)
  INTO v_unlinked
  FROM public.profiles p
  WHERE p.org_id = v_org
    AND EXISTS (SELECT 1 FROM public.work_sessions s
      WHERE s.org_id = v_org AND s.profile_id = p.id
        AND s.started_at >= v_start AND s.started_at < v_end)
    AND NOT EXISTS (SELECT 1 FROM public.employee_roster emp
      WHERE emp.org_id = v_org AND emp.profile_id = p.id
        AND emp.employment_status = 'active');

  RETURN jsonb_build_object(
    'date', p_date, 'as_of', now(),
    'roster', v_roster, 'sessions', v_sessions,
    'operationalProfiles', v_unlinked,
    'roster_count', jsonb_array_length(v_roster),
    'session_count', jsonb_array_length(v_sessions)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.workforce_map_day(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workforce_map_day(date) TO authenticated;
