-- Phase 4: one authoritative review route and one read-only work-attention queue.
-- Communication receipts remain independent in room_reads and announcement_receipts.

create or replace function public.app_responsible_reviewer_id(item_id uuid)
returns uuid
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  w public.work_items;
  v_reviewer uuid;
begin
  if auth.uid() is null or public.app_org_id() is null then
    return null;
  end if;
  if not public.app_can_see_item(item_id) then
    return null;
  end if;

  select * into w
  from public.work_items
  where id=item_id
    and org_id=public.app_org_id()
    and kind in ('task','deliverable','meeting_outcome')
    and visibility<>'private';

  if w.id is null or w.assignee_id is null then
    return null;
  end if;

  -- A valid recorded assigning authority owns the ordinary review route.
  if w.assigned_by is not null
     and w.assigned_by is distinct from w.assignee_id
     and exists (
       select 1
       from public.profiles p
       where p.id=w.assigned_by
         and p.org_id=w.org_id
         and p.active
         and (
           p.is_admin
           or (w.origin='assigned_by_exec' and p.is_exec)
           or (not w.confidential and exists (
             select 1 from public.unit_memberships m
             where m.profile_id=p.id
               and m.org_id=w.org_id
               and m.unit_id=w.unit_id
               and m.role='manager'
           ))
           or (
             not w.confidential
             and
             w.sub_team_id is not null
             and exists (
               select 1 from public.sub_teams s
               where s.id=w.sub_team_id
                 and s.org_id=w.org_id
                 and s.unit_id=w.unit_id
                 and s.lead_id=p.id
                 and s.active
             )
           )
         )
     ) then
    return w.assigned_by;
  end if;

  -- Existing review authority reserves confidential work for Administration,
  -- except for a valid explicit Executive-origin route handled above.
  if w.confidential then
    return null;
  end if;

  -- Agreed/self-created work first follows the closest recorded work-lane lead.
  if w.sub_team_id is not null then
    select s.lead_id into v_reviewer
    from public.sub_teams s
    join public.profiles p on p.id=s.lead_id
    where s.id=w.sub_team_id
      and s.org_id=w.org_id
      and s.unit_id=w.unit_id
      and s.active
      and p.active
      and p.org_id=w.org_id
      and s.lead_id is distinct from w.assignee_id
    limit 1;

    if v_reviewer is not null then
      return v_reviewer;
    end if;
  end if;

  select m.profile_id into v_reviewer
  from public.unit_memberships m
  join public.profiles p on p.id=m.profile_id
  where m.unit_id=w.unit_id
    and m.org_id=w.org_id
    and m.role='manager'
    and p.active
    and p.org_id=w.org_id
    and m.profile_id is distinct from w.assignee_id
  order by m.profile_id
  limit 1;

  return v_reviewer;
end;
$$;

create or replace function public.app_can_review_item(item_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.work_items w
    where w.id=item_id
      and w.org_id=public.app_org_id()
      and w.kind in ('task','deliverable','meeting_outcome')
      and w.visibility<>'private'
      and w.assignee_id is distinct from auth.uid()
      and (
        public.app_is_admin()
        or public.app_responsible_reviewer_id(w.id)=auth.uid()
      )
  );
$$;

create or replace function public.my_work_attention_queue()
returns table(
  action_kind text,
  work_item_id uuid,
  work_ref text,
  work_title text,
  work_kind text,
  work_status text,
  action_at timestamptz,
  assignee_id uuid,
  assignee_name text,
  unit_name text,
  project_name text,
  responsible_reviewer_id uuid,
  responsible_reviewer_name text,
  submission_id uuid
)
language plpgsql
stable
security invoker
set search_path=public
as $$
begin
  if auth.uid() is null or public.app_org_id() is null then
    raise exception 'Sign in to view work actions.' using errcode='42501';
  end if;

  return query
  select
    'new_assignment'::text,
    w.id,
    w.ref,
    w.title,
    w.kind,
    w.status,
    w.created_at,
    w.assignee_id,
    assignee.full_name,
    unit_record.name,
    project_record.name,
    route.reviewer_id,
    reviewer.full_name,
    null::uuid
  from public.work_items w
  left join public.profiles assignee on assignee.id=w.assignee_id
  left join public.units unit_record on unit_record.id=w.unit_id
  left join public.projects project_record on project_record.id=w.project_id
  left join lateral (select public.app_responsible_reviewer_id(w.id) as reviewer_id) route on true
  left join public.profiles reviewer on reviewer.id=route.reviewer_id
  where w.org_id=public.app_org_id()
    and w.assignee_id=auth.uid()
    and w.visibility<>'private'
    and w.origin in ('assigned','assigned_by_exec')
    and w.status='not_started'

  union all

  select
    'returned_work'::text,
    w.id,
    w.ref,
    w.title,
    w.kind,
    w.status,
    w.last_movement_at,
    w.assignee_id,
    assignee.full_name,
    unit_record.name,
    project_record.name,
    route.reviewer_id,
    reviewer.full_name,
    null::uuid
  from public.work_items w
  left join public.profiles assignee on assignee.id=w.assignee_id
  left join public.units unit_record on unit_record.id=w.unit_id
  left join public.projects project_record on project_record.id=w.project_id
  left join lateral (select public.app_responsible_reviewer_id(w.id) as reviewer_id) route on true
  left join public.profiles reviewer on reviewer.id=route.reviewer_id
  where w.org_id=public.app_org_id()
    and w.assignee_id=auth.uid()
    and w.visibility<>'private'
    and w.status='returned'

  union all

  select
    'review_required'::text,
    w.id,
    w.ref,
    w.title,
    w.kind,
    w.status,
    s.submitted_at,
    w.assignee_id,
    assignee.full_name,
    unit_record.name,
    project_record.name,
    route.reviewer_id,
    reviewer.full_name,
    s.id
  from public.work_items w
  join lateral (
    select submission.id,submission.submitted_at
    from public.submissions submission
    where submission.work_item_id=w.id
    order by submission.submitted_at desc,submission.id desc
    limit 1
  ) s on true
  left join public.profiles assignee on assignee.id=w.assignee_id
  left join public.units unit_record on unit_record.id=w.unit_id
  left join public.projects project_record on project_record.id=w.project_id
  left join lateral (select public.app_responsible_reviewer_id(w.id) as reviewer_id) route on true
  left join public.profiles reviewer on reviewer.id=route.reviewer_id
  where w.org_id=public.app_org_id()
    and w.status='in_review'
    and public.app_can_review_item(w.id)

  order by 7 desc,2;
end;
$$;

create index if not exists work_items_org_status_idx
  on public.work_items(org_id,status,last_movement_at desc);

revoke all on function public.app_responsible_reviewer_id(uuid) from public,anon;
revoke all on function public.app_can_review_item(uuid) from public,anon;
revoke all on function public.my_work_attention_queue() from public,anon;
grant execute on function public.app_responsible_reviewer_id(uuid) to authenticated,service_role;
grant execute on function public.app_can_review_item(uuid) to authenticated,service_role;
grant execute on function public.my_work_attention_queue() to authenticated,service_role;
