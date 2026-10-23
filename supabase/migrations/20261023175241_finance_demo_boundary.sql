-- A6: reversible, attributable demo classification; original ledgers stay intact.
-- No seeded financial rows are changed or automatically classified here.
create table public.finance_demo_events (
  event_no bigint generated always as identity primary key,
  org_id uuid not null references public.organisations(id),
  record_table text not null check (record_table in ('spend_lines','budgets','finance_requests')),
  record_id uuid not null,
  is_demo boolean not null,
  reason text not null check (length(btrim(reason)) between 10 and 1000),
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default clock_timestamp()
);
create index finance_demo_record_history on public.finance_demo_events(org_id,record_table,record_id,event_no desc);
create index finance_demo_actor on public.finance_demo_events(recorded_by);
alter table public.finance_demo_events enable row level security;
revoke all on public.finance_demo_events from public,anon,authenticated,service_role;
-- Only the classification predicate is exposed to ordinary same-org callers.
-- Reasons and actor history are available through the Administration reader.
grant select(event_no,org_id,record_table,record_id,is_demo) on public.finance_demo_events to authenticated;
create policy finance_demo_read on public.finance_demo_events for select to authenticated
  using (org_id=(select public.app_org_id()));

create function public.finance_record_is_demo(p_table text,p_id uuid,p_org uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce((select e.is_demo from public.finance_demo_events e
    where e.org_id=p_org and e.record_table=p_table and e.record_id=p_id
    order by e.event_no desc limit 1),false);
$$;
revoke all on function public.finance_record_is_demo(text,uuid,uuid) from public,anon;
grant execute on function public.finance_record_is_demo(text,uuid,uuid) to authenticated;

create policy spend_live_records on public.spend_lines as restrictive for select to authenticated
  using (not public.finance_record_is_demo('spend_lines',id,org_id));
create policy budget_live_records on public.budgets as restrictive for select to authenticated
  using (not public.finance_record_is_demo('budgets',id,org_id));
create policy request_live_records on public.finance_requests as restrictive for select to authenticated
  using (not public.finance_record_is_demo('finance_requests',id,org_id));

create function public.admin_finance_demo_records()
returns table(record_table text,record_id uuid,description text,amount_minor bigint,currency text,
  is_demo boolean,event_no bigint,fingerprint text,reason text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.app_is_admin() or public.app_org_id() is null then
    raise exception 'Only Administration can review demonstration finance records.' using errcode='42501';
  end if;
  return query
  with records as (
    select 'spend_lines'::text as kind,s.id,s.org_id,s.description as label,s.amount_minor::bigint as amount,s.currency,md5(to_jsonb(s)::text) as fingerprint from public.spend_lines s
    union all select 'budgets',b.id,b.org_id,coalesce(b.note,'Budget'),b.amount_minor::bigint,b.currency,md5(to_jsonb(b)::text) from public.budgets b
    union all select 'finance_requests',r.id,r.org_id,r.title,r.amount_minor::bigint,r.currency,md5(to_jsonb(r)::text) from public.finance_requests r
  )
  select r.kind,r.id,r.label,r.amount,r.currency,coalesce(e.is_demo,false),coalesce(e.event_no,0),r.fingerprint,e.reason
  from records r left join lateral (
    select h.is_demo,h.event_no,h.reason from public.finance_demo_events h
    where h.org_id=r.org_id and h.record_table=r.kind and h.record_id=r.id
    order by h.event_no desc limit 1
  ) e on true
  where r.org_id=public.app_org_id()
    -- A title only offers a review candidate; it never changes classification.
    and (r.label ilike 'Demo · %' or e.event_no is not null)
  order by r.kind,r.label,r.id;
end; $$;
revoke all on function public.admin_finance_demo_records() from public,anon;
grant execute on function public.admin_finance_demo_records() to authenticated;

create function public.admin_set_finance_demo_record(p_table text,p_id uuid,p_is_demo boolean,
  p_expected_fingerprint text,p_expected_event_no bigint,p_reason text)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_row jsonb; v_previous record; v_event bigint;
begin
  v_org:=public.app_org_id();
  if auth.uid() is null or v_org is null or not public.app_is_admin() then
    raise exception 'Only Administration can classify demonstration finance records.' using errcode='42501';
  end if;
  if p_table is null or p_table not in ('spend_lines','budgets','finance_requests') or p_is_demo is null
    or p_expected_event_no is null or p_expected_fingerprint is null then
    raise exception 'Choose a finance record and refresh its current details.';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then
    raise exception 'Record a reason of 10 to 1000 characters.';
  end if;
  -- Allowlisted relation, tenant restriction, row lock and exact source revision.
  execute format('select to_jsonb(t) from public.%I t where t.id=$1 and t.org_id=$2 for update',p_table)
    into v_row using p_id,v_org;
  if v_row is null then raise exception 'That finance record is unavailable.' using errcode='42501'; end if;
  select e.event_no,e.is_demo into v_previous from public.finance_demo_events e
    where e.org_id=v_org and e.record_table=p_table and e.record_id=p_id order by e.event_no desc limit 1;
  if md5(v_row::text)<>p_expected_fingerprint or coalesce(v_previous.event_no,0)<>p_expected_event_no then
    raise exception 'This record changed. Refresh it before recording a classification.' using errcode='40001';
  end if;
  if coalesce(v_previous.is_demo,false)=p_is_demo then raise exception 'That classification is already recorded.'; end if;
  if p_table='spend_lines' then
    if p_is_demo and (
      exists(select 1 from public.spend_lines s where s.org_id=v_org and s.reverses_id=p_id and not public.finance_record_is_demo('spend_lines',s.id,v_org))
      or exists(select 1 from public.finance_requests r where r.org_id=v_org and r.fulfilled_spend_id=p_id and not public.finance_record_is_demo('finance_requests',r.id,v_org))
    ) then raise exception 'Review the linked live corrections and requests before archiving this spend.'; end if;
    if not p_is_demo and public.finance_record_is_demo('spend_lines',(v_row->>'reverses_id')::uuid,v_org) then
      raise exception 'Restore the original spend before restoring its correction.';
    end if;
  elsif p_table='finance_requests' and not p_is_demo
    and public.finance_record_is_demo('spend_lines',(v_row->>'fulfilled_spend_id')::uuid,v_org) then
    raise exception 'Restore the linked spend before restoring this request.';
  end if;
  insert into public.finance_demo_events(org_id,record_table,record_id,is_demo,reason,recorded_by)
    values(v_org,p_table,p_id,p_is_demo,btrim(p_reason),auth.uid()) returning event_no into v_event;
  return v_event;
end; $$;
revoke all on function public.admin_set_finance_demo_record(text,uuid,boolean,text,bigint,text) from public,anon;
grant execute on function public.admin_set_finance_demo_record(text,uuid,boolean,text,bigint,text) to authenticated;

-- Runs even within existing SECURITY DEFINER decision/fulfilment RPCs.
create function public.guard_finance_demo_record()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_org uuid;
begin
  -- Intermediate multi-stage approvals insert a decision without updating the
  -- request. Guard that insert too, using the same parent-row lock as archival.
  if tg_table_name='finance_request_decisions' then
    select r.org_id into v_org from public.finance_requests r where r.id=new.request_id for update;
    if public.finance_record_is_demo('finance_requests',new.request_id,v_org) then
      raise exception 'Demonstration finance requests cannot be decided. Review their classification first.';
    end if;
    return new;
  end if;
  if tg_op='UPDATE' then
    if public.finance_record_is_demo(tg_table_name,old.id,old.org_id) then
      raise exception 'Demonstration finance records cannot be changed or paid out. Review their classification first.';
    end if;
  end if;
  if tg_table_name='spend_lines' then
    if new.reverses_id is not null then
    perform 1 from public.spend_lines s where s.id=new.reverses_id for update;
    if public.finance_record_is_demo('spend_lines',new.reverses_id,new.org_id) then
      raise exception 'Live spend cannot correct an archived demonstration record.';
    end if;
  end if;
  elsif tg_table_name='finance_requests' then
    if new.fulfilled_spend_id is not null then
    perform 1 from public.spend_lines s where s.id=new.fulfilled_spend_id for update;
    if public.finance_record_is_demo('spend_lines',new.fulfilled_spend_id,new.org_id) then
      raise exception 'Live requests cannot use archived demonstration spend.';
    end if;
  end if;
  end if;
  return new;
end; $$;
revoke all on function public.guard_finance_demo_record() from public,anon,authenticated;
create trigger finance_demo_spend_guard before insert or update on public.spend_lines for each row execute function public.guard_finance_demo_record();
create trigger finance_demo_budget_guard before update on public.budgets for each row execute function public.guard_finance_demo_record();
create trigger finance_demo_request_guard before insert or update on public.finance_requests for each row execute function public.guard_finance_demo_record();
create trigger finance_demo_decision_guard before insert on public.finance_request_decisions for each row execute function public.guard_finance_demo_record();

-- Definer aggregate applies the same classification explicitly.
CREATE OR REPLACE FUNCTION public.unit_budget_position(p_unit_id uuid, p_year integer DEFAULT NULL::integer)
 RETURNS TABLE(currency text, budget_minor bigint, spent_minor bigint, committed_minor bigint, remaining_minor bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with y as (select coalesce(p_year, extract(year from current_date)::int) as yr),
  cur as (
    select currency from budgets where not public.finance_record_is_demo('budgets',id,org_id) and org_id=public.app_org_id() and unit_id = p_unit_id and year = (select yr from y)
    union select currency from spend_lines where not public.finance_record_is_demo('spend_lines',id,org_id) and org_id=public.app_org_id() and unit_id = p_unit_id
    union select currency from finance_requests where not public.finance_record_is_demo('finance_requests',id,org_id) and org_id=public.app_org_id() and unit_id = p_unit_id and state = 'approved'
  ),
  spend as (
    select s.currency,
           coalesce(sum(case when s.reverses_id is null then s.amount_minor else -s.amount_minor end),0)::bigint as amount_minor
    from spend_lines s
    where not public.finance_record_is_demo('spend_lines',s.id,s.org_id) and s.org_id=public.app_org_id() and s.unit_id = p_unit_id
    group by s.currency
  )
  select c.currency,
    coalesce((select sum(amount_minor) from budgets b
               where not public.finance_record_is_demo('budgets',b.id,b.org_id) and b.org_id=public.app_org_id() and b.unit_id = p_unit_id and b.year = (select yr from y) and b.currency = c.currency), 0)::bigint,
    coalesce((select amount_minor from spend s where s.currency = c.currency), 0)::bigint,
    coalesce((select sum(amount_minor) from finance_requests fr
               where not public.finance_record_is_demo('finance_requests',fr.id,fr.org_id) and fr.org_id=public.app_org_id() and fr.unit_id = p_unit_id and fr.state = 'approved' and fr.currency = c.currency), 0)::bigint,
    (
      coalesce((select sum(amount_minor) from budgets b
                 where not public.finance_record_is_demo('budgets',b.id,b.org_id) and b.org_id=public.app_org_id() and b.unit_id = p_unit_id and b.year = (select yr from y) and b.currency = c.currency), 0)
      - coalesce((select amount_minor from spend s where s.currency = c.currency), 0)
      - coalesce((select sum(amount_minor) from finance_requests fr
                   where not public.finance_record_is_demo('finance_requests',fr.id,fr.org_id) and fr.org_id=public.app_org_id() and fr.unit_id = p_unit_id and fr.state = 'approved' and fr.currency = c.currency), 0)
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
