-- 146: Volunteer expenses/transport are NOT salaries or payroll entries.
-- All decisions preserve manager assignment evidence and both HR/Finance
-- consultations; final authorization is not payment confirmation.
create table if not exists public.volunteer_reimbursement_requests(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  volunteer_id uuid not null references public.profiles(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  kind text not null check(kind in ('task_expense','transport_support')),
  amount_minor bigint not null check(amount_minor>0),
  currency text not null default 'GHS' check(currency='GHS'),
  activity_context text not null check(length(btrim(activity_context)) between 10 and 1200),
  reason text not null check(length(btrim(reason)) between 8 and 1200),
  status text not null default 'requested'
    check(status in ('requested','manager_confirmed','authorised','declined')),
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  manager_confirmed_by uuid references public.profiles(id),
  manager_confirmed_at timestamptz,
  manager_note text,
  hr_consulted_by uuid references public.profiles(id),
  hr_consulted_at timestamptz,
  hr_note text,
  finance_consulted_by uuid references public.profiles(id),
  finance_consulted_at timestamptz,
  finance_note text,
  authorised_by uuid references public.profiles(id),
  authorised_at timestamptz,
  authorization_note text,
  check(status<>'authorised' or
    (manager_confirmed_by is not null and hr_consulted_by is not null
      and finance_consulted_by is not null and authorised_by is not null))
);
create index if not exists volunteer_reimbursement_org_time_idx
  on public.volunteer_reimbursement_requests(org_id,requested_at desc);
alter table public.volunteer_reimbursement_requests enable row level security;
revoke all on public.volunteer_reimbursement_requests from public,anon,authenticated;
grant select on public.volunteer_reimbursement_requests to authenticated;
create policy volunteer_reimbursement_scope_read
on public.volunteer_reimbursement_requests for select to authenticated
using(
  org_id=public.app_org_id() and (
    volunteer_id=auth.uid()
    or unit_id in(select public.app_managed_units())
    or (public.app_is_admin() and public.app_has_capability('people.manage',null))
    or exists(select 1 from public.unit_memberships m
      join public.units u on u.id=m.unit_id
      where m.profile_id=auth.uid() and m.org_id=public.app_org_id()
        and u.handles_finance)
  )
);

create or replace function public.volunteer_reimbursement_request(
  p_kind text,p_amount_minor bigint,p_activity_context text,p_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_employment public.employment_records%rowtype;
  v_id uuid;
begin
  if v_org is null or v_actor is null then
    raise exception 'Sign in before requesting reimbursement.' using errcode='42501';
  end if;
  select * into v_employment from public.employment_records
  where profile_id=v_actor and org_id=v_org
    and employment_type='volunteer' and employment_status='active';
  if v_employment.profile_id is null or v_employment.unit_id is null then
    raise exception 'An active HR-approved volunteer assignment is required.'
      using errcode='42501';
  end if;
  if p_kind not in ('task_expense','transport_support')
     or coalesce(p_amount_minor,0)<=0
     or length(btrim(coalesce(p_activity_context,''))) not between 10 and 1200
     or length(btrim(coalesce(p_reason,''))) not between 8 and 1200 then
    raise exception 'Provide the assignment, actual amount and reason.';
  end if;
  insert into public.volunteer_reimbursement_requests(
    org_id,volunteer_id,unit_id,kind,amount_minor,activity_context,reason,requested_by
  ) values (v_org,v_actor,v_employment.unit_id,p_kind,p_amount_minor,
    btrim(p_activity_context),btrim(p_reason),v_actor)
  returning id into v_id;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'volunteer_expense_requested','volunteer_reimbursement',v_id,
    jsonb_build_object('category',p_kind,'amount_minor',p_amount_minor));
  return v_id;
end;
$$;
revoke all on function public.volunteer_reimbursement_request(text,bigint,text,text)
  from public,anon;
grant execute on function public.volunteer_reimbursement_request(text,bigint,text,text)
  to authenticated;

create or replace function public.volunteer_reimbursement_review(
  p_request_id uuid,p_action text,p_note text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  r public.volunteer_reimbursement_requests%rowtype;
  v_hr boolean;
  v_finance boolean;
  v_manager boolean;
begin
  if v_org is null or v_actor is null then
    raise exception 'Sign in to review this volunteer request.' using errcode='42501';
  end if;
  if p_action not in ('manager_confirm','hr_consult','finance_consult','authorise','decline')
     or length(btrim(coalesce(p_note,''))) not between 8 and 1200 then
    raise exception 'Choose a permitted action and record an attributable review.';
  end if;
  select * into r from public.volunteer_reimbursement_requests
  where id=p_request_id and org_id=v_org for update;
  if r.id is null or r.status in ('authorised','declined') then
    raise exception 'An open volunteer request in this organisation is required.'
      using errcode='42501';
  end if;
  v_hr:=public.app_is_admin() and public.app_has_capability('people.manage',null);
  v_manager:=r.unit_id in(select public.app_managed_units());
  select exists(select 1 from public.unit_memberships m
    join public.units u on u.id=m.unit_id
    where m.profile_id=v_actor and m.org_id=v_org and u.handles_finance)
    into v_finance;

  if p_action='manager_confirm' then
    if not v_manager or r.status<>'requested' then
      raise exception 'The assigned Manager must confirm the activity first.'
        using errcode='42501';
    end if;
    update public.volunteer_reimbursement_requests
      set status='manager_confirmed',manager_confirmed_by=v_actor,
          manager_confirmed_at=now(),manager_note=btrim(p_note)
    where id=r.id;
  elsif p_action='hr_consult' then
    if not v_hr or r.status<>'manager_confirmed' or r.hr_consulted_by is not null then
      raise exception 'A single documented HR consultation is required.' using errcode='42501';
    end if;
    update public.volunteer_reimbursement_requests
      set hr_consulted_by=v_actor,hr_consulted_at=now(),hr_note=btrim(p_note)
    where id=r.id;
  elsif p_action='finance_consult' then
    if not v_finance or r.status<>'manager_confirmed' or r.finance_consulted_by is not null then
      raise exception 'A single documented Finance consultation is required.' using errcode='42501';
    end if;
    update public.volunteer_reimbursement_requests
      set finance_consulted_by=v_actor,finance_consulted_at=now(),finance_note=btrim(p_note)
    where id=r.id;
  elsif p_action='authorise' then
    if not (v_hr or v_finance) or r.status<>'manager_confirmed'
       or r.hr_consulted_by is null or r.finance_consulted_by is null then
      raise exception 'Manager confirmation and both HR/Finance consultations are required before authorization.'
        using errcode='42501';
    end if;
    update public.volunteer_reimbursement_requests
      set status='authorised',authorised_by=v_actor,
          authorised_at=now(),authorization_note=btrim(p_note)
    where id=r.id;
  elsif p_action='decline' then
    if not (v_hr or v_finance) or r.status<>'manager_confirmed' then
      raise exception 'Only HR or Finance may decline a manager-confirmed request.'
        using errcode='42501';
    end if;
    update public.volunteer_reimbursement_requests
      set status='declined',authorised_by=v_actor,
          authorised_at=now(),authorization_note=btrim(p_note)
    where id=r.id;
  end if;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'volunteer_reimbursement_reviewed','volunteer_reimbursement',r.id,
    jsonb_build_object('action',p_action,'final',p_action in ('authorise','decline')));
  return jsonb_build_object('request_id',r.id,'action',p_action,
    'payment_completed',false,'salary',false);
end;
$$;
revoke all on function public.volunteer_reimbursement_review(uuid,text,text)
  from public,anon;
grant execute on function public.volunteer_reimbursement_review(uuid,text,text)
  to authenticated;
