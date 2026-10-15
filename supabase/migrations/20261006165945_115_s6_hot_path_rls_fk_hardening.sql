-- 115 — S6 hot-path RLS/init-plan and targeted FK hardening.
--
-- Scope is intentionally narrow:
-- - optimise only advisor-confirmed hot RLS policies with row-independent
--   auth/authority helpers;
-- - add only high-value FK indexes on authority/work/session/submission/alert
--   paths observed in live workload;
-- - do not alter protected-HR direct-access boundaries;
-- - do not consolidate permissive policies or drop unused indexes in this tranche.

create index if not exists unit_memberships_org_id_idx
  on public.unit_memberships(org_id);

create index if not exists capability_grants_scope_unit_id_idx
  on public.capability_grants(scope_unit_id);

create index if not exists work_items_assigned_by_idx
  on public.work_items(assigned_by);

create index if not exists work_items_phase_id_idx
  on public.work_items(phase_id);

create index if not exists work_items_responsibility_id_idx
  on public.work_items(responsibility_id);

create index if not exists work_sessions_work_item_id_idx
  on public.work_sessions(work_item_id);

create index if not exists submissions_session_id_idx
  on public.submissions(session_id);

create index if not exists alerts_org_id_idx
  on public.alerts(org_id);

alter policy memberships_read
on public.unit_memberships
using (
  org_id = (select public.app_org_id())
  and (
    profile_id = (select auth.uid())
    or unit_id in (select public.app_visible_units())
  )
);

alter policy capability_grants_read
on public.capability_grants
using (
  org_id = (select public.app_org_id())
  and (
    profile_id = (select auth.uid())
    or (select public.app_has_capability('authority.manage',null::uuid))
  )
);

alter policy stage9_work_sessions_workforce_read
on public.work_sessions
using (
  org_id = (select public.app_org_id())
  and (
    profile_id = (select auth.uid())
    or (select public.app_has_capability('workforce.manage',null::uuid))
    or (select public.app_has_capability('attendance.correct',null::uuid))
    or exists (
      select 1
      from public.employment_records er
      where er.profile_id = work_sessions.profile_id
        and er.org_id = (select public.app_org_id())
        and er.unit_id in (select public.app_managed_units())
    )
  )
);
