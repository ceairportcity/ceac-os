-- Optional confidential project close contribution remarks, one attributable person at a time.
-- Independent of operational project closure and NOT released to employee by insertion.
CREATE TABLE public.project_person_contribution_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
 project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
 project_close_id uuid REFERENCES public.project_closes(id) ON DELETE RESTRICT,
 subject_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 subject_unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
 period_start date,
 period_end date,
 narrative text NOT NULL CHECK (length(btrim(narrative)) BETWEEN 20 AND 6000),
 evidence_note text CHECK (length(evidence_note)<=3000),
 next_action text CHECK (length(next_action)<=1500),
 supersedes_id uuid UNIQUE REFERENCES public.project_person_contribution_assessments(id) ON DELETE RESTRICT,
 written_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT project_person_no_self_review CHECK(subject_profile_id<>reviewer_id),
 CONSTRAINT project_person_valid_period CHECK(period_start IS NULL OR period_end IS NULL OR period_start<=period_end)
);
CREATE INDEX project_person_close_evidence_idx
 ON public.project_person_contribution_assessments(org_id,project_id,subject_profile_id,written_at DESC);
ALTER TABLE public.project_person_contribution_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_person_contribution_assessments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.project_person_contribution_assessments TO authenticated;

-- Draft assessment text is restricted to its author and independently authorised HR.
-- This does NOT grant a subject access to unpublished project appraisal text.
CREATE POLICY stage2_project_person_private_review_read
 ON public.project_person_contribution_assessments FOR SELECT TO authenticated
 USING(org_id=public.app_org_id()
   AND public.app_stage2_universal_aal_allowed()
   AND (reviewer_id=auth.uid() OR
     (public.app_is_admin() AND public.app_has_capability('people.manage',NULL))));

CREATE FUNCTION public.stage2_record_project_person_assessment(
 p_project_id uuid,
 p_subject_profile_id uuid,
 p_narrative text,
 p_evidence_note text DEFAULT NULL,
 p_next_action text DEFAULT NULL,
 p_project_close_id uuid DEFAULT NULL,
 p_period_start date DEFAULT NULL,
 p_period_end date DEFAULT NULL
) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $record$
DECLARE
 v_org uuid:=public.app_org_id();
 v_unit uuid;
 v_id uuid:=gen_random_uuid();
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.app_stage2_universal_aal_allowed()
 THEN RAISE EXCEPTION 'Signed-in authorised manager required.' USING ERRCODE='42501'; END IF;
 IF p_subject_profile_id IS NULL OR p_subject_profile_id=auth.uid()
 THEN RAISE EXCEPTION 'A manager cannot assess their own contribution.' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_narrative,''))) NOT BETWEEN 20 AND 6000
 THEN RAISE EXCEPTION 'Provide a specific narrative of 20–6000 characters.'; END IF;
 IF p_period_start IS NOT NULL AND p_period_end IS NOT NULL AND p_period_start>p_period_end
 THEN RAISE EXCEPTION 'Assessment period is invalid.'; END IF;
 IF p_project_close_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.project_closes pc WHERE pc.id=p_project_close_id
    AND pc.project_id=p_project_id AND pc.org_id=v_org)
 THEN RAISE EXCEPTION 'The selected project close revision is invalid.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_subject_profile_id AND p.org_id=v_org)
 THEN RAISE EXCEPTION 'This person does not belong to the organisation.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=p_project_id AND p.org_id=v_org)
 THEN RAISE EXCEPTION 'This project is not available.' USING ERRCODE='42501'; END IF;
 -- The actor must legitimately manage the affected person's unit, and
 -- the subject must have a real work assignment or attributable activity
 -- within this project. No general organisation-wide manager observation.
 SELECT wi.unit_id INTO v_unit
 FROM public.work_items wi
 WHERE wi.project_id=p_project_id AND wi.org_id=v_org AND wi.assignee_id=p_subject_profile_id
   AND wi.visibility<>'private'
   AND wi.confidential=false
   AND wi.unit_id IN (SELECT public.app_managed_units())
 ORDER BY wi.created_at DESC LIMIT 1;
 IF v_unit IS NULL THEN
  SELECT wi.unit_id INTO v_unit
  FROM public.work_activity_records act
  JOIN public.work_items wi ON wi.id=act.work_item_id AND wi.org_id=act.org_id
  WHERE act.org_id=v_org AND act.source_project_id=p_project_id
   AND act.contributor_id=p_subject_profile_id
   AND wi.unit_id IN (SELECT public.app_managed_units())
   AND wi.visibility<>'private'
   AND wi.confidential=false
  ORDER BY act.recorded_at DESC LIMIT 1;
 END IF;
 IF v_unit IS NULL
 THEN RAISE EXCEPTION 'No supervised individual contribution exists for this person in this project.' USING ERRCODE='42501'; END IF;
 INSERT INTO public.project_person_contribution_assessments(
  id,org_id,project_id,project_close_id,subject_profile_id,reviewer_id,subject_unit_id,
  period_start,period_end,narrative,evidence_note,next_action
 ) VALUES (v_id,v_org,p_project_id,p_project_close_id,p_subject_profile_id,auth.uid(),v_unit,
  p_period_start,p_period_end,btrim(p_narrative),nullif(btrim(coalesce(p_evidence_note,'')),''),
  nullif(btrim(coalesce(p_next_action,'')),''));
 INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 VALUES(v_org,auth.uid(),'project_person_assessment_recorded','project',p_project_id,
   jsonb_build_object('assessment_id',v_id,'subject_profile_id',p_subject_profile_id,
     'project_close_id',p_project_close_id,'publication','hr_restricted_draft'));
 RETURN v_id;
END;
$record$;
REVOKE ALL ON FUNCTION public.stage2_record_project_person_assessment(uuid,uuid,text,text,text,uuid,date,date)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage2_record_project_person_assessment(uuid,uuid,text,text,text,uuid,date,date)
 TO authenticated;
COMMENT ON TABLE public.project_person_contribution_assessments IS
 'Manager-authored optional per-person project contribution remarks; unpublished protected appraisal input requiring independent HR handling.';
