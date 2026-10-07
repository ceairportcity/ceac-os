-- Experience Stage 7: work capture, staff subtasks and project proposals.
-- Give-out-work keeps four required business fields: what, why, who, when.
-- Checklist method is optional. Assignees may append their own steps, but
-- cannot rewrite or delete checklist history. Project proposals are staff
-- input; a scoped manager confirmation creates the actual project.

-- Staff may append their own steps. Managers keep checklist authority.
drop policy if exists checklist_items_write on public.checklist_items;

create policy checklist_items_manager_write
on public.checklist_items
for all
using (public.app_can_review_item(work_item_id))
with check (public.app_can_review_item(work_item_id));

create policy checklist_items_assignee_insert
on public.checklist_items
for insert
with check (
  work_item_id in (
    select w.id
    from public.work_items w
    where w.assignee_id = auth.uid()
      and w.org_id = public.app_org_id()
      and w.kind = 'task'
      and w.status in ('not_started','in_progress','waiting_on','returned')
  )
);

-- Keep the existing atomic task creator, but make the UI contract honest:
-- assigned Task => what, why, who, when. Finished-result and method are optional.
create or replace function public.create_task_with_checklist(
  p_unit_id uuid,
  p_assignee_id uuid,
  p_title text,
  p_expected_outcome text,
  p_sub_team_id uuid default null,
  p_project_id uuid default null,
  p_objective_id uuid default null,
  p_phase_id uuid default null,
  p_purpose text default null,
  p_instructions text default null,
  p_due_at timestamptz default null,
  p_origin text default 'assigned',
  p_visibility text default 'unit',
  p_steps text[] default '{}'::text[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_ref text;
  v_id uuid:=gen_random_uuid();
  v_step text;
  v_pos int:=0;
begin
  if auth.uid() is null then raise exception 'Sign in to create work.' using errcode='42501'; end if;
  if v_org is null then raise exception 'Your organisation could not be identified.' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null then raise exception 'Enter what needs to happen.'; end if;
  if p_origin not in ('assigned','self_created') then raise exception 'Unsupported Task origin.'; end if;
  if p_visibility not in ('unit','private') then raise exception 'Unsupported visibility.'; end if;

  if p_origin='assigned' then
    if p_assignee_id is null then raise exception 'Choose who is responsible.'; end if;
    if nullif(btrim(coalesce(p_purpose,'')),'') is null then raise exception 'Explain why this work matters.'; end if;
    if p_due_at is null then raise exception 'Choose when this work is due.'; end if;
  end if;

  if not exists(select 1 from public.units u where u.id=p_unit_id and u.org_id=v_org and u.active) then
    raise exception 'That unit is not active in your organisation.' using errcode='42501';
  end if;

  if p_origin='self_created' then
    if p_assignee_id<>auth.uid() then raise exception 'Self-created work must belong to you.' using errcode='42501'; end if;
    if not exists(select 1 from public.unit_memberships um where um.unit_id=p_unit_id and um.profile_id=auth.uid() and um.org_id=v_org) then
      raise exception 'You are not a member of that unit.' using errcode='42501';
    end if;
  else
    if not (p_unit_id in(select public.app_managed_units()) or public.app_is_admin()) then
      raise exception 'Only the Unit Head can assign this Task.' using errcode='42501';
    end if;
    if not exists(
      select 1 from public.unit_memberships um join public.profiles p on p.id=um.profile_id
      where um.unit_id=p_unit_id and um.profile_id=p_assignee_id and um.org_id=v_org and p.active
    ) then raise exception 'The assignee is not an active member of this unit.' using errcode='42501'; end if;
    if p_visibility='private' then raise exception 'Assigned work cannot be private.' using errcode='42501'; end if;
  end if;

  if p_sub_team_id is not null and not exists(
    select 1 from public.sub_teams s where s.id=p_sub_team_id and s.unit_id=p_unit_id and s.org_id=v_org and s.active
  ) then raise exception 'That team part does not belong to this unit.'; end if;

  if p_project_id is not null then
    if not exists(
      select 1 from public.projects p
      where p.id=p_project_id and p.org_id=v_org and p.status in ('planned','active')
        and (p.lead_unit_id=p_unit_id or exists(select 1 from public.project_units pu where pu.project_id=p.id and pu.unit_id=p_unit_id))
    ) then raise exception 'That project is not active for this unit.'; end if;
  elsif p_objective_id is not null or p_phase_id is not null then
    raise exception 'Objective or phase requires a project.';
  end if;

  if p_objective_id is not null and not exists(
    select 1 from public.objectives o where o.id=p_objective_id and o.project_id=p_project_id and o.unit_id=p_unit_id
  ) then raise exception 'That objective does not belong to this unit and project.'; end if;

  if p_phase_id is not null and not exists(
    select 1 from public.project_phases ph where ph.id=p_phase_id and ph.project_id=p_project_id
  ) then raise exception 'That phase does not belong to this project.'; end if;

  v_ref:=public.next_work_ref(p_unit_id,p_sub_team_id);

  insert into public.work_items(
    id,org_id,ref,kind,unit_id,sub_team_id,project_id,objective_id,phase_id,
    assignee_id,assigned_by,title,purpose,instructions,expected_outcome,
    original_due_at,due_at,origin,visibility,status
  ) values(
    v_id,v_org,v_ref,'task',p_unit_id,p_sub_team_id,p_project_id,p_objective_id,p_phase_id,
    p_assignee_id,auth.uid(),btrim(p_title),nullif(btrim(coalesce(p_purpose,'')),''),
    nullif(btrim(coalesce(p_instructions,'')),''),nullif(btrim(coalesce(p_expected_outcome,'')),''),
    p_due_at,p_due_at,p_origin,p_visibility,'not_started'
  );

  foreach v_step in array coalesce(p_steps,'{}'::text[]) loop
    if nullif(btrim(v_step),'') is not null then
      v_pos:=v_pos+1;
      insert into public.checklist_items(work_item_id,label,position)
      values(v_id,btrim(v_step),v_pos);
    end if;
  end loop;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,auth.uid(),'work_created','work_item',v_id,
    jsonb_build_object('kind','task','origin',p_origin,'assignee_id',p_assignee_id,'checklist_count',v_pos));

  return jsonb_build_object('id',v_id,'ref',v_ref);
end;
$$;

-- Staff may suggest a project. A proposal is not a project until a manager confirms it.
create table if not exists public.project_proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete restrict,
  proposed_by uuid not null references public.profiles(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  purpose text not null check (btrim(purpose) <> ''),
  starts_on date,
  ends_on date,
  state text not null default 'submitted' check (state in ('submitted','approved','declined')),
  project_id uuid references public.projects(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or ends_on >= starts_on),
  check (
    (state='submitted' and reviewed_by is null and reviewed_at is null and project_id is null)
    or (state='approved' and reviewed_by is not null and reviewed_at is not null and project_id is not null)
    or (state='declined' and reviewed_by is not null and reviewed_at is not null and project_id is null)
  )
);

create index if not exists project_proposals_unit_state_idx
  on public.project_proposals(unit_id,state,created_at desc);
create index if not exists project_proposals_proposer_idx
  on public.project_proposals(proposed_by,created_at desc);

alter table public.project_proposals enable row level security;
revoke all on public.project_proposals from anon;
grant select,insert,update on public.project_proposals to authenticated;

create policy project_proposals_read
on public.project_proposals for select
using (
  org_id = public.app_org_id()
  and (
    proposed_by = auth.uid()
    or unit_id in (select public.app_managed_units())
    or public.app_is_admin()
    or public.app_is_exec()
  )
);

create policy project_proposals_insert
on public.project_proposals for insert
with check (
  org_id = public.app_org_id()
  and proposed_by = auth.uid()
  and exists (
    select 1 from public.unit_memberships m
    where m.profile_id=auth.uid()
      and m.unit_id=project_proposals.unit_id
      and m.org_id=project_proposals.org_id
  )
);

create policy project_proposals_manager_update
on public.project_proposals for update
using (
  org_id = public.app_org_id()
  and (unit_id in (select public.app_managed_units()) or public.app_is_admin())
)
with check (
  org_id = public.app_org_id()
  and (unit_id in (select public.app_managed_units()) or public.app_is_admin())
);

create or replace function public.guard_project_proposal_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.org_id is distinct from old.org_id
     or new.unit_id is distinct from old.unit_id
     or new.proposed_by is distinct from old.proposed_by
     or new.name is distinct from old.name
     or new.purpose is distinct from old.purpose
     or new.starts_on is distinct from old.starts_on
     or new.ends_on is distinct from old.ends_on
     or new.created_at is distinct from old.created_at then
    raise exception 'Proposal facts are immutable after submission.';
  end if;

  if old.state <> 'submitted' then
    raise exception 'A decided project proposal cannot be changed.';
  end if;
  if new.state not in ('approved','declined') then
    raise exception 'A submitted proposal can only be approved or declined.';
  end if;
  if new.reviewed_by is distinct from auth.uid() or new.reviewed_at is null then
    raise exception 'The proposal decision must remain attributable.';
  end if;
  if new.state='approved' and new.project_id is null then
    raise exception 'An approved proposal must create a project.';
  end if;
  if new.state='declined' and new.project_id is not null then
    raise exception 'A declined proposal cannot point to a project.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_project_proposal_update() from public;

drop trigger if exists project_proposal_update_guard on public.project_proposals;
create trigger project_proposal_update_guard
before update on public.project_proposals
for each row execute function public.guard_project_proposal_update();

create or replace function public.decide_project_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_note text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_proposal public.project_proposals;
  v_project_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to review a project proposal.' using errcode='42501'; end if;
  if p_decision not in ('approved','declined') then raise exception 'Decision must be approved or declined.'; end if;

  select * into v_proposal
  from public.project_proposals
  where id=p_proposal_id
  for update;

  if v_proposal.id is null then raise exception 'That project proposal was not found.' using errcode='42501'; end if;
  if v_proposal.state <> 'submitted' then raise exception 'That project proposal has already been decided.'; end if;
  if not (v_proposal.unit_id in (select public.app_managed_units()) or public.app_is_admin()) then
    raise exception 'Only the Unit Head can confirm this project proposal.' using errcode='42501';
  end if;

  if p_decision='approved' then
    insert into public.projects(
      org_id,kind,lead_unit_id,name,purpose,starts_on,ends_on,status,created_by
    ) values(
      v_proposal.org_id,'project',v_proposal.unit_id,v_proposal.name,v_proposal.purpose,
      v_proposal.starts_on,v_proposal.ends_on,'planned',auth.uid()
    ) returning id into v_project_id;

    insert into public.project_units(project_id,unit_id,role)
    values(v_project_id,v_proposal.unit_id,'lead');

    update public.project_proposals
    set state='approved',project_id=v_project_id,reviewed_by=auth.uid(),reviewed_at=now(),
        review_note=nullif(btrim(coalesce(p_note,'')),'')
    where id=v_proposal.id;
  else
    update public.project_proposals
    set state='declined',reviewed_by=auth.uid(),reviewed_at=now(),
        review_note=nullif(btrim(coalesce(p_note,'')),'')
    where id=v_proposal.id;
  end if;

  return v_project_id;
end;
$$;
revoke all on function public.decide_project_proposal(uuid,text,text) from public;
grant execute on function public.decide_project_proposal(uuid,text,text) to authenticated;
