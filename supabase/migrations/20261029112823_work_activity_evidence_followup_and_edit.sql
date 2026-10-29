-- Phase 1: retain immutable activities, reuse private files and personal planning.
BEGIN;

-- The old intake contract accepted only NULL department / normal impact.
-- Keep self-reporting and every assignment/closure restriction; permit only
-- an actual active department membership and the two existing impact values.
-- Confirmed identity is enforced by the existing protected BEFORE INSERT
-- trigger. Its internal helper intentionally has no direct staff EXECUTE grant.
DO $identity_guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.support_cases'::regclass
  AND tgname='support_case_insert_guard' AND NOT tgisinternal AND tgenabled IN ('O','A')
  AND tgfoid='public.support_case_insert_guard()'::regprocedure)
 THEN RAISE EXCEPTION 'Verified Support intake trigger must remain enabled.'; END IF;
END; $identity_guard$;
ALTER POLICY support_cases_report_self ON public.support_cases WITH CHECK (
 org_id=public.app_org_id() AND reported_by=auth.uid() AND affected_profile_id=auth.uid()
 AND public.app_stage2_universal_aal_allowed()
 AND (affected_unit_id IS NULL OR (
  affected_unit_id IN (SELECT public.app_my_units())
  AND EXISTS(SELECT 1 FROM public.units u WHERE u.id=affected_unit_id AND u.org_id=public.app_org_id() AND u.active)
 ))
 AND assigned_to IS NULL AND state='open' AND impact IN ('normal','work_blocked')
 AND resolution_summary IS NULL AND resolved_at IS NULL AND closed_at IS NULL
);

