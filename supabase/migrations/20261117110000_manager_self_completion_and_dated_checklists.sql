begin;

-- Preserve the actual calendar date of work separately from the server's
-- immutable recording timestamp. Existing ticks remain valid; NULL indicates
-- that an older entry did not capture a performed-on date.
ALTER TABLE public.checklist_ticks
  ADD COLUMN IF NOT EXISTS performed_on date;
COMMENT ON COLUMN public.checklist_ticks.performed_on IS
  'Contributor-reported date the checklist step was done, distinct from ticked_at, when it was recorded.';

CREATE OR REPLACE FUNCTION private.guard_checklist_performed_on()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $body$
DECLARE
  today date := (now() AT TIME ZONE 'Africa/Accra')::date;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.performed_on IS DISTINCT FROM OLD.performed_on THEN
      RAISE EXCEPTION 'A recorded checklist date cannot be changed. Undo and record a corrected step.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  NEW.performed_on := COALESCE(NEW.performed_on, today);
  IF NEW.performed_on > today THEN
    RAISE EXCEPTION 'A checklist step cannot be dated in the future.';
  END IF;
  RETURN NEW;
END;
$body$;
DROP TRIGGER IF EXISTS checklist_performed_on_guard ON public.checklist_ticks;
CREATE TRIGGER checklist_performed_on_guard
  BEFORE INSERT OR UPDATE OF performed_on ON public.checklist_ticks
  FOR EACH ROW EXECUTE FUNCTION private.guard_checklist_performed_on();

-- Ordinary organisational work created BY a manager FOR themself may close
-- directly. Executive/Administration assignments and all work assigned by
-- someone else retain the established independent approval authority.
-- Do not rewrite old work statuses, reviewers, submissions or dates.
CREATE OR REPLACE FUNCTION public.guard_executive_work_self_certification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.status = 'self_certified'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.assignee_id = auth.uid()
     AND OLD.visibility <> 'private'
     AND NOT public.app_is_exec()
     AND EXISTS (
       SELECT 1 FROM public.unit_memberships manager_membership
       WHERE manager_membership.profile_id = OLD.assignee_id
         AND manager_membership.org_id = OLD.org_id
         AND manager_membership.role = 'manager'
     )
     AND NOT (
       OLD.origin = 'self_created'
       AND OLD.assigned_by = auth.uid()
       AND OLD.visibility = 'unit'
       AND OLD.confidential = false
       AND EXISTS (
         SELECT 1 FROM public.unit_memberships owned_unit
         WHERE owned_unit.profile_id = OLD.assignee_id
           AND owned_unit.org_id = OLD.org_id
           AND owned_unit.unit_id = OLD.unit_id
           AND owned_unit.role = 'manager'
       )
     )
  THEN
    RAISE EXCEPTION 'Manager work must be sent for review. The Executive or assigning Admin will decide.'
      USING ERRCODE = '42501';
  END IF;
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
$function$;

commit;
