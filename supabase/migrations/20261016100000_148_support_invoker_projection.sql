-- 148: eliminate the public SECURITY DEFINER view without widening case table RLS.
-- The public view becomes SECURITY INVOKER; the narrow reporter-only projection
-- is executed in an unexposed private routine with independently checked grants.
-- This deliberately preserves the approved employee-facing Help Desk contract.
-- Do not grant a reporter SELECT on public.support_cases: that table includes
-- privileged assignment, organisation, impact, and reporter identity columns.

create or replace function private.support_case_safe_status_rows()
returns table (
  id uuid,
  reference text,
  category text,
  summary text,
  description text,
  affected_service text,
  state text,
  opened_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution_summary text
)
language sql stable security definer
set search_path = ''
as $safe$
  select
    sc.id,sc.reference,sc.category,sc.summary,sc.description,
    sc.affected_service,sc.state,sc.opened_at,sc.resolved_at,
    sc.closed_at,sc.resolution_summary
  from public.support_cases as sc
  where auth.uid() is not null
    and public.app_identity_confirmed()
    and sc.org_id = public.app_org_id()
    and (sc.reported_by = auth.uid() or sc.affected_profile_id = auth.uid())
$safe$;

-- Prevent accidental SQL/API execution by anonymous users, including via PUBLIC.
revoke all on function private.support_case_safe_status_rows()
  from public, anon, authenticated, service_role;
grant execute on function private.support_case_safe_status_rows()
  to authenticated, service_role;

-- Preserve the original view name, eleven-column order and PostgREST shape.
-- Authenticated users have USAGE of the existing unexposed private schema;
-- the helper itself returns only verified, tenant-scoped personal case status.
create or replace view public.support_case_safe_status
with (security_invoker = true, security_barrier = true)
as
  select id,reference,category,summary,description,
         affected_service,state,opened_at,resolved_at,closed_at,
         resolution_summary
  from private.support_case_safe_status_rows();

revoke all on public.support_case_safe_status from public, anon, authenticated;
grant select on public.support_case_safe_status to authenticated;

comment on function private.support_case_safe_status_rows() is
  'Unexposed, audited reporter-only case projection. Explicit confirmed identity, tenant, reporter/affected-person checks; no raw case SELECT grant.';
comment on view public.support_case_safe_status is
  'SECURITY INVOKER public projection of the unexposed least-privilege Support personal-status helper. No underlying support_cases SELECT is granted to reporters.';

-- Fail the migration if its intended narrow contract or existing trusted
-- privileged-function surface is not exactly the accepted baseline.
do $ceac_safe_view_gate$
begin
  if not exists (
    select 1 from pg_class c
    where c.oid='public.support_case_safe_status'::regclass
      and 'security_invoker=true'=any(coalesce(c.reloptions,array[]::text[]))
      and 'security_barrier=true'=any(coalesce(c.reloptions,array[]::text[]))
  ) then raise exception 'Support personal-status view must be an invoker security barrier.'; end if;

  if has_table_privilege('anon','public.support_case_safe_status','SELECT')
     or not has_table_privilege('authenticated','public.support_case_safe_status','SELECT')
     or has_function_privilege('anon','private.support_case_safe_status_rows()','EXECUTE')
     or not has_function_privilege('authenticated','private.support_case_safe_status_rows()','EXECUTE')
  then raise exception 'Reporter projection role grants are incorrect.'; end if;

  if (select count(*) from information_schema.columns
        where table_schema='public' and table_name='support_case_safe_status')<>11
  then raise exception 'The Help Desk projection column contract changed.'; end if;

  -- The exact public function allowlist is asserted by the independent
  -- security_definer_surface_gate.sql after full fixture setup. A migration
  -- must not hardcode environment-specific test role grants/counts.

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef
        and has_function_privilege('anon',p.oid,'EXECUTE'))
  then raise exception 'An anonymous privileged RPC was exposed.'; end if;
end
$ceac_safe_view_gate$;
