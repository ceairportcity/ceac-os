-- 109 — OCR3 Executive Project Room authority correction.
--
-- OCR3E explicitly grants the Group Pastor / Executive organisation-wide
-- access to active Unit Rooms and Sub-team Rooms. Project Rooms remain
-- contextual and must not become ambient merely because an Executive profile
-- also has an ordinary unit membership.
--
-- Non-Executive users retain the original project-unit membership rule.
-- Executives require an explicit project-level relationship: project creator,
-- sponsor, delivery owner, project-linked work participant/assigner, or a
-- manager membership in a lead/participating project unit.

create or replace function public.app_can_access_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.rooms r
    where r.id=p_room_id
      and r.org_id=public.app_org_id()
      and (
        (
          r.kind='unit'
          and exists(
            select 1
            from public.units u
            where u.id=r.unit_id
              and u.org_id=r.org_id
              and u.active
          )
          and (
            public.app_is_exec()
            or exists (
              select 1
              from public.unit_memberships um
              where um.profile_id=auth.uid()
                and um.unit_id=r.unit_id
                and um.org_id=r.org_id
            )
          )
        )
        or
        (
          r.kind='sub_team'
          and exists (
            select 1
            from public.sub_teams st
            where st.id=r.sub_team_id
              and st.unit_id=r.unit_id
              and st.org_id=r.org_id
              and st.active
              and (
                public.app_is_exec()
                or st.lead_id=auth.uid()
                or exists (
                  select 1
                  from public.sub_team_members stm
                  where stm.sub_team_id=st.id
                    and stm.profile_id=auth.uid()
                )
                or exists (
                  select 1
                  from public.unit_memberships um
                  where um.unit_id=st.unit_id
                    and um.profile_id=auth.uid()
                    and um.role='manager'
                )
              )
          )
        )
        or
        (
          r.kind='project'
          and exists (
            select 1
            from public.projects p
            where p.id=r.project_id
              and p.org_id=r.org_id
              and (
                (
                  not public.app_is_exec()
                  and exists (
                    select 1
                    from public.unit_memberships um
                    where um.profile_id=auth.uid()
                      and um.org_id=r.org_id
                      and (
                        um.unit_id=p.lead_unit_id
                        or exists (
                          select 1
                          from public.project_units pu
                          where pu.project_id=p.id
                            and pu.unit_id=um.unit_id
                        )
                      )
                  )
                )
                or
                (
                  public.app_is_exec()
                  and (
                    p.created_by=auth.uid()
                    or p.sponsor_profile_id=auth.uid()
                    or p.delivery_owner_id=auth.uid()
                    or exists (
                      select 1
                      from public.work_items w
                      where w.project_id=p.id
                        and w.org_id=p.org_id
                        and (
                          w.assignee_id=auth.uid()
                          or w.assigned_by=auth.uid()
                        )
                    )
                    or exists (
                      select 1
                      from public.unit_memberships um
                      where um.profile_id=auth.uid()
                        and um.org_id=r.org_id
                        and um.role='manager'
                        and (
                          um.unit_id=p.lead_unit_id
                          or exists (
                            select 1
                            from public.project_units pu
                            where pu.project_id=p.id
                              and pu.unit_id=um.unit_id
                          )
                        )
                    )
                  )
                )
              )
          )
        )
      )
  );
$$;

revoke all on function public.app_can_access_room(uuid) from public,anon;
grant execute on function public.app_can_access_room(uuid) to authenticated,service_role;
