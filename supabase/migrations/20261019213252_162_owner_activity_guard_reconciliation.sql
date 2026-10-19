-- Forward reconciliation for the owner correction candidate.
-- Keep invitation-controlled email/password and organisation MFA flags unchanged.
-- The prior relink function accidentally nested its assurance check inside the
-- unauthenticated branch. Check every authenticated caller before any data access.
-- Reinstall the immutable correction attribution function as well, so previously
-- rehearsed staging definitions and a fresh sequential replay converge.
BEGIN;

CREATE OR REPLACE FUNCTION public.stage2_relink_own_work(
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
  IF auth.uid() IS NULL
    THEN RAISE EXCEPTION 'Sign in with your existing account.' USING ERRCODE='42501';
  END IF;
  IF NOT public.app_stage2_universal_aal_allowed()
    THEN RAISE EXCEPTION 'Your current assurance level does not authorise this action.'
      USING ERRCODE='42501'; END IF;
  IF v_org IS NULL
    THEN RAISE EXCEPTION 'Your active organisation membership could not be verified.'
      USING ERRCODE='42501'; END IF;
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

CREATE OR REPLACE FUNCTION public.stage2_snapshot_activity_attribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $snapshot$
DECLARE w public.work_items%ROWTYPE;
BEGIN
  SELECT * INTO w FROM public.work_items
   WHERE id=NEW.work_item_id AND org_id=NEW.org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'A valid parent responsibility is required.'
    USING ERRCODE='42501'; END IF;
  IF NEW.supersedes_id IS NOT NULL THEN
    -- A correction must remain attributable to the original project's
    -- historical state, even when the parent work has since been moved.
    SELECT prior.source_project_id,prior.source_objective_id
      INTO NEW.source_project_id,NEW.source_objective_id
    FROM public.work_activity_records prior
    WHERE prior.id=NEW.supersedes_id AND prior.org_id=NEW.org_id
      AND prior.work_item_id=NEW.work_item_id
      AND prior.contributor_id=NEW.contributor_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'A correction must belong to the same original contributor and responsibility.'
      USING ERRCODE='42501'; END IF;
  ELSE
    NEW.source_project_id:=w.project_id;
    NEW.source_objective_id:=w.objective_id;
  END IF;
  RETURN NEW;
END;
$snapshot$;
REVOKE ALL ON FUNCTION public.stage2_snapshot_activity_attribution()
  FROM PUBLIC,anon,authenticated;

COMMIT;
