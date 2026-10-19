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
