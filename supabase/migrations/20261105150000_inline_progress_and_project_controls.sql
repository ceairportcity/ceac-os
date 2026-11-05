-- CEAC OS: one progress history and auditable project management (5 Nov 2026).
-- Historical activity/project data is retained. Destructive client table access is not granted.
ALTER TABLE public.work_activity_records
  ADD COLUMN IF NOT EXISTS entry_kind text NOT NULL DEFAULT 'update',
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.work_activity_records
  ADD CONSTRAINT work_activity_entry_kind_check CHECK (entry_kind IN ('update','milestone'));

-- Removed activity is absent from ordinary history, reports and counts while
-- its immutable original remains available to controlled audit/database review.
CREATE POLICY work_activity_hide_removed
  ON public.work_activity_records AS RESTRICTIVE FOR SELECT TO authenticated
  USING (removed_at IS NULL);
CREATE POLICY work_activity_no_pre_removed_insert
  ON public.work_activity_records AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (removed_at IS NULL AND removed_by IS NULL);

CREATE OR REPLACE FUNCTION public.remove_own_work_update(p_activity_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE r public.work_activity_records%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.app_stage2_universal_aal_allowed()
     OR public.app_org_id() IS NULL THEN
    RAISE EXCEPTION 'Sign in to manage your work.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO r FROM public.work_activity_records
    WHERE id=p_activity_id AND org_id=public.app_org_id() FOR UPDATE;
  IF NOT FOUND OR r.contributor_id IS DISTINCT FROM auth.uid()
     OR r.removed_at IS NOT NULL
     OR NOT public.app_can_see_item(r.work_item_id) THEN
    RAISE EXCEPTION 'You can only remove your own available work update.' USING ERRCODE='42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.work_activity_records newer
    WHERE newer.supersedes_id=r.id AND newer.removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Remove the latest correction instead of an earlier version.';
  END IF;
  UPDATE public.work_activity_records
    SET removed_at=clock_timestamp(),removed_by=auth.uid()
    WHERE id=r.id AND removed_at IS NULL;
  INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  VALUES(r.org_id,auth.uid(),'work_activity_removed','work_item',r.work_item_id,
    jsonb_build_object('activity_id',r.id,'previous_date',r.activity_date,
                       'entry_kind',r.entry_kind));
  RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.remove_own_work_update(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remove_own_work_update(uuid) TO authenticated;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id);
CREATE POLICY projects_hide_deleted ON public.projects
  AS RESTRICTIVE FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE OR REPLACE FUNCTION public.guard_ceac_project_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $fn$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL
       OR NEW.deleted_at IS NOT NULL OR NEW.deleted_by IS NOT NULL THEN
      RAISE EXCEPTION 'Projects cannot be created with lifecycle history.'
        USING ERRCODE='42501';
    END IF;
  ELSIF (
    NEW.archived_at IS DISTINCT FROM OLD.archived_at
    OR NEW.archived_by IS DISTINCT FROM OLD.archived_by
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by
  ) AND current_user NOT IN ('postgres','service_role') THEN
    RAISE EXCEPTION 'Use the authorised project management action.'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.guard_ceac_project_lifecycle() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER projects_guard_ceac_lifecycle
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.guard_ceac_project_lifecycle();


-- Project edits and lifecycle transitions run only after current server-side
-- organisational authority checks. Unused deletion is reversible in audit,
-- does not cascade-delete projects, and rejects projects with substantive work.
CREATE OR REPLACE FUNCTION public.manage_ceac_project(
  p_project_id uuid, p_action text,
  p_name text DEFAULT NULL, p_purpose text DEFAULT NULL,
  p_starts_on date DEFAULT NULL, p_ends_on date DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE p public.projects%ROWTYPE;
DECLARE v_busy boolean:=false;
BEGIN
  IF auth.uid() IS NULL OR public.app_org_id() IS NULL
     OR NOT public.app_stage2_universal_aal_allowed() THEN
    RAISE EXCEPTION 'Sign in to manage a project.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO p FROM public.projects
    WHERE id=p_project_id AND org_id=public.app_org_id() FOR UPDATE;
  IF NOT FOUND OR p.deleted_at IS NOT NULL OR
    NOT (p.created_by=auth.uid() OR public.app_can_manage_delivery_project(p.id))
  THEN
    RAISE EXCEPTION 'You are not authorised to manage this project.' USING ERRCODE='42501';
  END IF;
  IF p_action='save' THEN
    IF p.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Restore this project before editing it.';
    END IF;
    IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 3 AND 220
       OR length(coalesce(p_purpose,''))>4000
       OR (p_starts_on IS NOT NULL AND p_ends_on IS NOT NULL AND p_ends_on<p_starts_on)
    THEN RAISE EXCEPTION 'Check the project name, description and dates.'; END IF;
    UPDATE public.projects SET name=btrim(p_name),purpose=nullif(btrim(p_purpose),''),
      starts_on=p_starts_on,ends_on=p_ends_on WHERE id=p.id;
  ELSIF p_action='archive' THEN
    IF p.archived_at IS NULL THEN
      UPDATE public.projects SET archived_at=clock_timestamp(),archived_by=auth.uid()
        WHERE id=p.id;
    END IF;
  ELSIF p_action='restore' THEN
    UPDATE public.projects SET archived_at=NULL,archived_by=NULL WHERE id=p.id;
  ELSIF p_action='delete' THEN
    SELECT
      EXISTS(SELECT 1 FROM public.work_items WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.objectives WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.project_phases WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.project_milestones WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.project_closes WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.meeting_sessions WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.memos WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.reports WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.budgets WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.spend_lines WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.finance_requests WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.project_register_items WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.delivery_group_projects WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.project_dependencies WHERE project_id=p.id OR depends_on_project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.project_person_contribution_assessments WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.feedback_notes WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.internal_transfers WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.strategy_delivery_links WHERE project_id=p.id)
      OR EXISTS(SELECT 1 FROM public.resource_project_commitment_versions WHERE project_id=p.id)
      INTO v_busy;
    IF v_busy THEN
      RAISE EXCEPTION 'This project has recorded work or related evidence. Archive it instead.';
    END IF;
    -- Automatic room and unit setup is retained; no dependent records are
    -- destroyed. Deleting a mistaken empty project hides it from normal access.
    UPDATE public.projects SET deleted_at=clock_timestamp(),deleted_by=auth.uid(),
      archived_at=coalesce(archived_at,clock_timestamp()),archived_by=coalesce(archived_by,auth.uid())
      WHERE id=p.id;
  ELSE
    RAISE EXCEPTION 'Unsupported project change.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  VALUES(p.org_id,auth.uid(),'project_'||p_action,'project',p.id,
    jsonb_build_object('previous_name',p.name,'name',CASE WHEN p_action='save' THEN btrim(p_name) ELSE p.name END));
  RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.manage_ceac_project(uuid,text,text,text,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_ceac_project(uuid,text,text,text,date,date) TO authenticated;

-- An occurrence of a manager-owned routine must be reviewed by Executive,
-- except where an active Admin explicitly assigned that manager's work.
CREATE OR REPLACE FUNCTION public.app_can_review_routine_work(p_work_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO ''
AS $fn$
 SELECT EXISTS(
  SELECT 1 FROM public.work_items w
  WHERE w.id=p_work_item_id AND w.org_id=public.app_org_id()
    AND w.kind='routine' AND w.visibility='unit' AND NOT w.confidential
    AND w.assignee_id IS DISTINCT FROM auth.uid()
    AND public.app_stage2_universal_aal_allowed()
    AND public.app_can_see_item(w.id)
    AND (
      (EXISTS(
        SELECT 1 FROM public.unit_memberships m
        WHERE m.profile_id=w.assignee_id AND m.org_id=w.org_id AND m.role='manager'
       ) AND (
        (w.assigned_by IS DISTINCT FROM w.assignee_id
          AND w.assigned_by=auth.uid()
          AND EXISTS(SELECT 1 FROM public.profiles p
            WHERE p.id=w.assigned_by AND p.org_id=w.org_id AND p.active AND p.is_admin))
        OR (
          NOT EXISTS(SELECT 1 FROM public.profiles assigning_admin
            WHERE assigning_admin.id=w.assigned_by AND assigning_admin.org_id=w.org_id
              AND assigning_admin.active AND assigning_admin.is_admin
              AND w.assigned_by IS DISTINCT FROM w.assignee_id)
          AND public.app_is_exec()
        )
      ))
      OR (
        NOT EXISTS(SELECT 1 FROM public.unit_memberships m
          WHERE m.profile_id=w.assignee_id AND m.org_id=w.org_id AND m.role='manager')
        AND (w.unit_id IN (SELECT public.app_managed_units()) OR public.app_is_admin())
      )
    )
 );
$fn$;
REVOKE ALL ON FUNCTION public.app_can_review_routine_work(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.app_can_review_routine_work(uuid) TO authenticated;

DROP POLICY IF EXISTS stage2_routine_review_write ON public.routine_occurrence_reviews;
CREATE POLICY stage2_routine_review_write ON public.routine_occurrence_reviews
  FOR INSERT TO authenticated WITH CHECK (
    org_id=public.app_org_id() AND reviewer_id=auth.uid()
    AND public.app_stage2_universal_aal_allowed()
    AND EXISTS(
      SELECT 1 FROM public.operation_occurrences occurrence
      JOIN public.recurring_operations routine ON routine.id=occurrence.operation_id
      JOIN public.work_items work ON work.id=routine.work_item_id
      WHERE occurrence.id=routine_occurrence_reviews.occurrence_id
        AND occurrence.org_id=routine_occurrence_reviews.org_id
        AND routine.org_id=routine_occurrence_reviews.org_id
        AND work.org_id=routine_occurrence_reviews.org_id
        AND occurrence.recorded_by IS DISTINCT FROM auth.uid()
        AND public.app_can_review_routine_work(work.id)
    )
  );
