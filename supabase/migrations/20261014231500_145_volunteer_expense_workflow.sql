-- CEAC product release 145: unsalaried volunteer expense and transport support.
-- Distinct from salary, employee Payroll and automatic bank disbursement.
-- Manager confirms duty. HR and Finance document independent consultations
-- (in either order), then either authority may record ONE final payment approval.
-- All data remains append-only/authority-mediated; no direct PostgREST writes.

create table if not exists public.volunteer_expense_requests(
  id uuid primary key default gen_random_uuid(),
  client_key uuid not null,
  org_id uuid not null references public.organisations(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  volunteer_profile_id uuid not null references public.profiles(id) on delete restrict,
  category text not null check(category in ('task_reimbursement','transport_support')),
  duty_date date not null,
  amount_minor bigint not null check(amount_minor between 1 and 999999999999),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  description text not null check(length(btrim(description)) between 8 and 1500),
  receipt_reference text check(receipt_reference is null or length(receipt_reference)<=500),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  state text not null default 'requested' check(state in
    ('requested','manager_confirmed','approved','declined','paid')),
  manager_confirmed_by uuid references public.profiles(id) on delete restrict,
  manager_confirmed_at timestamptz,
  manager_note text,
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  decision_note text,
  paid_by uuid references public.profiles(id) on delete restrict,
  paid_at timestamptz,
  payment_reference text,
  constraint volunteer_expense_idempotency unique(org_id,client_key),
  check((state='requested' and manager_confirmed_by is null and decided_by is null)
    or (state='declined' and decided_by is not null)
    or (state in ('manager_confirmed','approved','paid') and manager_confirmed_by is not null)),
  check((state in ('approved','paid'))=(decided_by is not null and decided_at is not null and
    manager_confirmed_by is not null)),
  check(state<>'paid' or (paid_by is not null and paid_at is not null and
    length(btrim(payment_reference)) between 6 and 300))
);
create index if not exists volunteer_expense_org_state on public.volunteer_expense_requests
  (org_id,state,requested_at desc);
create index if not exists volunteer_expense_person on public.volunteer_expense_requests
  (org_id,volunteer_profile_id,requested_at desc);

create table if not exists public.volunteer_expense_consultations(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  request_id uuid not null references public.volunteer_expense_requests(id) on delete restrict,
  authority text not null check(authority in ('hr','finance')),
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  recommendation text not null check(recommendation in ('support','hold')),
  note text not null check(length(btrim(note)) between 8 and 1000),
  reviewed_at timestamptz not null default now(),
  constraint volunteer_expense_consult_once unique(request_id,authority)
);
create index if not exists volunteer_expense_consult_org on public.volunteer_expense_consultations
  (org_id,request_id);

alter table public.volunteer_expense_requests enable row level security;
alter table public.volunteer_expense_consultations enable row level security;
revoke all on public.volunteer_expense_requests from public,anon,authenticated;
revoke all on public.volunteer_expense_consultations from public,anon,authenticated;
grant select on public.volunteer_expense_requests to authenticated;
grant select on public.volunteer_expense_consultations to authenticated;

create policy volunteer_expense_read on public.volunteer_expense_requests
for select to authenticated
using(
  org_id=public.app_org_id()
  and (
    volunteer_profile_id=auth.uid() or requested_by=auth.uid()
    or (public.app_is_admin() and public.app_has_capability('people.manage',null))
    or exists(select 1 from public.unit_memberships fm
      join public.units fu on fu.id=fm.unit_id and fu.org_id=fm.org_id
      where fm.org_id=volunteer_expense_requests.org_id
        and fm.profile_id=auth.uid() and fu.handles_finance)
    or unit_id in(select public.app_managed_units())
  )
);
create policy volunteer_expense_consult_read on public.volunteer_expense_consultations
for select to authenticated
using(
  org_id=public.app_org_id()
  and exists(select 1 from public.volunteer_expense_requests r
    where r.id=volunteer_expense_consultations.request_id
      and r.org_id=volunteer_expense_consultations.org_id)
);

-- Manager and volunteer may create only for an active member of the real
-- volunteer roster in the selected unit. Retries reuse one idempotency key.
create or replace function public.volunteer_expense_request(
  p_client_key uuid,p_volunteer_profile_id uuid,p_unit_id uuid,p_category text,
  p_duty_date date,p_amount_minor bigint,p_currency text,p_description text,
  p_receipt_reference text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid:=public.app_org_id();v_actor uuid:=auth.uid();v_id uuid;
begin
  if v_org is null or v_actor is null then
    raise exception 'Sign in to request volunteer expenses.' using errcode='42501';
  end if;
  if p_client_key is null or p_volunteer_profile_id is null or p_unit_id is null
    or p_duty_date is null or p_duty_date>(now() at time zone 'Africa/Accra')::date
    or p_category not in ('task_reimbursement','transport_support')
    or p_amount_minor not between 1 and 999999999999
    or p_currency !~ '^[A-Z]{3}$'
    or length(btrim(coalesce(p_description,''))) not between 8 and 1500
    or length(coalesce(p_receipt_reference,''))>500 then
    raise exception 'Provide a valid volunteer assignment and expense.';
  end if;
  if not exists(select 1 from public.employee_roster er
      join public.unit_memberships um
        on um.profile_id=er.profile_id and um.org_id=er.org_id
      where er.profile_id=p_volunteer_profile_id and er.org_id=v_org
        and er.employment_type='volunteer' and er.employment_status='active'
        and um.unit_id=p_unit_id) then
    raise exception 'Only an active, assigned volunteer can request support.' using errcode='42501';
  end if;
  if v_actor is distinct from p_volunteer_profile_id
     and p_unit_id not in(select public.app_managed_units()) then
    raise exception 'Only the volunteer or their authorised manager can request this.' using errcode='42501';
  end if;
  insert into public.volunteer_expense_requests(
    client_key,org_id,unit_id,volunteer_profile_id,category,duty_date,
    amount_minor,currency,description,receipt_reference,requested_by
  ) values(
    p_client_key,v_org,p_unit_id,p_volunteer_profile_id,p_category,p_duty_date,
    p_amount_minor,p_currency,btrim(p_description),nullif(btrim(p_receipt_reference),''),v_actor
  ) on conflict(org_id,client_key) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.volunteer_expense_requests
    where org_id=v_org and client_key=p_client_key and requested_by=v_actor
      and volunteer_profile_id=p_volunteer_profile_id and unit_id=p_unit_id
      and category=p_category and amount_minor=p_amount_minor;
    if v_id is null then
      raise exception 'This submission key belongs to a different request.' using errcode='42501';
    end if;
  else
    insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
    values(v_org,v_actor,'volunteer_expense_requested','volunteer_expense',v_id,
      jsonb_build_object('volunteer_profile_id',p_volunteer_profile_id,'category',p_category));
  end if;
  return v_id;
end;
$$;
revoke all on function public.volunteer_expense_request(uuid,uuid,uuid,text,date,bigint,text,text,text)
  from public,anon;
grant execute on function public.volunteer_expense_request(uuid,uuid,uuid,text,date,bigint,text,text,text)
  to authenticated;

create or replace function public.volunteer_expense_manager_confirm(
  p_request_id uuid,p_confirm boolean,p_note text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid:=public.app_org_id();v_actor uuid:=auth.uid();r public.volunteer_expense_requests%rowtype;
begin
  if v_actor is null or v_org is null or length(btrim(coalesce(p_note,''))) not between 8 and 1000 then
    raise exception 'Authorised manager confirmation and a reason are required.' using errcode='42501';
  end if;
  select * into r from public.volunteer_expense_requests
  where id=p_request_id and org_id=v_org and state='requested' for update;
  if r.id is null or r.unit_id not in(select public.app_managed_units())
    or r.volunteer_profile_id=v_actor then
    raise exception 'Only this volunteer’s authorised manager may confirm duty.' using errcode='42501';
  end if;
  update public.volunteer_expense_requests
    set state=case when p_confirm then 'manager_confirmed' else 'declined' end,
        manager_confirmed_by=case when p_confirm then v_actor else null end,
        manager_confirmed_at=case when p_confirm then now() else null end,
        manager_note=btrim(p_note),
        decided_by=case when p_confirm then null else v_actor end,
        decided_at=case when p_confirm then null else now() end,
        decision_note=case when p_confirm then null else btrim(p_note) end
    where id=r.id;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'volunteer_expense_manager_decision','volunteer_expense',r.id,
    jsonb_build_object('confirmed',p_confirm));
  return jsonb_build_object('request_id',r.id,'confirmed',p_confirm);
end;
$$;
revoke all on function public.volunteer_expense_manager_confirm(uuid,boolean,text) from public,anon;
grant execute on function public.volunteer_expense_manager_confirm(uuid,boolean,text) to authenticated;
