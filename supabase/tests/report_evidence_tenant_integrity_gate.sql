\set ON_ERROR_STOP on
-- Disposable-only two-tenant report evidence acceptance. Requires versions
-- 001..129 replayed and seeded role fixtures. Never run on CEAC production.
-- Synthetic mismatched-org rows are inserted only before SET ROLE and inside
-- one transaction that always ROLLBACKs.
BEGIN;

DO $contract$
DECLARE v_fn text:=pg_get_functiondef(
  'public.save_and_submit_report(uuid,text,uuid,uuid,text,text,jsonb,jsonb)'::regprocedure);
BEGIN
  IF has_function_privilege('anon',
      'public.save_and_submit_report(uuid,text,uuid,uuid,text,text,jsonb,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated',
      'public.save_and_submit_report(uuid,text,uuid,uuid,text,text,jsonb,jsonb)','EXECUTE') THEN
     RAISE EXCEPTION 'Evidence tenant gate: caller grants changed';
  END IF;
  IF v_fn NOT ILIKE '%w.org_id=r.org_id%'
    OR v_fn NOT ILIKE '%s.org_id=r.org_id%'
    OR v_fn NOT ILIKE '%ws.org_id=r.org_id%'
    OR v_fn NOT ILIKE '%um.org_id=r.org_id%'
    OR v_fn NOT ILIKE '%rp.org_id is distinct from r.org_id%'
    OR v_fn NOT ILIKE '%r.org_id is distinct from public.app_org_id()%' THEN
    RAISE EXCEPTION 'Evidence tenant gate: mandatory organisation predicate absent';
  END IF;
END
$contract$;

INSERT INTO public.organisations(id,name,short_code)
VALUES('10000000-0000-4000-8000-000000000096','Isolated evidence foreign tenant','EVIDX');
INSERT INTO public.report_periods(id,org_id,kind,label,starts_on,ends_on,status)
VALUES
 ('23000000-0000-4000-8000-000000000096',
  '10000000-0000-4000-8000-000000000010',
  'week','Evidence gate positive',date '2026-10-05',date '2026-10-11','open'),
 ('23000000-0000-4000-8000-000000000097',
  '10000000-0000-4000-8000-000000000010',
  -- A distinct identity still contains every 6 October adversarial reference.
  -- The live uniqueness contract must not be bypassed to set up this test.
  'week','Evidence gate denial',date '2026-10-06',date '2026-10-12','open');

-- Existing keys and FKs validate a work item's unit_id by UUID but do not
-- guarantee it belongs to the work item's org. The definer must not rely on
-- data simply looking unit-scoped.
INSERT INTO public.work_items(id,org_id,ref,unit_id,kind,title,visibility)
VALUES('26000000-0000-4000-8000-000000000096',
       '10000000-0000-4000-8000-000000000096','EVID-FOREIGN-129',
       '20000000-0000-4000-8000-000000000011','task',
       'Synthetic foreign-org unit-linked item','unit');

-- Foreign submission points to a real same-unit fixture work item but is
-- itself owned by a different organisation.
INSERT INTO public.submissions(id,org_id,work_item_id,profile_id,submitted_at)
VALUES('27000000-0000-4000-8000-000000000096',
       '10000000-0000-4000-8000-000000000096',
       '26000000-0000-4000-8000-000000000011',
       '31000000-0000-4000-8000-000000000001',
       '2026-10-06 12:00:00+00'::timestamptz);

-- A foreign-org work session belongs to a fixture employee who is member of
-- the real report unit; membership UUID alone cannot authenticate the session.
INSERT INTO public.work_sessions(id,org_id,profile_id,place,started_at)
VALUES('28000000-0000-4000-8000-000000000096',
       '10000000-0000-4000-8000-000000000096',
       '31000000-0000-4000-8000-000000000001',
       'elsewhere','2026-10-06 14:00:00+00'::timestamptz);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
 true);

DO $adversarial$
DECLARE v_good uuid;
BEGIN
  -- Positive control must actually preserve normal in-tenant submission.
  v_good:=public.save_and_submit_report(
   '23000000-0000-4000-8000-000000000096',
   'unit','20000000-0000-4000-8000-000000000011',
   NULL,'Legitimate report evidence',NULL,
   '{"counts":{"evidence":1}}'::jsonb,
   jsonb_build_array(jsonb_build_object(
    'object_type','work_item','object_id',
    '26000000-0000-4000-8000-000000000011',
    'section','evidence')));
  IF v_good IS NULL THEN
    RAISE EXCEPTION 'Evidence tenant gate: legitimate evidence submission failed';
  END IF;

  -- Work item has the requested unit UUID but belongs to foreign org.
  BEGIN
    PERFORM public.save_and_submit_report(
      '23000000-0000-4000-8000-000000000097',
      'unit','20000000-0000-4000-8000-000000000011',
      NULL,'Foreign work item reject',NULL,
      '{"counts":{"evidence":1}}'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'object_type','work_item',
        'object_id','26000000-0000-4000-8000-000000000096',
        'section','evidence')));
    RAISE EXCEPTION 'Evidence tenant gate: foreign work item accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'A report work reference is outside this report scope.' THEN
      RAISE;
    END IF;
  END;

  -- Submission itself is cross-org even though related work item is in-org.
  BEGIN
    PERFORM public.save_and_submit_report(
      '23000000-0000-4000-8000-000000000097',
      'unit','20000000-0000-4000-8000-000000000011',
      NULL,'Foreign submission reject',NULL,
      '{"counts":{"evidence":1}}'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'object_type','submission',
        'object_id','27000000-0000-4000-8000-000000000096',
        'section','evidence')));
    RAISE EXCEPTION 'Evidence tenant gate: foreign submission accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'A report submission reference is outside this report scope or period.' THEN
      RAISE;
    END IF;
  END;

  -- Session belongs to foreign org; existing unit membership is insufficient.
  BEGIN
    PERFORM public.save_and_submit_report(
      '23000000-0000-4000-8000-000000000097',
      'unit','20000000-0000-4000-8000-000000000011',
      NULL,'Foreign session reject',NULL,
      '{"counts":{"evidence":1}}'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'object_type','work_session',
        'object_id','28000000-0000-4000-8000-000000000096',
        'section','evidence')));
    RAISE EXCEPTION 'Evidence tenant gate: foreign work session accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'A report session reference is outside this unit or period.' THEN
      RAISE;
    END IF;
  END;
END
$adversarial$;
RESET ROLE;

DO $validate$
BEGIN
 IF (SELECT count(*) FROM public.reports
     WHERE period_id='23000000-0000-4000-8000-000000000096'
       AND org_id='10000000-0000-4000-8000-000000000010'
       AND status='submitted') <> 1
   OR EXISTS(SELECT 1 FROM public.reports
      WHERE period_id='23000000-0000-4000-8000-000000000097')
   OR EXISTS(SELECT 1 FROM public.report_evidence_refs ref
      JOIN public.reports r ON r.id=ref.report_id
      WHERE r.period_id='23000000-0000-4000-8000-000000000097') THEN
    RAISE EXCEPTION 'Evidence tenant gate: invalid report or evidence persisted';
 END IF;
END
$validate$;
ROLLBACK;
SELECT 'CEAC report evidence same-tenant authority gate passed' AS result;
