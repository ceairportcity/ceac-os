-- 143 — Manager-approved attendance correction and subsequent HR audit.
-- Corrections are attributable evidence overlays. Never rewrite historical
-- work sessions, GPS readings, leave, Payroll or disciplinary records.
-- No direct user writes: constrained SECURITY DEFINER RPCs enforce authority.
-- Retire pre-review direct correction and reversal API for ordinary clients.
-- All new factual correction overlays must originate from manager approval.
revoke all on function public.workforce_record_attendance_correction(
  uuid,date,uuid,text,jsonb,jsonb,text,uuid
) from public,anon,authenticated;


create table if not exists public.attendance_correction_requests(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  work_date date not null,
  work_session_id uuid references public.work_sessions(id) on delete restrict,
  correction_type text not null check(correction_type in
    ('context_note','start_time','end_time','day_type','administrative_finding')),
  requested_context jsonb not null default '{}'::jsonb
    check(jsonb_typeof(requested_context)='object'),
  reason text not null check(char_length(btrim(reason)) between 8 and 1000),
  status text not null default 'pending' check(status in
    ('pending','manager_approved','manager_declined')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  decision_note text,
  correction_id uuid unique references public.attendance_corrections(id) on delete restrict,
  check(
    (status='pending' and decided_by is null and decided_at is null and correction_id is null)
    or
    (status='manager_declined' and decided_by is not null and decided_at is not null and correction_id is null)
    or
    (status='manager_approved' and decided_by is not null and decided_at is not null and correction_id is not null)
  )
);

create index if not exists attendance_correction_request_subject_idx
  on public.attendance_correction_requests(org_id,profile_id,requested_at desc);
create index if not exists attendance_correction_request_pending_idx
  on public.attendance_correction_requests(org_id,status,requested_at desc);

alter table public.attendance_correction_requests enable row level security;
revoke all on public.attendance_correction_requests from public,anon,authenticated;
grant select on public.attendance_correction_requests to authenticated;

create policy attendance_correction_requests_read
on public.attendance_correction_requests for select to authenticated
using(
  org_id=public.app_org_id()
  and (
    profile_id=auth.uid()
    or requested_by=auth.uid()
    or public.app_is_admin()
    or exists(
      select 1 from public.employment_records er
      where er.profile_id=attendance_correction_requests.profile_id
        and er.org_id=attendance_correction_requests.org_id
        and er.unit_id in(select public.app_managed_units())
    )
  )
);

create table if not exists public.attendance_correction_audits(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  request_id uuid not null unique references public.attendance_correction_requests(id) on delete restrict,
  outcome text not null check(outcome in ('confirmed','requires_follow_up')),
  note text not null check(length(btrim(note)) between 8 and 1000),
  audited_by uuid not null references public.profiles(id) on delete restrict,
  audited_at timestamptz not null default now()
);
alter table public.attendance_correction_audits enable row level security;
revoke all on public.attendance_correction_audits from public,anon,authenticated;
grant select on public.attendance_correction_audits to authenticated;
create policy attendance_correction_audits_read
on public.attendance_correction_audits for select to authenticated
using(
  org_id=public.app_org_id() and (
    public.app_is_admin()
    or exists(select 1 from public.attendance_correction_requests q
      where q.id=attendance_correction_audits.request_id
        and q.org_id=attendance_correction_audits.org_id
        and (q.profile_id=auth.uid() or q.requested_by=auth.uid()
          or exists(select 1 from public.employment_records er
            where er.profile_id=q.profile_id and er.org_id=q.org_id
              and er.unit_id in(select public.app_managed_units())))
    )
  )
);

create or replace function public.attendance_request_correction(
  p_profile_id uuid,
  p_work_date date,
  p_correction_type text,
  p_context jsonb,
  p_reason text,
  p_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_id uuid;
begin
  if v_actor is null or v_org is null then
    raise exception 'Sign in to request an attendance correction.' using errcode='42501';
  end if;
  if p_profile_id is null or p_work_date is null
     or p_work_date>(now() at time zone 'Africa/Accra')::date
     or p_correction_type not in ('context_note','start_time','end_time','day_type','administrative_finding')
     or jsonb_typeof(p_context) is distinct from 'object'
     or length(p_context::text)>2000
     or length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then
    raise exception 'Enter a valid historical attendance correction and explanation.';
  end if;
  if not exists(select 1 from public.profiles p
    where p.id=p_profile_id and p.org_id=v_org) then
    raise exception 'Person not found in this organisation.' using errcode='42501';
  end if;
  if p_profile_id<>v_actor and not public.app_is_admin()
     and not exists(select 1 from public.employment_records er
       where er.profile_id=p_profile_id and er.org_id=v_org
         and er.unit_id in(select public.app_managed_units())) then
    raise exception 'You may request only your own or managed employee correction.' using errcode='42501';
  end if;
  if p_session_id is not null and not exists(select 1 from public.work_sessions s
    where s.id=p_session_id and s.org_id=v_org and s.profile_id=p_profile_id) then
    raise exception 'That work session does not belong to this person.' using errcode='42501';
  end if;
  insert into public.attendance_correction_requests(
    org_id,profile_id,work_date,work_session_id,correction_type,
    requested_context,reason,requested_by
  ) values(v_org,p_profile_id,p_work_date,p_session_id,p_correction_type,
    p_context,btrim(p_reason),v_actor)
  returning id into v_id;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'attendance_correction_requested','attendance_correction_request',v_id,
    jsonb_build_object('profile_id',p_profile_id,'work_date',p_work_date));
  return v_id;
end;
$$;
revoke all on function public.attendance_request_correction(uuid,date,text,jsonb,text,uuid)
  from public,anon;
grant execute on function public.attendance_request_correction(uuid,date,text,jsonb,text,uuid)
  to authenticated;

create or replace function public.attendance_manager_decide_correction(
  p_request_id uuid,
  p_approve boolean,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  q public.attendance_correction_requests%rowtype;
  v_correction uuid;
begin
  if v_actor is null or v_org is null then
    raise exception 'Sign in to review a correction.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_note,''))) not between 8 and 1000 then
    raise exception 'Record a reason for the management decision.';
  end if;
  select * into q from public.attendance_correction_requests
  where id=p_request_id and org_id=v_org for update;
  if q.id is null or q.status<>'pending' then
    raise exception 'This pending correction request is unavailable.' using errcode='42501';
  end if;
  if not exists(select 1 from public.employment_records er
    where er.profile_id=q.profile_id and er.org_id=v_org
      and er.unit_id in(select public.app_managed_units())) then
    raise exception 'Only the employee’s authorised manager may decide.' using errcode='42501';
  end if;

  if coalesce(p_approve,false) then
    insert into public.attendance_corrections(
      org_id,profile_id,work_date,work_session_id,correction_type,
      before_context,after_context,reason,recorded_by
    ) values(v_org,q.profile_id,q.work_date,q.work_session_id,q.correction_type,
      '{}'::jsonb,q.requested_context,q.reason,v_actor)
    returning id into v_correction;
  end if;
  update public.attendance_correction_requests
  set status=case when coalesce(p_approve,false) then 'manager_approved' else 'manager_declined' end,
      decided_by=v_actor,decided_at=now(),decision_note=btrim(p_note),
      correction_id=v_correction
  where id=q.id;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'attendance_manager_correction_decided','attendance_correction_request',q.id,
    jsonb_build_object('approved',coalesce(p_approve,false),'correction_id',v_correction));

  return jsonb_build_object('request_id',q.id,'approved',coalesce(p_approve,false),
    'correction_id',v_correction,'hr_audit_pending',coalesce(p_approve,false));
end;
$$;
revoke all on function public.attendance_manager_decide_correction(uuid,boolean,text)
  from public,anon;
grant execute on function public.attendance_manager_decide_correction(uuid,boolean,text)
  to authenticated;

create or replace function public.attendance_hr_audit_correction(
  p_request_id uuid,
  p_outcome text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  q public.attendance_correction_requests%rowtype;
  v_id uuid;
begin
  if v_actor is null or v_org is null or not public.app_is_admin()
     or not public.app_has_capability('attendance.correct',null) then
    raise exception 'HR attendance audit authority is required.' using errcode='42501';
  end if;
  if p_outcome not in ('confirmed','requires_follow_up')
     or length(btrim(coalesce(p_note,''))) not between 8 and 1000 then
    raise exception 'Choose an HR audit outcome and reason.';
  end if;
  select * into q from public.attendance_correction_requests
  where id=p_request_id and org_id=v_org and status='manager_approved' for update;
  if q.id is null then
    raise exception 'An approved manager correction is required.' using errcode='42501';
  end if;
  insert into public.attendance_correction_audits(
    org_id,request_id,outcome,note,audited_by
  ) values(v_org,q.id,p_outcome,btrim(p_note),v_actor)
  returning id into v_id;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'attendance_hr_correction_audited','attendance_correction_request',q.id,
    jsonb_build_object('outcome',p_outcome,'audit_id',v_id));
  return v_id;
end;
$$;
revoke all on function public.attendance_hr_audit_correction(uuid,text,text)
  from public,anon;
grant execute on function public.attendance_hr_audit_correction(uuid,text,text)
  to authenticated;
