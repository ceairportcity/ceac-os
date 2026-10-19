-- CEAC OS Stage 2 P6: one auditable official quarterly leadership review
-- event, independent from protected HR appraisal publication.
-- Executive or narrowly authorised Administration may initiate; neither gains
-- automatic access to unpublished people appraisals or Payroll.
CREATE TABLE public.quarterly_ministry_review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 meeting_on date NOT NULL,
 unit_submission_due_on date NOT NULL,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 160),
 purpose text NOT NULL CHECK (length(btrim(purpose)) BETWEEN 12 AND 2000),
 state text NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled','in_progress','closed')),
 initiated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 initiated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(org_id,starts_on,ends_on),
 CONSTRAINT quarter_event_dates CHECK(
  ends_on>=starts_on AND unit_submission_due_on BETWEEN starts_on AND meeting_on
  AND meeting_on>=ends_on)
);
CREATE INDEX stage2_quarter_review_org_date_idx
 ON public.quarterly_ministry_review_events(org_id,starts_on DESC);
ALTER TABLE public.quarterly_ministry_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quarterly_ministry_review_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.quarterly_ministry_review_events TO authenticated;

CREATE POLICY stage2_quarterly_review_event_read
 ON public.quarterly_ministry_review_events FOR SELECT TO authenticated
 USING(
  org_id=public.app_org_id() AND
  (public.app_is_exec() OR
   (public.app_is_admin() AND public.app_has_capability('performance.admin',NULL)))
 );
CREATE POLICY stage2_quarterly_review_event_insert
 ON public.quarterly_ministry_review_events FOR INSERT TO authenticated
 WITH CHECK(
  org_id=public.app_org_id() AND initiated_by=auth.uid() AND
  (public.app_is_exec() OR
   (public.app_is_admin() AND public.app_has_capability('performance.admin',NULL)))
 );

-- The trigger validates immutable calendar-quarter identity even against
-- manipulated PostgREST requests. No browser UPDATE/DELETE grants.
CREATE FUNCTION public.stage2_validate_quarter_review_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $guard$
BEGIN
 IF auth.uid() IS NULL OR NEW.initiated_by IS DISTINCT FROM auth.uid()
    OR NEW.org_id IS DISTINCT FROM public.app_org_id()
    OR NOT (public.app_is_exec() OR
      (public.app_is_admin() AND public.app_has_capability('performance.admin',NULL)))
 THEN RAISE EXCEPTION 'Only an authorised Executive or Administration initiator can open a quarter.'
   USING ERRCODE='42501'; END IF;
 IF extract(month from NEW.starts_on) NOT IN (1,4,7,10)
    OR NEW.starts_on<>date_trunc('month',NEW.starts_on::timestamp)::date
    OR NEW.ends_on<>(NEW.starts_on+interval '3 months'-interval '1 day')::date
 THEN RAISE EXCEPTION 'A quarterly meeting must use an exact Ghana calendar quarter.'; END IF;
 IF NEW.meeting_on<NEW.ends_on OR NEW.unit_submission_due_on>NEW.meeting_on
    OR NEW.unit_submission_due_on<NEW.starts_on
 THEN RAISE EXCEPTION 'Review date and submission deadline are outside the valid review period.'; END IF;
 NEW.initiated_at:=clock_timestamp();
 NEW.state:='scheduled';
 INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 VALUES(NEW.org_id,NEW.initiated_by,'quarterly_ministry_review_initiated',
 'quarterly_ministry_review',NEW.id,
 jsonb_build_object('starts_on',NEW.starts_on,'ends_on',NEW.ends_on,
 'meeting_on',NEW.meeting_on,'unit_submission_due_on',NEW.unit_submission_due_on));
 RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION public.stage2_validate_quarter_review_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage2_validate_quarter_review_event
 BEFORE INSERT ON public.quarterly_ministry_review_events FOR EACH ROW
 EXECUTE FUNCTION public.stage2_validate_quarter_review_event();

-- Migrations 150 and 152 can be developed on isolated branches. At final
-- integration, migration 150 precedes this one and must gate this new table,
-- too. The default-off branch still rehearses ordinary role RLS independently.
DO $mfa_compat$
BEGIN
 IF to_regprocedure('public.app_stage2_universal_aal_allowed()') IS NOT NULL THEN
  EXECUTE 'CREATE POLICY stage2_universal_totp_gate ON public.quarterly_ministry_review_events AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.app_stage2_universal_aal_allowed())) WITH CHECK ((SELECT public.app_stage2_universal_aal_allowed()))';
 END IF;
END;
$mfa_compat$;
