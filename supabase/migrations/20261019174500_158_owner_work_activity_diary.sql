-- Stage 2 owner correction: attributable, dated activities per responsibility.
-- New forward-only table. Do not apply to production outside a verified cutover.
-- Activity records are NOT completed work, KPI achievement, attendance or payroll.
CREATE TABLE public.work_activity_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE RESTRICT,
  contributor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  activity_date date NOT NULL,
  activity_state text NOT NULL CHECK (activity_state IN ('planned','in_progress','done','waiting','blocked')),
  action_summary text NOT NULL CHECK (length(btrim(action_summary)) BETWEEN 3 AND 600),
  outcome_note text CHECK (length(outcome_note) <= 4000),
  next_action text CHECK (length(next_action) <= 1200),
  duration_minutes integer CHECK (duration_minutes BETWEEN 0 AND 1440),
  evidence_url text CHECK (evidence_url IS NULL OR (length(evidence_url) <= 2048 AND evidence_url ~ '^https://')),
  supersedes_id uuid UNIQUE REFERENCES public.work_activity_records(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX work_activity_by_work_time ON public.work_activity_records (work_item_id, activity_date DESC, recorded_at DESC);
CREATE INDEX work_activity_by_contributor_time ON public.work_activity_records (org_id, contributor_id, activity_date DESC);

ALTER TABLE public.work_activity_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_activity_records FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.work_activity_records TO authenticated;

-- A diary entry inherits the underlying work-item visibility. Private tasks
-- remain visible only to the contributor; HR/Executive access is not broadened.
CREATE POLICY stage2_activity_owner_or_authorised_work_read
  ON public.work_activity_records FOR SELECT TO authenticated
  USING (
    org_id=public.app_org_id()
    AND public.app_stage2_universal_aal_allowed()
    AND public.app_can_see_item(work_item_id)
    AND (
      contributor_id=auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.work_items wi
        WHERE wi.id=work_item_id AND wi.org_id=org_id
          AND wi.visibility<>'private' AND wi.confidential=false
      )
    )
  );

-- App_can_see_item enforces RLS-equivalent actor scope. Self, same-unit and
-- authorised project participants can record their OWN contribution to a
-- visible organisational responsibility; never another person's contribution.
CREATE POLICY stage2_activity_write_by_contributor
  ON public.work_activity_records FOR INSERT TO authenticated
  WITH CHECK (
    org_id=public.app_org_id()
    AND contributor_id=auth.uid()
    AND public.app_stage2_universal_aal_allowed()
    AND public.app_can_see_item(work_item_id)
    AND EXISTS (
      SELECT 1 FROM public.work_items wi
      WHERE wi.id=work_item_id AND wi.org_id=org_id
        AND (
          wi.assignee_id=auth.uid()
          OR (
            wi.visibility<>'private' AND wi.confidential=false
            AND (
              wi.unit_id IN (SELECT public.app_my_units())
              OR (wi.project_id IS NOT NULL
                AND wi.project_id IN (SELECT public.app_visible_projects()))
            )
          )
        )
    )
  );

-- Immutable entries: amendments are append-only correction versions.
-- No UPDATE/DELETE privileges or policies exist. Server owns timestamps.
CREATE FUNCTION public.stage2_guard_work_activity_append()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $activity$
DECLARE prior public.work_activity_records%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NEW.org_id IS DISTINCT FROM public.app_org_id()
    OR NEW.contributor_id IS DISTINCT FROM auth.uid()
    OR NOT public.app_can_see_item(NEW.work_item_id)
  THEN RAISE EXCEPTION 'Not authorised to record this activity.'
    USING ERRCODE='42501'; END IF;
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT * INTO prior FROM public.work_activity_records WHERE id=NEW.supersedes_id;
    IF NOT FOUND OR prior.org_id<>NEW.org_id
      OR prior.work_item_id<>NEW.work_item_id
      OR prior.contributor_id<>NEW.contributor_id
    THEN RAISE EXCEPTION 'Only the original contributor can correct an activity.'
      USING ERRCODE='42501'; END IF;
  END IF;
  NEW.recorded_at:=clock_timestamp();
  INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  VALUES (NEW.org_id,auth.uid(),'work_activity_recorded','work_item',NEW.work_item_id,
    jsonb_build_object('activity_id',NEW.id,'activity_state',NEW.activity_state,
      'activity_date',NEW.activity_date,'correction_of',NEW.supersedes_id));
  RETURN NEW;
END;
$activity$;
REVOKE ALL ON FUNCTION public.stage2_guard_work_activity_append() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage2_guard_work_activity_append
  BEFORE INSERT ON public.work_activity_records FOR EACH ROW
  EXECUTE FUNCTION public.stage2_guard_work_activity_append();

