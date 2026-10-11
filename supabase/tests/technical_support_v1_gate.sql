-- CEAC Technical Support v1 catalog and authority gate.
-- Run only on a disposable database after all canonical migrations.
\set ON_ERROR_STOP on
BEGIN;
DO $gate$
DECLARE
  v_qual text;
  v_anon integer;
BEGIN
  IF to_regclass('public.support_cases') IS NULL
     OR to_regclass('public.support_case_events') IS NULL
     OR to_regclass('public.support_team_memberships') IS NULL THEN
    RAISE EXCEPTION 'Technical Support schema not installed in fixture database.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
      WHERE c.oid IN ('public.support_cases'::regclass,
                      'public.support_case_events'::regclass,
                      'public.support_team_memberships'::regclass)
        AND NOT c.relrowsecurity
  ) THEN RAISE EXCEPTION 'Technical Support RLS is required on all tables.'; END IF;

  IF has_table_privilege('anon','public.support_cases','SELECT')
     OR has_table_privilege('anon','public.support_cases','INSERT')
     OR has_table_privilege('anon','public.support_team_memberships','SELECT')
     OR has_table_privilege('anon','public.support_case_events','SELECT') THEN
    RAISE EXCEPTION 'Anonymous role has Technical Support table access.';
  END IF;

  IF has_table_privilege('authenticated','public.support_team_memberships','INSERT')
     OR has_table_privilege('authenticated','public.support_team_memberships','UPDATE')
     OR has_table_privilege('authenticated','public.support_team_memberships','DELETE')
     OR has_table_privilege('authenticated','public.support_case_events','INSERT')
     OR has_table_privilege('authenticated','public.support_case_events','UPDATE')
     OR has_table_privilege('authenticated','public.support_case_events','DELETE')
     OR has_table_privilege('authenticated','public.support_cases','DELETE') THEN
    RAISE EXCEPTION 'Direct browser writes to membership/history or case deletion are forbidden.';
  END IF;

  SELECT coalesce(string_agg(qual,' '),'') INTO v_qual FROM pg_policies
    WHERE schemaname='public' AND tablename='support_cases' AND cmd IN ('SELECT','UPDATE');
  IF position('support.case.manage' IN v_qual)=0
     OR position('support_team_memberships' IN v_qual)=0
     OR position('reported_by' IN v_qual)=0 THEN
    RAISE EXCEPTION 'Case visibility/management membership-capability gate is missing.';
  END IF;

  -- Audit-event note content is restricted to the support team, even when
  -- the reporting person is authorised to see the case's own state.
  SELECT coalesce(string_agg(qual,' '),'') INTO v_qual
  FROM pg_policies
  WHERE schemaname='public' AND tablename='support_case_events' AND cmd='SELECT';
  IF position('support.case.manage' IN v_qual)=0
     OR position('support_team_memberships' IN v_qual)=0
     OR position('app_org_id' IN v_qual)=0 THEN
    RAISE EXCEPTION 'Internal support-case audit events are not support-only.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.capability_definitions WHERE capability='support.case.manage'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.capability_definitions WHERE capability='support.access.apply_approved'
  ) THEN RAISE EXCEPTION 'Support-only capability catalogue is incomplete.'; END IF;

  IF has_function_privilege('authenticated','public.support_case_audit_guard()','EXECUTE')
     OR has_function_privilege('anon','public.support_case_audit_guard()','EXECUTE')
     OR has_function_privilege('authenticated','public.support_case_insert_guard()','EXECUTE')
     OR has_function_privilege('anon','public.support_case_insert_guard()','EXECUTE')
     OR has_function_privilege('authenticated','public.support_membership_scope_guard()','EXECUTE')
     OR has_function_privilege('anon','public.support_membership_scope_guard()','EXECUTE') THEN
    RAISE EXCEPTION 'Internal support guard functions are directly callable.';
  END IF;

  -- An append-only audit trail must reject even privileged UPDATE/DELETE
  -- attempts; checking browser GRANTs alone is insufficient.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.support_case_events'::regclass
      AND t.tgname='support_case_events_immutable'
      AND NOT t.tgisinternal
      -- pg_trigger.tgtype bits: 2=BEFORE, 4=INSERT, 8=DELETE, 16=UPDATE.
      -- The immutable audit guard must intercept BOTH UPDATE and DELETE.
      AND (t.tgtype & 2)<>0
      AND (t.tgtype & 8)<>0
      AND (t.tgtype & 16)<>0
  ) THEN RAISE EXCEPTION 'Support audit event immutability trigger missing.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.support_cases'::regclass
      AND t.tgname='support_case_audit_insert'
      AND NOT t.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.support_cases'::regclass
      AND t.tgname='support_case_audit_update'
      AND NOT t.tgisinternal
  ) THEN RAISE EXCEPTION 'Case history recording triggers are missing.'; END IF;

  SELECT count(*) INTO v_anon
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef AND
    has_function_privilege('anon',p.oid,'EXECUTE');
  IF v_anon<>0 THEN RAISE EXCEPTION 'Anon-executable SECURITY DEFINER surface exceeds zero.'; END IF;
END;
$gate$;

