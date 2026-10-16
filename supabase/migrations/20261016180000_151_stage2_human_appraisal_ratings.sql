-- CEAC Stage 2 P6: human-entered rating versions within EXISTING appraisal cases.
-- Future-only. Never changes issued HR reviews or assumes auto-generated scores.
-- Production apply and Auth cutover require a separate explicit owner P9 GO.
ALTER TABLE public.appraisal_cycles
  ADD COLUMN IF NOT EXISTS stage2_cadence text NOT NULL DEFAULT 'legacy_or_other'
  CHECK (stage2_cadence IN ('legacy_or_other','month','quarter'));

-- Identify calendar-aligned NEW cycles. Do not rewrite historical cycle identity.
CREATE FUNCTION public.stage2_classify_new_appraisal_cycle()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $cycle$
BEGIN
 IF NEW.starts_on = date_trunc('month',NEW.starts_on::timestamp)::date
    AND NEW.ends_on = (NEW.starts_on + interval '1 month' - interval '1 day')::date
 THEN NEW.stage2_cadence:='month';
 ELSIF extract(month from NEW.starts_on) IN (1,4,7,10)
    AND NEW.starts_on = date_trunc('month',NEW.starts_on::timestamp)::date
    AND NEW.ends_on = (NEW.starts_on + interval '3 months' - interval '1 day')::date
 THEN NEW.stage2_cadence:='quarter';
 ELSE NEW.stage2_cadence:='legacy_or_other';
 END IF;
 RETURN NEW;
END;
$cycle$;
REVOKE ALL ON FUNCTION public.stage2_classify_new_appraisal_cycle() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage2_classify_new_appraisal_cycle
BEFORE INSERT ON public.appraisal_cycles FOR EACH ROW
EXECUTE FUNCTION public.stage2_classify_new_appraisal_cycle();

CREATE TABLE public.appraisal_human_rating_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
 appraisal_id uuid NOT NULL REFERENCES public.appraisals(id) ON DELETE RESTRICT,
 assessment_entry_id uuid NOT NULL UNIQUE REFERENCES public.appraisal_entries(id) ON DELETE RESTRICT,
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 cadence text NOT NULL CHECK (cadence IN ('month','quarter')),
 rubric_version integer NOT NULL DEFAULT 1 CHECK (rubric_version>=1),
 category_ratings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(category_ratings)='object'),
 overall_rating text CHECK (overall_rating IN ('1','2','3','4','5','N/O')),
 overall_narrative text,
 strengths text,
 challenges text,
 next_actions text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT appraisal_rating_no_self_review CHECK (profile_id <> reviewer_id)
);
CREATE INDEX stage2_appraisal_human_ratings_case_idx
 ON public.appraisal_human_rating_versions(org_id,appraisal_id,created_at DESC);
ALTER TABLE public.appraisal_human_rating_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appraisal_human_rating_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.appraisal_human_rating_versions TO authenticated;

-- The reviewer may see their own authored protected version, HR may review it,
-- and an employee sees only a version tied to an independently HR-approved
-- manager-assessment ID and later publication decision. Not published elsewhere.
CREATE POLICY stage2_appraisal_human_rating_select
 ON public.appraisal_human_rating_versions FOR SELECT TO authenticated
 USING (
  org_id=public.app_org_id() AND (
   reviewer_id=auth.uid()
   OR (public.app_is_admin() AND public.app_has_capability('people.manage',NULL))
   OR (profile_id=auth.uid() AND EXISTS(
     SELECT 1 FROM public.performance_review_release_requests p
     WHERE p.appraisal_id=appraisal_human_rating_versions.appraisal_id
       AND p.org_id=appraisal_human_rating_versions.org_id
       AND p.requested_assessment_id=appraisal_human_rating_versions.assessment_entry_id
       AND p.state='approved'
       AND p.decided_at>=appraisal_human_rating_versions.created_at
   ))
  )
 );
CREATE POLICY stage2_appraisal_human_rating_insert
 ON public.appraisal_human_rating_versions FOR INSERT TO authenticated
 WITH CHECK (
  org_id=public.app_org_id() AND reviewer_id=auth.uid()
  AND EXISTS (
   SELECT 1 FROM public.appraisals a
   WHERE a.id=appraisal_id AND a.org_id=appraisal_human_rating_versions.org_id
     AND a.profile_id=appraisal_human_rating_versions.profile_id
     AND a.manager_id=auth.uid()
     AND a.manager_id<>a.profile_id
     AND a.status NOT IN ('closed','shared')
  )
 );

