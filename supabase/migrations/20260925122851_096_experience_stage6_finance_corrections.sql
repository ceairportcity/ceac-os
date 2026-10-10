-- Experience Stage 6: departmental spending and factual unit operating position.
-- Managers may record spend only for units they manage. Spend remains append-only.
-- Actual operating position is separated from budget planning and never combines currencies.

drop policy if exists sp_insert on public.spend_lines;
create policy sp_insert on public.spend_lines for insert
  with check (
    org_id = public.app_org_id()
    and entered_by = auth.uid()
    and (
      public.app_is_admin()
      or unit_id in (select public.app_managed_units())
      or exists (
        select 1
        from public.unit_memberships m
        join public.units u on u.id = m.unit_id
        where m.profile_id = auth.uid()
          and m.unit_id = spend_lines.unit_id
          and u.handles_finance
      )
    )
  );

create or replace function public.unit_operating_position(p_unit_id uuid)
returns table (
  currency text,
  in_minor bigint,
  out_minor bigint,
  committed_minor bigint,
  remaining_minor bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with allowed as (
    select p_unit_id as unit_id
    where p_unit_id in (select public.app_managed_units())
       or public.app_is_admin()
       or public.app_is_exec()
       or exists (
         select 1
         from public.unit_memberships m
         join public.units u on u.id = m.unit_id
         where m.profile_id = auth.uid()
           and u.handles_finance
       )
  ),
  currencies as (
    select t.currency
    from public.internal_transfers t, allowed a
    where t.to_unit_id = a.unit_id and t.state = 'confirmed'
    union
    select s.currency
    from public.spend_lines s, allowed a
    where s.unit_id = a.unit_id
    union
    select r.currency
    from public.finance_requests r, allowed a
    where r.unit_id = a.unit_id and r.state = 'approved'
  ),
  incoming as (
    select t.currency, coalesce(sum(t.amount_minor),0)::bigint as amount_minor
    from public.internal_transfers t, allowed a
    where t.to_unit_id = a.unit_id and t.state = 'confirmed'
    group by t.currency
  ),
  outgoing as (
    select s.currency,
           coalesce(sum(case when s.reverses_id is null then s.amount_minor else -s.amount_minor end),0)::bigint as amount_minor
    from public.spend_lines s, allowed a
    where s.unit_id = a.unit_id
    group by s.currency
  ),
  commitments as (
    select r.currency, coalesce(sum(r.amount_minor),0)::bigint as amount_minor
    from public.finance_requests r, allowed a
    where r.unit_id = a.unit_id and r.state = 'approved'
    group by r.currency
  )
  select c.currency,
         coalesce(i.amount_minor,0)::bigint,
         coalesce(o.amount_minor,0)::bigint,
         coalesce(k.amount_minor,0)::bigint,
         (coalesce(i.amount_minor,0)-coalesce(o.amount_minor,0)-coalesce(k.amount_minor,0))::bigint
  from currencies c
  left join incoming i using(currency)
  left join outgoing o using(currency)
  left join commitments k using(currency)
  order by c.currency;
$$;

revoke all on function public.unit_operating_position(uuid) from public;
grant execute on function public.unit_operating_position(uuid) to authenticated;
