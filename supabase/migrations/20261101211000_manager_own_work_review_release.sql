-- Manager-owned work, including an Executive assignment, is completed by its
-- authorised assignee. The previous submission is retained in history.
-- Same signature and existing SECURITY DEFINER authority checks; no new grants.
CREATE OR REPLACE FUNCTION public.self_certify_work(p_work_item_id uuid,p_session_id uuid DEFAULT NULL,p_note text DEFAULT NULL,p_link text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $ceac_work$
declare
  w record;
  v_submission uuid;
  v_outstanding integer;
  v_deliverable record;
begin
  select * into w
  from work_items
  where id=p_work_item_id
  for update;

  if w is null then raise exception 'That work item does not exist.'; end if;
  if w.org_id<>app_org_id() then raise exception 'That work item belongs to another organisation.'; end if;
  if w.assignee_id<>auth.uid() then raise exception 'Only the person the work is assigned to can certify it.'; end if;
  if w.kind not in ('task','meeting_outcome','deliverable') then
    raise exception 'This work type does not use self-certification.';
  end if;

  if not exists (
    select 1 from unit_memberships m
    where m.profile_id=auth.uid()
      and m.unit_id=w.unit_id
      and m.role='manager'
  ) and not app_is_admin() and not app_is_exec() then
    raise exception 'Only a unit head can certify their own work. Send it for review instead.';
  end if;

  if w.status in ('completed','cancelled','self_certified') then
    raise exception 'That work is already finished.';
  end if;
  -- A unit head may finish their own pending review without asking an Executive
  -- to approve routine manager work. Preserve the existing submission and
  -- reject a transition if it is not the same actor's undecided submission.
  if w.status='in_review' and not exists (
    select 1 from submissions s
    where s.work_item_id=w.id and s.profile_id=auth.uid()
      and not exists (select 1 from reviews r where r.submission_id=s.id)
      and s.id=(select s2.id from submissions s2
                where s2.work_item_id=w.id order by s2.submitted_at desc,s2.id desc limit 1)
  ) then
    raise exception 'Only your own pending submission can be finished by you.';
  end if;

  if w.kind='task' then
    select count(*) into v_outstanding
    from checklist_items ci
    where ci.work_item_id=w.id
      and not exists (
        select 1 from checklist_ticks t
        where t.checklist_item_id=ci.id and t.undone_at is null
      );
    if v_outstanding>0 then
      raise exception 'Finish the checklist first — % item(s) outstanding.',v_outstanding;
    end if;
  end if;

  if w.kind='deliverable' then
    select * into v_deliverable
    from work_deliverables
    where work_item_id=w.id;

    if v_deliverable is null then
      raise exception 'Deliverable configuration is missing.';
    end if;

    if v_deliverable.evidence_required then
      if v_deliverable.evidence_kind='file' then
        raise exception 'This deliverable requires an uploaded file. It cannot be self-certified with a link-only submission.';
      end if;
      if v_deliverable.evidence_kind in ('link','file_or_link')
         and (p_link is null or length(btrim(p_link))=0) then
        raise exception 'Add the required evidence link before finishing this deliverable.';
      end if;
    end if;
  end if;

  insert into submissions(org_id,work_item_id,profile_id,session_id,note,outside_session)
  values(w.org_id,w.id,auth.uid(),p_session_id,p_note,p_session_id is null)
  returning id into v_submission;

  if p_link is not null and length(btrim(p_link))>0 then
    insert into submission_files(submission_id,kind,url)
    values(v_submission,'link',btrim(p_link));
  end if;

  update work_items
  set status='self_certified',
      completed_at=now(),
      last_movement_at=now()
  where id=w.id;

  insert into activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(
    w.org_id,
    auth.uid(),
    'self_certified',
    'work_item',
    w.id,
    jsonb_build_object('submission_id',v_submission,'kind',w.kind)
  );

  return v_submission;
end;
$ceac_work$;
REVOKE ALL ON FUNCTION public.self_certify_work(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.self_certify_work(uuid,uuid,text,text) TO authenticated;
