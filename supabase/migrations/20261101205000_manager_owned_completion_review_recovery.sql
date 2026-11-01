-- Managers complete their own responsibilities; independent review remains for staff.
-- Do not remove earlier submissions or any review decision.
create or replace function public.guard_executive_work_self_certification()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.status='self_certified'
     and old.status is distinct from new.status
     and old.visibility <> 'private'
     and (old.origin='assigned_by_exec' or
          (old.origin='assigned' and old.assigned_by is distinct from auth.uid())) then
    if old.assignee_id is distinct from auth.uid()
       or not exists(
         select 1 from public.unit_memberships m
         where m.profile_id=auth.uid()
           and m.unit_id=old.unit_id
           and m.role='manager'
       ) then
      raise exception 'Work assigned by another authority requires review unless the assignee is the responsible unit manager.'
        using errcode='42501';
    end if;
  end if;
  return new;
end
$$;

create or replace function public.withdraw_unreviewed_manager_submission(
  p_work_item_id uuid
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  w public.work_items;
  v_submission uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to continue.' using errcode='42501';
  end if;
  select * into w from public.work_items
  where id=p_work_item_id for update;
  if w.id is null
     or w.org_id is distinct from public.app_org_id()
     or w.assignee_id is distinct from auth.uid() then
    raise exception 'You cannot change this work.' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.unit_memberships m
    where m.profile_id=auth.uid()
      and m.unit_id=w.unit_id and m.role='manager'
  ) then
    raise exception 'Only the responsible unit manager may withdraw this review.' using errcode='42501';
  end if;
  if w.kind not in ('task','meeting_outcome','deliverable')
     or w.status <> 'in_review' then
    raise exception 'This work is no longer waiting for review.';
  end if;
  select s.id into v_submission from public.submissions s
  where s.work_item_id=w.id and s.profile_id=auth.uid()
  order by s.submitted_at desc, s.id desc limit 1;
  if v_submission is null or exists(
    select 1 from public.reviews r where r.submission_id=v_submission
  ) then
    raise exception 'A review decision exists or the submission cannot be verified. It cannot be withdrawn.';
  end if;
  update public.work_items set status='in_progress',last_movement_at=now()
  where id=w.id;
  insert into public.activity_events(
    org_id,actor_id,verb,object_type,object_id,meta
  ) values (
    w.org_id,auth.uid(),'manager_withdrew_unreviewed_submission','work_item',w.id,
    jsonb_build_object('submission_id',v_submission)
  );
  return v_submission;
end
$$;
revoke all on function public.withdraw_unreviewed_manager_submission(uuid) from public,anon;
grant execute on function public.withdraw_unreviewed_manager_submission(uuid) to authenticated;
