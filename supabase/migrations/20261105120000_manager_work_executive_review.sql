-- CEAC approval route (5 Nov 2026).
-- Manager-owned organisational work goes to the Executive, including Grace
-- (OFTGP Secretariat). An active Admin who actually assigned that work remains
-- its reviewer. Other staff work and private work retain their existing routes.
-- No historical work, review, submission, or membership records are modified.
--
-- Routing and approval are enforced server-side, not only by presentation.
CREATE OR REPLACE FUNCTION public.app_responsible_reviewer_id(item_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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

  -- Managers, including the OFTGP Secretariat manager, submit organisational
  -- work to the Executive, unless it was explicitly assigned by Administration.
  -- Private work is intentionally excluded by the visibility check above.
  if exists (
    select 1 from public.unit_memberships manager_membership
    where manager_membership.profile_id=w.assignee_id
      and manager_membership.org_id=w.org_id
      and manager_membership.role='manager'
  ) then
    -- An actual Admin-to-manager assignment returns to that assigning Admin.
    -- Self-created items (assigned_by=assignee) are not Admin assignments.
    if w.assigned_by is distinct from w.assignee_id
       and exists (
         select 1 from public.profiles assigning_admin
         where assigning_admin.id=w.assigned_by
           and assigning_admin.org_id=w.org_id
           and assigning_admin.active
           and assigning_admin.is_admin
       ) then
      return w.assigned_by;
    end if;

    -- Use a verified active Executive from the same organisation.
    -- Do not fall back to HR or a peer manager if no Executive exists.
    select executive.id into v_reviewer
    from public.profiles executive
    where executive.org_id=w.org_id
      and executive.active and executive.is_exec
      and executive.id is distinct from w.assignee_id
    order by executive.created_at,executive.id
    limit 1;
    return v_reviewer;
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
$function$;

CREATE OR REPLACE FUNCTION public.app_can_review_item(item_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from private.operational_live_work_items w
    where w.id=item_id
      and w.org_id=public.app_org_id()
      and w.kind in ('task','deliverable','meeting_outcome')
      and w.visibility<>'private'
      and w.assignee_id is distinct from auth.uid()
      and (
        (
          public.app_is_admin()
          and not exists (
            select 1 from public.unit_memberships manager_membership
            where manager_membership.profile_id=w.assignee_id
              and manager_membership.org_id=w.org_id
              and manager_membership.role='manager'
          )
        )
        or (
          public.app_privileged_aal_allowed()
          and public.app_responsible_reviewer_id(w.id)=auth.uid()
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.guard_executive_work_self_certification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Manager-owned work requires an independent review; only the assigned
  -- Admin may review an Admin assignment. The RPC cannot bypass this trigger.
  IF auth.uid() IS NOT NULL
     AND NEW.status = 'self_certified'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.assignee_id = auth.uid()
     AND OLD.visibility <> 'private'
     AND NOT public.app_is_exec()
     AND EXISTS (
       SELECT 1 FROM public.unit_memberships manager_membership
       WHERE manager_membership.profile_id = OLD.assignee_id
         AND manager_membership.org_id = OLD.org_id
         AND manager_membership.role = 'manager'
     )
  THEN
    RAISE EXCEPTION 'Manager work must be sent for review. The Executive or assigning Admin will decide.'
      USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NOT NULL
     AND NEW.status = 'self_certified'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.visibility <> 'private'
     AND (
       OLD.origin = 'assigned_by_exec'
       OR (OLD.origin = 'assigned' AND OLD.assigned_by IS DISTINCT FROM auth.uid())
     )
  THEN
    IF OLD.assignee_id IS DISTINCT FROM auth.uid()
       OR NOT EXISTS (
         SELECT 1 FROM public.unit_memberships m
         WHERE m.profile_id = auth.uid()
           AND m.unit_id = OLD.unit_id
           AND m.role = 'manager'
       )
    THEN
      RAISE EXCEPTION 'Work assigned by another authority requires review unless the assignee is the responsible unit manager.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
