-- Focused adapter for the existing Support contracts; no hosted data.
CREATE FUNCTION public.app_identity_confirmed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active) $$;
CREATE FUNCTION public.app_has_capability(p_capability text,p_unit_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.capabilities WHERE profile_id=auth.uid() AND org_id=public.app_org_id() AND capability=p_capability) $$;
CREATE TABLE public.support_team_memberships(org_id uuid,profile_id uuid,active boolean DEFAULT true);
ALTER TABLE public.support_team_memberships ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.support_team_memberships TO authenticated;
CREATE POLICY fixture_support_member_read ON public.support_team_memberships FOR SELECT TO authenticated USING(profile_id=auth.uid() AND org_id=public.app_org_id());
CREATE TABLE public.support_cases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,reported_by uuid,affected_profile_id uuid,affected_unit_id uuid,assigned_to uuid,state text DEFAULT 'open',impact text DEFAULT 'normal',resolution_summary text,resolved_at timestamptz,closed_at timestamptz);
ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
GRANT INSERT,SELECT ON public.support_cases TO authenticated;
CREATE POLICY support_cases_report_self ON public.support_cases FOR INSERT TO authenticated WITH CHECK(org_id=public.app_org_id() AND reported_by=auth.uid() AND affected_profile_id=auth.uid() AND affected_unit_id IS NULL AND impact='normal');
CREATE POLICY fixture_support_read ON public.support_cases FOR SELECT TO authenticated USING(org_id=public.app_org_id() AND public.app_has_capability('support.case.manage',NULL) AND EXISTS(SELECT 1 FROM public.support_team_memberships tm WHERE tm.org_id=support_cases.org_id AND tm.profile_id=auth.uid() AND tm.active));