COMMENT ON TABLE public.work_activity_records IS
  'Append-only self-attributed work actions; not an automatic KPI, attendance or employee rating.';

-- Relink an existing SELF-CREATED organisational responsibility, with an
-- immutable author/reason/old/new audit. It cannot change another person's
-- assignment, publish private notes or self-approve an outcome.
CREATE FUNCTION public.stage2_relink_own_work(
  p_work_item_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_objective_id uuid DEFAULT NULL,
  p_phase_id uuid DEFAULT NULL,
  p_reason text DEFAULT ''
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $link$
DECLARE
  w public.work_items%ROWTYPE;
  v_org uuid:=public.app_org_id();
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL
    THEN RAISE EXCEPTION 'Sign in with your existing account.' USING ERRCODE='42501';
  IF NOT public.app_stage2_universal_aal_allowed()
    THEN RAISE EXCEPTION 'Your current assurance level does not authorise this action.'
      USING ERRCODE='42501'; END IF;
  END IF;
  SELECT * INTO w FROM public.work_items
    WHERE id=p_work_item_id AND org_id=v_org FOR UPDATE;
  IF NOT FOUND OR w.assignee_id IS DISTINCT FROM auth.uid()
    OR w.origin<>'self_created' OR w.visibility<>'unit'
    OR w.status IN ('completed','self_certified','cancelled','in_review')
  THEN RAISE EXCEPTION 'Only your open organisational self-created work may be relinked.'
    USING ERRCODE='42501'; END IF;
  IF w.unit_id NOT IN (SELECT public.app_my_units())
    THEN RAISE EXCEPTION 'Your current department membership cannot change this work.'
      USING ERRCODE='42501'; END IF;
  IF (p_project_id IS NULL AND (p_objective_id IS NOT NULL OR p_phase_id IS NOT NULL))
    THEN RAISE EXCEPTION 'Select a project for an objective or phase.'; END IF;
  IF p_project_id IS NOT NULL THEN
    IF NOT EXISTS(
      SELECT 1 FROM public.projects p WHERE p.id=p_project_id
        AND p.org_id=v_org AND p.status IN ('planned','active')
        AND (p.lead_unit_id=w.unit_id
          OR EXISTS(SELECT 1 FROM public.project_units pu
            WHERE pu.project_id=p.id AND pu.unit_id=w.unit_id))
    ) THEN RAISE EXCEPTION 'That project is not authorised for this department.'
      USING ERRCODE='42501'; END IF;
  END IF;
  IF p_objective_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.objectives o
      WHERE o.id=p_objective_id AND o.project_id=p_project_id AND o.unit_id=w.unit_id
  ) THEN RAISE EXCEPTION 'That objective is not authorised for this responsibility.'
    USING ERRCODE='42501'; END IF;
  IF p_phase_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.project_phases ph
      WHERE ph.id=p_phase_id AND ph.project_id=p_project_id
  ) THEN RAISE EXCEPTION 'That project phase is invalid.'
    USING ERRCODE='42501'; END IF;

  IF w.project_id IS NOT DISTINCT FROM p_project_id
    AND w.objective_id IS NOT DISTINCT FROM p_objective_id
    AND w.phase_id IS NOT DISTINCT FROM p_phase_id
    THEN RETURN jsonb_build_object('id',w.id,'unchanged',true);
  END IF;
  IF length(btrim(coalesce(p_reason,''))) < 6 OR length(p_reason)>1200
    THEN RAISE EXCEPTION 'Record why the project link is being changed (6–1200 characters).'; END IF;

  UPDATE public.work_items
    SET project_id=p_project_id,objective_id=p_objective_id,phase_id=p_phase_id,
      last_movement_at=clock_timestamp()
    WHERE id=w.id AND org_id=v_org;
  INSERT INTO public.activity_events (org_id,actor_id,verb,object_type,object_id,meta)
  VALUES(v_org,auth.uid(),'self_work_project_relinked','work_item',w.id,
    jsonb_build_object('previous_project_id',w.project_id,
      'new_project_id',p_project_id,'previous_objective_id',w.objective_id,
      'new_objective_id',p_objective_id,'previous_phase_id',w.phase_id,
      'new_phase_id',p_phase_id,'reason',btrim(p_reason)));
  RETURN jsonb_build_object('id',w.id,'unchanged',false,
    'project_id',p_project_id,'objective_id',p_objective_id,'phase_id',p_phase_id);
END;
$link$;
REVOKE ALL ON FUNCTION public.stage2_relink_own_work(uuid,uuid,uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage2_relink_own_work(uuid,uuid,uuid,uuid,text)
  TO authenticated;
