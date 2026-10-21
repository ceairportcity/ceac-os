-- Independent progress for canonical dates in the EXISTING routine engine.
-- No parent completion, new assignment authority, HR rating or public RPC.
CREATE TABLE public.routine_date_progress (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
 operation_id uuid NOT NULL REFERENCES public.recurring_operations(id) ON DELETE RESTRICT,
 scheduled_on date NOT NULL,
 entry_number integer NOT NULL DEFAULT 1 CHECK(entry_number>0),
 actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 status text NOT NULL CHECK(status IN ('in_progress','waiting_on','ready_for_review')),
 completed_step_ids uuid[] NOT NULL DEFAULT '{}' CHECK(cardinality(completed_step_ids)<=100),
 checklist_snapshot jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(checklist_snapshot)='array'),
 note text CHECK(note IS NULL OR length(note)<=2500),
 evidence_links text[] NOT NULL DEFAULT '{}' CHECK(cardinality(evidence_links)<=5),
 UNIQUE(operation_id,scheduled_on,entry_number)
);
CREATE INDEX routine_date_progress_org_history_idx
 ON public.routine_date_progress(org_id,operation_id,scheduled_on,entry_number DESC);
ALTER TABLE public.routine_date_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.routine_date_progress FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.routine_date_progress TO authenticated;

CREATE POLICY routine_date_progress_read ON public.routine_date_progress
 FOR SELECT TO authenticated USING (
 org_id=public.app_org_id() AND public.app_stage2_universal_aal_allowed()
 AND EXISTS(SELECT 1 FROM public.recurring_operations r JOIN public.work_items w ON w.id=r.work_item_id
   WHERE r.id=routine_date_progress.operation_id AND r.org_id=routine_date_progress.org_id
   AND w.org_id=routine_date_progress.org_id AND public.app_can_see_item(w.id))
 );
CREATE POLICY routine_date_progress_write ON public.routine_date_progress
 FOR INSERT TO authenticated WITH CHECK (
 org_id=public.app_org_id() AND actor_id=auth.uid() AND public.app_stage2_universal_aal_allowed()
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.org_id=routine_date_progress.org_id AND p.active)
 AND EXISTS(SELECT 1 FROM public.recurring_operations r
   JOIN public.work_items w ON w.id=r.work_item_id AND w.org_id=r.org_id
   JOIN public.units u ON u.id=r.unit_id AND u.org_id=r.org_id AND u.active
   WHERE r.id=routine_date_progress.operation_id AND r.org_id=routine_date_progress.org_id
   AND r.active AND r.paused_at IS NULL AND w.kind='routine'
   AND w.visibility='unit' AND NOT w.confidential AND public.app_can_see_item(w.id)
   AND (r.unit_id IN(SELECT public.app_managed_units()) OR public.app_is_admin()
     OR (r.unit_id IN(SELECT public.app_my_units()) AND (w.assignee_id=auth.uid() OR w.assignee_id IS NULL))))
 );

