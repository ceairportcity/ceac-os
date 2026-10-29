-- Exercises the real revised intake policy and narrow case-identity reader.
INSERT INTO public.units(id,org_id,name) VALUES('20000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000010','Unrelated department');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',false);
INSERT INTO public.support_cases(id,org_id,reported_by,affected_profile_id,affected_unit_id,impact) VALUES('43000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000011','work_blocked');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.support_cases) THEN RAISE EXCEPTION 'Reporter gained raw case access';END IF;
 IF EXISTS(SELECT 1 FROM public.support_case_people(ARRAY['43000000-0000-4000-8000-000000000001'::uuid])) THEN RAISE EXCEPTION 'Ordinary reporter gained Support identities';END IF;
 BEGIN INSERT INTO public.support_cases(org_id,reported_by,affected_profile_id,affected_unit_id) VALUES('10000000-0000-4000-8000-000000000010',auth.uid(),auth.uid(),'20000000-0000-4000-8000-000000000012');RAISE EXCEPTION 'Unrelated department accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO public.support_cases(org_id,reported_by,affected_profile_id,assigned_to) VALUES('10000000-0000-4000-8000-000000000010',auth.uid(),auth.uid(),auth.uid());RAISE EXCEPTION 'Reporter preassigned a case';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $$;
RESET ROLE;
INSERT INTO public.capabilities VALUES('31000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','support.case.manage');
INSERT INTO public.support_team_memberships VALUES('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000002',true);
-- Reporter is outside the operator's directory; the case reader must still
-- resolve their historical name without granting profile SELECT globally.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_own_profile ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',false);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id='31000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Fixture profile boundary missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.support_case_people(ARRAY['43000000-0000-4000-8000-000000000001'::uuid]) WHERE reporter_name='Synthetic 1' AND department_name='Synthetic department') THEN RAISE EXCEPTION 'Authorised technician cannot resolve reporter';END IF;
END; $$;
RESET ROLE;
UPDATE public.support_team_memberships SET active=false;
SET ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.support_case_people(ARRAY['43000000-0000-4000-8000-000000000001'::uuid])) THEN RAISE EXCEPTION 'Revoked operator retained case identities';END IF;END; $$;
RESET ROLE;
