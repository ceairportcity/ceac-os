-- 138 — Immutable Technical Support evidence registration audit (review only).
-- Preserve the completed 133/134 case-event ledger and link-file semantics.
-- A new private file is not marked uploaded/finalised merely because its
-- registration metadata was created. Record 'evidence_registered' only,
-- even if storage upload subsequently fails. Never store filenames,
-- credentials or protected employee content in support events.
-- The event is append-only and bound to current case/file organisation.

ALTER TABLE public.support_case_events
  DROP CONSTRAINT support_case_events_action_check;
ALTER TABLE public.support_case_events
  ADD CONSTRAINT support_case_events_action_check
  CHECK (action IN (
    'opened','state_changed','assigned','resolution_updated','evidence_registered'
  ));

CREATE OR REPLACE FUNCTION public.support_evidence_registration_audit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $support_audit$
BEGIN
  IF NEW.context_type<>'support_case' THEN
    RETURN NEW;
  END IF;
  IF NEW.relation<>'support_evidence'
    OR auth.uid() IS NULL
    OR NEW.org_id IS DISTINCT FROM public.app_org_id()
    OR NEW.linked_by IS DISTINCT FROM auth.uid()
    OR NOT EXISTS(
      SELECT 1 FROM public.operational_files f
      WHERE f.id=NEW.file_id AND f.org_id=NEW.org_id
        AND f.uploaded_by=auth.uid()
        AND f.storage_bucket='ceac-operational-private'
    )
    OR NOT EXISTS(
      SELECT 1 FROM public.support_cases sc
      WHERE sc.id=NEW.context_id AND sc.org_id=NEW.org_id
    )
  THEN
    RAISE EXCEPTION 'Support file registration is outside this case or organisation.'
      USING ERRCODE='42501';
  END IF;
  INSERT INTO public.support_case_events(org_id,case_id,actor_id,action,note)
  VALUES(NEW.org_id,NEW.context_id,auth.uid(),'evidence_registered',
    'Private evidence registration created; upload not yet verified');
  RETURN NEW;
END
$support_audit$;
REVOKE ALL ON FUNCTION public.support_evidence_registration_audit()
  FROM PUBLIC,anon,authenticated;

CREATE TRIGGER support_evidence_registration_audit
AFTER INSERT ON public.operational_file_links
FOR EACH ROW
WHEN (NEW.context_type='support_case')
EXECUTE FUNCTION public.support_evidence_registration_audit();

COMMENT ON FUNCTION public.support_evidence_registration_audit() IS
  'Append-only acknowledgement of a private Support file registration, not proof that bytes were uploaded or restored.';
