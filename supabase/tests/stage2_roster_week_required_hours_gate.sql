\set ON_ERROR_STOP on
-- Real seeded local HR/Staff authority gate. All fixture and schedule writes
-- roll back; never create a paid provider, live Auth user or unapproved policy.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false
 WHERE id='10000000-0000-4000-8000-000000000010';
INSERT INTO public.employee_roster(
 id,org_id,full_name,employment_type,employment_status,identity_state,source_system,source_row_key
) VALUES (
 '41000000-0000-4000-8000-000000000183','10000000-0000-4000-8000-000000000010',
 'Schedule-only employee without account','not_recorded','active','roster_only','stage2_week_gate','week-183'
);
INSERT INTO public.workforce_day_types(id,org_id,name,session_expected,active) VALUES
 ('96000000-0000-4000-8000-000000000183','10000000-0000-4000-8000-000000000010','Gate office',true,true),
 ('96000000-0000-4000-8000-000000000184','10000000-0000-4000-8000-000000000010','Gate weekly off',false,true),
 ('96000000-0000-4000-8000-000000000185','10000000-0000-4000-8000-000000000010','Gate authorised remote',true,true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
DO $schedule$
DECLARE d jsonb;h jsonb;v_first uuid;v_next uuid;denied boolean;
 v_employee uuid:='41000000-0000-4000-8000-000000000183';
BEGIN
 IF NOT has_function_privilege('authenticated',
  'public.workforce_record_roster_pattern(uuid,date,date,jsonb,jsonb,text,uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.workforce_record_roster_pattern(uuid,date,date,jsonb,jsonb,text,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Roster-only schedule RPC grant does not match reviewed HR surface'; END IF;
 SELECT jsonb_object_agg(day,
   CASE WHEN day IN ('sat','sun') THEN '96000000-0000-4000-8000-000000000184'
   ELSE '96000000-0000-4000-8000-000000000183' END),
  jsonb_object_agg(day,
   CASE WHEN day IN ('sat','sun') THEN jsonb_build_object('start',NULL,'end',NULL)
   ELSE jsonb_build_object('start','10:00','end','17:00') END)
 INTO d,h FROM unnest(ARRAY['mon','tue','wed','thu','fri','sat','sun']) AS day;
 denied:=false;
 BEGIN
  PERFORM public.workforce_record_roster_pattern(v_employee,'2026-10-26',NULL,
    d,h-'wed','Incomplete workday hours must be rejected',NULL);
 EXCEPTION WHEN invalid_parameter_value THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Incomplete seven-day session clocks were accepted'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.workforce_record_roster_pattern(v_employee,'2026-10-26',NULL,
    d,jsonb_set(h,'{sat}',jsonb_build_object('start','10:00','end','17:00')),
    'Weekly off must not carry expected session hours',NULL);
 EXCEPTION WHEN invalid_parameter_value THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Off-day expected working hours were accepted'; END IF;
 v_first:=public.workforce_record_roster_pattern(v_employee,'2026-10-26',NULL,
  d,h,'Initial authorised seven-day employee week',NULL);
 IF NOT EXISTS(SELECT 1 FROM public.workforce_schedule_versions
   WHERE id=v_first AND employee_id=v_employee AND profile_id IS NULL AND version=1) THEN
  RAISE EXCEPTION 'Unlinked employee schedule did not persist as version one'; END IF;
 v_next:=public.workforce_record_roster_pattern(v_employee,'2026-11-02',NULL,
  jsonb_set(d,'{fri}',to_jsonb('96000000-0000-4000-8000-000000000185'::text)),
  jsonb_set(h,'{fri}',jsonb_build_object('start','09:00','end','16:00')),
  'Authorised future-Friday remote schedule amendment',v_first);
 IF NOT EXISTS(SELECT 1 FROM public.workforce_schedule_versions
   WHERE id=v_next AND employee_id=v_employee AND supersedes_id=v_first AND version=2)
  OR (SELECT count(*) FROM public.workforce_schedule_versions WHERE employee_id=v_employee)<>2
 THEN RAISE EXCEPTION 'Future approved exception did not preserve both HR versions'; END IF;
END;
$schedule$;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $staff$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
 PERFORM public.workforce_record_roster_pattern(
  '41000000-0000-4000-8000-000000000183','2026-11-09',NULL,
  '{}'::jsonb,'{}'::jsonb,'Ordinary Staff schedule override not authorised',NULL);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Staff was able to create employee HR schedules'; END IF;
END;
$staff$;
RESET ROLE;
ROLLBACK;
SELECT 'Stage 2 roster-only required hours and HR/Staff schedule authority gate PASSED' AS result;
