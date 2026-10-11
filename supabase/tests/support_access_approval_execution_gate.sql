\set ON_ERROR_STOP on
-- Only on a freshly seeded disposable 139-migration PostgreSQL replay.
-- All synthetic fixture writes are inside the transaction and rolled back.
BEGIN;

DO $contract$
DECLARE fn text := pg_get_functiondef('public.support_access_request_guard()'::regprocedure);
BEGIN
 IF to_regclass('public.support_access_requests') IS NULL
    OR to_regclass('public.support_access_events') IS NULL
    OR has_table_privilege('anon','public.support_access_requests','SELECT')
    OR has_table_privilege('authenticated','public.support_access_events','INSERT')
    OR has_function_privilege('authenticated','public.support_access_request_guard()','EXECUTE')
    OR has_function_privilege('anon','public.support_access_history_guard()','EXECUTE')
 THEN RAISE EXCEPTION 'Access-ledger RLS/trigger authority not installed correctly.'; END IF;
 IF fn NOT ILIKE '%app_has_capability(''support.access.apply_approved'',NULL)%'
   OR fn NOT ILIKE '%app_has_capability(''people.manage'',NULL)%'
   OR fn NOT ILIKE '%app_managed_units()%'
   OR fn NOT ILIKE '%OLD.version+1%'
   OR fn NOT ILIKE '%Support cannot business-approve its own access request%'
 THEN RAISE EXCEPTION 'Access-ledger separation/replay defences missing.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger
   WHERE tgrelid='public.support_access_requests'::regclass
     AND tgname='support_access_request_guard' AND tgenabled IN ('O','A'))
 THEN RAISE EXCEPTION 'Access-ledger state-machine trigger missing.'; END IF;
END
$contract$;

-- Fixture org, profiles and ordinary manager unit memberships originate from
-- scripts/seed-role-fixtures.mjs. No user, password or real production data.
INSERT INTO public.support_team_memberships(
 org_id,profile_id,role,added_by,reason,associated_unit_id)
VALUES('10000000-0000-4000-8000-000000000010',
 '31000000-0000-4000-8000-000000000003','lead',
 '31000000-0000-4000-8000-000000000003',
 'Isolated ledger fixture support membership','20000000-0000-4000-8000-000000000011');
INSERT INTO public.capability_grants(
 org_id,profile_id,capability,granted_by,grant_reason)
VALUES
 ('10000000-0000-4000-8000-000000000010',
  '31000000-0000-4000-8000-000000000003',
  'support.case.manage','31000000-0000-4000-8000-000000000004',
  'Isolated fixture support queue authority.'),
 ('10000000-0000-4000-8000-000000000010',
  '31000000-0000-4000-8000-000000000003',
  'support.access.apply_approved','31000000-0000-4000-8000-000000000004',
  'Isolated fixture technical execution authority.');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
INSERT INTO public.support_cases(
 id,org_id,reported_by,affected_profile_id,category,summary,description)
VALUES
 ('61000000-0000-4000-8000-000000000091',
  '10000000-0000-4000-8000-000000000010',
  '31000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  'access_needed','Ledger acceptance access case',
  'Authorised business decision and technical execution required.'),
 ('61000000-0000-4000-8000-000000000092',
  '10000000-0000-4000-8000-000000000010',
  '31000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  'something_not_working','Normal incident fixture',
  'Incident resolution must not depend on access approval ledger.');

-- Support Lead is both current owner and separate support-capability holder.
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
UPDATE public.support_cases
 SET assigned_to='31000000-0000-4000-8000-000000000003',state='waiting_approval'
 WHERE id='61000000-0000-4000-8000-000000000091';
UPDATE public.support_cases
 SET assigned_to='31000000-0000-4000-8000-000000000003',state='in_progress'
 WHERE id='61000000-0000-4000-8000-000000000092';
INSERT INTO public.support_access_requests(
 id,org_id,case_id,requested_action,target_profile_id,target_unit_id,
 access_object,requested_by,required_approver)
VALUES('62000000-0000-4000-8000-000000000091',
 '10000000-0000-4000-8000-000000000010',
 '61000000-0000-4000-8000-000000000091',
 'unit_access_assistance',
 '31000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-000000000011',
 'Review approved unit workspace assistance',
 '31000000-0000-4000-8000-000000000003','unit_manager');

