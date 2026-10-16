-- 151 — Stage 2 owner-approved Manager-authored 1–5 / N/O structured rubric.
-- Additive and forward-only. DO NOT apply to production without separate P9 GO.
-- Does not alter legacy performance collection/review publication RPCs, only
-- attaches a quarterly-only completeness guard to their established HR path.
ALTER TABLE public.appraisal_cycles
  ADD COLUMN IF NOT EXISTS review_cadence text NOT NULL DEFAULT 'legacy'
    CHECK (review_cadence IN ('legacy','monthly','quarterly')),
  ADD COLUMN IF NOT EXISTS presentation_on date,
  ADD COLUMN IF NOT EXISTS department_submission_due_on date;

-- For the approved five-category rubric, the entire version is a single
-- append-only, human-authored document. No weighted or averaged employee score.
CREATE OR REPLACE FUNCTION public.stage2_validate_human_ratings(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $validate$
DECLARE row jsonb; evidence jsonb; category text; seen text[] := ARRAY[]::text[];
BEGIN
 IF value IS NULL OR jsonb_typeof(value) <> 'array' OR jsonb_array_length(value) <> 5 THEN RETURN false; END IF;
 FOR row IN SELECT jsonb_array_elements(value) LOOP
   IF jsonb_typeof(row) <> 'object' THEN RETURN false; END IF;
   category := row->>'category';
   IF category IS NULL OR NOT category = ANY(ARRAY['delivery','quality','ownership','initiative','collaboration'])
      OR category = ANY(seen) THEN RETURN false; END IF;
   seen := array_append(seen,category);
   IF coalesce(row->>'rating','') <> ALL(ARRAY['1','2','3','4','5','N/O']) THEN RETURN false; END IF;
   IF length(btrim(coalesce(row->>'explanation',''))) NOT BETWEEN 12 AND 1500 THEN RETURN false; END IF;
   evidence := row->'evidenceIds';
   IF evidence IS NULL OR jsonb_typeof(evidence) <> 'array' OR jsonb_array_length(evidence)>30 THEN RETURN false; END IF;
   IF row->>'rating'<>'N/O' AND jsonb_array_length(evidence)=0 THEN RETURN false; END IF;
 END LOOP;
 RETURN array_length(seen,1)=5;
EXCEPTION WHEN others THEN RETURN false;
END;
$validate$;
REVOKE ALL ON FUNCTION public.stage2_validate_human_ratings(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.stage2_validate_human_ratings(jsonb) TO authenticated;

CREATE TABLE public.appraisal_human_rating_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
 appraisal_id uuid NOT NULL REFERENCES public.appraisals(id) ON DELETE RESTRICT,
 assessment_entry_id uuid NOT NULL REFERENCES public.appraisal_entries(id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 rubric_version integer NOT NULL DEFAULT 1 CHECK (rubric_version>=1),
 category_ratings jsonb NOT NULL
   CHECK (public.stage2_validate_human_ratings(category_ratings)),
 overall_rating text NOT NULL CHECK (overall_rating IN ('1','2','3','4','5','N/O')),
 overall_narrative text NOT NULL CHECK (length(btrim(overall_narrative)) BETWEEN 12 AND 3000),
 strengths text NOT NULL CHECK (length(btrim(strengths)) BETWEEN 12 AND 3000),
 challenges text NOT NULL CHECK (length(btrim(challenges)) BETWEEN 12 AND 3000),
 improvement_actions text NOT NULL CHECK (length(btrim(improvement_actions)) BETWEEN 12 AND 3000),
 next_responsibilities text NOT NULL CHECK (length(btrim(next_responsibilities)) BETWEEN 12 AND 3000),
 supersedes_id uuid UNIQUE REFERENCES public.appraisal_human_rating_versions(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appraisal_human_rating_case_idx
  ON public.appraisal_human_rating_versions(appraisal_id,created_at DESC,id DESC);
CREATE INDEX appraisal_human_rating_org_idx
  ON public.appraisal_human_rating_versions(org_id,created_by,created_at DESC);
ALTER TABLE public.appraisal_human_rating_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appraisal_human_rating_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.appraisal_human_rating_versions TO authenticated;

ALTER TABLE public.performance_review_release_requests
  ADD COLUMN IF NOT EXISTS human_rating_version_id uuid
    REFERENCES public.appraisal_human_rating_versions(id) ON DELETE RESTRICT;

-- The employee sees ONLY an independently HR-approved, specifically pinned
-- version, never the latest unpublished revision or the release-request notes.
CREATE FUNCTION public.stage2_employee_human_rating_visible(p_version_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $visibility$
 SELECT coalesce(EXISTS(
   SELECT 1 FROM public.appraisal_human_rating_versions v
   JOIN public.appraisals a ON a.id=v.appraisal_id AND a.org_id=v.org_id
   JOIN public.performance_review_release_requests req
     ON req.human_rating_version_id=v.id
       AND req.appraisal_id=a.id AND req.org_id=a.org_id
   WHERE v.id=p_version_id
     AND a.org_id=public.app_org_id()
     AND a.profile_id=auth.uid()
     AND req.state='approved'
     AND req.decided_at>=v.created_at
 ),false);
$visibility$;
REVOKE ALL ON FUNCTION public.stage2_employee_human_rating_visible(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.stage2_employee_human_rating_visible(uuid) TO authenticated;

CREATE POLICY stage2_human_rating_read ON public.appraisal_human_rating_versions
FOR SELECT TO authenticated USING(
 org_id=public.app_org_id()
 AND EXISTS(SELECT 1 FROM public.appraisals a
  WHERE a.id=appraisal_id AND a.org_id=org_id AND (
   a.manager_id=auth.uid()
   OR (public.app_is_admin() AND public.app_has_capability('people.manage',null))
   OR (a.profile_id=auth.uid() AND public.stage2_employee_human_rating_visible(id))
  ))
);
CREATE POLICY stage2_human_rating_insert ON public.appraisal_human_rating_versions
FOR INSERT TO authenticated WITH CHECK(
 org_id=public.app_org_id()
 AND created_by=auth.uid()
 AND EXISTS(SELECT 1 FROM public.appraisals a
   WHERE a.id=appraisal_id AND a.org_id=org_id
     AND a.manager_id=auth.uid() AND a.profile_id<>auth.uid()
     AND a.status<>'closed')
);

-- Untrusted client payloads must never be able to attach another employee's
-- evidence or falsify the reviewer/assessment/supersession chain.
CREATE FUNCTION public.stage2_guard_human_rating_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $guard$
DECLARE review public.appraisals%ROWTYPE;
  assessment public.appraisal_entries%ROWTYPE;
  prior public.appraisal_human_rating_versions%ROWTYPE;
  row jsonb; e text; e_id uuid; count_e integer; actual_count integer;
BEGIN
 IF auth.uid() IS NULL OR NEW.created_by<>auth.uid() OR NEW.org_id<>public.app_org_id() THEN
  RAISE EXCEPTION 'Signed-in reviewer required.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO review FROM public.appraisals
 WHERE id=NEW.appraisal_id AND org_id=NEW.org_id FOR UPDATE;
 IF review.id IS NULL OR review.manager_id<>auth.uid()
   OR review.profile_id=auth.uid() OR review.status='closed' THEN
  RAISE EXCEPTION 'Only the current independent reviewer may record judgments.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO assessment FROM public.appraisal_entries
 WHERE id=NEW.assessment_entry_id AND appraisal_id=review.id
   AND org_id=review.org_id AND entry_type='manager_assessment'
   AND created_by=auth.uid();
 IF assessment.id IS NULL OR assessment.id<>(
   SELECT id FROM public.appraisal_entries
   WHERE appraisal_id=review.id AND entry_type='manager_assessment'
   ORDER BY created_at DESC,id DESC LIMIT 1
 ) THEN RAISE EXCEPTION 'Record or select the latest own Manager assessment first.' USING ERRCODE='42501'; END IF;
 IF NEW.supersedes_id IS NOT NULL THEN
   SELECT * INTO prior FROM public.appraisal_human_rating_versions
   WHERE id=NEW.supersedes_id AND appraisal_id=review.id;
   IF prior.id IS NULL THEN
     RAISE EXCEPTION 'Revisions must supersede a version of the same case.' USING ERRCODE='42501';
   END IF;
 END IF;
 FOR row IN SELECT jsonb_array_elements(NEW.category_ratings) LOOP
   count_e:=jsonb_array_length(row->'evidenceIds');
   SELECT count(DISTINCT x.value) INTO actual_count
   FROM jsonb_array_elements_text(row->'evidenceIds') AS x(value)
   WHERE x.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     AND EXISTS (SELECT 1 FROM public.appraisal_evidence_items proof
       WHERE proof.id=x.value::uuid AND proof.appraisal_id=review.id
         AND proof.org_id=review.org_id AND proof.profile_id=review.profile_id);
   IF actual_count<>count_e THEN
     RAISE EXCEPTION 'Each evidence reference must belong to this employee review.' USING ERRCODE='42501';
   END IF;
 END LOOP;
 RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION public.stage2_guard_human_rating_insert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage2_validate_human_rating BEFORE INSERT
 ON public.appraisal_human_rating_versions FOR EACH ROW
 EXECUTE FUNCTION public.stage2_guard_human_rating_insert();

-- The previously approved Manager -> independent HR release path remains
-- authoritative. Its INSERT/approval is refused if a quarterly human rubric
-- is incomplete, missing, superseded or changed after the requested version.
CREATE FUNCTION public.stage2_guard_quarterly_hr_release()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $release$
DECLARE review public.appraisals%ROWTYPE; cadence text;
 rating public.appraisal_human_rating_versions%ROWTYPE;
 latest_id uuid;
BEGIN
 SELECT a.* INTO review FROM public.appraisals a
 WHERE a.id=NEW.appraisal_id AND a.org_id=NEW.org_id;
 IF review.id IS NULL THEN RETURN NEW; END IF;
 SELECT review_cadence INTO cadence FROM public.appraisal_cycles WHERE id=review.cycle_id AND org_id=review.org_id;
 IF cadence<>'quarterly' THEN RETURN NEW; END IF;
 SELECT * INTO rating FROM public.appraisal_human_rating_versions
 WHERE appraisal_id=review.id AND assessment_entry_id=NEW.requested_assessment_id
 ORDER BY created_at DESC,id DESC LIMIT 1;
 SELECT id INTO latest_id FROM public.appraisal_human_rating_versions
 WHERE appraisal_id=review.id ORDER BY created_at DESC,id DESC LIMIT 1;
 IF rating.id IS NULL OR latest_id<>rating.id OR rating.created_by<>NEW.requested_by THEN
  RAISE EXCEPTION 'Quarterly release requires a current complete Manager-entered rubric for this assessment.' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.appraisal_entries e
   WHERE e.appraisal_id=review.id AND e.entry_type='employee_reflection')
 THEN RAISE EXCEPTION 'Quarterly formal review requires the employee reflection or an attributed HR exception.' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
   NEW.human_rating_version_id:=rating.id;
 ELSIF NEW.state='approved' THEN
   IF OLD.human_rating_version_id IS DISTINCT FROM rating.id THEN
    RAISE EXCEPTION 'The rating version changed; request independent HR review again.' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END;
$release$;
REVOKE ALL ON FUNCTION public.stage2_guard_quarterly_hr_release() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage2_quarterly_hr_release_insert BEFORE INSERT
 ON public.performance_review_release_requests FOR EACH ROW
 EXECUTE FUNCTION public.stage2_guard_quarterly_hr_release();
CREATE TRIGGER stage2_quarterly_hr_release_decision BEFORE UPDATE OF state
 ON public.performance_review_release_requests FOR EACH ROW
 EXECUTE FUNCTION public.stage2_guard_quarterly_hr_release();

COMMENT ON TABLE public.appraisal_human_rating_versions IS
 'Owner Stage 2: versioned Manager-selected five-category evidence-linked judgments, monthly optional/quarterly mandatory; never machine-calculated, only HR-published to employee.';

-- Classification/initiation UI is a separately reviewed Stage 2 integration
-- step. Existing historical cycles are intentionally classified LEGACY.
-- This migration does NOT recategorise or publish old performance cases.
