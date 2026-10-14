-- CEAC next-bundle: formal performance assessments are confidential until
-- Manager requests release and authorised HR explicitly approves.
-- Prior owner decision overrides the earlier visible-as-written Stage 7 draft.
-- The employee may still see factual evidence, their own reflections,
-- ordinary direct feedback and assessments ALREADY formally released.

create table if not exists public.performance_release_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  appraisal_id uuid not null references public.appraisals(id) on delete restrict,
  assessment_entry_id uuid not null references public.appraisal_entries(id) on delete restrict,
  manager_id uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  decision text not null default 'pending'
    check(decision in ('pending','approved','declined')),
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  decision_reason text,
  check((decision='pending' and decided_by is null and decided_at is null)
     or (decision<>'pending' and decided_by is not null
         and decided_at is not null and length(btrim(decision_reason)) between 8 and 1000))
);
create unique index if not exists performance_release_one_pending
  on public.performance_release_requests(appraisal_id) where decision='pending';
create index if not exists performance_release_by_case
  on public.performance_release_requests(org_id,appraisal_id,requested_at desc);
alter table public.performance_release_requests enable row level security;
revoke all on public.performance_release_requests from public,anon,authenticated;
grant select on public.performance_release_requests to authenticated;
create policy performance_release_read on public.performance_release_requests
for select to authenticated
using (
  org_id=public.app_org_id()
  and exists (
    select 1 from public.appraisals a
    where a.id=performance_release_requests.appraisal_id and a.org_id=org_id
      and (a.manager_id=auth.uid()
        or (public.app_is_admin() and public.app_has_capability('people.manage',null))
        or (a.profile_id=auth.uid() and decision='approved'))
  )
);

-- Employee-facing SELECT on appraisals must not expose historic free-text
-- assessment/development_notes columns. The current Performance client
-- already requests only its allowed operational columns. RLS cannot hide
-- individual columns, so restrict column privileges independently.
revoke select on public.appraisals from public,anon,authenticated;
grant select (
  id,org_id,cycle_id,profile_id,manager_id,status,shared_at,created_at,
  unit_id,opened_by,reviewer_assigned_by,reviewer_assigned_at,
  reviewer_assignment_reason,shared_by,closed_by,closed_at
) on public.appraisals to authenticated;

-- Manager and authorised HR can read a private assessment draft.
-- Staff cannot read any manager narrative/version created after the latest
-- authorised HR publication. The approval is bound to the exact assessment
-- version; a later revision cannot inherit an earlier release.
drop policy if exists stage7_entries_read on public.appraisal_entries;
create policy stage7_entries_read on public.appraisal_entries
for select to authenticated
using (
  org_id=public.app_org_id()
  and exists (
    select 1 from public.appraisals a
    where a.id=appraisal_entries.appraisal_id and a.org_id=org_id
    and (
      a.manager_id=auth.uid()
      or (public.app_is_admin() and public.app_has_capability('people.manage',null))
      or (
        a.profile_id=auth.uid() and (
          appraisal_entries.entry_type not in ('manager_assessment','conversation_record')
          or exists(
            select 1 from public.performance_release_requests rr
            where rr.appraisal_id=a.id and rr.org_id=a.org_id
              and rr.decision='approved'
              and rr.decided_at >= appraisal_entries.created_at
              -- A published approval never exposes a draft written later.
              -- Do not query appraisal_entries from its own RLS policy:
              -- that would recursively evaluate this same policy.
          )
        )
      )
    )
  )
);