-- Database validation is authoritative: client-side dropdowns are NOT an
-- appraisal security boundary. Direct PostgREST inserts obey the same rules.
CREATE FUNCTION public.stage2_validate_human_appraisal_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $validate$
DECLARE
 v_review public.appraisals%rowtype;
 v_cycle public.appraisal_cycles%rowtype;
 v_latest uuid;
 v_dimension text;
 v_record jsonb;
 v_rating text;
 v_evidence text;
 v_evidence_uuid uuid;
BEGIN
 SELECT * INTO v_review FROM public.appraisals
 WHERE id=NEW.appraisal_id AND org_id=NEW.org_id FOR UPDATE;
 IF v_review.id IS NULL OR auth.uid() IS NULL
    OR v_review.manager_id IS DISTINCT FROM auth.uid()
    OR NEW.reviewer_id IS DISTINCT FROM auth.uid()
    OR NEW.profile_id IS DISTINCT FROM v_review.profile_id
    OR v_review.profile_id=auth.uid()
    OR v_review.status IN ('closed','shared')
 THEN RAISE EXCEPTION 'Only the independently assigned reviewer may record an active review.'
   USING ERRCODE='42501'; END IF;
 SELECT * INTO v_cycle FROM public.appraisal_cycles
 WHERE id=v_review.cycle_id AND org_id=v_review.org_id;
 IF v_cycle.id IS NULL OR v_cycle.stage2_cadence NOT IN ('month','quarter')
    OR NEW.cadence IS DISTINCT FROM v_cycle.stage2_cadence
 THEN RAISE EXCEPTION 'Human ratings require the calendar-aligned review cadence.'
   USING ERRCODE='42501'; END IF;
 SELECT id INTO v_latest FROM public.appraisal_entries
 WHERE appraisal_id=v_review.id AND org_id=v_review.org_id
   AND entry_type='manager_assessment' AND created_by=auth.uid()
 ORDER BY created_at DESC,id DESC LIMIT 1;
 IF v_latest IS NULL OR NEW.assessment_entry_id IS DISTINCT FROM v_latest
 THEN RAISE EXCEPTION 'First record the current Manager-authored assessment and attach ratings to that version.'
   USING ERRCODE='42501'; END IF;
 IF EXISTS (
  SELECT 1 FROM public.performance_review_release_requests req
  WHERE req.appraisal_id=v_review.id AND req.requested_assessment_id=v_latest
    AND req.state IN ('pending','approved')
 ) THEN RAISE EXCEPTION 'An HR review or approved publication exists. Revise the assessment before changing ratings.'
   USING ERRCODE='42501'; END IF;

 FOREACH v_dimension IN ARRAY ARRAY['delivery','quality','reliability','initiative','collaboration'] LOOP
  v_record:=NEW.category_ratings->v_dimension;
  IF v_record IS NULL THEN
    IF NEW.cadence='quarter' THEN
      RAISE EXCEPTION 'Quarterly Manager review requires category %.',v_dimension;
    END IF;
    CONTINUE;
  END IF;
  IF jsonb_typeof(v_record)<>'object' THEN
    RAISE EXCEPTION 'Each category must be an object.'; END IF;
  v_rating:=v_record->>'rating';
  IF v_rating IS NULL OR v_rating NOT IN ('1','2','3','4','5','N/O')
    OR length(btrim(coalesce(v_record->>'reason','')))<4
  THEN RAISE EXCEPTION 'Category % needs a human-selected 1-5/N/O rating and specific explanation.',v_dimension;
  END IF;
  IF jsonb_typeof(v_record->'evidenceIds') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Category % must explicitly list its evidence IDs.',v_dimension;
  END IF;
  IF v_rating<>'N/O' AND jsonb_array_length(v_record->'evidenceIds')=0 THEN
    RAISE EXCEPTION 'Category % needs real linked evidence or an explained N/O.',v_dimension;
  END IF;
  FOR v_evidence IN SELECT jsonb_array_elements_text(v_record->'evidenceIds') LOOP
    IF v_evidence !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'An evidence identifier is malformed.'; END IF;
    v_evidence_uuid:=v_evidence::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM public.appraisal_evidence_items ev
      WHERE ev.id=v_evidence_uuid AND ev.appraisal_id=v_review.id
        AND ev.org_id=v_review.org_id AND ev.profile_id=v_review.profile_id
    ) THEN RAISE EXCEPTION 'Evidence must belong to this employee review.'
      USING ERRCODE='42501'; END IF;
  END LOOP;
 END LOOP;
 IF EXISTS (
   SELECT 1 FROM jsonb_object_keys(NEW.category_ratings) key
   WHERE key NOT IN ('delivery','quality','reliability','initiative','collaboration')
 ) THEN RAISE EXCEPTION 'Unapproved appraisal rubric category.'; END IF;
 IF NEW.cadence='quarter' OR NEW.overall_rating IS NOT NULL THEN
  IF NEW.overall_rating NOT IN ('1','2','3','4','5','N/O')
    OR length(btrim(coalesce(NEW.overall_narrative,'')))<8
    OR length(btrim(coalesce(NEW.strengths,'')))<3
    OR length(btrim(coalesce(NEW.challenges,'')))<3
    OR length(btrim(coalesce(NEW.next_actions,'')))<3
  THEN RAISE EXCEPTION 'Human-selected overall rating, narrative, strengths, challenges and next actions required.';
  END IF;
 END IF;
 IF NEW.cadence='quarter' AND NOT EXISTS (
  SELECT 1 FROM public.appraisal_entries ent
  WHERE ent.appraisal_id=v_review.id AND ent.org_id=v_review.org_id
    AND ent.entry_type='employee_reflection' AND ent.created_by=v_review.profile_id
 ) THEN
   RAISE EXCEPTION 'Quarterly review requires a genuine employee reflection or independently authorised exception.'
   USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$validate$;
