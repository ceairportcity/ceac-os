-- 144 — Owner-approved Manager → HR formal performance assessment release.
-- Source authority: 14 Oct owner operating decisions. Stage 7's earlier direct
-- manager share / instant employee view is superseded; factual evidence and
-- employee-authored reflection remain accessible under their existing grants.
-- Forward-only: immutable assessment entries, audit and existing review rows
-- are retained. No scoring, automatic judgement or retrospective publication.

create table if not exists public.performance_review_release_requests(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  appraisal_id uuid not null references public.appraisals(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_assessment_id uuid not null references public.appraisal_entries(id) on delete restrict,
  requested_at timestamptz not null default now(),
  request_reason text not null check(length(btrim(request_reason)) between 8 and 1000),
  state text not null default 'pending'
    check(state in ('pending','approved','declined')),
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  decision_reason text,
  check(
    (state='pending' and decided_by is null and decided_at is null)
    or
    (state in ('approved','declined') and decided_by is not null and decided_at is not null
       and length(btrim(decision_reason)) between 8 and 1000)
  )
);
create unique index if not exists performance_release_one_pending_idx
  on public.performance_review_release_requests(appraisal_id) where state='pending';
create index if not exists performance_release_org_time_idx
  on public.performance_review_release_requests(org_id,requested_at desc);

alter table public.performance_review_release_requests enable row level security;
revoke all on public.performance_review_release_requests from public,anon,authenticated;
grant select on public.performance_review_release_requests to authenticated;

create policy performance_release_request_read
on public.performance_review_release_requests for select to authenticated
using(
  org_id=public.app_org_id()
  and (
    (public.app_is_admin() and public.app_has_capability('people.manage',null))
    or exists(select 1 from public.appraisals a
      where a.id=performance_review_release_requests.appraisal_id
        and a.org_id=performance_review_release_requests.org_id
        and a.manager_id=auth.uid())
  )
);

-- A SECURITY DEFINER visibility predicate is needed because the release
-- request table itself is restricted to HR and the assigned reviewer.
-- Employee RLS cannot directly SELECT those approval rows.
create or replace function public.performance_employee_release_visible(
  p_appraisal_id uuid,
  p_entry_created_at timestamptz
)
returns boolean
language sql stable security definer set search_path=''
as $
  select coalesce(exists(
    select 1 from public.appraisals a
    join public.performance_review_release_requests d
      on d.appraisal_id=a.id and d.org_id=a.org_id
    where a.id=p_appraisal_id
      and a.org_id=public.app_org_id()
      and a.profile_id=auth.uid()
      and d.state='approved' and d.decided_at>=p_entry_created_at
  ),false);
$;
revoke all on function public.performance_employee_release_visible(uuid,timestamptz)
  from public,anon;
grant execute on function public.performance_employee_release_visible(uuid,timestamptz)
  to authenticated;

-- Prevent a staff member reading unpublished manager-authored assessment or
-- conversation entries directly through PostgREST, regardless of UI hiding.
drop policy if exists stage7_entries_read on public.appraisal_entries;
create policy stage7_entries_read
on public.appraisal_entries for select to authenticated
using(
  org_id=public.app_org_id()
  and exists (
    select 1 from public.appraisals a
    where a.id=appraisal_entries.appraisal_id
      and a.org_id=appraisal_entries.org_id
      and (
        a.manager_id=auth.uid()
        or (public.app_is_admin() and public.app_has_capability('people.manage',null))
        or (
          a.profile_id=auth.uid()
          and (
            appraisal_entries.entry_type not in ('manager_assessment','conversation_record')
            or (
              public.performance_employee_release_visible(
                a.id,appraisal_entries.created_at
              )
            )
          )
        )
      )
  )
);

-- Older appraisal rows retain assessment and development_notes data. Both
-- columns contain legacy narrative; table-level SELECT would bypass the new
-- appraisal_entries row policy. Restrict legacy narrative columns in PostgREST.
-- All currently used Performance.jsx appraisal list queries explicitly select
-- non-confidential fields. Privileged definer RPCs keep their own owner rights.
revoke select on public.appraisals from public,anon,authenticated;
grant select(
  id,org_id,cycle_id,profile_id,manager_id,status,shared_at,created_at,
  unit_id,opened_by,reviewer_assigned_by,reviewer_assigned_at,
  reviewer_assignment_reason,shared_by,closed_by,closed_at
) on public.appraisals to authenticated;

create or replace function public.performance_request_release(
  p_appraisal_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_review public.appraisals%rowtype;
  v_assessment public.appraisal_entries%rowtype;
  v_request uuid;
begin
  if v_actor is null or v_org is null then
    raise exception 'Sign in to request an assessment release.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then
    raise exception 'Record why this assessment is ready for HR review.';
  end if;
  select * into v_review from public.appraisals
  where id=p_appraisal_id and org_id=v_org for update;
  if v_review.id is null or v_review.manager_id is distinct from v_actor then
    raise exception 'Only the assigned reviewer may request release.' using errcode='42501';
  end if;
  select * into v_assessment from public.appraisal_entries
  where appraisal_id=v_review.id and org_id=v_org and entry_type='manager_assessment'
  order by created_at desc,id desc limit 1;
  if v_assessment.id is null then
    raise exception 'Record a manager-authored assessment before requesting release.';
  end if;
  if exists(
    select 1 from public.performance_review_release_requests d
    where d.appraisal_id=v_review.id and d.state='approved'
      and d.requested_assessment_id=v_assessment.id
  ) then
    raise exception 'The current assessment version has already been released by HR.';
  end if;
  insert into public.performance_review_release_requests(
    org_id,appraisal_id,requested_by,requested_assessment_id,request_reason
  ) values(v_org,v_review.id,v_actor,v_assessment.id,btrim(p_reason))
  returning id into v_request;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'performance_release_requested','performance_review',v_review.id,
    jsonb_build_object('request_id',v_request,'assessment_id',v_assessment.id));
  return v_request;
end;
$$;
revoke all on function public.performance_request_release(uuid,text) from public,anon;
grant execute on function public.performance_request_release(uuid,text) to authenticated;

create or replace function public.performance_hr_decide_release(
  p_request_id uuid,
  p_approve boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_request public.performance_review_release_requests%rowtype;
  v_review public.appraisals%rowtype;
  v_latest uuid;
  v_ok boolean:=coalesce(p_approve,false);
begin
  if v_actor is null or v_org is null
     or not public.app_is_admin()
     or not public.app_has_capability('people.manage',null) then
    raise exception 'HR release authority is required.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then
    raise exception 'Record the HR release decision and reason.';
  end if;
  select * into v_request from public.performance_review_release_requests
  where id=p_request_id and org_id=v_org and state='pending' for update;
  if v_request.id is null then
    raise exception 'This pending assessment release request is unavailable.' using errcode='42501';
  end if;
  select * into v_review from public.appraisals
  where id=v_request.appraisal_id and org_id=v_org for update;
  if v_review.id is null or v_review.status='closed'
     or v_review.manager_id is distinct from v_request.requested_by
     or v_actor=v_request.requested_by then
    raise exception 'The assigned reviewer changed. Request a fresh review.' using errcode='42501';
  end if;
  select id into v_latest from public.appraisal_entries
  where appraisal_id=v_review.id and org_id=v_org and entry_type='manager_assessment'
  order by created_at desc,id desc limit 1;
  if v_latest is distinct from v_request.requested_assessment_id then
    raise exception 'The manager assessment changed. Request HR review of the latest version.' using errcode='42501';
  end if;
  update public.performance_review_release_requests
  set state=case when v_ok then 'approved' else 'declined' end,
      decided_by=v_actor,decided_at=now(),decision_reason=btrim(p_reason)
  where id=v_request.id;
  if v_ok then
    update public.appraisals
    set status='shared',shared_at=now(),shared_by=v_actor
    where id=v_review.id;
  end if;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'performance_hr_release_decided','performance_review',v_review.id,
    jsonb_build_object('request_id',v_request.id,'approved',v_ok,'assessment_id',v_latest));

  return jsonb_build_object('request_id',v_request.id,'approved',v_ok,
    'appraisal_id',v_review.id,'manager_assessment_id',v_latest);
end;
$$;
revoke all on function public.performance_hr_decide_release(uuid,boolean,text) from public,anon;
grant execute on function public.performance_hr_decide_release(uuid,boolean,text) to authenticated;

-- Retire the old direct Manager→Employee publication route. The old API
-- remains callable only to return an explicit refusal to unsafe publication.
create or replace function public.share_performance_review(p_appraisal_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  raise exception 'Manager requests assessment release; HR authorises publication.'
    using errcode='42501';
end;
$$;
revoke all on function public.share_performance_review(uuid) from public,anon;
grant execute on function public.share_performance_review(uuid) to authenticated;
