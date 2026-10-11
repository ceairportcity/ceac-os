-- CEAC cross-tenant report linkage guard — REVIEW-ONLY SQL PROPOSAL.
-- DO NOT execute against production. Does not create migration history.
-- Generate a correctly ordered canonical migration after isolated replay
-- and restored encrypted production backup. Verify full role/RLS gates.
-- Derived from live production function definition (read-only on 11 Oct 2026).
-- The only behavioral addition is explicit same-organisation validation for
-- unit_id and any supplied project_id; no capability or org-role grants change.

CREATE OR REPLACE FUNCTION public.save_report_draft(p_period_id uuid, p_scope text, p_unit_id uuid DEFAULT NULL::uuid, p_project_id uuid DEFAULT NULL::uuid, p_narrative text DEFAULT NULL::text, p_challenges text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid; v_period record; v_version int; v_tries int := 0;
begin
  select * into v_period from report_periods where id = p_period_id;
  if v_period is null then raise exception 'That reporting period does not exist.'; end if;
  if v_period.org_id <> app_org_id() then raise exception 'That belongs to another organisation.'; end if;
  if v_period.status <> 'open' then raise exception 'That reporting period is closed.'; end if;
  if p_scope not in ('unit','project') then
    raise exception 'A manager saves a unit or project report.';
  end if;
  if p_unit_id is null then raise exception 'Say which unit this report is for.'; end if;
  if not (p_unit_id in (select app_managed_units()) or app_is_admin()) then
    raise exception 'You do not lead that unit.';
  end if;
  -- Tenant consistency: SECURITY DEFINER bypasses RLS, so foreign-key
  -- existence alone cannot establish that an associated unit or project
  -- belongs to this report period's organisation.
  if not exists (select 1 from public.units u
                 where u.id = p_unit_id and u.org_id = v_period.org_id) then
    raise exception 'That unit does not belong to this organisation.' using errcode='42501';
  end if;
  if p_project_id is not null and not exists
       (select 1 from public.projects p
        where p.id = p_project_id and p.org_id = v_period.org_id) then
    raise exception 'That project does not belong to this organisation.' using errcode='42501';
  end if;
  if p_scope = 'project' then
    if p_project_id is null then raise exception 'Say which project this report is for.'; end if;
    if p_project_id not in (select app_visible_projects()) then
      raise exception 'That project is not one of yours.';
    end if;
  end if;

  loop
    v_tries := v_tries + 1;
    select id into v_id from reports
     where period_id = p_period_id and scope = p_scope and status = 'draft'
       and coalesce(unit_id,'00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_unit_id,'00000000-0000-0000-0000-000000000000'::uuid)
       and coalesce(project_id,'00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_project_id,'00000000-0000-0000-0000-000000000000'::uuid);

    if v_id is not null then
      update reports set narrative = p_narrative, challenges = p_challenges where id = v_id;
      return v_id;
    end if;

    select coalesce(max(version),0) + 1 into v_version from reports
     where period_id = p_period_id and scope = p_scope
       and coalesce(unit_id,'00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_unit_id,'00000000-0000-0000-0000-000000000000'::uuid)
       and coalesce(project_id,'00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_project_id,'00000000-0000-0000-0000-000000000000'::uuid);

    begin
      insert into reports (org_id, period_id, scope, unit_id, project_id,
                           narrative, challenges, status, version)
      values (v_period.org_id, p_period_id, p_scope, p_unit_id, p_project_id,
              p_narrative, p_challenges, 'draft', v_version)
      returning id into v_id;
      return v_id;
    exception when unique_violation then
      if v_tries >= 3 then raise; end if;
      -- Someone else created it a moment ago; go round and update theirs.
    end;
  end loop;
end; $function$

