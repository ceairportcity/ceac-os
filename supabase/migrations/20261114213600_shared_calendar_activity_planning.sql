-- Shared plans use the existing calendar records, with a narrower audience for
-- newly created unit plans. Existing ministry events retain their read policy.
alter table public.ministry_events
  add column project_id uuid references public.projects(id) on delete set null,
  add column is_unit_plan boolean not null default false,
  add constraint ministry_events_unit_plan_scope check (
    not is_unit_plan or scope = 'unit' and unit_id is not null
  );

create policy ministry_events_unit_plan_read
on public.ministry_events as restrictive for select to authenticated
using (
  not is_unit_plan or public.app_is_admin() or public.app_is_exec()
  or unit_id in (select public.app_my_units())
  or exists (
    select 1 from public.unit_memberships m
    where m.org_id = ministry_events.org_id and m.unit_id = ministry_events.unit_id
      and m.profile_id = auth.uid()
  )
);

create policy ministry_events_unit_plan_insert
on public.ministry_events for insert to authenticated
with check (is_unit_plan);

create policy ministry_events_unit_plan_insert_guard
on public.ministry_events as restrictive for insert to authenticated
with check (
  (not is_unit_plan and project_id is null)
  or (
    is_unit_plan and org_id = public.app_org_id()
    and auth.uid() is not null and public.app_stage2_universal_aal_allowed()
    and created_by = auth.uid() and updated_by is null and not cancelled
    and length(btrim(title)) between 1 and 160
    and length(coalesce(location, '')) <= 200
    and length(coalesce(notes, '')) <= 2000
    and exists (
      select 1 from public.units u
      where u.id = ministry_events.unit_id and u.org_id = ministry_events.org_id and u.active
    )
    and (public.app_is_admin() or public.app_is_exec() or unit_id in (select public.app_managed_units()))
    and (project_id is null or exists (
      select 1 from public.projects p
      where p.id = ministry_events.project_id and p.org_id = ministry_events.org_id
        and p.id in (select public.app_visible_projects())
        and (p.lead_unit_id = ministry_events.unit_id or exists (
          select 1 from public.project_units pu where pu.project_id = p.id and pu.unit_id = ministry_events.unit_id
        ))
    ))
  )
);

-- Existing calendar maintainers can still maintain legacy records. Shared plans
-- are created through the scoped policy above and cannot be converted into
-- church-wide records through the legacy update policy.
create policy ministry_events_unit_plan_update_guard
on public.ministry_events as restrictive for update to authenticated
using (not is_unit_plan)
with check (not is_unit_plan and project_id is null);

create policy ministry_events_unit_plan_delete_guard
on public.ministry_events as restrictive for delete to authenticated
using (not is_unit_plan);
