-- Executive read-only schedule summary. Resolves saved schedule day UUID values
-- into human-readable day types, without disclosing schedule change reasons,
-- HR protected fields, or write permissions.
CREATE OR REPLACE FUNCTION public.executive_personnel_schedule(p_profile_id uuid)
RETURNS TABLE (
  day_code text, day_label text, day_type text, session_expected boolean,
  effective_from date, effective_to date,
  expected_start time without time zone, expected_end time without time zone
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.app_is_exec() OR public.app_org_id() IS NULL OR p_profile_id IS NULL THEN
   RAISE EXCEPTION 'Executive permission required' USING ERRCODE='42501';
 END IF;
 RETURN QUERY
   SELECT day.key AS day_code,
     CASE day.key
       WHEN 'mon' THEN 'Monday' WHEN 'tue' THEN 'Tuesday'
       WHEN 'wed' THEN 'Wednesday' WHEN 'thu' THEN 'Thursday'
       WHEN 'fri' THEN 'Friday' WHEN 'sat' THEN 'Saturday'
       WHEN 'sun' THEN 'Sunday'
       ELSE 'Day' END AS day_label,
     t.name AS day_type, t.session_expected,
     s.effective_from, s.effective_to, s.expected_start, s.expected_end
   FROM public.workforce_schedule_versions s
   JOIN public.profiles p ON p.id=s.profile_id AND p.org_id=s.org_id AND p.active IS TRUE
   CROSS JOIN LATERAL pg_catalog.jsonb_each_text(coalesce(s.day_map,'{}'::jsonb)) day
   LEFT JOIN public.workforce_day_types t
     ON t.id::text=day.value AND t.org_id=s.org_id
   WHERE s.org_id=public.app_org_id() AND s.profile_id=p_profile_id
     AND s.id=(
       SELECT latest.id FROM public.workforce_schedule_versions latest
       WHERE latest.org_id=public.app_org_id()
         AND latest.profile_id=p_profile_id
         AND latest.effective_from<=CURRENT_DATE
         AND (latest.effective_to IS NULL OR latest.effective_to>=CURRENT_DATE)
       ORDER BY latest.effective_from DESC, latest.version DESC, latest.created_at DESC
       LIMIT 1
     )
   ORDER BY CASE day.key
     WHEN 'mon' THEN 1 WHEN 'tue' THEN 2 WHEN 'wed' THEN 3
     WHEN 'thu' THEN 4 WHEN 'fri' THEN 5 WHEN 'sat' THEN 6 WHEN 'sun' THEN 7 ELSE 8 END;
END;
$$;
REVOKE ALL ON FUNCTION public.executive_personnel_schedule(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.executive_personnel_schedule(uuid) TO authenticated;
