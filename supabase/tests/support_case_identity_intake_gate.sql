\set ON_ERROR_STOP on
-- Disposable migrated/seeded database only. No production fixture writes.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false WHERE id='10000000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
INSERT INTO public.support_team_memberships(org_id,profile_id,role,added_by,associated_unit_id,reason)
VALUES('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000005','member','31000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000012','Authorised cross-department Support identity fixture.');
SELECT public.grant_capability('31000000-0000-4000-8000-000000000005','support.case.manage',NULL,'Authorised Support identity fixture.',NULL);

SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
INSERT INTO public.support_cases(id,org_id,reported_by,affected_profile_id,affected_unit_id,category,summary,description,impact)
VALUES('43000000-0000-4000-8000-000000000212','10000000-0000-4000-8000-000000000010',auth.uid(),auth.uid(),'20000000-0000-4000-8000-000000000011','cannot_upload','Synthetic blocked upload','The employee cannot upload the required document.','work_blocked');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.support_cases WHERE id='43000000-0000-4000-8000-000000000212') THEN RAISE EXCEPTION 'Reporter gained raw Support-case access';END IF;
 IF EXISTS(SELECT 1 FROM public.support_case_people(ARRAY['43000000-0000-4000-8000-000000000212'::uuid])) THEN RAISE EXCEPTION 'Reporter gained Support-only identity access';END IF;
 BEGIN
  INSERT INTO public.support_cases(org_id,reported_by,affected_profile_id,affected_unit_id,category,summary,description)
  VALUES('10000000-0000-4000-8000-000000000010',auth.uid(),auth.uid(),'20000000-0000-4000-8000-000000000012','cannot_upload','Unrelated department attempt','A synthetic request must use an actual department membership.');
  RAISE EXCEPTION 'Unrelated department accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  INSERT INTO public.support_cases(org_id,reported_by,affected_profile_id,assigned_to,category,summary,description)
  VALUES('10000000-0000-4000-8000-000000000010',auth.uid(),auth.uid(),auth.uid(),'cannot_upload','Preassigned intake attempt','A reporter cannot assign their request to an operator.');
  RAISE EXCEPTION 'Reporter preassigned a case';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $$;

SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id='31000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Operator gained unrelated directory access';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.support_case_people(ARRAY['43000000-0000-4000-8000-000000000212'::uuid]) WHERE reporter_name='Staff Fixture' AND affected_name='Staff Fixture' AND department_name IS NOT NULL) THEN RAISE EXCEPTION 'Authorised operator cannot identify the reporter';END IF;
 IF EXISTS(SELECT 1 FROM public.support_case_people(array_fill('43000000-0000-4000-8000-000000000212'::uuid,ARRAY[151]))) THEN RAISE EXCEPTION 'Unbounded identity lookup accepted';END IF;
 IF has_function_privilege('anon','public.support_case_people(uuid[])','EXECUTE')
 OR (SELECT prosecdef FROM pg_proc WHERE oid='public.support_case_people(uuid[])'::regprocedure)
 THEN RAISE EXCEPTION 'Identity wrapper privileges changed';END IF;
END; $$;

SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
UPDATE public.support_team_memberships SET active=false,ended_at=now(),ended_by=auth.uid(),end_reason='Synthetic identity fixture is finished.'
WHERE profile_id='31000000-0000-4000-8000-000000000005' AND active;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.support_case_people(ARRAY['43000000-0000-4000-8000-000000000212'::uuid])) THEN RAISE EXCEPTION 'Revoked operator retained case identities';END IF;END; $$;
ROLLBACK;