-- Keep existing single-argument client RPC name as the manager's REQUEST,
-- not a publication action. This blocks older clients from bypassing HR.
create or replace function public.share_performance_review(p_appraisal_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_case public.appraisals%rowtype;
  v_assessment uuid;
begin
  if v_actor is null or v_org is null then
    raise exception 'Sign in to request a review release.' using errcode='42501';
  end if;
  select * into v_case from public.appraisals
    where id=p_appraisal_id and org_id=v_org for update;
  if v_case.id is null or v_case.manager_id is distinct from v_actor
     or v_case.status='closed' then
    raise exception 'Only the current assigned reviewer may request release.' using errcode='42501';
  end if;
  select e.id into v_assessment from public.appraisal_entries e
  where e.appraisal_id=v_case.id and e.org_id=v_org
    and e.entry_type='manager_assessment'
    and not exists(select 1 from public.appraisal_entries revised
      where revised.supersedes_id=e.id and revised.appraisal_id=v_case.id)
  order by e.created_at desc,e.id desc limit 1;
  if v_assessment is null then
    raise exception 'Record a narrative assessment before requesting HR release.';
  end if;
  if exists(select 1 from public.performance_release_requests r
    where r.appraisal_id=v_case.id and r.decision='approved'
      and r.assessment_entry_id=v_assessment) then
    raise exception 'The latest assessment is already approved for employee release.';
  end if;
  if exists(select 1 from public.performance_release_requests r
    where r.appraisal_id=v_case.id and r.decision='pending') then
    raise exception 'HR already has an outstanding release request for this review.';
  end if;

  insert into public.performance_release_requests(
    org_id,appraisal_id,assessment_entry_id,manager_id
  ) values(v_org,v_case.id,v_assessment,v_actor);
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'performance_release_requested','appraisal',v_case.id,
    jsonb_build_object('assessment_entry_id',v_assessment));
end;
$$;
revoke all on function public.share_performance_review(uuid) from public,anon;
grant execute on function public.share_performance_review(uuid) to authenticated;

create or replace function public.performance_hr_decide_release(
  p_request_id uuid,p_approve boolean,p_reason text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_request public.performance_release_requests%rowtype;
  v_case public.appraisals%rowtype;
  v_latest uuid;
begin
  if v_actor is null or v_org is null or not public.app_is_admin()
     or not public.app_has_capability('people.manage',null) then
    raise exception 'HR authorisation is required for publication.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then
    raise exception 'Record the HR publication decision and reason.';
  end if;
  select * into v_request from public.performance_release_requests
  where id=p_request_id and org_id=v_org and decision='pending' for update;
  if v_request.id is null then
    raise exception 'A pending review request is required.' using errcode='42501';
  end if;
  select * into v_case from public.appraisals
  where id=v_request.appraisal_id and org_id=v_org for update;
  if v_case.id is null or v_case.status='closed'
    or v_case.manager_id is distinct from v_request.manager_id
    or v_actor=v_request.manager_id then
    raise exception 'The release requires independent current HR authorisation.' using errcode='42501';
  end if;
  select e.id into v_latest from public.appraisal_entries e
  where e.appraisal_id=v_case.id and e.org_id=v_org
    and e.entry_type='manager_assessment'
    and not exists(select 1 from public.appraisal_entries revised
      where revised.supersedes_id=e.id and revised.appraisal_id=v_case.id)
  order by e.created_at desc,e.id desc limit 1;
  if v_latest is distinct from v_request.assessment_entry_id then
    raise exception 'The assessment changed after the release request. Request HR approval for the current version.';
  end if;
  update public.performance_release_requests
  set decision=case when p_approve then 'approved' else 'declined' end,
      decided_by=v_actor,decided_at=now(),decision_reason=btrim(p_reason)
  where id=v_request.id;

  if p_approve then
    update public.appraisals
    set status='shared',shared_at=now(),shared_by=v_actor
    where id=v_case.id;
  end if;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'performance_hr_release_decided','appraisal',v_case.id,
    jsonb_build_object('approved',p_approve,'request_id',v_request.id,
                       'assessment_entry_id',v_request.assessment_entry_id));
  return jsonb_build_object('request_id',v_request.id,'approved',p_approve,'appraisal_id',v_case.id);
end;
$$;
revoke all on function public.performance_hr_decide_release(uuid,boolean,text)
  from public,anon;
grant execute on function public.performance_hr_decide_release(uuid,boolean,text)
  to authenticated;


