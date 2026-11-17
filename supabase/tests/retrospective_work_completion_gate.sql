\\set ON_ERROR_STOP on
-- Synthetic, transactional, role-scoped acceptance: no production data changes.
BEGIN;
INSERT INTO public.work_items
  (id,org_id,unit_id,ref,kind,title,assignee_id,assigned_by,origin,visibility,confidential,status,due_at)
VALUES
  ('4a000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011',
   'WRC-MGR-001','task','Own earlier manager work','31000000-0000-4000-8000-000000000002',
   '31000000-0000-4000-8000-000000000002','self_created','unit',false,'in_progress',now()-interval '3 days'),
  ('4a000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011',
   'WRC-ASG-002','task','Externally assigned manager work','31000000-0000-4000-8000-000000000002',
   '31000000-0000-4000-8000-000000000001','assigned','unit',false,'in_progress',now()-interval '3 days');
INSERT INTO public.checklist_items(id,work_item_id,label,position)
VALUES ('4b000000-0000-4000-8000-000000000001','4a000000-0000-4000-8000-000000000001','Weekend work completed',1);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);

-- A manager may record a past Saturday/Monday step without any attendance session.
INSERT INTO public.checklist_ticks(checklist_item_id,profile_id,session_id,performed_on)
VALUES ('4b000000-0000-4000-8000-000000000001',
 '31000000-0000-4000-8000-000000000002',NULL,
 (now() AT TIME ZONE 'Africa/Accra')::date - 2);
DO $checklist$
DECLARE
  record_row public.checklist_ticks%ROWTYPE;
  rejected boolean := false;
BEGIN
  SELECT * INTO record_row FROM public.checklist_ticks
   WHERE checklist_item_id='4b000000-0000-4000-8000-000000000001' AND undone_at IS NULL;
  IF record_row.id IS NULL OR record_row.session_id IS NOT NULL
    OR record_row.performed_on IS DISTINCT FROM (now() AT TIME ZONE 'Africa/Accra')::date - 2
    OR record_row.ticked_at::date < record_row.performed_on THEN
     RAISE EXCEPTION 'Past checklist work was not recorded accurately without attendance.';
  END IF;
  BEGIN
    INSERT INTO public.checklist_ticks(checklist_item_id,profile_id,performed_on)
      VALUES ('4b000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000002',
      (now() AT TIME ZONE 'Africa/Accra')::date + 1);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%future%' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Future checklist date was accepted.'; END IF;
END;
$checklist$;

SELECT public.self_certify_work('4a000000-0000-4000-8000-000000000001',NULL,
 'Completed earlier; recorded later.',NULL);
DO $completion$
DECLARE
  rejected boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.work_items
    WHERE id='4a000000-0000-4000-8000-000000000001'
      AND status='self_certified' AND completed_at IS NOT NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.activity_events
    WHERE object_id='4a000000-0000-4000-8000-000000000001'
      AND verb='self_certified'
  ) THEN
    RAISE EXCEPTION 'Manager self-completion did not preserve the completion and audit.';
  END IF;
  BEGIN
    UPDATE public.work_items
       SET origin='self_created', assigned_by='31000000-0000-4000-8000-000000000002'
     WHERE id='4a000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Expected original-assigner protection was bypassed.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    UPDATE public.work_items SET status='completed'
     WHERE id='4a000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Expected direct-approval protection was bypassed.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM public.self_certify_work('4a000000-0000-4000-8000-000000000002',NULL,
      'Bypass independent review.',NULL);
  EXCEPTION WHEN insufficient_privilege THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Externally assigned manager work bypassed independent review.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.work_items
    WHERE id='4a000000-0000-4000-8000-000000000002' AND status='self_certified'
  ) THEN
    RAISE EXCEPTION 'Rejected self-completion changed the assigned work.';
  END IF;
END;
$completion$;

ROLLBACK;
