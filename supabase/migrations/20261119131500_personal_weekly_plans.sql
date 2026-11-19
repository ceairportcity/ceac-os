-- Per-person weekly plans cannot overwrite department plans. Staff can edit only their own.
alter table public.weekly_work_plans add column owner_id uuid references public.profiles(id) on delete cascade;
alter table public.weekly_work_plans alter column unit_id drop not null;
alter table public.weekly_work_plans drop constraint weekly_work_plans_unit_id_week_start_key;
alter table public.weekly_work_plans add constraint weekly_work_plans_scope_check
 check(owner_id is not null or unit_id is not null);
create unique index weekly_plan_unit_week_unique on public.weekly_work_plans(unit_id,week_start) where owner_id is null;
create unique index weekly_plan_person_week_unique on public.weekly_work_plans(owner_id,week_start) where owner_id is not null;
create index weekly_plan_person_scoped on public.weekly_work_plans(org_id,owner_id,week_start);

alter policy weekly_plan_read on public.weekly_work_plans using(
 org_id=(select public.app_org_id()) and (select public.app_stage2_universal_aal_allowed())
 and (
   owner_id=(select auth.uid())
   or (owner_id is null and unit_id in(select public.app_managed_units()))
   or (shared_at is not null and (
      (select public.app_is_admin())
      or ((select public.app_is_exec()) and exists(select 1 from public.profiles v where v.id=(select auth.uid())
         and v.active and lower(btrim(coalesce(v.job_title,'')))='group pastor'))
      or (owner_id is not null and unit_id in(select public.app_managed_units()))
      or (owner_id is null and unit_id in(select public.app_my_units()))
   ))
 ));