REVOKE ALL ON FUNCTION public.stage2_validate_human_appraisal_rating() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage2_validate_human_appraisal_rating
BEFORE INSERT ON public.appraisal_human_rating_versions FOR EACH ROW
EXECUTE FUNCTION public.stage2_validate_human_appraisal_rating();

-- Retain existing HR release request/decision architecture and prevent
-- quarterly publication without the exact Manager-authored rubric version.
CREATE FUNCTION public.stage2_require_quarterly_ratings_for_release()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $release$
DECLARE v_kind text;
BEGIN
 SELECT c.stage2_cadence INTO v_kind
 FROM public.appraisals a JOIN public.appraisal_cycles c
 ON c.id=a.cycle_id AND c.org_id=a.org_id
 WHERE a.id=NEW.appraisal_id AND a.org_id=NEW.org_id;
 IF v_kind='quarter' AND NOT EXISTS (
  SELECT 1 FROM public.appraisal_human_rating_versions r
  WHERE r.appraisal_id=NEW.appraisal_id AND r.org_id=NEW.org_id
    AND r.assessment_entry_id=NEW.requested_assessment_id
    AND r.cadence='quarter'
 ) THEN
  RAISE EXCEPTION 'Quarterly review requires completed human-entered Manager category and overall ratings before independent HR release.'
   USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$release$;
REVOKE ALL ON FUNCTION public.stage2_require_quarterly_ratings_for_release() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage2_require_quarterly_ratings_for_release
BEFORE INSERT ON public.performance_review_release_requests FOR EACH ROW
EXECUTE FUNCTION public.stage2_require_quarterly_ratings_for_release();

-- Immutable rows (no browser UPDATE/DELETE and no table rewrite); append-only
-- event created with actual reviewer and version ID.
CREATE FUNCTION public.stage2_audit_human_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $audit$
BEGIN
 INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 VALUES (NEW.org_id,NEW.reviewer_id,'human_appraisal_rating_recorded','appraisal',NEW.appraisal_id,
   jsonb_build_object('rating_version_id',NEW.id,'assessment_entry_id',NEW.assessment_entry_id,
                      'cadence',NEW.cadence,'rubric_version',NEW.rubric_version));
 RETURN NEW;
END;
$audit$;
REVOKE ALL ON FUNCTION public.stage2_audit_human_rating() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage2_audit_human_rating
AFTER INSERT ON public.appraisal_human_rating_versions FOR EACH ROW
EXECUTE FUNCTION public.stage2_audit_human_rating();