-- Behavioral adversarial gate. The transaction leaves no fixture state while
-- queries use the authenticated role and JWT helpers used by the application.
INSERT INTO public.organisations(id,name,short_code)
VALUES('10000000-0000-4000-8000-000000000020','CEAC Support Tenant B','CEACSB');

ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
('31000000-0000-4000-8000-000000000011','tenant-b@ceac.local.test',now(),'{}');
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

INSERT INTO public.profiles(id,org_id,full_name,email,is_admin,is_exec,active) VALUES
('31000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000020','Tenant B Reporter','tenant-b@ceac.local.test',false,false,true);

INSERT INTO public.capability_grants(
  org_id,profile_id,capability,scope_unit_id,granted_by,grant_reason
) VALUES
('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000003','support.case.manage',null,'31000000-0000-4000-8000-000000000003','Technical Support gate lead authority.'),
('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000002','support.case.manage',null,'31000000-0000-4000-8000-000000000003','Technical Support gate member authority.');

INSERT INTO public.support_team_memberships(
  org_id,profile_id,role,added_by,reason,associated_unit_id
) VALUES
('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000003','lead','31000000-0000-4000-8000-000000000003','Gate Support Lead membership','20000000-0000-4000-8000-000000000011'),
('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000002','member','31000000-0000-4000-8000-000000000003','Gate Support Member membership','20000000-0000-4000-8000-000000000011'),
('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000006','member','31000000-0000-4000-8000-000000000003','Gate membership without capability','20000000-0000-4000-8000-000000000011');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
INSERT INTO public.support_cases(
  id,org_id,reported_by,affected_profile_id,category,summary,description
) VALUES(
  '61000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010',
  '31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',
  'something_not_working','Acceptance case cannot load','A support acceptance fixture failed to load.'
),(
  '61000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010',
  '31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',
  'access_needed','Acceptance access request','A separately approved access change is requested.'
);

DO $reporter$
BEGIN
  IF (SELECT count(*) FROM public.support_cases)<>2 THEN
    RAISE EXCEPTION 'Reporter cannot read exactly their own cases.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.support_case_events) THEN
    RAISE EXCEPTION 'Reporter gained internal support audit history.';
  END IF;
  UPDATE public.support_cases SET summary='Reporter attempted mutation'
    WHERE id='61000000-0000-4000-8000-000000000001';
  IF FOUND THEN RAISE EXCEPTION 'Reporter directly updated a filed case.'; END IF;
END
$reporter$;

SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}',true);
DO $membership_without_power$
BEGIN
  IF EXISTS(SELECT 1 FROM public.support_cases) THEN
    RAISE EXCEPTION 'Membership without support.case.manage exposed the queue.';
  END IF;
END
$membership_without_power$;

SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
UPDATE public.support_cases SET assigned_to='31000000-0000-4000-8000-000000000002'
WHERE id='61000000-0000-4000-8000-000000000001';
UPDATE public.support_cases SET state='in_progress'
WHERE id='61000000-0000-4000-8000-000000000001';

DO $member_behavior$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.support_cases
    WHERE id='61000000-0000-4000-8000-000000000001'
      AND assigned_to='31000000-0000-4000-8000-000000000002'
      AND state='in_progress'
  ) THEN RAISE EXCEPTION 'Support member could not claim and work an unassigned case.'; END IF;
  BEGIN
    UPDATE public.support_cases SET assigned_to='31000000-0000-4000-8000-000000000003'
      WHERE id='61000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'A member reassigned their held case to another person.';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.support_cases SET assigned_to='31000000-0000-4000-8000-000000000003'
      WHERE id='61000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'A member claimed an unassigned case for another person.';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF (SELECT count(*) FROM public.support_case_events
      WHERE case_id='61000000-0000-4000-8000-000000000001')<>3 THEN
    RAISE EXCEPTION 'Opened, assignment and state-change history was not recorded.';
  END IF;
END
$member_behavior$;

SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
UPDATE public.support_cases SET assigned_to='31000000-0000-4000-8000-000000000003'
WHERE id='61000000-0000-4000-8000-000000000001';
UPDATE public.support_cases SET assigned_to='31000000-0000-4000-8000-000000000003',state='waiting_approval'
WHERE id='61000000-0000-4000-8000-000000000002';

DO $lead_behavior$
BEGIN
  BEGIN
    UPDATE public.support_cases SET state='resolved',resolution_summary='Access was supposedly completed.'
      WHERE id='61000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Access request was resolved without approved execution evidence.';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.support_cases SET description='Rewritten source facts are forbidden.'
      WHERE id='61000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Support changed immutable reporter source facts.';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.support_case_events SET note='Rewritten history'
      WHERE case_id='61000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Support rewrote immutable case history.';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$lead_behavior$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000011","role":"authenticated","aal":"aal1"}',true);
INSERT INTO public.support_cases(
  id,org_id,reported_by,affected_profile_id,category,summary,description
) VALUES(
  '61000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000020',
  '31000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000011',
  'other','Tenant B support request','Tenant B must remain isolated from Tenant A.'
);
DO $cross_tenant$
BEGIN
  IF (SELECT count(*) FROM public.support_cases)<>1
     OR NOT EXISTS(SELECT 1 FROM public.support_cases
       WHERE id='61000000-0000-4000-8000-000000000011') THEN
    RAISE EXCEPTION 'Cross-tenant reporter visibility is not isolated.';
  END IF;
END
$cross_tenant$;

ROLLBACK;