-- Invoker trigger: source reads stay under RLS; the append-only table IS the
-- attributable date history. No elevation or client-writable activity_events.
CREATE FUNCTION public.stage2_stamp_routine_date_progress()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $progress$
DECLARE v_work uuid; v_zone text; v_previous integer; v_total integer;
BEGIN
 IF auth.uid() IS NULL OR NEW.org_id IS DISTINCT FROM public.app_org_id()
  OR NOT public.app_stage2_universal_aal_allowed() THEN
  RAISE EXCEPTION 'Sign in before recording routine progress.' USING ERRCODE='42501';
 END IF;
 SELECT r.work_item_id INTO v_work FROM public.recurring_operations r
  JOIN public.work_items w ON w.id=r.work_item_id AND w.org_id=r.org_id
  WHERE r.id=NEW.operation_id AND r.org_id=NEW.org_id AND public.app_can_see_item(w.id);
 IF v_work IS NULL THEN
  RAISE EXCEPTION 'That routine is not available to your account.' USING ERRCODE='42501';
 END IF;
 IF NEW.scheduled_on IS NULL OR NEW.scheduled_on<current_date-370 OR NEW.scheduled_on>current_date+1 THEN
  RAISE EXCEPTION 'Choose a routine date within the past year.' USING ERRCODE='22023';
 END IF;
 SELECT p.timezone INTO v_zone FROM public.routine_schedule_preview(ARRAY[v_work],NEW.scheduled_on,NEW.scheduled_on) p;
 IF v_zone IS NULL OR NEW.scheduled_on>(clock_timestamp() AT TIME ZONE v_zone)::date THEN
  RAISE EXCEPTION 'Choose today or an earlier scheduled date.' USING ERRCODE='22023';
 END IF;
 -- Serialize updates for a date, and refuse stale forms instead of losing work.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.operation_id::text||':'||NEW.scheduled_on::text,0));
 SELECT coalesce(max(p.entry_number),0) INTO v_previous FROM public.routine_date_progress p
  WHERE p.operation_id=NEW.operation_id AND p.scheduled_on=NEW.scheduled_on;
 IF NEW.entry_number IS DISTINCT FROM v_previous+1 THEN
  RAISE EXCEPTION 'This date has newer progress. Refresh it before saving.' USING ERRCODE='40001';
 END IF;
 IF NEW.completed_step_ids IS NULL OR cardinality(NEW.completed_step_ids)>100
  OR cardinality(NEW.completed_step_ids)<>(SELECT count(DISTINCT x) FROM unnest(NEW.completed_step_ids) x)
  OR EXISTS(SELECT 1 FROM unnest(NEW.completed_step_ids) x WHERE NOT EXISTS(
    SELECT 1 FROM public.checklist_items c WHERE c.id=x AND c.work_item_id=v_work)) THEN
  RAISE EXCEPTION 'Choose steps from this responsibility.' USING ERRCODE='22023';
 END IF;
 IF NEW.evidence_links IS NULL OR cardinality(NEW.evidence_links)>5 OR EXISTS(
  SELECT 1 FROM unnest(NEW.evidence_links) link WHERE link IS NULL OR length(link)>2000 OR link !~ '^https?://[^[:space:]]+$') THEN
  RAISE EXCEPTION 'Use at most five complete web evidence links.' USING ERRCODE='22023';
 END IF;
 SELECT count(*),coalesce(jsonb_agg(jsonb_build_object('id',c.id,'label',c.label,
  'done',c.id=ANY(NEW.completed_step_ids)) ORDER BY c.position,c.id),'[]'::jsonb)
 INTO v_total,NEW.checklist_snapshot FROM public.checklist_items c WHERE c.work_item_id=v_work;
 IF v_total>100 THEN RAISE EXCEPTION 'This routine has too many steps to verify.' USING ERRCODE='22023'; END IF;
 IF NEW.status='ready_for_review' AND cardinality(NEW.completed_step_ids)<>v_total THEN
  RAISE EXCEPTION 'Record every step before marking this date ready for review.' USING ERRCODE='22023';
 END IF;
 IF NEW.status='waiting_on' AND length(btrim(coalesce(NEW.note,'')))<3 THEN
  RAISE EXCEPTION 'Explain what this date is waiting on.' USING ERRCODE='22023';
 END IF;
 NEW.actor_id:=auth.uid(); NEW.recorded_at:=clock_timestamp();
 NEW.note:=nullif(btrim(coalesce(NEW.note,'')),'');
 RETURN NEW;
END;
$progress$;
REVOKE ALL ON FUNCTION public.stage2_stamp_routine_date_progress() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage2_stamp_routine_date_progress_before_insert
 BEFORE INSERT ON public.routine_date_progress FOR EACH ROW
 EXECUTE FUNCTION public.stage2_stamp_routine_date_progress();
COMMENT ON TABLE public.routine_date_progress IS
 'Append-only per-date routine checklist, factual progress and evidence links. Readiness is not completion or independent approval. Original outcomes and parent responsibility are unchanged.';
