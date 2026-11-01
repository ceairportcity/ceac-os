-- Human-review attendance reporting; no payroll or disciplinary decisions.
-- Reuses the already-authorised daily evidence scope and omits all GPS coordinates.
CREATE FUNCTION public.compliance_period_facts(p_from date,p_to date,p_limit integer DEFAULT 25,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $period$
DECLARE v_total bigint; v_rows jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.app_org_id() IS NULL
 OR NOT public.app_stage2_universal_aal_allowed()
 OR NOT (public.app_has_capability('compliance.manage',NULL)
         OR public.app_has_capability('workforce.manage',NULL) OR public.app_is_admin())
 THEN RAISE EXCEPTION 'Not authorised for organisation attendance reporting.' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>30
 OR p_limit NOT BETWEEN 1 AND 50 OR p_offset NOT BETWEEN 0 AND 200000
 THEN RAISE EXCEPTION 'Choose up to 31 dates and a valid page.' USING ERRCODE='22023'; END IF;
 WITH dates AS (
  SELECT d::date work_date FROM pg_catalog.generate_series(p_from::timestamp,p_to::timestamp,'1 day'::interval) d
 ), observed AS (
  SELECT work_date,person.value AS v FROM dates
  CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(public.attendance_day_evidence(work_date)) person(value)
 ), facts AS (
  SELECT work_date,(v->>'employee_id')::uuid employee_id,v->>'name' employee_name,
   v->>'unit_id' unit_id,v->>'expected_today'='true' scheduled,
   pg_catalog.jsonb_array_length(COALESCE(v->'sessions','[]'::jsonb))>0 started,
   EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(COALESCE(v->'approved_leave','[]'::jsonb)) l
    WHERE l->>'state'='current' AND (l->>'start_date')::date<=work_date AND (l->>'end_date')::date>=work_date) leave_approved,
   EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(COALESCE(v->'sessions','[]'::jsonb)) s
    WHERE s->>'ended_at' IS NULL) session_open,
   (SELECT min(s->>'started_at') FROM pg_catalog.jsonb_array_elements(COALESCE(v->'sessions','[]'::jsonb)) s) first_start,
   (SELECT max(s->>'ended_at') FROM pg_catalog.jsonb_array_elements(COALESCE(v->'sessions','[]'::jsonb)) s) last_finish,
   (SELECT s->>'place' FROM pg_catalog.jsonb_array_elements(COALESCE(v->'sessions','[]'::jsonb)) s ORDER BY s->>'started_at' LIMIT 1) location_kind
  FROM observed WHERE v->>'employee_id' IS NOT NULL
 ), grouped AS (
  SELECT employee_id,max(employee_name) name,max(unit_id) unit_id,
   count(*) FILTER(WHERE scheduled) expected_days,
   count(*) FILTER(WHERE started) recorded_days,
   count(*) FILTER(WHERE leave_approved) approved_leave_days,
   count(*) FILTER(WHERE scheduled AND NOT started AND NOT leave_approved) days_needing_check,
   count(*) FILTER(WHERE session_open) open_session_days,
   jsonb_agg(jsonb_build_object('date',work_date,'scheduled',scheduled,'started',started,
    'approved_leave',leave_approved,'open_session',session_open,'first_start',first_start,
    'last_finish',last_finish,'location',location_kind) ORDER BY work_date) days
  FROM facts GROUP BY employee_id
 )
 SELECT (SELECT count(*) FROM grouped),
  COALESCE((SELECT jsonb_agg(jsonb_build_object('employee_id',employee_id,'name',name,
   'unit_id',unit_id,'expected_days',expected_days,'recorded_days',recorded_days,
   'approved_leave_days',approved_leave_days,'days_needing_check',days_needing_check,
   'open_session_days',open_session_days,'days',days) ORDER BY name,employee_id)
   FROM (SELECT * FROM grouped ORDER BY name,employee_id LIMIT p_limit OFFSET p_offset) page),'[]'::jsonb)
 INTO v_total,v_rows;
 RETURN jsonb_build_object('from',p_from,'to',p_to,'total_people',v_total,'rows',v_rows,
  'page_size',p_limit,'page_offset',p_offset);
END $period$;
REVOKE ALL ON FUNCTION public.compliance_period_facts(date,date,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.compliance_period_facts(date,date,integer,integer) TO authenticated;
