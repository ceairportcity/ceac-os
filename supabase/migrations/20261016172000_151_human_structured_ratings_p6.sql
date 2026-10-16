-- CEAC OS Stage 2 P6, forward-only, production NOT authorised.
-- Preserve all earlier appraisal entries, HR release records and applied migrations.
-- Human selections, never system scores; no new exposed SECURITY DEFINER RPC.
ALTER TABLE public.appraisal_cycles
  ADD COLUMN IF NOT EXISTS cadence text NOT NULL DEFAULT 'other'
  CHECK (cadence IN ('monthly','quarterly','other'));

CREATE OR REPLACE FUNCTION public.stage2_classify_appraisal_cycle()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $cycle$
BEGIN
  IF NEW.starts_on = date_trunc('quarter', NEW.starts_on)::date
     AND NEW.ends_on = (date_trunc('quarter', NEW.starts_on) + interval '3 months - 1 day')::date
  THEN NEW.cadence := 'quarterly';
  ELSIF NEW.starts_on = date_trunc('month', NEW.starts_on)::date
    AND NEW.ends_on = (date_trunc('month', NEW.starts_on) + interval '1 month - 1 day')::date
  THEN NEW.cadence := 'monthly';
  ELSE NEW.cadence := 'other';
  END IF;
  RETURN NEW;
END
$cycle$;
REVOKE ALL ON FUNCTION public.stage2_classify_appraisal_cycle() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS stage2_classify_appraisal_cycle ON public.appraisal_cycles;
CREATE TRIGGER stage2_classify_appraisal_cycle BEFORE INSERT ON public.appraisal_cycles
FOR EACH ROW EXECUTE FUNCTION public.stage2_classify_appraisal_cycle();

CREATE TABLE IF NOT EXISTS public.appraisal_structured_ratings(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id),
  appraisal_id uuid NOT NULL REFERENCES public.appraisals(id) ON DELETE RESTRICT,
  assessment_entry_id uuid NOT NULL UNIQUE REFERENCES public.appraisal_entries(id) ON DELETE RESTRICT,
  rubric_version integer NOT NULL DEFAULT 1 CHECK(rubric_version>0),
  categories jsonb NOT NULL,
  overall_rating text NOT NULL CHECK(overall_rating IN ('1','2','3','4','5','N/O')),
  overall_explanation text NOT NULL,
  strengths text NOT NULL,
  challenges text NOT NULL,
  next_steps text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appraisal_structured_ratings_one_version UNIQUE(appraisal_id,assessment_entry_id)
);
COMMENT ON TABLE public.appraisal_structured_ratings IS
  'Immutable human-entered, five-category reviewer ratings bound to one appraisal assessment entry version; never computed from Work, attendance or Compliance. Subject access only after HR publishes exact assessment version.';

