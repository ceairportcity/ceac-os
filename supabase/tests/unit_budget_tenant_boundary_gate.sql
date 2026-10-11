\set ON_ERROR_STOP on
-- Disposable-only SQL authority gate for SECURITY DEFINER unit budget reads.
-- Requires the existing seed-role-fixtures.mjs identities and the forward 128 migration.
-- No persisted data changes: every synthetic row is rolled back.
BEGIN;

DO $contract$
DECLARE v_def text := pg_get_functiondef('public.unit_budget_position(uuid,integer)'::regprocedure);
BEGIN
 IF NOT has_function_privilege('authenticated','public.unit_budget_position(uuid,integer)','EXECUTE')
    OR has_function_privilege('anon','public.unit_budget_position(uuid,integer)','EXECUTE') THEN
   RAISE EXCEPTION 'Budget scope gate: authenticated/anonymous boundary incorrect';
 END IF;
 IF v_def NOT ILIKE '%requested.org_id=public.app_org_id()%'
    OR v_def NOT ILIKE '%m.org_id=public.app_org_id()%'
    OR v_def NOT ILIKE '%finance_unit.org_id=m.org_id%'
    OR v_def NOT ILIKE '%public.app_managed_units()%'
    OR v_def NOT ILIKE '%public.app_is_admin()%'
    OR v_def NOT ILIKE '%public.app_is_exec()%' THEN
    RAISE EXCEPTION 'Budget scope gate: caller or same-organisation policy is missing';
 END IF;
END
$contract$;

INSERT INTO public.organisations(id,name,short_code)
VALUES('10000000-0000-4000-8000-000000000098','Isolated budget tenant','BUDT');
INSERT INTO public.units(id,org_id,name,code)
VALUES('20000000-0000-4000-8000-000000000098',
       '10000000-0000-4000-8000-000000000098','Foreign finance unit','FBU');
INSERT INTO public.budgets(org_id,unit_id,year,amount_minor,currency)
VALUES
 ('10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011',2099,1234,'GHS'),
 ('10000000-0000-4000-8000-000000000098','20000000-0000-4000-8000-000000000098',2099,998877,'GHS');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
 true);

DO $admin$
DECLARE v bigint;
BEGIN
 SELECT budget_minor INTO v
 FROM public.unit_budget_position('20000000-0000-4000-8000-000000000011',2099);
 IF v IS DISTINCT FROM 1234 THEN
   RAISE EXCEPTION 'Budget scope gate: authorised same-org admin budget failed, found %',v;
 END IF;
 IF EXISTS (SELECT 1 FROM public.unit_budget_position(
       '20000000-0000-4000-8000-000000000098',2099)) THEN
   RAISE EXCEPTION 'Budget scope gate: admin disclosed another tenant budget';
 END IF;
END
$admin$;

-- A Finance-unit member retains the approved whole-organisation finance view,
-- but their finance membership must never authorise reading another tenant.
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',
 true);
DO $finance$
DECLARE v bigint;
BEGIN
 SELECT budget_minor INTO v
 FROM public.unit_budget_position('20000000-0000-4000-8000-000000000011',2099);
 IF v IS DISTINCT FROM 1234 THEN
   RAISE EXCEPTION 'Budget scope gate: authorised in-org Finance view changed, found %',v;
 END IF;
 IF EXISTS (SELECT 1 FROM public.unit_budget_position(
       '20000000-0000-4000-8000-000000000098',2099)) THEN
   RAISE EXCEPTION 'Budget scope gate: Finance-unit membership exposed a foreign tenant';
 END IF;
END
$finance$;

SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
 true);
DO $staff$
BEGIN
 IF EXISTS(SELECT 1 FROM public.unit_budget_position(
       '20000000-0000-4000-8000-000000000011',2099))
    OR EXISTS(SELECT 1 FROM public.unit_budget_position(
       '20000000-0000-4000-8000-000000000098',2099)) THEN
   RAISE EXCEPTION 'Budget scope gate: ordinary staff unexpectedly read budget';
 END IF;
END
$staff$;

RESET ROLE;
ROLLBACK;
SELECT 'CEAC budget-position same-tenant authority gate passed' AS result;
