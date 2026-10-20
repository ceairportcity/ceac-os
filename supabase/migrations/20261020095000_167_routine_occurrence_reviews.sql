-- Stage 2: each real routine occurrence can be reviewed independently.
-- Append-only operational review history; never changes the occurrence itself,
-- employee ratings, project outcome, personal Calendar or attendance.
-- Uses existing Work/organisation authority with RLS; no new privileged RPC.
CREATE TABLE public.routine_occurrence_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  occurrence_id uuid NOT NULL REFERENCES public.operation_occurrences(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('accepted','changes_requested')),
  note text CHECK (note IS NULL OR length(note) <= 2500),
  reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT routine_changes_request_explained CHECK (
    decision <> 'changes_requested' OR length(btrim(coalesce(note,''))) >= 3
  )
);
CREATE INDEX routine_occurrence_reviews_history_idx
 ON public.routine_occurrence_reviews(org_id,occurrence_id,reviewed_at DESC,id DESC);
ALTER TABLE public.routine_occurrence_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.routine_occurrence_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.routine_occurrence_reviews TO authenticated;

-- Prevent a client from impersonating another reviewer or backdating review
-- history. This is an invoker trigger and cannot write protected audit events.
CREATE FUNCTION public.stage2_stamp_routine_occurrence_review()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $review$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before reviewing an occurrence.' USING ERRCODE='42501';
  END IF;
  NEW.reviewer_id := auth.uid();
  NEW.reviewed_at := clock_timestamp();
  NEW.note := nullif(btrim(coalesce(NEW.note,'')), '');
  RETURN NEW;
END;
$review$;
REVOKE ALL ON FUNCTION public.stage2_stamp_routine_occurrence_review() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage2_stamp_routine_occurrence_review_before_insert
 BEFORE INSERT ON public.routine_occurrence_reviews
 FOR EACH ROW EXECUTE FUNCTION public.stage2_stamp_routine_occurrence_review();

-- A person may read operational review history only when they may read the
-- underlying Work. HR-restricted appraisals are kept in their own tables.
CREATE POLICY stage2_routine_review_read ON public.routine_occurrence_reviews
 FOR SELECT TO authenticated
 USING (
   org_id=public.app_org_id()
   AND public.app_stage2_universal_aal_allowed()
   AND EXISTS (
     SELECT 1
     FROM public.operation_occurrences occurrence
     JOIN public.recurring_operations routine ON routine.id=occurrence.operation_id
     JOIN public.work_items work ON work.id=routine.work_item_id
     WHERE occurrence.id=routine_occurrence_reviews.occurrence_id
       AND occurrence.org_id=routine_occurrence_reviews.org_id
       AND routine.org_id=routine_occurrence_reviews.org_id
       AND work.org_id=routine_occurrence_reviews.org_id
       AND public.app_can_see_item(work.id)
   )
 );

-- Only a different, authorised unit manager or Administration/HR may review
-- a recorded occurrence. All denials are enforced server-side regardless
-- of client button visibility or direct REST calls.
CREATE POLICY stage2_routine_review_write ON public.routine_occurrence_reviews
 FOR INSERT TO authenticated
 WITH CHECK (
   org_id=public.app_org_id()
   AND reviewer_id=auth.uid()
   AND public.app_stage2_universal_aal_allowed()
   AND EXISTS (
     SELECT 1
     FROM public.operation_occurrences occurrence
     JOIN public.recurring_operations routine ON routine.id=occurrence.operation_id
     JOIN public.work_items work ON work.id=routine.work_item_id
     WHERE occurrence.id=routine_occurrence_reviews.occurrence_id
       AND occurrence.org_id=routine_occurrence_reviews.org_id
       AND routine.org_id=routine_occurrence_reviews.org_id
       AND work.org_id=routine_occurrence_reviews.org_id
       AND occurrence.recorded_by IS DISTINCT FROM auth.uid()
       AND work.visibility='unit'
       AND work.confidential=false
       AND (routine.unit_id IN (SELECT public.app_managed_units())
            OR public.app_is_admin())
       AND public.app_can_see_item(work.id)
   )
 );
COMMENT ON TABLE public.routine_occurrence_reviews IS
 'Operational human review of an independently recorded routine date; append-only, not a staff performance rating or a change to master Work completion.';
