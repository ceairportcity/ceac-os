-- 128 — Independently reviewed cross-tenant budget read boundary (DRAFT).
-- Derived from verified existing CEAC production RPC; no live writes.
-- This SECURITY DEFINER bypasses table RLS and formerly allowed any
-- authenticated administrator/executive/finance-unit member to request budget
-- figures for a unit in a different organisation by UUID.
-- Preserve valid same-organisation Finance/Executive/Admin and unit-manager
-- availability. Require the requested unit to belong to the active caller org.
-- Require Finance membership to be in that same organisation and associated
-- with a same-org Finance unit, preventing foreign memberships granting access.
-- No existing grants, table contents or history are modified.
-- Apply ONLY after complete disposable migration replay / real backup restore
-- and independent role/finance/payroll adversarial verification.

CREATE OR REPLACE FUNCTION public.unit_budget_position(p_unit_id uuid, p_year integer DEFAULT NULL::integer)
 RETURNS TABLE(currency text, budget_minor bigint, spent_minor bigint, committed_minor bigint, remaining_minor bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with y as (select coalesce(p_year, extract(year from current_date)::int) as yr),
  cur as (
    select currency from budgets where unit_id = p_unit_id and year = (select yr from y)
    union select currency from spend_lines where unit_id = p_unit_id
    union select currency from finance_requests where unit_id = p_unit_id and state = 'approved'
  ),
  spend as (
    select s.currency,
           coalesce(sum(case when s.reverses_id is null then s.amount_minor else -s.amount_minor end),0)::bigint as amount_minor
    from spend_lines s
    where s.unit_id = p_unit_id
    group by s.currency
  )
  select c.currency,
    coalesce((select sum(amount_minor) from budgets b
               where b.unit_id = p_unit_id and b.year = (select yr from y) and b.currency = c.currency), 0)::bigint,
    coalesce((select amount_minor from spend s where s.currency = c.currency), 0)::bigint,
    coalesce((select sum(amount_minor) from finance_requests fr
               where fr.unit_id = p_unit_id and fr.state = 'approved' and fr.currency = c.currency), 0)::bigint,
    (
      coalesce((select sum(amount_minor) from budgets b
                 where b.unit_id = p_unit_id and b.year = (select yr from y) and b.currency = c.currency), 0)
      - coalesce((select amount_minor from spend s where s.currency = c.currency), 0)
      - coalesce((select sum(amount_minor) from finance_requests fr
                   where fr.unit_id = p_unit_id and fr.state = 'approved' and fr.currency = c.currency), 0)
    )::bigint
  from cur c
  where exists (
    select 1 from public.units requested
    where requested.id=p_unit_id
      and requested.org_id=public.app_org_id()
  )
  and (
    p_unit_id in (select public.app_managed_units())
    or public.app_is_admin()
    or public.app_is_exec()
    or exists (
      select 1
      from public.unit_memberships m
      join public.units finance_unit
        on finance_unit.id=m.unit_id
       and finance_unit.org_id=m.org_id
      where m.profile_id=auth.uid()
        and m.org_id=public.app_org_id()
        and finance_unit.handles_finance
    )
  );
$function$
