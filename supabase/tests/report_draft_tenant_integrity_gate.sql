\set ON_ERROR_STOP on
-- Security assurance for the isolated report-draft integrity migration.
-- Run ONLY after 130 historical files + the 127 migration have actually replayed
-- in disposable PostgreSQL with scripts/seed-role-fixtures.mjs data.
-- All synthetic writes are inside a transaction that is always rolled back.
BEGIN;

DO $contract$
DECLARE
  v_definition text := pg_get_functiondef(
    'public.save_report_draft(uuid,text,uuid,uuid,text,text)'::regprocedure);
BEGIN
  IF has_function_privilege('anon',
       'public.save_report_draft(uuid,text,uuid,uuid,text,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated',
       'public.save_report_draft(uuid,text,uuid,uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Report tenant gate: existing authenticated-only execution boundary changed.';
  END IF;
  IF v_definition NOT ILIKE '%u.org_id = v_period.org_id%'
     OR v_definition NOT ILIKE '%p.org_id = v_period.org_id%'
     OR v_definition NOT ILIKE '%r.org_id = v_period.org_id%'
     OR v_definition NOT ILIKE '%org_id = v_period.org_id and period_id = p_period_id%'
     OR v_definition NOT ILIKE '%public.app_managed_units()%'
     OR v_definition NOT ILIKE '%public.app_is_admin()%'
     OR v_definition NOT ILIKE '%SECURITY DEFINER%' THEN
    RAISE EXCEPTION 'Report tenant gate: a reviewed tenant or authority predicate is missing.';
  END IF;
END
$contract$;

-- The runner's seeded organisation and its Admin profile already exist.
-- Build an unrelated tenant only inside this rollback-only acceptance gate.
INSERT INTO public.organisations(id,name,short_code)
VALUES('10000000-0000-4000-8000-000000000099','Isolated Other Tenant','TGTB');
INSERT INTO public.units(id,org_id,name,code)
VALUES('20000000-0000-4000-8000-000000000099',
       '10000000-0000-4000-8000-000000000099','Other-tenant unit','TGTB');
INSERT INTO public.projects(id,org_id,lead_unit_id,name)
VALUES('22000000-0000-4000-8000-000000000099',
       '10000000-0000-4000-8000-000000000099',
       '20000000-0000-4000-8000-000000000099','Other-tenant project');
INSERT INTO public.report_periods(id,org_id,kind,label,starts_on,ends_on,status)
VALUES
 ('23000000-0000-4000-8000-000000000091',
  '10000000-0000-4000-8000-000000000010',
  'week','Tenant gate own period',date '2026-10-05',date '2026-10-11','open'),
 ('23000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000099',
  'week','Tenant gate foreign period',date '2026-10-05',date '2026-10-11','open');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);

DO $adversarial$
DECLARE
  v_id uuid;
BEGIN
  -- Positive control: an authorised in-tenant draft must still work.
  v_id := public.save_report_draft(
    '23000000-0000-4000-8000-000000000091',
    'unit','20000000-0000-4000-8000-000000000011',NULL,
    'Tenant acceptance initial',NULL);
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Report tenant gate: valid in-tenant Admin draft was rejected.';
  END IF;
  IF public.save_report_draft(
    '23000000-0000-4000-8000-000000000091',
    'unit','20000000-0000-4000-8000-000000000011',NULL,
    'Tenant acceptance update',NULL) IS DISTINCT FROM v_id THEN
    RAISE EXCEPTION 'Report tenant gate: existing authorised draft was not updated.';
  END IF;

  -- A manager/Admin of tenant A must not attach tenant B's unit.
  BEGIN
    PERFORM public.save_report_draft(
      '23000000-0000-4000-8000-000000000091',
      'unit','20000000-0000-4000-8000-000000000099',NULL,
      'should not write',NULL);
    RAISE EXCEPTION 'Report tenant gate: cross-tenant unit was accepted.';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;

  -- A foreign project is invalid even when a legitimate tenant A unit is passed.
  BEGIN
    PERFORM public.save_report_draft(
      '23000000-0000-4000-8000-000000000091',
      'project','20000000-0000-4000-8000-000000000011',
      '22000000-0000-4000-8000-000000000099',
      'should not write',NULL);
    RAISE EXCEPTION 'Report tenant gate: cross-tenant project was accepted.';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;

  -- Non-project scope must not quietly accept an extra foreign project link.
  BEGIN
    PERFORM public.save_report_draft(
      '23000000-0000-4000-8000-000000000091',
      'unit','20000000-0000-4000-8000-000000000011',
      '22000000-0000-4000-8000-000000000099',
      'should not write',NULL);
    RAISE EXCEPTION 'Report tenant gate: foreign optional project was accepted.';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;

  -- A report period from tenant B is not writable by Admin A.
  BEGIN
    PERFORM public.save_report_draft(
      '23000000-0000-4000-8000-000000000099',
      'unit','20000000-0000-4000-8000-000000000011',NULL,
      'should not write',NULL);
    RAISE EXCEPTION 'Report tenant gate: foreign report period was accepted.';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END
$adversarial$;
RESET ROLE;

DO $verify$
BEGIN
  IF (SELECT count(*) FROM public.reports
      WHERE period_id='23000000-0000-4000-8000-000000000091') <> 1
     OR NOT EXISTS(
       SELECT 1 FROM public.reports
       WHERE period_id='23000000-0000-4000-8000-000000000091'
         AND org_id='10000000-0000-4000-8000-000000000010'
         AND narrative='Tenant acceptance update')
     OR EXISTS(
       SELECT 1 FROM public.reports
       WHERE period_id='23000000-0000-4000-8000-000000000099'
          OR org_id='10000000-0000-4000-8000-000000000099') THEN
    RAISE EXCEPTION 'Report tenant gate: cross-tenant data was created or valid update failed.';
  END IF;
END
$verify$;

ROLLBACK;
SELECT 'Isolated CEAC report-draft tenant-authority gate passed' AS result;