CREATE OR REPLACE FUNCTION public.stage2_rating_payload_valid(p_categories jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $validate$
DECLARE
 k text;
 entry jsonb;
 cnt integer:=0;
BEGIN
 IF jsonb_typeof(p_categories) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 FOR k IN SELECT jsonb_object_keys(p_categories) LOOP
   cnt:=cnt+1;
   IF k <> ALL(ARRAY['delivery','quality','reliability','initiative','collaboration']) THEN RETURN false; END IF;
   entry:=p_categories->k;
   IF jsonb_typeof(entry) IS DISTINCT FROM 'object'
      OR (entry->>'rating') NOT IN ('1','2','3','4','5','N/O')
      OR length(btrim(coalesce(entry->>'reason','')))<8
      OR (entry ? 'evidence_refs' AND jsonb_typeof(entry->'evidence_refs') IS DISTINCT FROM 'array')
   THEN RETURN false; END IF;
 END LOOP;
 RETURN cnt=5;
END
$validate$;
-- The INSERT CHECK executes as authenticated; grant only this pure validator,
-- never the SECURITY DEFINER reviewer/HR-trigger helpers.
REVOKE ALL ON FUNCTION public.stage2_rating_payload_valid(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage2_rating_payload_valid(jsonb) TO authenticated;

ALTER TABLE public.appraisal_structured_ratings ADD CONSTRAINT appraisal_structured_ratings_valid
CHECK(public.stage2_rating_payload_valid(categories)
  AND length(btrim(overall_explanation))>=8
  AND length(btrim(strengths))>=3
  AND length(btrim(challenges))>=3
  AND length(btrim(next_steps))>=3);

-- Read identities carefully: only the assigned reviewer, independent HR,
-- or employee AFTER independently approved publication of that exact version.
ALTER TABLE public.appraisal_structured_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appraisal_structured_ratings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.appraisal_structured_ratings TO authenticated;

CREATE POLICY stage2_appraisal_rating_read ON public.appraisal_structured_ratings
FOR SELECT TO authenticated USING (
  org_id=public.app_org_id()
  AND EXISTS(
    SELECT 1 FROM public.appraisals a
    WHERE a.id=appraisal_id AND a.org_id=org_id
      AND (
        a.manager_id=auth.uid()
        OR (public.app_is_admin() AND public.app_has_capability('people.manage',null))
        OR (
          a.profile_id=auth.uid()
          AND a.status IN ('shared','closed')
          AND EXISTS(
            SELECT 1 FROM public.performance_review_release_requests rr
            WHERE rr.appraisal_id=a.id AND rr.state='approved'
              AND rr.requested_assessment_id=assessment_entry_id
          )
        )
      )
  )
);
CREATE POLICY stage2_appraisal_rating_insert ON public.appraisal_structured_ratings
FOR INSERT TO authenticated WITH CHECK (
  org_id=public.app_org_id()
  AND created_by=auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.appraisals a
    WHERE a.id=appraisal_id AND a.org_id=org_id
      AND a.manager_id=auth.uid() AND a.profile_id<>auth.uid()
      AND a.status NOT IN ('shared','closed')
  )
);
-- No UPDATE or DELETE grants. Corrections create a NEW assessment entry
-- and attach a NEW immutable human rating row to the replacement version.

CREATE OR REPLACE FUNCTION public.stage2_validate_rating_version_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $identity$
DECLARE
 a public.appraisals%rowtype;
 latest_entry uuid;
BEGIN
 IF auth.uid() IS NULL OR NEW.created_by IS DISTINCT FROM auth.uid()
   OR NEW.org_id IS DISTINCT FROM public.app_org_id()
 THEN RAISE EXCEPTION 'A signed-in, authorised reviewer is required.' USING errcode='42501'; END IF;
 SELECT * INTO a FROM public.appraisals WHERE id=NEW.appraisal_id AND org_id=NEW.org_id;
 IF a.id IS NULL OR a.manager_id IS DISTINCT FROM auth.uid()
   OR a.profile_id=auth.uid() OR a.status IN ('shared','closed')
 THEN RAISE EXCEPTION 'Only the assigned independent reviewer may record the unpublished review.' USING errcode='42501'; END IF;
 SELECT e.id INTO latest_entry FROM public.appraisal_entries e
 WHERE e.appraisal_id=a.id AND e.org_id=a.org_id
   AND e.entry_type='manager_assessment'
 ORDER BY e.created_at DESC,e.id DESC LIMIT 1;
 IF latest_entry IS DISTINCT FROM NEW.assessment_entry_id THEN
   RAISE EXCEPTION 'Ratings must be for the latest manager assessment version.' USING errcode='42501'; END IF;
 IF NEW.rubric_version<>1 THEN
   RAISE EXCEPTION 'The HR-governed rubric version is not published.' USING errcode='42501'; END IF;
 RETURN NEW;
END
$identity$;
REVOKE ALL ON FUNCTION public.stage2_validate_rating_version_insert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage2_rating_version_insert BEFORE INSERT ON public.appraisal_structured_ratings
FOR EACH ROW EXECUTE FUNCTION public.stage2_validate_rating_version_insert();

-- Independently authorised HR can record a reason when the employee cannot
-- reflect before a formal quarter; no invented employee statement.
CREATE TABLE IF NOT EXISTS public.appraisal_review_exceptions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id),
 appraisal_id uuid NOT NULL REFERENCES public.appraisals(id) ON DELETE RESTRICT,
 exception_type text NOT NULL CHECK(exception_type IN ('employee_reflection_unavailable')),
 reason text NOT NULL CHECK(length(btrim(reason))>=12),
 approved_by uuid NOT NULL REFERENCES public.profiles(id),
 approved_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(appraisal_id,exception_type)
);
ALTER TABLE public.appraisal_review_exceptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appraisal_review_exceptions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.appraisal_review_exceptions TO authenticated;
CREATE POLICY stage2_review_exception_read ON public.appraisal_review_exceptions
FOR SELECT TO authenticated USING (
 org_id=public.app_org_id()
 AND EXISTS (
  SELECT 1 FROM public.appraisals a WHERE a.id=appraisal_id
  AND (a.manager_id=auth.uid() OR
       (public.app_is_admin() AND public.app_has_capability('people.manage',null)))
 )
);
CREATE POLICY stage2_review_exception_write ON public.appraisal_review_exceptions
FOR INSERT TO authenticated WITH CHECK (
 org_id=public.app_org_id() AND approved_by=auth.uid()
 AND public.app_is_admin() AND public.app_has_capability('people.manage',null)
 AND EXISTS (SELECT 1 FROM public.appraisals a WHERE a.id=appraisal_id
   AND a.org_id=org_id AND a.manager_id IS DISTINCT FROM auth.uid())
);