DO $unapproved$
BEGIN
 IF (SELECT state FROM public.support_access_requests
   WHERE id='62000000-0000-4000-8000-000000000091')<>'pending'
 THEN RAISE EXCEPTION 'Support request was not created pending approval.'; END IF;
 BEGIN
   UPDATE public.support_cases
     SET state='resolved',resolution_summary='Should be blocked without business approval.'
   WHERE id='61000000-0000-4000-8000-000000000091';
   RAISE EXCEPTION 'Access case closed without approval/execution.';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   UPDATE public.support_access_requests
     SET state='approved',decision_reason='Support must not approve its own request.'
   WHERE id='62000000-0000-4000-8000-000000000091';
   RAISE EXCEPTION 'Support operator business-approved its own request.';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   UPDATE public.support_access_requests
     SET state='executed',execution_result='Falsely executed before approval.',
       execution_reference='TICKET-ILLEGAL'
   WHERE id='62000000-0000-4000-8000-000000000091';
   RAISE EXCEPTION 'Support operator executed an unapproved request.';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- Normal incidents are separate and must remain resolvable.
 UPDATE public.support_cases
 SET state='resolved',resolution_summary='Normal incident resolved after investigation.'
 WHERE id='61000000-0000-4000-8000-000000000092';
 IF NOT EXISTS(SELECT 1 FROM public.support_cases
  WHERE id='61000000-0000-4000-8000-000000000092' AND state='resolved')
 THEN RAISE EXCEPTION 'Normal incident was blocked by access ledger.'; END IF;
END
$unapproved$;

-- Wrong-unit business manager cannot decide this Unit A request.
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}',true);
DO $other_manager$
BEGIN
 UPDATE public.support_access_requests
   SET state='approved',decision_reason='Attempt from an unrelated unit manager.'
 WHERE id='62000000-0000-4000-8000-000000000091';
 IF FOUND THEN RAISE EXCEPTION 'Unrelated Unit B manager approved Unit A request.'; END IF;
END
$other_manager$;

-- The actual Unit A Manager has the business decision, not Technical Support.
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
UPDATE public.support_access_requests
 SET state='approved',decision_reason='Unit A access assistance approved by manager.'
 WHERE id='62000000-0000-4000-8000-000000000091' AND version=1 AND state='pending';
DO $approved$
BEGIN
 IF NOT EXISTS(
   SELECT 1 FROM public.support_access_requests
   WHERE id='62000000-0000-4000-8000-000000000091' AND state='approved'
     AND version=2
     AND approved_by='31000000-0000-4000-8000-000000000002'
     AND decided_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'Actual Unit Manager approval was not recorded.'; END IF;
 UPDATE public.support_access_requests
   SET state='declined',decision_reason='Duplicate decision after approval is invalid.'
 WHERE id='62000000-0000-4000-8000-000000000091' AND version=2;
 IF FOUND THEN RAISE EXCEPTION 'Second conflicting business decision succeeded.'; END IF;
END
$approved$;

-- Actor-only execution cannot manufacture a business approval. Must preserve
-- the approved decision actor/timestamp and add execution proof separately.
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
DO $stale$
BEGIN
 UPDATE public.support_access_requests SET state='executed',
   execution_result='Should be stale and never recorded.',
   execution_reference='TEST-STALE-99'
 WHERE id='62000000-0000-4000-8000-000000000091' AND version=1;
 IF FOUND THEN RAISE EXCEPTION 'Stale version wrote access execution.'; END IF;
END
$stale$;
UPDATE public.support_access_requests
 SET state='executed',
     execution_result='Verified approved unit assistance; no business permission changed.',
     execution_reference='LOCAL-GATE-EVIDENCE-91'
 WHERE id='62000000-0000-4000-8000-000000000091' AND version=2 AND state='approved';
UPDATE public.support_cases
 SET state='resolved',resolution_summary='Business approval recorded and assistance executed.'
 WHERE id='61000000-0000-4000-8000-000000000091';

DO $complete$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.support_access_requests
   WHERE id='62000000-0000-4000-8000-000000000091'
    AND state='executed' AND version=3
    AND approved_by='31000000-0000-4000-8000-000000000002'
    AND executed_by='31000000-0000-4000-8000-000000000003'
    AND execution_reference='LOCAL-GATE-EVIDENCE-91')
 THEN RAISE EXCEPTION 'Approved technical execution was not recorded with split actors.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.support_cases
   WHERE id='61000000-0000-4000-8000-000000000091' AND state='resolved')
 THEN RAISE EXCEPTION 'Executed access case cannot close through case guard.'; END IF;
 IF (SELECT count(*) FROM public.support_access_events
      WHERE request_id='62000000-0000-4000-8000-000000000091')<>3
 THEN RAISE EXCEPTION 'Immutable request/approval/execution history is incomplete.'; END IF;
 BEGIN
   UPDATE public.support_access_events SET note='tampered'
   WHERE request_id='62000000-0000-4000-8000-000000000091';
   RAISE EXCEPTION 'Immutable access history was rewritten.';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$complete$;

RESET ROLE;
ROLLBACK;
SELECT 'CEAC support access approval/execution gate PASSED' AS result;
