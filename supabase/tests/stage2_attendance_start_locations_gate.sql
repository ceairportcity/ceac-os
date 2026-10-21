\set ON_ERROR_STOP on
-- Rollback-only factual first-start GPS test. Every created record stays local.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false WHERE id='10000000-0000-4000-8000-000000000010';
CREATE TEMP TABLE stage2_attendance_start_probe (session_id uuid);
GRANT SELECT ON stage2_attendance_start_probe TO authenticated;
WITH inserted AS (INSERT INTO public.work_sessions(org_id,profile_id,place,started_at,lat,lng,location_accuracy_m,location_captured_at)
 VALUES ('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000001','elsewhere',clock_timestamp(),5.61,-0.23,14,clock_timestamp())
 RETURNING id) INSERT INTO stage2_attendance_start_probe SELECT id FROM inserted;

DO $permissions$
BEGIN
 IF to_regprocedure('public.attendance_day_evidence(date)') IS NULL
  OR has_function_privilege('anon','public.attendance_day_evidence(date)','EXECUTE') THEN
  RAISE EXCEPTION 'Daily attendance evidence public-execution boundary changed'; END IF;
END;
$permissions$;
-- Existing organisation-wide Compliance fixture receives ONLY its normal capability.
INSERT INTO public.capability_grants(org_id,profile_id,capability,scope_unit_id,granted_by,grant_reason)
 SELECT '10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000005',
  'compliance.manage',null,'31000000-0000-4000-8000-000000000003','Rollback-only start GPS evidence'
 WHERE NOT EXISTS (SELECT 1 FROM public.capability_grants
  WHERE profile_id='31000000-0000-4000-8000-000000000005'
  AND capability='compliance.manage' AND scope_unit_id IS NULL AND revoked_at IS NULL);
SET LOCAL ROLE authenticated;
-- HR administrator sees the actual session's historical start GPS and place.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
DO $hr$
DECLARE v_result jsonb;
BEGIN
 SELECT session INTO v_result
 FROM jsonb_array_elements(public.attendance_day_evidence(current_date)) r
 CROSS JOIN LATERAL jsonb_array_elements(r->'sessions') session
 WHERE r->>'profile_id'='31000000-0000-4000-8000-000000000001'
  AND session->>'id'=(SELECT session_id::text FROM stage2_attendance_start_probe);
 IF v_result IS NULL OR v_result->>'place'<>'elsewhere'
  OR (v_result->>'start_lat')::numeric<>5.61 OR (v_result->>'start_lng')::numeric<>-0.23
  OR (v_result->>'start_location_accuracy_m')::numeric<>14
 THEN RAISE EXCEPTION 'HR start GPS evidence not read from actual stored session'; END IF;
END;
$hr$;
-- Compliance sees only the scoped factual observation, not a raw-table permission.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
DO $compliance$
DECLARE v_result jsonb;
BEGIN
 IF NOT public.app_has_capability('compliance.manage',null) THEN
  RAISE EXCEPTION 'Compliance test fixture does not hold its authorised capability'; END IF;
 SELECT session INTO v_result
 FROM jsonb_array_elements(public.attendance_day_evidence(current_date)) r
 CROSS JOIN LATERAL jsonb_array_elements(r->'sessions') session
 WHERE r->>'profile_id'='31000000-0000-4000-8000-000000000001'
  AND session->>'id'=(SELECT session_id::text FROM stage2_attendance_start_probe);
 IF v_result IS NULL OR (v_result->>'start_lat')::numeric<>5.61 OR (v_result->>'start_lng')::numeric<>-0.23
 THEN RAISE EXCEPTION 'Scoped Compliance did not receive a recorded start'; END IF;
 IF has_table_privilege('authenticated','public.attendance_notices','SELECT') THEN
  RAISE EXCEPTION 'Raw attendance notice table was made readable'; END IF;
END;
$compliance$;
-- Ordinary staff retains their OWN attendance facts but not the new precise coordinates.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $staff$
DECLARE v_result jsonb;
BEGIN
 IF public.app_is_admin() OR public.app_has_capability('compliance.manage',null)
  OR public.app_has_capability('workforce.manage',null) THEN
  RAISE EXCEPTION 'Staff test identity unexpectedly holds broad location authority'; END IF;
 SELECT session INTO v_result
 FROM jsonb_array_elements(public.attendance_day_evidence(current_date)) r
 CROSS JOIN LATERAL jsonb_array_elements(r->'sessions') session
 WHERE r->>'profile_id'=auth.uid()::text
  AND session->>'id'=(SELECT session_id::text FROM stage2_attendance_start_probe);
 IF v_result IS NULL OR v_result->>'start_lat' IS NOT NULL
  OR v_result->>'start_lng' IS NOT NULL OR v_result->>'start_location_accuracy_m' IS NOT NULL THEN
  RAISE EXCEPTION 'Precise location boundary was opened to ordinary staff'; END IF;
END;
$staff$;
-- A manager of a different unit may not see the underlying person or their start.
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000007',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}',true);
DO $other$
BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.attendance_day_evidence(current_date)) r
  CROSS JOIN LATERAL jsonb_array_elements(r->'sessions') session
  WHERE session->>'id'=(SELECT session_id::text FROM stage2_attendance_start_probe)) THEN
  RAISE EXCEPTION 'Other-unit manager accessed unauthorised start GPS'; END IF;
END;
$other$;
RESET ROLE;
ROLLBACK;