-- Profile RLS deliberately hides unrelated departments. Return only the names
-- attached to already-authorised support cases, including historical reporters.
-- Do not broaden profiles, memberships, employee or case-body access.
CREATE FUNCTION private.support_case_people_rows(p_case_ids uuid[])
RETURNS TABLE(case_id uuid,reporter_name text,affected_name text,assignee_name text,department_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT sc.id,reporter.full_name,affected.full_name,assignee.full_name,department.name
 FROM public.support_cases sc
 LEFT JOIN public.profiles reporter ON reporter.id=sc.reported_by AND reporter.org_id=sc.org_id
 LEFT JOIN public.profiles affected ON affected.id=sc.affected_profile_id AND affected.org_id=sc.org_id
 LEFT JOIN public.profiles assignee ON assignee.id=sc.assigned_to AND assignee.org_id=sc.org_id
 LEFT JOIN public.units department ON department.id=sc.affected_unit_id AND department.org_id=sc.org_id
 WHERE cardinality(p_case_ids) BETWEEN 1 AND 150 AND sc.id=ANY(p_case_ids)
 AND auth.uid() IS NOT NULL AND public.app_identity_confirmed()
 AND public.app_stage2_universal_aal_allowed() AND sc.org_id=public.app_org_id()
 AND public.app_has_capability('support.case.manage',NULL)
 AND EXISTS(SELECT 1 FROM public.support_team_memberships tm WHERE tm.org_id=sc.org_id AND tm.profile_id=auth.uid() AND tm.active)
$$;
REVOKE ALL ON FUNCTION private.support_case_people_rows(uuid[]) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.support_case_people_rows(uuid[]) TO authenticated,service_role;
CREATE FUNCTION public.support_case_people(p_case_ids uuid[])
RETURNS TABLE(case_id uuid,reporter_name text,affected_name text,assignee_name text,department_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM private.support_case_people_rows(p_case_ids)
$$;
REVOKE ALL ON FUNCTION public.support_case_people(uuid[]) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.support_case_people(uuid[]) TO authenticated;

DO $extend$
DECLARE d text; n text;
BEGIN
 FOREACH n IN ARRAY ARRAY['app_can_read_operational_context(text,uuid)','app_can_write_operational_context(text,uuid)'] LOOP
  d:=pg_get_functiondef(('public.'||n)::regprocedure);
  IF position('when ''memo_version'' then' in d)=0 OR position('else false' in d)=0 THEN
   RAISE EXCEPTION 'Operational file contexts changed; review this extension.';
  END IF;
  IF n LIKE 'app_can_read%' THEN
   d:=replace(d,'else false','when ''work_activity'' then exists(select 1 from public.work_activity_records a join public.work_items w on w.id=a.work_item_id where a.id=p_context_id and a.org_id=public.app_org_id() and public.app_stage2_universal_aal_allowed() and public.app_can_see_item(w.id) and (a.contributor_id=auth.uid() or (w.visibility<>''private'' and not w.confidential))) else false');
  ELSE
   d:=replace(d,'else false','when ''work_activity'' then exists(select 1 from public.work_activity_records a where a.id=p_context_id and a.org_id=public.app_org_id() and a.contributor_id=auth.uid() and public.app_stage2_universal_aal_allowed() and public.app_can_see_item(a.work_item_id) and not exists(select 1 from public.work_activity_records correction where correction.supersedes_id=a.id)) else false');
  END IF;
  EXECUTE d;
 END LOOP;
 FOREACH n IN ARRAY ARRAY['register_operational_file(text,uuid,text,text,text,bigint)','link_operational_file(uuid,text,uuid,text)'] LOOP
  d:=pg_get_functiondef(('public.'||n)::regprocedure);
  IF position('p_context_type not in (' in d)=0 THEN RAISE EXCEPTION 'File validator changed.'; END IF;
  EXECUTE replace(d,'p_context_type not in (','p_context_type=''work_activity'' and p_relation<>''activity_evidence'' or p_context_type not in (''work_activity'',');
 END LOOP;
 FOR d IN SELECT 'ALTER TABLE public.operational_file_links DROP CONSTRAINT '||quote_ident(c.conname)||'; ALTER TABLE public.operational_file_links ADD CONSTRAINT '||quote_ident(c.conname)||' CHECK(('||pg_get_expr(c.conbin,c.conrelid)||') OR (context_type=''work_activity'' AND relation=''activity_evidence''));'
 FROM pg_constraint c WHERE c.conrelid='public.operational_file_links'::regclass AND c.contype='c' AND (pg_get_expr(c.conbin,c.conrelid) LIKE '%context_type%' OR pg_get_expr(c.conbin,c.conrelid) LIKE '%relation%')
 LOOP EXECUTE d; END LOOP;
END; $extend$;

-- The link is private. Completing an assignment cannot complete its follow-up.
CREATE TABLE private.work_activity_followups (
 activity_id uuid PRIMARY KEY REFERENCES public.work_activity_records(id) ON DELETE RESTRICT,
 task_id uuid REFERENCES public.personal_day_tasks(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX work_activity_followups_task_idx ON private.work_activity_followups(task_id);
ALTER TABLE private.work_activity_followups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_activity_followups FROM public,anon,authenticated;

CREATE FUNCTION public.plan_work_activity_followup(p_activity_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.work_activity_records; t uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.app_stage2_universal_aal_allowed()
 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND org_id=public.app_org_id() AND active)
 THEN RAISE EXCEPTION 'Your active account is required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.work_activity_records WHERE id=p_activity_id AND org_id=public.app_org_id() FOR UPDATE;
 IF a.id IS NULL OR a.contributor_id IS DISTINCT FROM auth.uid() OR NOT public.app_can_see_item(a.work_item_id)
 OR nullif(btrim(a.next_action),'') IS NULL THEN RAISE EXCEPTION 'Only your own recorded next action can be planned.' USING ERRCODE='42501'; END IF;
 SELECT task_id INTO t FROM private.work_activity_followups WHERE activity_id=a.id;
 IF FOUND THEN RETURN t; END IF; -- Includes an explicitly deleted private task: no silent recreation.
 IF EXISTS(SELECT 1 FROM public.work_activity_records WHERE supersedes_id=a.id)
 THEN RAISE EXCEPTION 'Plan the corrected activity instead.'; END IF;
 INSERT INTO public.personal_day_tasks(org_id,profile_id,plan_date,title,details,linked_work_item_id)
 VALUES(a.org_id,auth.uid(),a.next_action_on,left(btrim(a.next_action),220),a.next_action,a.work_item_id) RETURNING id INTO t;
 INSERT INTO private.work_activity_followups(activity_id,task_id) VALUES(a.id,t);
 RETURN t;
END; $$;
REVOKE ALL ON FUNCTION public.plan_work_activity_followup(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.plan_work_activity_followup(uuid) TO authenticated;

-- Preserve exact revisions without copying private assignment text into the
-- broader activity feed. No ordinary HR/IT/Executive content grant is added.
CREATE TABLE private.work_detail_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
 work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 before_details jsonb NOT NULL,after_details jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX work_detail_revisions_work_idx ON private.work_detail_revisions(work_item_id,recorded_at);
ALTER TABLE private.work_detail_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.work_detail_revisions FROM public,anon,authenticated;

CREATE FUNCTION public.edit_open_work_details(p_work_item_id uuid,p_expected_movement timestamptz,p_title text,p_purpose text,p_outcome text,p_instructions text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.work_items;
BEGIN
 IF auth.uid() IS NULL OR NOT public.app_stage2_universal_aal_allowed()
 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND org_id=public.app_org_id() AND active)
 THEN RAISE EXCEPTION 'Your active account is required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO w FROM public.work_items WHERE id=p_work_item_id AND org_id=public.app_org_id() FOR UPDATE;
 IF w.id IS NULL OR NOT public.app_can_see_item(w.id) OR w.status IN ('completed','self_certified','cancelled','in_review') OR NOT (
  (w.origin='self_created' AND w.assignee_id=auth.uid() AND w.unit_id IN (SELECT public.app_my_units()))
  OR (w.assigned_by=auth.uid() AND (w.unit_id IN (SELECT public.app_managed_units()) OR public.app_is_admin() OR public.app_is_exec()))
 ) THEN RAISE EXCEPTION 'Only the creator or assigning manager can edit open work.' USING ERRCODE='42501'; END IF;
 IF w.last_movement_at IS DISTINCT FROM p_expected_movement THEN RAISE EXCEPTION 'This work changed. Refresh before editing.' USING ERRCODE='40001'; END IF;
 IF length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 220 OR length(coalesce(p_purpose,''))>4000
 OR length(coalesce(p_outcome,''))>4000 OR length(coalesce(p_instructions,''))>8000 THEN RAISE EXCEPTION 'Check the work title and detail lengths.'; END IF;
 UPDATE public.work_items SET title=btrim(p_title),purpose=nullif(btrim(p_purpose),''),expected_outcome=nullif(btrim(p_outcome),''),instructions=nullif(btrim(p_instructions),''),last_movement_at=clock_timestamp() WHERE id=w.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Your current permissions cannot edit this work.' USING ERRCODE='42501'; END IF;
 INSERT INTO private.work_detail_revisions(org_id,work_item_id,actor_id,before_details,after_details)
 VALUES(w.org_id,w.id,auth.uid(),jsonb_build_object('title',w.title,'purpose',w.purpose,'expected_outcome',w.expected_outcome,'instructions',w.instructions),
 jsonb_build_object('title',btrim(p_title),'purpose',nullif(btrim(p_purpose),''),'expected_outcome',nullif(btrim(p_outcome),''),'instructions',nullif(btrim(p_instructions),'')));
 INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 VALUES(w.org_id,auth.uid(),'work_details_edited','work_item',w.id,'{}'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.edit_open_work_details(uuid,timestamptz,text,text,text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.edit_open_work_details(uuid,timestamptz,text,text,text,text) TO authenticated;
COMMIT;
