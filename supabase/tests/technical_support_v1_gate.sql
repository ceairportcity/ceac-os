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
     OR to_regclass('public.support_team_memberships') IS NULL
     OR to_regclass('public.support_membership_events') IS NULL
     OR to_regclass('public.support_case_safe_status') IS NULL THEN
    RAISE EXCEPTION 'Technical Support schema not installed in fixture database.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
      WHERE c.oid IN ('public.support_cases'::regclass,
                      'public.support_case_events'::regclass,
                      'public.support_team_memberships'::regclass,
                      'public.support_membership_events'::regclass)
        AND NOT c.relrowsecurity
  ) THEN RAISE EXCEPTION 'Technical Support RLS is required on all tables.'; END IF;

  IF has_table_privilege('anon','public.support_cases','SELECT')
     OR has_table_privilege('anon','public.support_cases','INSERT')
     OR has_table_privilege('anon','public.support_team_memberships','SELECT')
     OR has_table_privilege('anon','public.support_case_events','SELECT') THEN
    RAISE EXCEPTION 'Anonymous role has Technical Support table access.';
  END IF;

  IF NOT has_table_privilege('authenticated','public.support_team_memberships','INSERT')
     OR NOT has_table_privilege('authenticated','public.support_team_memberships','UPDATE')
     OR has_table_privilege('authenticated','public.support_team_memberships','DELETE')
     OR has_table_privilege('authenticated','public.support_case_events','INSERT')
     OR has_table_privilege('authenticated','public.support_case_events','UPDATE')
     OR has_table_privilege('authenticated','public.support_case_events','DELETE')
     OR has_table_privilege('authenticated','public.support_cases','DELETE') THEN
    RAISE EXCEPTION 'People membership lifecycle or immutable history/delete privileges are incorrect.';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='support_team_memberships'
      AND policyname='support_team_people_read' AND cmd='SELECT'
      AND qual LIKE '%people.manage%') THEN
    RAISE EXCEPTION 'People Administration cannot safely inspect membership lifecycle records.';
  END IF;

  IF (SELECT array_agg(policyname ORDER BY policyname) FROM pg_policies
      WHERE schemaname='public' AND tablename='support_cases' AND cmd='SELECT')
     IS DISTINCT FROM ARRAY['support_cases_support_read']::name[] THEN
    RAISE EXCEPTION 'Unexpected or missing support-case SELECT policy.';
  END IF;
  SELECT qual INTO v_qual FROM pg_policies
    WHERE schemaname='public' AND tablename='support_cases'
      AND cmd='SELECT' AND policyname='support_cases_support_read';
  IF position('support.case.manage' IN coalesce(v_qual,''))=0
     OR position('support_team_memberships' IN coalesce(v_qual,''))=0
     OR position('reported_by' IN coalesce(v_qual,''))<>0 THEN
    RAISE EXCEPTION 'Case visibility/management membership-capability gate is missing.';
  END IF;

  IF EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='support_case_safe_status'
      AND column_name IN ('assigned_to','affected_profile_id','affected_unit_id','org_id','reported_by','impact','updated_at'))
     OR NOT has_table_privilege('authenticated','public.support_case_safe_status','SELECT')
     OR has_table_privilege('anon','public.support_case_safe_status','SELECT') THEN
    RAISE EXCEPTION 'Reporter safe projection exposes internal fields or has incorrect grants.';
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
     OR has_function_privilege('anon','public.support_membership_scope_guard()','EXECUTE')
     OR has_function_privilege('authenticated','public.support_membership_history_guard()','EXECUTE')
     OR has_function_privilege('anon','public.support_membership_history_guard()','EXECUTE')
     OR has_function_privilege('authenticated','public.support_capability_grant_guard()','EXECUTE')
     OR has_function_privilege('anon','public.support_capability_grant_guard()','EXECUTE') THEN
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
    WHERE t.tgrelid='public.support_team_memberships'::regclass
      AND t.tgname='support_membership_scope_guard' AND NOT t.tgisinternal
      AND (t.tgtype & 2)<>0 AND (t.tgtype & 4)<>0
      AND (t.tgtype & 8)<>0 AND (t.tgtype & 16)<>0
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.support_membership_events'::regclass
      AND t.tgname='support_membership_events_immutable' AND NOT t.tgisinternal
      AND (t.tgtype & 8)<>0 AND (t.tgtype & 16)<>0
  ) THEN RAISE EXCEPTION 'Membership lifecycle/history immutability triggers are incomplete.'; END IF;

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

-- auth.users is owned by Supabase Auth, not the local Postgres test client.
-- Never disable auth triggers or bypass the real invitation/activation
-- boundary to create a cross-organisation test identity.
INSERT INTO public.units(id,org_id,name,code) VALUES (
  '20000000-0000-4000-8000-000000000020',
  '10000000-0000-4000-8000-000000000020',
  'Tenant B Unit','CEACSB'
);
INSERT INTO public.pending_invitations(
  id,org_id,email,full_name,unit_id,role,invited_by,expires_at
) VALUES (
  '40000000-0000-4000-8000-000000000020',
  '10000000-0000-4000-8000-000000000020',
  'tenant-b@ceac.local.test',
  'Tenant B Reporter',
  '20000000-0000-4000-8000-000000000020',
  'staff',
  '31000000-0000-4000-8000-000000000003',
  now()+interval '1 day'
);
-- The normal handle_new_user() trigger creates the Tenant B profile and
-- membership in the disposable transaction using the authorised invitation.
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
('31000000-0000-4000-8000-000000000011','tenant-b@ceac.local.test',now(),'{}');
DO $tenant_b_invitation_integrity$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.profiles p JOIN public.unit_memberships m
      ON m.profile_id=p.id AND m.org_id=p.org_id
    WHERE p.id='31000000-0000-4000-8000-000000000011'
      AND p.org_id='10000000-0000-4000-8000-000000000020'
      AND m.unit_id='20000000-0000-4000-8000-000000000020'
  ) THEN
    RAISE EXCEPTION 'Technical Support gate: Tenant B invitation did not establish a correctly scoped account.';
  END IF;
