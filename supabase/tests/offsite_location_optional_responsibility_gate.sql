\set ON_ERROR_STOP on
-- Local/CI rollback-only gate. Never run as a production attendance probe.
BEGIN;
SELECT set_config('request.jwt.claim.sub','',true);
UPDATE public.organisations SET universal_totp_required=false
WHERE id='10000000-0000-4000-8000-000000000010';
-- A pre-existing open session must not confound these start-specific probes.
UPDATE public.work_sessions SET ended_at=now()
WHERE profile_id='31000000-0000-4000-8000-000000000001' AND ended_at IS NULL;
INSERT INTO public.work_items(id,org_id,ref,unit_id,assignee_id,assigned_by,title,status) VALUES
 ('a8000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','OFFSITE-GATE-OWN','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000002','Synthetic own responsibility','in_progress'),
 ('a8000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','OFFSITE-GATE-OTHER','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000002','Synthetic other responsibility','in_progress'),
 ('a8000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000010','OFFSITE-GATE-DONE','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000002','Synthetic completed responsibility','completed');
DO $$ BEGIN
 IF has_function_privilege('authenticated','private.guard_offsite_session_start()','EXECUTE')
  OR has_function_privilege('anon','private.guard_offsite_session_start()','EXECUTE') THEN
  RAISE EXCEPTION 'Internal attendance trigger exposed as a callable function';
 END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='private.guard_offsite_session_start()'::regprocedure) THEN
  RAISE EXCEPTION 'Off-site validation must retain caller RLS';
 END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $gate$
DECLARE probe public.work_sessions; item uuid; bad jsonb; expected text; rejected boolean;
BEGIN
 -- Both unlinked and linked genuine attendance succeed and retain exact evidence.
 FOREACH item IN ARRAY ARRAY[NULL::uuid,'a8000000-0000-4000-8000-000000000001'::uuid] LOOP
  BEGIN
   INSERT INTO public.work_sessions(org_id,profile_id,place,work_item_id,lat,lng,location_accuracy_m,location_captured_at,device_time,flags)
   VALUES(public.app_org_id(),auth.uid(),'elsewhere',item,0,0,850,now(),now(),'{"offsite_location_name":"  Synthetic remote office  "}') RETURNING * INTO probe;
   IF probe.work_item_id IS DISTINCT FROM item OR probe.lat<>0 OR probe.lng<>0 OR probe.location_accuracy_m<>850
    OR probe.flags->>'offsite_location_name'<>'Synthetic remote office' OR probe.start_geofence<>'not_applicable' THEN
    RAISE EXCEPTION 'Recorded off-site evidence changed'; END IF;
   RAISE EXCEPTION 'Rollback successful probe' USING ERRCODE='Z0001';
  EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL; END;
 END LOOP;
 -- Direct client inserts cannot bypass the form. Each probe must be rejected.
 FOR bad,expected IN SELECT * FROM (VALUES
  ('{"name":null}'::jsonb,'missing name'),('{"name":"   "}','blank name'),
  (jsonb_build_object('name',repeat('x',201)),'long name'),
  ('{"name":123}','non-string name'),(jsonb_build_object('name',E'Place\nname'),'control characters'),
  ('{"no_location":true}','missing GPS'),('{"stale":true}','stale GPS'),
  ('{"future":true}','future GPS'),('{"lat":91}','invalid latitude'),
  ('{"work":"a8000000-0000-4000-8000-000000000002"}','someone else work'),
  ('{"work":"a8000000-0000-4000-8000-000000000003"}','completed work'),
  ('{"actor":"31000000-0000-4000-8000-000000000002"}','another employee'),
  ('{"org":"10000000-0000-4000-8000-000000000020"}','another organisation'),
  ('{"spoof_recovery":true,"name":null}','forged recovery flag')
 ) cases(input,label) LOOP
  rejected:=false;
  BEGIN
   INSERT INTO public.work_sessions(org_id,profile_id,place,work_item_id,lat,lng,location_accuracy_m,location_captured_at,device_time,flags)
   VALUES(coalesce((bad->>'org')::uuid,public.app_org_id()),coalesce((bad->>'actor')::uuid,auth.uid()),'elsewhere',(bad->>'work')::uuid,
    CASE WHEN bad ? 'no_location' THEN NULL ELSE coalesce((bad->>'lat')::float8,0) END,
    CASE WHEN bad ? 'no_location' THEN NULL ELSE 0 END,14,
    CASE WHEN bad ? 'stale' THEN now()-interval '3 minutes' WHEN bad ? 'future' THEN now()+interval '1 minute' ELSE now() END,now(),
    jsonb_build_object('offsite_location_name',CASE WHEN bad ? 'name' THEN bad->'name' ELSE '"Synthetic remote office"'::jsonb END)
     ||CASE WHEN bad ? 'spoof_recovery' THEN '{"continued_from_session_id":"a8000000-0000-4000-8000-000000000099"}'::jsonb ELSE '{}'::jsonb END);
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Expected off-site rejection: %',expected; END IF;
 END LOOP;
END;
$gate$;
RESET ROLE;
ROLLBACK;
