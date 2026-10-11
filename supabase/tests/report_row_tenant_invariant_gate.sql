\set ON_ERROR_STOP on
-- All calls on a disposable, seeded PostgreSQL replay; the whole test rolls
-- back. This catches bypasses through authenticated direct reports table DML.
BEGIN;

DO $contract$
DECLARE v_fn text;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.reports'::regclass
      AND t.tgname = 'reports_tenant_reference_integrity'
      AND NOT t.tgisinternal AND t.tgenabled IN ('O','A')
  ) THEN
    RAISE EXCEPTION 'Report-row gate: tenant reference trigger is absent or disabled';
  END IF;
  v_fn := pg_get_functiondef('public.guard_report_tenant_references()'::regprocedure);
  IF v_fn NOT ILIKE '%rp.id = NEW.period_id AND rp.org_id = NEW.org_id%'
    OR v_fn NOT ILIKE '%u.id = NEW.unit_id AND u.org_id = NEW.org_id%'
    OR v_fn NOT ILIKE '%p.id = NEW.project_id AND p.org_id = NEW.org_id%'
    OR v_fn NOT ILIKE '%SECURITY DEFINER%'
    OR v_fn NOT ILIKE '%SET search_path TO %' THEN
    RAISE EXCEPTION 'Report-row gate: expected tenant invariant missing';
  END IF;
  IF has_function_privilege('anon','public.guard_report_tenant_references()','EXECUTE')
    OR has_function_privilege('authenticated','public.guard_report_tenant_references()','EXECUTE') THEN
    RAISE EXCEPTION 'Report-row gate: trigger implementation is browser-executable';
  END IF;
END
$contract$;

-- Malformed referential data cannot be committed even when the caller
-- legitimately controls a draft. FKs reference individual UUIDs only.
INSERT INTO public.organisations(id,name,short_code)
VALUES('10000000-0000-4000-8000-000000000094','Synthetic foreign report tenant','RPTF');
INSERT INTO public.units(id,org_id,name,code)
VALUES('20000000-0000-4000-8000-000000000094',
       '10000000-0000-4000-8000-000000000094','Foreign report unit','RPTF');
INSERT INTO public.projects(id,org_id,lead_unit_id,name)
VALUES('22000000-0000-4000-8000-000000000094',
       '10000000-0000-4000-8000-000000000094',
       '20000000-0000-4000-8000-000000000094','Foreign report project');
INSERT INTO public.report_periods(id,org_id,kind,label,starts_on,ends_on,status)
VALUES
 ('23000000-0000-4000-8000-000000000094',
  '10000000-0000-4000-8000-000000000010','week',
  'Report integrity own',date '2026-10-05',date '2026-10-11','open'),
 ('23000000-0000-4000-8000-000000000095',
  '10000000-0000-4000-8000-000000000094','week',
  'Report integrity foreign',date '2026-10-05',date '2026-10-11','open');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
 true);
DO $attacks$
DECLARE v_good uuid;
BEGIN
  -- Positive control: ordinary in-organisation creation AND direct draft
  -- editing remain supported; the invariant must not break normal work.
  v_good := public.save_report_draft(
    '23000000-0000-4000-8000-000000000094','unit',
    '20000000-0000-4000-8000-000000000011',NULL,
    'Correct report unit',NULL);
  UPDATE public.reports SET narrative='Correct report unit edited'
  WHERE id=v_good;
  IF NOT EXISTS(
    SELECT 1 FROM public.reports
    WHERE id=v_good AND narrative='Correct report unit edited'
  ) THEN RAISE EXCEPTION 'Report-row gate: legitimate draft update failed'; END IF;

  BEGIN
    INSERT INTO public.reports(org_id,period_id,scope,unit_id,status,narrative)
    VALUES('10000000-0000-4000-8000-000000000010',
      '23000000-0000-4000-8000-000000000094','unit',
      '20000000-0000-4000-8000-000000000094','draft','Foreign unit link');
    RAISE EXCEPTION 'Report-row gate: accepted direct cross-org unit INSERT';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
    INSERT INTO public.reports(org_id,period_id,scope,unit_id,project_id,status,narrative)
    VALUES('10000000-0000-4000-8000-000000000010',
      '23000000-0000-4000-8000-000000000094','unit',
      '20000000-0000-4000-8000-000000000011',
      '22000000-0000-4000-8000-000000000094','draft','Foreign project link');
    RAISE EXCEPTION 'Report-row gate: accepted direct cross-org project INSERT';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
    INSERT INTO public.reports(org_id,period_id,scope,unit_id,status,narrative)
    VALUES('10000000-0000-4000-8000-000000000010',
      '23000000-0000-4000-8000-000000000095','unit',
      '20000000-0000-4000-8000-000000000011','draft','Foreign reporting period');
    RAISE EXCEPTION 'Report-row gate: accepted direct cross-org period INSERT';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
    UPDATE public.reports
      SET unit_id='20000000-0000-4000-8000-000000000094'
    WHERE id=v_good;
    RAISE EXCEPTION 'Report-row gate: accepted cross-org draft UPDATE';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$attacks$;
RESET ROLE;

DO $verify$
BEGIN
  IF (SELECT count(*) FROM public.reports
      WHERE period_id IN (
        '23000000-0000-4000-8000-000000000094',
        '23000000-0000-4000-8000-000000000095')) <> 1
     OR EXISTS(
       SELECT 1 FROM public.reports
       WHERE period_id='23000000-0000-4000-8000-000000000094'
         AND unit_id='20000000-0000-4000-8000-000000000094'
     ) THEN RAISE EXCEPTION 'Report-row gate: cross-tenant record persisted'; END IF;
END
$verify$;

ROLLBACK;
SELECT 'CEAC report row tenant invariant gate passed' AS result;
