-- CEAC OS next bundle: Manager requests publication, HR explicitly authorises.
-- Employee cannot read an unpublished formal manager narrative or confidential
-- legacy assessment/development_notes columns through the Data API.
-- Preserve original assessment, review, reflection and audit history.

-- Existing appraisals records contain confidential legacy narrative columns.
-- Do not rely on the frontend omitting those names from SELECT: restrict DB
-- column grants so an authenticated employee cannot query them directly.
revoke select on public.appraisals from public,anon,authenticated;
grant select (
  id,org_id,cycle_id,profile_id,manager_id,unit_id,status,created_at,
  shared_at,reviewer_assignment_reason,opened_by,reviewer_assigned_by,
  reviewer_assigned_at,shared_by,closed_by,closed_at
) on public.appraisals to authenticated;

drop policy if exists stage7_entries_read on public.appraisal_entries;
create policy stage7_entries_read on public.appraisal_entries
for select to authenticated using (
  org_id=public.app_org_id()
  and exists(
    select 1 from public.appraisals a
    where a.id=appraisal_entries.appraisal_id and a.org_id=appraisal_entries.org_id
      and (
        a.manager_id=auth.uid()
        or public.app_has_capability('performance.admin',null)
        or (
          a.profile_id=auth.uid()
          and (
            appraisal_entries.entry_type in ('employee_reflection','staff_response')
            or a.status in ('shared','closed')
          )
        )
      )
  )
);

create table if not exists public.appraisal_release_requests(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  appraisal_id uuid not null unique references public.appraisals(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  reason text not null check(length(btrim(reason)) between 8 and 1000),
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  approval_reason text,
  check(
    (approved_by is null and approved_at is null and approval_reason is null)
    or (approved_by is not null and approved_at is not null
        and length(btrim(coalesce(approval_reason,''))) between 8 and 1000)
  )
);
create index if not exists appraisal_release_requests_org_idx
  on public.appraisal_release_requests(org_id,requested_at desc);
alter table public.appraisal_release_requests enable row level security;
revoke all on public.appraisal_release_requests from public,anon,authenticated;
grant select on public.appraisal_release_requests to authenticated;
create policy appraisal_release_requests_authorised_read
on public.appraisal_release_requests for select to authenticated using(
  org_id=public.app_org_id()
  and (
    public.app_has_capability('performance.admin',null)
    or requested_by=auth.uid()
  )
);

create or replace function public.performance_request_release(
  p_appraisal_id uuid,p_reason text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_review public.appraisals%rowtype;
  v_id uuid;
begin
  if v_actor is null or v_org is null then
    raise exception 'Sign in to request performance review release.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then
    raise exception 'Record why this review is ready for HR release.';
  end if;
  select * into v_review from public.appraisals a
  where a.id=p_appraisal_id and a.org_id=v_org for update;
  if v_review.id is null or v_review.manager_id is distinct from v_actor
     or v_review.status not in ('manager_draft','conversation_recorded') then
    raise exception 'Only the assigned reviewer may request release of an assessed draft.'
      using errcode='42501';
  end if;
  if not exists (
    select 1 from public.appraisal_entries e
    where e.appraisal_id=v_review.id and e.org_id=v_org
      and e.entry_type='manager_assessment'
  ) then raise exception 'Record a manager assessment before requesting release.'; end if;
  insert into public.appraisal_release_requests(
    org_id,appraisal_id,requested_by,reason
  ) values (v_org,v_review.id,v_actor,btrim(p_reason))
  returning id into v_id;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values (v_org,v_actor,'performance_release_requested','appraisal',v_review.id,
    jsonb_build_object('request_id',v_id));
  return v_id;
end;
$$;
revoke all on function public.performance_request_release(uuid,text) from public,anon;
grant execute on function public.performance_request_release(uuid,text) to authenticated;

create or replace function public.performance_hr_authorise_release(
  p_appraisal_id uuid,p_reason text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_review public.appraisals%rowtype;
  v_req public.appraisal_release_requests%rowtype;
begin
  if v_actor is null or v_org is null
     or not public.app_is_admin()
     or not public.app_has_capability('performance.admin',null) then
    raise exception 'HR review publication authority is required.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then
    raise exception 'Record the HR publication decision.';
  end if;
  select * into v_review from public.appraisals a
  where a.id=p_appraisal_id and a.org_id=v_org for update;
  if v_review.id is null or v_review.status not in ('manager_draft','conversation_recorded') then
    raise exception 'An unpublished reviewed assessment is required.' using errcode='42501';
  end if;
  select * into v_req from public.appraisal_release_requests
  where org_id=v_org and appraisal_id=v_review.id and approved_at is null for update;
  if v_req.id is null or v_req.requested_by is distinct from v_review.manager_id
     or v_req.requested_by=v_actor then
    raise exception 'A distinct assigned Manager must request HR release first.'
      using errcode='42501';
  end if;
  update public.appraisal_release_requests set
    approved_by=v_actor,approved_at=now(),approval_reason=btrim(p_reason)
  where id=v_req.id;
  update public.appraisals set status='shared',
    shared_at=now(),shared_by=v_actor where id=v_review.id;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values (v_org,v_actor,'performance_hr_release_authorised','appraisal',v_review.id,
    jsonb_build_object('request_id',v_req.id));
  return jsonb_build_object('appraisal_id',v_review.id,'shared',true);
end;
$$;
revoke all on function public.performance_hr_authorise_release(uuid,text) from public,anon;
grant execute on function public.performance_hr_authorise_release(uuid,text) to authenticated;

-- Disable the older Manager-only release route; neither an API call nor an
-- unupdated client may circumvent HR's recorded approval.
revoke execute on function public.share_performance_review(uuid) from public,anon,authenticated;