-- Existing manager_request_release() remains the only supported entrypoint.
-- Reject premature quarterly requests at the actual DB insert boundary;
-- all monthly rating controls remain optional, not mandatory.
CREATE OR REPLACE FUNCTION public.stage2_quarterly_release_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $release$
DECLARE
 v_appraisal public.appraisals%rowtype;
 v_cycle public.appraisal_cycles%rowtype;
 v_quarterly boolean;
BEGIN
 SELECT * INTO v_appraisal FROM public.appraisals
 WHERE id=NEW.appraisal_id AND org_id=NEW.org_id;
 IF v_appraisal.id IS NULL THEN
   RAISE EXCEPTION 'Appraisal was not found.' USING errcode='42501';
 END IF;
 SELECT * INTO v_cycle FROM public.appraisal_cycles
 WHERE id=v_appraisal.cycle_id AND org_id=NEW.org_id;
 v_quarterly:=(v_cycle.cadence='quarterly'
   OR (v_cycle.starts_on=date_trunc('quarter',v_cycle.starts_on)::date
    AND v_cycle.ends_on=(date_trunc('quarter',v_cycle.starts_on)+interval '3 months - 1 day')::date));
 IF v_quarterly THEN
   IF NOT EXISTS(
     SELECT 1 FROM public.appraisal_structured_ratings rat
     WHERE rat.appraisal_id=v_appraisal.id
       AND rat.assessment_entry_id=NEW.requested_assessment_id
       AND rat.created_by=v_appraisal.manager_id
   ) THEN
     RAISE EXCEPTION 'Complete the five human-entered quarterly ratings and overall reviewer explanation before requesting HR release.' USING errcode='23514';
   END IF;
   IF NOT EXISTS(
     SELECT 1 FROM public.appraisal_entries e
     WHERE e.appraisal_id=v_appraisal.id AND e.entry_type='employee_reflection'
       AND e.created_by=v_appraisal.profile_id
   ) AND NOT EXISTS(
     SELECT 1 FROM public.appraisal_review_exceptions ex
     WHERE ex.appraisal_id=v_appraisal.id
       AND ex.exception_type='employee_reflection_unavailable'
       AND ex.approved_by IS DISTINCT FROM v_appraisal.manager_id
   ) THEN
     RAISE EXCEPTION 'Employee reflection or an independently approved HR exception is required for formal quarterly release.' USING errcode='23514';
   END IF;
 END IF;
 RETURN NEW;
END
$release$;
REVOKE ALL ON FUNCTION public.stage2_quarterly_release_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stage2_quarterly_release_guard BEFORE INSERT ON public.performance_review_release_requests
FOR EACH ROW EXECUTE FUNCTION public.stage2_quarterly_release_guard();
