\set ON_ERROR_STOP on
begin;

do $permissions$
begin
  if has_function_privilege('authenticated', 'public.admin_set_work_lane_membership(uuid,uuid,boolean,text)', 'execute')
     or has_function_privilege('authenticated', 'public.swap_sub_team_positions(uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.manage_unit_team(uuid,text,uuid,text,text,uuid[],uuid,uuid)', 'execute') then
    raise exception 'A retired or unauthenticated team write path is still exposed.';
  end if;
end $permissions$;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);

do $manager$
declare
  home constant uuid := '20000000-0000-4000-8000-000000000011';
  other constant uuid := '20000000-0000-4000-8000-000000000012';
  staff constant uuid := '31000000-0000-4000-8000-000000000001';
  volunteer constant uuid := '31000000-0000-4000-8000-000000000006';
  outsider constant uuid := '31000000-0000-4000-8000-000000000005';
  team uuid;
  saved jsonb;
begin
  team := (public.manage_unit_team(home, 'create', p_name => 'Team security fixture', p_code => 'MTST')->>'id')::uuid;
  perform set_config('ceac.test_manager_team', team::text, true);

  begin
    perform public.manage_unit_team(other, 'create', p_name => 'Forbidden team', p_code => 'MTST');
    raise exception 'Manager created a team outside their unit.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.manage_unit_team(home, 'add_members', team, p_member_ids => array[staff, outsider]);
    raise exception 'Manager added somebody outside their unit.';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.sub_team_members where sub_team_id = team) then
    raise exception 'Failed bulk edit partially added members.';
  end if;

  saved := public.manage_unit_team(home, 'add_members', team, p_member_ids => array[staff, volunteer]);
  if saved->>'changed' <> '2' or jsonb_array_length(saved->'members') <> 2 then
    raise exception 'Manager could not bulk add staff and volunteer.';
  end if;
  saved := public.manage_unit_team(home, 'add_members', team, p_member_ids => array[staff, volunteer]);
  if saved->>'changed' <> '0' or jsonb_array_length(saved->'members') <> 2 then
    raise exception 'Retry changed or duplicated team membership.';
  end if;

  begin
    perform public.manage_unit_team(home, 'set_lead', team, p_lead_id => outsider);
    raise exception 'Non-member became lead.';
  exception when insufficient_privilege then null;
  end;
  saved := public.manage_unit_team(home, 'set_lead', team, p_lead_id => volunteer);
  if saved->>'lead_id' is distinct from volunteer::text then
    raise exception 'Manager could not appoint an existing member as lead.';
  end if;
  saved := public.manage_unit_team(home, 'remove_member', team, p_member_ids => array[volunteer]);
  if saved->>'lead_id' is not null or jsonb_array_length(saved->'members') <> 1 then
    raise exception 'Removing the lead left stale lead authority.';
  end if;
  if not exists (select 1 from public.unit_memberships where unit_id = home and profile_id = volunteer) then
    raise exception 'Team removal changed official unit membership.';
  end if;

  saved := public.manage_unit_team(home, 'rename', team, p_name => 'Renamed team');
  if saved->>'name' <> 'Renamed team' then raise exception 'Team rename did not persist.'; end if;
  saved := public.manage_unit_team(home, 'archive', team);
  if saved->>'active' <> 'false' or jsonb_array_length(saved->'members') <> 1 then
    raise exception 'Archive erased team history or retention.';
  end if;
  saved := public.manage_unit_team(home, 'restore', team);
  if saved->>'active' <> 'true' then raise exception 'Archived team did not restore.'; end if;
end $manager$;

select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
do $admin$
declare
  home constant uuid := '20000000-0000-4000-8000-000000000011';
  team constant uuid := current_setting('ceac.test_manager_team')::uuid;
begin
  begin
    perform public.manage_unit_team(home, 'rename', team, p_name => 'Forbidden rename');
    raise exception 'An admin role granted team management.';
  exception when insufficient_privilege then null;
  end;
  update public.sub_teams set active = false where id = team;
  if found then raise exception 'Admin bypassed the manager-only write path.'; end if;
  delete from public.sub_team_members where sub_team_id = team;
  if found then raise exception 'Admin directly changed team membership.'; end if;
end $admin$;

rollback;
