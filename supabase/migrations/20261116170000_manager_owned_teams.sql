begin;

-- The unit head owns team operations. Official unit access and lifecycle
-- operations retain their existing authority and cleanup triggers.
drop policy if exists sub_teams_manager_write on public.sub_teams;
drop policy if exists sub_team_members_admin_write on public.sub_team_members;
revoke execute on function public.admin_set_work_lane_membership(uuid,uuid,boolean,text) from public, anon, authenticated;
revoke execute on function public.swap_sub_team_positions(uuid,uuid) from public, anon, authenticated;

create function private.guard_manager_team_lead()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.lead_id is not distinct from old.lead_id then
    return new;
  end if;
  -- The existing account/membership lifecycle can clear former leads.
  if tg_op = 'UPDATE' and new.lead_id is null
     and current_setting('ceac.security_deactivation', true) = 'close'
     and (to_jsonb(new) - 'lead_id') = (to_jsonb(old) - 'lead_id') then
    return new;
  end if;
  if auth.uid() is null or (tg_op = 'INSERT' and new.lead_id is null) then
    return new;
  end if;
  if new.unit_id not in (select public.app_managed_units())
     or new.org_id is distinct from public.app_org_id()
     or not public.app_stage2_universal_aal_allowed() then
    raise exception 'Only the unit manager can change the team lead.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_manager_team_lead() from public, anon, authenticated;
drop trigger sub_teams_guard_hr_fields on public.sub_teams;
create trigger sub_teams_guard_manager_lead
before insert or update on public.sub_teams
for each row execute function private.guard_manager_team_lead();

