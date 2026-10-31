-- Executive, read-only staffing context. The ordinary employment_records and
-- leave_requests RLS policies remain unchanged. No salary, medical category,
-- leave reason, protected personnel record, private contact, or payroll field.
CREATE OR REPLACE FUNCTION public.executive_personnel_directory()
RETURNS TABLE (
  profile_id uuid,
  employment_type text,
  employment_status text,
  working_pattern jsonb,
  manager_profile_id uuid,
  unit_id uuid
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.app_is_exec() OR public.app_org_id() IS NULL THEN
    RAISE EXCEPTION 'Executive permission required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT e.profile_id, e.employment_type, e.employment_status,
           pg_catalog.jsonb_build_object(
             'kind',e.working_pattern->>'kind',
             'days',e.working_pattern->'days',
             'start',e.working_pattern->>'start',
             'end',e.working_pattern->>'end'
           ) AS working_pattern,
           e.manager_profile_id, e.unit_id
    FROM public.employment_records e
    JOIN public.profiles p ON p.id = e.profile_id AND p.org_id = e.org_id
    WHERE e.org_id = public.app_org_id()
      AND e.employment_status = 'active'
      AND p.active IS TRUE
    ORDER BY p.full_name, e.profile_id;
END;
$$;
REVOKE ALL ON FUNCTION public.executive_personnel_directory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.executive_personnel_directory() TO authenticated;

-- Only leave dates and pending/approved states needed for staffing oversight;
-- never expose private explanations, medical type or refused/cancelled requests.
CREATE OR REPLACE FUNCTION public.executive_personnel_leave(p_profile_id uuid)
RETURNS TABLE (id uuid, start_date date, end_date date, status text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.app_is_exec() OR public.app_org_id() IS NULL OR p_profile_id IS NULL THEN
    RAISE EXCEPTION 'Executive permission required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT l.id, l.start_date, l.end_date, l.status
    FROM public.leave_requests l
    JOIN public.profiles p ON p.id = l.profile_id AND p.org_id = l.org_id
    WHERE l.org_id = public.app_org_id()
      AND l.profile_id = p_profile_id
      AND l.status IN ('pending','manager_approved','approved')
      AND p.active IS TRUE
    ORDER BY l.start_date DESC, l.id DESC
    LIMIT 14;
END;
$$;
REVOKE ALL ON FUNCTION public.executive_personnel_leave(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.executive_personnel_leave(uuid) TO authenticated;
