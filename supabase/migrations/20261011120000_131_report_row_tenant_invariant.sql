-- 131 — Enforce tenant integrity for EVERY report row write (review-only).
-- Live reports ACL grants authenticated INSERT/UPDATE, whose original RLS
-- only checks the report's own org and role, not the referenced period,
-- unit or project organisations. Thus a permitted direct PostgREST draft
-- INSERT/UPDATE can bypass save_report_draft's forward 127 tenant checks.
-- Add a dedicated DB invariant for both RPC and any legacy direct DML path,
-- preserving the existing report grants and legitimate user experience.
-- In production, read-only audit found 1 report and 0 invalid linked orgs.
-- No backfill or destructive changes. Requires full disposable replay,
-- cross-tenant browser SQL tests, encrypted restored backup and approval.

CREATE OR REPLACE FUNCTION public.guard_report_tenant_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.report_periods rp
    WHERE rp.id = NEW.period_id AND rp.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Reporting period is outside the report organisation.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.unit_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.units u
    WHERE u.id = NEW.unit_id AND u.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Reporting unit is outside the report organisation.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.project_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.projects p
    WHERE p.id = NEW.project_id AND p.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Reporting project is outside the report organisation.'
      USING ERRCODE = '42501';
  END IF;

  -- People and correction lineage are also ordinary single-key foreign
  -- references; they must not attach a profile or prior report from another
  -- organisation, even if the same-org report RLS policy permits the draft.
  IF NEW.profile_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.profiles subject
    WHERE subject.id = NEW.profile_id AND subject.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Report subject is outside the report organisation.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.submitted_by IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.profiles submitter
    WHERE submitter.id = NEW.submitted_by AND submitter.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Report submitter is outside the report organisation.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.confirmed_by IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.profiles reviewer
    WHERE reviewer.id = NEW.confirmed_by AND reviewer.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Report confirmer is outside the report organisation.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.supersedes_report_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.reports previous
    WHERE previous.id = NEW.supersedes_report_id
      AND previous.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Report correction reference belongs to another organisation.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_report_tenant_references()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reports_tenant_reference_integrity ON public.reports;

CREATE TRIGGER reports_tenant_reference_integrity
BEFORE INSERT OR UPDATE OF org_id, period_id, unit_id, project_id,
  profile_id, submitted_by, confirmed_by, supersedes_report_id
ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.guard_report_tenant_references();

COMMENT ON FUNCTION public.guard_report_tenant_references() IS
  'Database-invariant tenant check for report period, unit, and optional project; enforced even when existing RLS grants permit writing a draft.';