create function public.manage_unit_team(
  p_unit_id uuid, p_action text, p_team_id uuid default null,
  p_name text default null, p_code text default null,
  p_member_ids uuid[] default '{}', p_lead_id uuid default null,
  p_other_team_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  manager_id uuid := auth.uid();
  organisation_id uuid := public.app_org_id();
  team public.sub_teams;
  other_position integer;
  team_code text := upper(btrim(p_code));
  prefix text;
  members uuid[] := coalesce(p_member_ids, '{}');
  changed integer := 0;
begin
  if manager_id is null or organisation_id is null or not public.app_stage2_universal_aal_allowed()
     or not exists (select 1 from public.app_managed_units() id where id = p_unit_id) then
    raise exception 'Only the manager of this unit can manage its teams.' using errcode = '42501';
  end if;

  -- Serialise with other team edits and official membership changes. Check
  -- authority again after waiting in case the unit manager was replaced.
  perform 1 from public.units
    where id = p_unit_id and org_id = organisation_id and active for update;
  if not found or not exists (select 1 from public.app_managed_units() id where id = p_unit_id) then
    raise exception 'This unit is no longer available to you.' using errcode = '42501';
  end if;

  if p_action in ('create', 'rename') and coalesce(char_length(btrim(p_name)), 0) not between 1 and 100 then
    raise exception 'Enter a team name of up to 100 characters.';
  end if;

  if p_action = 'create' then
    if nullif(team_code, '') is null then
      prefix := upper(regexp_replace(btrim(p_name), '[^a-zA-Z0-9]', '', 'g'));
      team_code := coalesce(nullif(left(prefix, 3), ''), 'TEAM');
      if exists (select 1 from public.sub_teams where unit_id = p_unit_id and code = team_code) then
        select left(coalesce(nullif(prefix, ''), 'TM'), 2) || lpad(n::text, 2, '0')
        into team_code
        from generate_series(2, 99) n
        where not exists (
          select 1 from public.sub_teams
          where unit_id = p_unit_id
            and code = left(coalesce(nullif(prefix, ''), 'TM'), 2) || lpad(n::text, 2, '0')
        )
        order by n limit 1;
        if team_code is null then raise exception 'Choose a team name that starts differently.'; end if;
      end if;
    end if;
    if team_code !~ '^[A-Z0-9]{1,4}$' then
      raise exception 'Use one to four letters or numbers for the team code.';
    end if;
    insert into public.sub_teams (org_id, unit_id, name, code, position)
    values (organisation_id, p_unit_id, btrim(p_name), team_code,
      (select coalesce(max(position), 0) + 1 from public.sub_teams where unit_id = p_unit_id))
    returning * into team;
  else
    select * into team from public.sub_teams
      where id = p_team_id and unit_id = p_unit_id and org_id = organisation_id for update;
    if not found then
      raise exception 'This team is no longer available in your unit.' using errcode = '42501';
    end if;
    if not team.active and p_action not in ('archive', 'restore') then
      raise exception 'Restore this team before making changes.';
    end if;
    case p_action
      when 'rename' then
        update public.sub_teams set name = btrim(p_name) where id = team.id returning * into team;
      when 'archive', 'restore' then
        update public.sub_teams set active = (p_action = 'restore') where id = team.id returning * into team;
      when 'reorder' then
        select position into other_position from public.sub_teams
          where id = p_other_team_id and unit_id = p_unit_id and org_id = organisation_id and active for update;
        if not found or p_other_team_id = team.id then raise exception 'Choose another active team in this unit.'; end if;
        update public.sub_teams set position = team.position where id = p_other_team_id;
        update public.sub_teams set position = other_position where id = team.id returning * into team;
      when 'add_members' then
        if cardinality(members) = 0 or exists (
          select 1 from unnest(members) member_id where not exists (
            select 1 from public.unit_memberships m
            join public.profiles p on p.id = m.profile_id and p.org_id = m.org_id
            where m.unit_id = p_unit_id and m.org_id = organisation_id and p.id = member_id and p.active
          )
        ) then
          raise exception 'Choose active people already in this unit.' using errcode = '42501';
        end if;
        insert into public.sub_team_members (sub_team_id, profile_id)
          select team.id, member_id from unnest(members) member_id on conflict do nothing;
        get diagnostics changed = row_count;
      when 'remove_member' then
        if cardinality(members) <> 1 or members[1] is null then raise exception 'Choose one team member to remove.'; end if;
        if team.lead_id = members[1] then
          update public.sub_teams set lead_id = null where id = team.id returning * into team;
        end if;
        delete from public.sub_team_members where sub_team_id = team.id and profile_id = members[1];
        get diagnostics changed = row_count;
      when 'set_lead' then
        if p_lead_id is not null and not exists (
          select 1 from public.sub_team_members sm
          join public.unit_memberships m on m.profile_id = sm.profile_id and m.unit_id = p_unit_id and m.org_id = organisation_id
          join public.profiles p on p.id = m.profile_id and p.org_id = m.org_id and p.active
          where sm.sub_team_id = team.id and sm.profile_id = p_lead_id
        ) then
          raise exception 'Choose an active member of this team.' using errcode = '42501';
        end if;
        update public.sub_teams set lead_id = p_lead_id where id = team.id returning * into team;
      else
        raise exception 'Choose a team action.';
    end case;
  end if;

  if changed > 0 then
    insert into public.activity_events (org_id, actor_id, verb, object_type, object_id, meta)
    values (organisation_id, manager_id, 'work_lane_membership_changed', 'unit', p_unit_id,
      jsonb_build_object('team_id', team.id, 'action', p_action, 'people', to_jsonb(members)));
  end if;

  return jsonb_build_object('id', team.id, 'name', team.name, 'code', team.code,
    'position', team.position, 'lead_id', team.lead_id, 'active', team.active, 'changed', changed,
    'members', coalesce((select jsonb_agg(profile_id) from public.sub_team_members where sub_team_id = team.id), '[]'::jsonb));
exception when unique_violation then
  raise exception 'That team code is already used in this unit. Choose another code.' using errcode = '23505';
end;
$$;

revoke all on function public.manage_unit_team(uuid,text,uuid,text,text,uuid[],uuid,uuid) from public, anon, service_role;
grant execute on function public.manage_unit_team(uuid,text,uuid,text,text,uuid[],uuid,uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.reassign_unstarted_task(
  p_work_item_id uuid, p_expected_assignee uuid, p_new_assignee uuid, p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  work public.work_items;
  is_admin boolean := public.app_is_admin();
BEGIN
  IF actor IS NULL OR NOT public.app_stage2_universal_aal_allowed()
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor AND active) THEN
    RAISE EXCEPTION 'An authorised active account is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO work FROM public.work_items
  WHERE id = p_work_item_id AND org_id = public.app_org_id() FOR UPDATE;

  IF work.id IS NULL OR NOT public.app_can_see_item(work.id)
     OR work.kind <> 'task' OR work.origin <> 'assigned'
     OR work.status <> 'not_started' OR work.visibility <> 'unit' OR work.confidential THEN
    RAISE EXCEPTION 'Only unstarted, shared assigned tasks can be reassigned.' USING ERRCODE = '42501';
  END IF;
  IF NOT is_admin THEN
    PERFORM 1 FROM public.units WHERE id = work.unit_id AND org_id = work.org_id AND active FOR UPDATE;
    IF NOT FOUND OR work.unit_id NOT IN (SELECT public.app_managed_units())
       OR NOT EXISTS (
         SELECT 1 FROM public.sub_teams st
         JOIN public.sub_team_members sm ON sm.sub_team_id = st.id
         WHERE st.id = work.sub_team_id AND st.unit_id = work.unit_id AND st.org_id = work.org_id
           AND st.active AND sm.profile_id = p_new_assignee
       ) THEN
      RAISE EXCEPTION 'Only the unit manager can reassign team work to an active team member.' USING ERRCODE = '42501';
    END IF;
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

commit;