END
$tenant_b_invitation_integrity$;

INSERT INTO public.support_team_memberships(
  org_id,profile_id,role,added_by,reason,associated_unit_id
) VALUES
('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000003','lead','31000000-0000-4000-8000-000000000003','Gate Support Lead membership','20000000-0000-4000-8000-000000000011'),
('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000002','member','31000000-0000-4000-8000-000000000003','Gate Support Member membership','20000000-0000-4000-8000-000000000011'),
('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000006','member','31000000-0000-4000-8000-000000000003','Gate membership without capability','20000000-0000-4000-8000-000000000011');

INSERT INTO public.capability_grants(
  org_id,profile_id,capability,scope_unit_id,granted_by,grant_reason
) VALUES
('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000003','support.case.manage',null,'31000000-0000-4000-8000-000000000004','Technical Support gate lead authority.'),
('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000002','support.case.manage',null,'31000000-0000-4000-8000-000000000003','Technical Support gate member authority.');

DO $grant_guard$
BEGIN
  BEGIN
    INSERT INTO public.capability_grants(org_id,profile_id,capability,granted_by,grant_reason)
    VALUES('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000003',
      'support.system.inspect','31000000-0000-4000-8000-000000000003','Forbidden lead self grant.');
    RAISE EXCEPTION 'Support Lead self-granted support capability.';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$grant_guard$;

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
  IF EXISTS(SELECT 1 FROM public.support_cases) THEN
    RAISE EXCEPTION 'Reporter bypassed the safe projection through the base relation.';
  END IF;
  IF (SELECT count(*) FROM public.support_case_safe_status)<>2 THEN
    RAISE EXCEPTION 'Reporter cannot read exactly their own safe case projection.';
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
    UPDATE public.support_cases SET assigned_to='31000000-0000-4000-8000-000000000006'
      WHERE id='61000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Lead assigned a case to a member without support.case.manage.';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
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
  IF EXISTS(SELECT 1 FROM public.support_cases)
     OR (SELECT count(*) FROM public.support_case_safe_status)<>1
     OR NOT EXISTS(SELECT 1 FROM public.support_case_safe_status
       WHERE id='61000000-0000-4000-8000-000000000011') THEN
    RAISE EXCEPTION 'Cross-tenant reporter visibility is not isolated.';
  END IF;
END
$cross_tenant$;

-- Tenant-A Support authority must not expose Tenant-B queue rows.
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
DO $cross_tenant_support$
BEGIN
  IF EXISTS(SELECT 1 FROM public.support_cases
      WHERE id='61000000-0000-4000-8000-000000000011') THEN
    RAISE EXCEPTION 'Tenant-A Technical Support read Tenant-B queue data.';
  END IF;
END
$cross_tenant_support$;

-- People Administration lifecycle is attributable, append-only and does not
-- mutate the profile, employment or ordinary unit history.
INSERT INTO public.support_team_memberships(id,org_id,profile_id,role,added_by,reason,associated_unit_id)
VALUES('61000000-0000-4000-8000-000000000165','10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000007','member',
  '31000000-0000-4000-8000-000000000001','Approved temporary support membership','20000000-0000-4000-8000-000000000011');
SELECT public.grant_capability(
  '31000000-0000-4000-8000-000000000007','support.guides.manage',NULL,
  'Approved temporary support guide authority.',NULL
);
UPDATE public.support_team_memberships SET active=false,ended_at=now(),ended_by=auth.uid(),
  end_reason='Temporary support assignment completed'
WHERE id='61000000-0000-4000-8000-000000000165' AND active;
DO $membership_history$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles
      WHERE id='31000000-0000-4000-8000-000000000007' AND active)
     OR NOT EXISTS(SELECT 1 FROM public.unit_memberships
      WHERE profile_id='31000000-0000-4000-8000-000000000007' AND role='manager')
     OR NOT EXISTS(SELECT 1 FROM public.support_team_memberships
      WHERE id='61000000-0000-4000-8000-000000000165'
        AND NOT active AND added_by='31000000-0000-4000-8000-000000000003'
        AND ended_by='31000000-0000-4000-8000-000000000003')
     OR (SELECT count(*) FROM public.support_membership_events
      WHERE membership_id='61000000-0000-4000-8000-000000000165')<>2 THEN
    RAISE EXCEPTION 'Membership lifecycle changed identity/business history or lost attribution.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.capability_grants
      WHERE profile_id='31000000-0000-4000-8000-000000000007'
        AND capability LIKE 'support.%' AND revoked_at IS NULL)
     OR NOT EXISTS(SELECT 1 FROM public.capability_grants
      WHERE profile_id='31000000-0000-4000-8000-000000000007'
        AND capability='support.guides.manage'
        AND revoked_by='31000000-0000-4000-8000-000000000003'
        AND revoked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Ending membership did not close support authority with attribution.';
  END IF;
  BEGIN
    DELETE FROM public.support_team_memberships
    WHERE profile_id='31000000-0000-4000-8000-000000000007';
    RAISE EXCEPTION 'Historical membership was deleted.';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.support_team_memberships SET role='lead'
    WHERE profile_id='31000000-0000-4000-8000-000000000007';
    IF FOUND THEN RAISE EXCEPTION 'Historical membership role was rewritten.'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$membership_history$;

ROLLBACK;
