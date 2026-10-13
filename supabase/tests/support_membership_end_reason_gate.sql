\set ON_ERROR_STOP on
-- 136 end-reason lifecycle test. Requires disposable migrated/seeded DB;
-- all fixture rows and grants are synthetic, and rolled back.
BEGIN;
DO $contract$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='support_team_memberships'
        AND column_name='end_reason')
    OR has_function_privilege('authenticated',
       'public.support_membership_scope_guard()','EXECUTE')
 THEN RAISE EXCEPTION 'End-reason schema/trigger-only authority not installed.'; END IF;
 IF pg_get_functiondef('public.support_membership_history_guard()'::regprocedure)
       NOT ILIKE '%coalesce(NEW.end_reason,NEW.reason)%'
    OR pg_get_functiondef('public.support_membership_history_guard()'::regprocedure)
       NOT ILIKE '%revoke_reason=%NEW.end_reason%'
 THEN RAISE EXCEPTION 'End history still reuses original joining reason.'; END IF;
END
$contract$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
INSERT INTO public.support_team_memberships(
 org_id,profile_id,role,added_by,associated_unit_id,reason)
VALUES('10000000-0000-4000-8000-000000000010',
 '31000000-0000-4000-8000-000000000006','member',
 '31000000-0000-4000-8000-000000000003',
 '20000000-0000-4000-8000-000000000011',
 'Temporary Support assistance was approved.');

SELECT public.grant_capability(
 '31000000-0000-4000-8000-000000000006',
 'support.guides.manage',NULL,'Temporary guide editing was approved.',NULL);

DO $short_reason$
BEGIN
 BEGIN
   UPDATE public.support_team_memberships
   SET active=false,ended_at=now(),ended_by=auth.uid(),end_reason='no'
   WHERE profile_id='31000000-0000-4000-8000-000000000006' AND active;
   RAISE EXCEPTION 'Membership ended without substantive end reason.';
 EXCEPTION WHEN check_violation OR insufficient_privilege THEN NULL;
 END;
END
$short_reason$;

UPDATE public.support_team_memberships
 SET active=false,ended_at=now(),ended_by=auth.uid(),
     end_reason='Temporary assistance concluded and separately reviewed.'
 WHERE profile_id='31000000-0000-4000-8000-000000000006' AND active;

DO $valid_history$
DECLARE v_id uuid;
BEGIN
 SELECT id INTO v_id FROM public.support_team_memberships
  WHERE profile_id='31000000-0000-4000-8000-000000000006' AND NOT active;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Membership did not end.'; END IF;
 IF (SELECT count(*) FROM public.support_membership_events WHERE membership_id=v_id)<>2
   OR NOT EXISTS(SELECT 1 FROM public.support_membership_events
       WHERE membership_id=v_id AND action='added'
         AND reason='Temporary Support assistance was approved.')
   OR NOT EXISTS(SELECT 1 FROM public.support_membership_events
       WHERE membership_id=v_id AND action='ended'
         AND reason='Temporary assistance concluded and separately reviewed.')
   OR NOT EXISTS(SELECT 1 FROM public.support_team_memberships
       WHERE id=v_id AND end_reason='Temporary assistance concluded and separately reviewed.')
 THEN RAISE EXCEPTION 'Joining/end reason distinction or history attribution failed.'; END IF;

 IF NOT EXISTS(SELECT 1 FROM public.profiles
   WHERE id='31000000-0000-4000-8000-000000000006' AND active)
   OR EXISTS(SELECT 1 FROM public.capability_grants
      WHERE profile_id='31000000-0000-4000-8000-000000000006'
       AND capability LIKE 'support.%' AND revoked_at IS NULL)
   OR NOT EXISTS(SELECT 1 FROM public.capability_grants
      WHERE profile_id='31000000-0000-4000-8000-000000000006'
       AND capability='support.guides.manage'
       AND revoke_reason='Technical Support membership ended: Temporary assistance concluded and separately reviewed.')
 THEN RAISE EXCEPTION 'Membership end deactivated profile or retained privileged Support grants.'; END IF;
 BEGIN
   UPDATE public.support_membership_events SET reason='History rewritten'
   WHERE membership_id=v_id;
   RAISE EXCEPTION 'Immutable Support transition history was overwritten.';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$valid_history$;

RESET ROLE;
ROLLBACK;
SELECT 'CEAC membership distinct end-reason SQL gate PASSED' AS result;
