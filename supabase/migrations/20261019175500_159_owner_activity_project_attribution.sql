-- Preserve the project/objective actually associated with each person-recorded action,
-- even if the parent responsibility is later moved with an audited relink.
ALTER TABLE public.work_activity_records
  ADD COLUMN IF NOT EXISTS source_project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_objective_id uuid REFERENCES public.objectives(id) ON DELETE RESTRICT;

-- This BEFORE trigger runs before the append guard by PostgreSQL's
-- alphabetical order for same-timing triggers.
CREATE FUNCTION public.stage2_snapshot_activity_attribution()
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
CREATE TRIGGER stage2_0_activity_snapshot
 BEFORE INSERT ON public.work_activity_records FOR EACH ROW
 EXECUTE FUNCTION public.stage2_snapshot_activity_attribution();

COMMENT ON COLUMN public.work_activity_records.source_project_id IS
  'Immutable attribution of the project linked at the original action time, not the current work-item project.';