-- A development plan written alongside the manager assessment is part of
-- the restricted formal review, not automatically public on initial drafting.
drop policy if exists stage7_development_read on public.development_plan_versions;
create policy stage7_development_read on public.development_plan_versions
for select to authenticated
using (
  org_id=public.app_org_id() and
  (
    manager_id=auth.uid()
    or (public.app_is_admin() and public.app_has_capability('people.manage',null))
    or (
      profile_id=auth.uid() and exists (
        select 1 from public.performance_release_requests r
        where r.appraisal_id=development_plan_versions.appraisal_id
          and r.org_id=development_plan_versions.org_id
          and r.decision='approved'
          and r.decided_at >= development_plan_versions.created_at
      )
    )
  )
);

-- A manager revision after HR publication reopens the draft instead of
-- pretending the newly written version was approved. Existing HR-approved
-- manager narrative history remains visible to the employee.
CREATE OR REPLACE FUNCTION public.record_appraisal_entry(p_appraisal_id uuid, p_entry_type text, p_body text, p_supersedes_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_appraisal public.appraisals;
  v_prior public.appraisal_entries;
  v_id uuid;
begin
  select * into v_appraisal
  from public.appraisals
  where id=p_appraisal_id and org_id=v_org;

  if v_appraisal.id is null then
    raise exception 'Review case not found.' using errcode='42501';
  end if;
  if p_entry_type not in (
    'employee_reflection','manager_assessment','conversation_record','staff_response'
  ) then
    raise exception 'That review entry type is not supported.';
  end if;
  if length(btrim(coalesce(p_body,'')))<3 then
    raise exception 'Write at least a short review note.';
  end if;

  if p_entry_type in ('manager_assessment','conversation_record')
     and v_appraisal.status='closed' then
    raise exception 'A closed review cannot receive new unreleased manager text.' using errcode='42501';
  end if;

  if p_entry_type in ('employee_reflection','staff_response') then
    if v_actor is distinct from v_appraisal.profile_id then
      raise exception 'Only the employee can write this part of the review.' using errcode='42501';
    end if;
  else
    if v_actor is distinct from v_appraisal.manager_id then
      raise exception 'Only the assigned reviewer can write this part of the review.' using errcode='42501';
    end if;
  end if;

  if p_supersedes_id is not null then
    select * into v_prior
    from public.appraisal_entries
    where id=p_supersedes_id
      and appraisal_id=v_appraisal.id
      and entry_type=p_entry_type;

    if v_prior.id is null then
      raise exception 'The review entry being revised was not found.';
    end if;
    if exists(select 1 from public.appraisal_entries where supersedes_id=v_prior.id) then
      raise exception 'That review entry has already been revised.';
    end if;
  end if;

  insert into public.appraisal_entries(
    org_id,appraisal_id,profile_id,entry_type,body,supersedes_id,created_by
  ) values (
    v_org,v_appraisal.id,v_appraisal.profile_id,p_entry_type,btrim(p_body),
    p_supersedes_id,v_actor
  )
  returning id into v_id;

  if p_entry_type='employee_reflection'
     and v_appraisal.status='evidence' then
    update public.appraisals
    set status='reflection_submitted'
    where id=v_appraisal.id;
  elsif p_entry_type='manager_assessment'
     and v_appraisal.status in ('evidence','reflection_submitted') then
    update public.appraisals
    set status='manager_draft'
    where id=v_appraisal.id;
  elsif p_entry_type='manager_assessment' and v_appraisal.status='shared' then
    -- A new manager revision requires a new HR publication decision.
    -- Keep historical shared_at for audit and released versions.
    update public.appraisals set status='manager_draft' where id=v_appraisal.id;
  elsif p_entry_type='conversation_record'
     and v_appraisal.status in ('evidence','reflection_submitted','manager_draft') then
    update public.appraisals
    set status='conversation_recorded'
    where id=v_appraisal.id;
  end if;

  return v_id;
end;
$function$;
