BEGIN;

CREATE FUNCTION public.reassign_unstarted_task(
  p_work_item_id uuid, p_expected_assignee uuid, p_new_assignee uuid, p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  work public.work_items;
BEGIN
  IF actor IS NULL OR NOT public.app_is_admin() OR NOT public.app_stage2_universal_aal_allowed()
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor AND active) THEN
    RAISE EXCEPTION 'An active Administration account is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO work FROM public.work_items
  WHERE id = p_work_item_id AND org_id = public.app_org_id() FOR UPDATE;

  IF work.id IS NULL OR NOT public.app_can_see_item(work.id)
     OR work.kind <> 'task' OR work.origin <> 'assigned'
     OR work.status <> 'not_started' OR work.visibility <> 'unit' OR work.confidential THEN
    RAISE EXCEPTION 'Only unstarted, shared assigned tasks can be reassigned.' USING ERRCODE = '42501';
  END IF;
  IF work.assignee_id IS DISTINCT FROM p_expected_assignee THEN
    RAISE EXCEPTION 'The assignee changed. Reopen the task before trying again.' USING ERRCODE = '40001';
  END IF;
  IF p_new_assignee IS NOT DISTINCT FROM work.assignee_id OR
     NOT EXISTS (
       SELECT 1 FROM public.unit_memberships m
       JOIN public.profiles p ON p.id = m.profile_id AND p.org_id = m.org_id
       WHERE m.org_id = work.org_id AND m.unit_id = work.unit_id
         AND p.id = p_new_assignee AND p.active
     ) THEN
    RAISE EXCEPTION 'Choose a different active member of the task department.';
  END IF;
  IF coalesce(length(btrim(p_reason)), 0) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Enter a reason of up to 1,000 characters.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.submissions WHERE work_item_id = work.id)
     OR EXISTS (SELECT 1 FROM public.work_activity_records WHERE work_item_id = work.id)
     OR EXISTS (SELECT 1 FROM public.work_sessions WHERE work_item_id = work.id)
     OR EXISTS (
       SELECT 1 FROM public.checklist_items c JOIN public.checklist_ticks t ON t.checklist_item_id = c.id
       WHERE c.work_item_id = work.id
     ) THEN
    RAISE EXCEPTION 'This task has recorded work and needs a separate handover.';
  END IF;

  UPDATE public.work_items
  SET assignee_id = p_new_assignee, last_movement_at = clock_timestamp()
  WHERE id = work.id;

  INSERT INTO public.activity_events (org_id, actor_id, verb, object_type, object_id, meta)
  VALUES (work.org_id, actor, 'work_reassigned', 'work_item', work.id,
    jsonb_build_object('previous_assignee_id', work.assignee_id, 'assignee_id', p_new_assignee, 'reason', btrim(p_reason)));
END;
$$;

REVOKE ALL ON FUNCTION public.reassign_unstarted_task(uuid, uuid, uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reassign_unstarted_task(uuid, uuid, uuid, text) TO authenticated;

COMMIT;
