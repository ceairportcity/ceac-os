-- Reconcile the manager-completion release with the existing Executive review guard.
-- Only the assigned manager for this unit may finish Executive-assigned work.
-- Staff, other managers, and other-assignee work remain protected.
-- This follows 20261101211000_manager_own_work_review_release.sql.
CREATE OR REPLACE FUNCTION public.guard_executive_work_self_certification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $ceac_guard$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.status = 'self_certified'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.visibility <> 'private'
     AND (
       OLD.origin = 'assigned_by_exec'
       OR (OLD.origin = 'assigned' AND OLD.assigned_by IS DISTINCT FROM auth.uid())
     )
  THEN
    IF OLD.assignee_id IS DISTINCT FROM auth.uid()
       OR NOT EXISTS (
         SELECT 1 FROM public.unit_memberships m
         WHERE m.profile_id = auth.uid()
           AND m.unit_id = OLD.unit_id
           AND m.role = 'manager'
       )
    THEN
      RAISE EXCEPTION 'Work assigned by another authority requires review unless the assignee is the responsible unit manager.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$ceac_guard$;