-- Reuse the already reviewed RPC signature: no extra public SECURITY DEFINER surface.
CREATE OR REPLACE FUNCTION public.update_weekly_work_plan(p_action text, p_plan uuid, p_item uuid, p_values jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  org uuid := public.app_org_id();
  today date := (now() at time zone 'Africa/Accra')::date;
  plan public.weekly_work_plans;
  entry public.weekly_work_plan_items;
  linked public.work_items;
  unit uuid;
  week date;
  day date;
  owner uuid;
  work uuid;
  routine date;
  v_title text;
  note text;
  wants_decision boolean;
  manager boolean;
  pastor boolean;
  personal boolean;
  target_owner uuid;
  recipients uuid[];
  memo uuid;
  version jsonb;
  target uuid;
  target_item uuid;
  target_shared_at timestamptz;
begin
  if actor is null or org is null or not public.app_stage2_universal_aal_allowed() then
    raise exception 'Sign in to use weekly plans.' using errcode = '42501';
  end if;

  if p_action = 'create' then
    unit := (p_values->>'unit')::uuid;
    week := (p_values->>'week')::date;
    if coalesce((p_values->>'personal')::boolean, false) then
      if not exists (select 1 from public.profiles p where p.id=actor and p.org_id=org and p.active)
         or (unit is not null and not exists(select 1 from public.app_my_units() m where m=unit))
      then raise exception 'Only your own active account can create your weekly plan.' using errcode='42501'; end if;
      if week is null or extract(isodow from week) <> 1 or week < today - 6 or week > today + 7 then
        raise exception 'Choose this week or next week.';
      end if;
      insert into public.weekly_work_plans(org_id,unit_id,owner_id,week_start)
        values(org,unit,actor,week) on conflict do nothing;
      select id into target from public.weekly_work_plans
        where org_id=org and owner_id=actor and week_start=week;
      return target;
    end if;
    if unit is null or week is null or not exists (
      select 1 from public.app_managed_units() m where m = unit
    ) or not exists (select 1 from public.units u where u.id = unit and u.org_id = org and u.active) then
      raise exception 'Choose a department you manage.' using errcode = '42501';
    end if;
    if extract(isodow from week) <> 1 or week < today - 6 or week > today + 7 then
      raise exception 'Choose this week or next week.';
    end if;
    insert into public.weekly_work_plans(org_id, unit_id, week_start)
      values (org, unit, week) on conflict do nothing;
    select id into target from public.weekly_work_plans where unit_id = unit and week_start = week and org_id = org;
    return target;
  end if;

  select * into plan from public.weekly_work_plans p where p.id = p_plan and p.org_id = org for update;
  if not found then raise exception 'This plan is unavailable.' using errcode = '42501'; end if;
  personal := plan.owner_id is not null;
  manager := case when personal then plan.owner_id=actor
    else exists (select 1 from public.app_managed_units() m where m=plan.unit_id) end;
  pastor := private.memo_authority_valid(actor, org, 'cross_department', plan.unit_id)
    or public.app_is_admin()
    or (personal and exists(select 1 from public.app_managed_units() m where m=plan.unit_id));
  if not manager and not (plan.shared_at is not null and (
      pastor or (not personal and exists(select 1 from public.app_my_units() u where u=plan.unit_id))
    )) then raise exception 'This plan is unavailable.' using errcode = '42501'; end if;

  if p_item is not null then
    select * into entry from public.weekly_work_plan_items e where e.id = p_item and e.plan_id = plan.id for update;
  end if;
  if p_action = 'tick' then
    if entry.id is null or entry.work_id is not null or entry.dropped_at is not null or entry.carried_at is not null or entry.owner_id is distinct from actor
      or jsonb_typeof(p_values->'done') is distinct from 'boolean' then
      raise exception 'Only the owner can check off this weekly plan item.' using errcode = '42501';
    end if;
    update public.weekly_work_plan_items set
      completed_at = case when (p_values->>'done')::boolean then coalesce(entry.completed_at, clock_timestamp()) end,
      updated_at = clock_timestamp()
      where id = entry.id and (completed_at is not null) is distinct from (p_values->>'done')::boolean;
    return plan.id;
  end if;

  if p_action = 'answer' then
    note := nullif(btrim(p_values->>'note'), '');
    if not pastor or plan.shared_at is null or entry.id is null or entry.dropped_at is not null
      or entry.carried_at is not null or not entry.decision_requested or note is null or length(note) > 1000 then
      raise exception 'Only an authorised supervisor or Administration can respond to an open decision.' using errcode = '42501';
    end if;
    update public.weekly_work_plan_items set decision_response = note, updated_at = clock_timestamp()
      where id = entry.id and decision_response is null;
    return plan.id;
  end if;

  if not manager then raise exception 'Only the personal owner or a department lead can edit this plan.' using errcode = '42501'; end if;

  if p_action = 'share' then
    if plan.shared_at is not null then return plan.id; end if;
    if not exists (select 1 from public.weekly_work_plan_items e where e.plan_id = plan.id and e.dropped_at is null) then
      raise exception 'Add at least one item before sharing.';
    end if;
    if personal and not exists(select 1 from public.unit_memberships x
      where x.org_id=org and x.profile_id=actor and x.role='manager') then
      -- Staff plans go to an independent unit manager, with Administration as fallback.
      select array_agg(p.id order by p.id) into recipients
      from public.profiles p where p.org_id=org and p.active and p.id<>actor
        and ((plan.unit_id is not null and exists(select 1 from public.unit_memberships m
          where m.org_id=org and m.unit_id=plan.unit_id and m.profile_id=p.id and m.role='manager'))
          or (p.is_admin and not exists(select 1 from public.unit_memberships m
            join public.profiles head on head.id=m.profile_id and head.active and head.org_id=org
            where m.org_id=org and m.unit_id=plan.unit_id and m.role='manager')));
    else
      -- Manager plans and executive plans reach the Group Pastor and HR coordinator.
      select array_agg(p.id order by p.id) into recipients from public.profiles p
       where p.org_id=org and p.active and p.id<>actor
         and (p.is_admin or (p.is_exec and lower(btrim(coalesce(p.job_title,'')))='group pastor'));
    end if;
    if recipients is null then raise exception 'No active authorised supervisor or Administration account is available.'; end if;
    memo := gen_random_uuid();
    version := public.save_memo_draft(memo, null, 'Weekly plan · ' || case when personal then
       left((select p.full_name from public.profiles p where p.id=actor), 150)
       else left((select u.name from public.units u where u.id=plan.unit_id), 150) end || ' · ' || to_char(plan.week_start, 'DD Mon'),
      'The weekly plan is ready. Open it to see the team’s commitments and progress.' || chr(10) ||
      '/?tab=work&weeklyPlan=' || plan.id::text, recipients, '{}'::uuid[], false, 'department', plan.unit_id, null, null);
    perform public.send_memo(memo, (version->>'version_id')::uuid);
    update public.weekly_work_plans p set shared_at = clock_timestamp(), original_plan = (
      select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'work_id', e.work_id,
        'routine_date', e.routine_date, 'planned_on', e.planned_on) order by e.planned_on nulls last, e.id)
      from public.weekly_work_plan_items e where e.plan_id = plan.id and e.dropped_at is null
    ) where p.id = plan.id;
    return plan.id;
  end if;

  if p_action = 'save' then
    if p_item is null or entry.dropped_at is not null or entry.carried_at is not null then raise exception 'This item is unavailable.'; end if;
    if entry.id is null and (select count(*) from public.weekly_work_plan_items e where e.plan_id = plan.id and e.dropped_at is null) >= 150 then
      raise exception 'This weekly plan already has 150 items.';
    end if;
    day := (p_values->>'day')::date;
    if day is not null and day not between plan.week_start and plan.week_start + 6 then
      raise exception 'Choose a day in this plan’s week.';
    end if;
    if entry.id is not null and entry.updated_at is distinct from (p_values->>'updated_at')::timestamptz then
      raise exception 'This item changed. Reload before editing.' using errcode = '40001';
    end if;
    work := case when entry.id is null then (p_values->>'work')::uuid else entry.work_id end;
    routine := case when entry.id is null then (p_values->>'routine')::date else entry.routine_date end;
    v_title := nullif(btrim(p_values->>'title'), '');
    owner := (p_values->>'owner')::uuid;
    note := nullif(btrim(p_values->>'blocker'), '');
    wants_decision := coalesce((p_values->>'decision')::boolean, false);
    if length(note) > 1000 or wants_decision and note is null then
      raise exception 'Describe the decision needed in 1,000 characters or fewer.';
    end if;
    if work is not null then
      select * into linked from public.work_items w where w.id = work and w.org_id = org
        and (case when personal then w.assignee_id=actor else w.unit_id=plan.unit_id end)
        and w.visibility = 'unit' and not w.confidential and public.app_can_see_item(w.id);
      if not found then raise exception 'This work cannot be linked to a shared plan.' using errcode = '42501'; end if;
      if entry.id is null and (
        (linked.kind = 'routine') <> (routine is not null) or (routine is not null and
          (routine not between plan.week_start and plan.week_start + 6 or not exists (
            select 1 from public.routine_schedule_preview(array[work], routine, routine) r
            where r.scheduled_on = routine and r.state <> 'skipped'
          )))
      ) then raise exception 'Choose a scheduled occurrence in this week.'; end if;
      v_title := null;
      owner := null;
    elsif v_title is null or length(v_title) > 240 or not (
      (personal and owner=actor and exists(select 1 from public.profiles p
        where p.id=actor and p.org_id=org and p.active))
      or (not personal and exists (
        select 1 from public.unit_memberships m join public.profiles p on p.id=m.profile_id
        where m.unit_id=plan.unit_id and m.org_id=org and p.org_id=org and p.active and p.id=owner
      ))
    ) then raise exception 'Enter a title and choose an authorised active owner.'; end if;

    if entry.id is null then
      insert into public.weekly_work_plan_items(id, plan_id, title, owner_id, work_id, routine_date, planned_on, blocker, decision_requested)
        values (p_item, plan.id, v_title, owner, work, routine, day, note, wants_decision);
    else
      update public.weekly_work_plan_items set title = v_title, owner_id = owner, planned_on = day,
        blocker = note, decision_requested = wants_decision, updated_at = clock_timestamp(),
        decision_response = case when entry.blocker is not distinct from note and entry.decision_requested = wants_decision then entry.decision_response end
        where id = entry.id;
    end if;
    if plan.shared_at is not null then
      insert into public.weekly_work_plan_changes(plan_id, item_id, action, previous_day, next_day)
        values (plan.id, p_item, case when entry.id is null then 'Added' when entry.planned_on is distinct from day then 'Moved' else 'Updated' end, entry.planned_on, day);
    end if;
    return plan.id;
  end if;

  if entry.id is null then raise exception 'This item is unavailable.' using errcode = '42501'; end if;
  if p_action = 'drop' then
    if entry.dropped_at is not null then return plan.id; end if;
    if entry.carried_at is not null or entry.updated_at is distinct from (p_values->>'updated_at')::timestamptz then
      raise exception 'This item changed. Reload before removing it.' using errcode = '40001';
    end if;
    update public.weekly_work_plan_items set dropped_at = clock_timestamp(), updated_at = clock_timestamp() where id = entry.id;
    if plan.shared_at is not null then
      insert into public.weekly_work_plan_changes(plan_id, item_id, action, previous_day)
        values (plan.id, entry.id, 'Removed', entry.planned_on);
    end if;
    return plan.id;
  end if;

  if p_action = 'carry' then
    select e.plan_id into target from public.weekly_work_plan_items e where e.carried_from = entry.id;
    if found then return target; end if;
    if entry.completed_at is not null or entry.dropped_at is not null or plan.week_start + 7 < today - 6
      or plan.week_start > today then
      raise exception 'Choose an unfinished item from this week or last week.';
    end if;
    if entry.work_id is not null and not exists (
      select 1 from public.work_items w where w.id=entry.work_id and w.org_id=org
        and (case when personal then w.assignee_id=actor else w.unit_id=plan.unit_id end)
        and w.visibility='unit' and not w.confidential and public.app_can_see_item(w.id)
        and w.status not in ('completed','self_certified','cancelled')
        and (entry.routine_date is null or exists (
          select 1 from public.routine_schedule_preview(array[w.id], entry.routine_date, entry.routine_date) r
          where r.scheduled_on = entry.routine_date and r.state in ('scheduled','unrecorded_past')
        ))
    ) then raise exception 'Only open shared work can move forward.'; end if;
    insert into public.weekly_work_plans(org_id, unit_id, owner_id, week_start)
      values (org, plan.unit_id, plan.owner_id, plan.week_start + 7) on conflict do nothing;
    select p.id,p.shared_at into target,target_shared_at from public.weekly_work_plans p
      where p.owner_id is not distinct from plan.owner_id
        and p.unit_id is not distinct from plan.unit_id
        and p.week_start=plan.week_start+7 and p.org_id=org for update;
    select e.id into target_item from public.weekly_work_plan_items e
      where e.plan_id = target and e.work_id = entry.work_id
        and e.routine_date is not distinct from entry.routine_date and e.dropped_at is null;
    if target_item is null then
      if (select count(*) from public.weekly_work_plan_items e where e.plan_id = target and e.dropped_at is null) >= 150 then
        raise exception 'Next week already has 150 items.';
      end if;
      insert into public.weekly_work_plan_items(id, plan_id, title, owner_id, work_id, routine_date, carried_from)
        values (gen_random_uuid(), target, entry.title, entry.owner_id, entry.work_id, entry.routine_date, entry.id)
        returning id into target_item;
      if target_shared_at is not null then
        insert into public.weekly_work_plan_changes(plan_id, item_id, action) values (target, target_item, 'Carried in');
      end if;
    else
      update public.weekly_work_plan_items set carried_from = coalesce(carried_from, entry.id) where id = target_item;
    end if;
    update public.weekly_work_plan_items set carried_at = clock_timestamp(), updated_at = clock_timestamp() where id = entry.id;
    insert into public.weekly_work_plan_changes(plan_id, item_id, action) values (plan.id, entry.id, 'Carried forward');
    return target;
  end if;

  raise exception 'Unknown weekly plan action.';
end;
$function$
