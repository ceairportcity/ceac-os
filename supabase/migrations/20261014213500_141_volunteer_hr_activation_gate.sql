-- CEAC owner-locked volunteer activation gate.
-- Manager initiates a volunteer invitation but does not activate it.
-- HR with organisation-wide People authority explicitly approves BEFORE the
-- Supabase Auth account-creation path may classify/activate the volunteer.
-- This is an additive forward migration; never rewrite migration 119.
-- Deliberately no automatic volunteer pay or employee Payroll entitlement.

create table if not exists public.volunteer_invitation_approvals(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  invitation_id uuid not null references public.pending_invitations(id) on delete restrict,
  invited_at timestamptz not null,
  approved_unit_id uuid not null references public.units(id) on delete restrict,
  approved_pattern jsonb not null check(jsonb_typeof(approved_pattern)='object'),
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  reason text not null check(length(btrim(reason)) between 8 and 1000),
  constraint volunteer_invitation_approval_version_unique unique(invitation_id,invited_at)
);

create index if not exists volunteer_invitation_approvals_org_idx
  on public.volunteer_invitation_approvals(org_id,approved_at desc);

alter table public.volunteer_invitation_approvals enable row level security;
revoke all on public.volunteer_invitation_approvals from public,anon,authenticated;
grant select on public.volunteer_invitation_approvals to authenticated;

create policy volunteer_invitation_approvals_read
on public.volunteer_invitation_approvals for select to authenticated
using (
  org_id=public.app_org_id() and (
    public.app_has_capability('people.manage',null) or
    exists(select 1 from public.pending_invitations i
      where i.id=volunteer_invitation_approvals.invitation_id
        and i.org_id=volunteer_invitation_approvals.org_id
        and i.unit_id in(select public.app_managed_units()))
  )
);

-- Once HR approves a specific invitation generation, Managers cannot
-- change the engagement, unit or work pattern under that same approval.
-- Reissue through the authorised request RPC; invited_at will advance and
-- will require a fresh HR approval before activation.
create or replace function public.volunteer_approved_invitation_guard()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.engagement_type='volunteer'
     and new.invited_at is not distinct from old.invited_at
     and (new.engagement_type is distinct from old.engagement_type
          or new.engagement_working_pattern is distinct from old.engagement_working_pattern
          or new.unit_id is distinct from old.unit_id)
     and exists (
       select 1 from public.volunteer_invitation_approvals a
       where a.invitation_id=old.id and a.org_id=old.org_id
         and a.invited_at=old.invited_at
         and a.approved_unit_id=old.unit_id
         and a.approved_pattern=old.engagement_working_pattern
     )
  then
    raise exception 'HR-approved volunteer terms cannot change without a new invitation request.'
      using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function public.volunteer_approved_invitation_guard() from public,anon,authenticated;
drop trigger if exists volunteer_approved_invitation_guard on public.pending_invitations;
create trigger volunteer_approved_invitation_guard
before update on public.pending_invitations
for each row execute function public.volunteer_approved_invitation_guard();

-- Manager's request and its volunteer classification must be atomic, and
-- must not send an activation link before HR has approved the request.
create or replace function public.volunteer_request_invitation(
  p_email text, p_full_name text, p_unit_id uuid, p_working_pattern jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_invite public.pending_invitations;
begin
  if auth.uid() is null or public.app_org_id() is null then
    raise exception 'Sign in to request a volunteer.' using errcode='42501';
  end if;
  if jsonb_typeof(p_working_pattern) is distinct from 'object'
     or coalesce(p_working_pattern->>'kind','') not in ('no_attendance','event_based','specific_days','custom')
     or length(p_working_pattern::text)>1500 then
    raise exception 'Choose a valid volunteer working arrangement.';
  end if;
  v_invite:=public.create_pending_invitation(p_email,p_full_name,p_unit_id,'staff');
  update public.pending_invitations set
    engagement_type='volunteer',
    engagement_working_pattern=p_working_pattern
  where id=v_invite.id and org_id=public.app_org_id()
  returning * into v_invite;
  if v_invite.id is null then raise exception 'Volunteer request was not recorded.'; end if;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_invite.org_id,auth.uid(),'volunteer_invitation_requested','pending_invitation',v_invite.id,
    jsonb_build_object('unit_id',v_invite.unit_id,'awaiting_hr',true));
  return jsonb_build_object('invitation_id',v_invite.id,'awaiting_hr',true);
end;
$$;
revoke all on function public.volunteer_request_invitation(text,text,uuid,jsonb) from public,anon;
grant execute on function public.volunteer_request_invitation(text,text,uuid,jsonb) to authenticated;

-- Approval rows cannot be edited or destroyed by ordinary API roles.
-- Server RPC inserts once and records the actor/decision atomically.
create or replace function public.volunteer_approve_invitation(
  p_invitation_id uuid,
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
  v_invite public.pending_invitations%rowtype;
  v_decision uuid;
begin
  if v_actor is null or v_org is null
     or not public.app_is_admin()
     or not public.app_has_capability('people.manage',null) then
    raise exception 'HR approval authority is required for volunteer activation.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,'')))<8 then
    raise exception 'Record a reason for volunteer approval.';
  end if;

  select * into v_invite from public.pending_invitations i
  where i.id=p_invitation_id and i.org_id=v_org
    and i.engagement_type='volunteer'
    and i.resolved_at is null and i.revoked_at is null
    and i.expires_at>now()
  for update;
  if v_invite.id is null then
    raise exception 'An active volunteer invitation in your organisation is required.' using errcode='42501';
  end if;

  insert into public.volunteer_invitation_approvals(
    org_id,invitation_id,invited_at,approved_unit_id,approved_pattern,approved_by,reason
  ) values (v_org,v_invite.id,v_invite.invited_at,v_invite.unit_id,
    v_invite.engagement_working_pattern,v_actor,btrim(p_reason))
  on conflict(invitation_id,invited_at) do nothing
  returning id into v_decision;

  if v_decision is not null then
    insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
    values(v_org,v_actor,'volunteer_invitation_hr_approved','volunteer_invitation',v_invite.id,
      jsonb_build_object('approved_at',now(),'approval_id',v_decision));
  end if;

  return jsonb_build_object(
    'approved',true,
    'already_approved',v_decision is null,
    'invitation_id',v_invite.id,
    'email',v_invite.email,
    'full_name',v_invite.full_name
  );
end;
$$;

revoke all on function public.volunteer_approve_invitation(uuid,text) from public,anon;
grant execute on function public.volunteer_approve_invitation(uuid,text) to authenticated;

-- Re-define the previous Stage 6 invitation activation hook with a single
-- additional HR approval check before creating a volunteer profile. Ordinary
-- staff invitation behaviour remains unaltered. Trigger binding is preserved.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_invite public.pending_invitations%rowtype;
  v_pattern jsonb;
  v_employee_id uuid;
begin
  if new.email is null then
    raise exception 'A valid CEAC invitation is required.';
  end if;

  select *
  into v_invite
  from public.pending_invitations
  where lower(email)=lower(new.email)
    and resolved_at is null
    and revoked_at is null
    and expires_at>now()
  order by invited_at desc
  limit 1
  for update;

  if v_invite.id is null then
    raise exception 'A valid, unexpired CEAC invitation is required.';
  end if;

  if v_invite.role<>'staff' then
    raise exception 'Invited accounts must begin as Staff.' using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.units u
    where u.id=v_invite.unit_id
      and u.org_id=v_invite.org_id
      and u.active
  ) then
    raise exception 'The invitation unit is no longer active.' using errcode='42501';
  end if;

  -- The Manager may request a volunteer invitation, but only HR may
  -- authorise initial volunteer activation. The approval record is immutable.
  if v_invite.engagement_type='volunteer' and not exists (
    select 1 from public.volunteer_invitation_approvals a
    where a.org_id=v_invite.org_id and a.invitation_id=v_invite.id
      and a.invited_at=v_invite.invited_at
      and a.approved_unit_id=v_invite.unit_id
      and a.approved_pattern=v_invite.engagement_working_pattern
  ) then
    raise exception 'HR approval is required before volunteer activation.' using errcode='42501';
  end if;

  v_pattern:=case
    when v_invite.engagement_type='volunteer'
      then coalesce(v_invite.engagement_working_pattern,'{"kind":"not_recorded"}'::jsonb)
    else '{"kind":"not_recorded"}'::jsonb
  end;

  insert into public.profiles(id,org_id,full_name,email,job_title)
  values(
    new.id,
    v_invite.org_id,
    coalesce(nullif(btrim(v_invite.full_name),''),split_part(lower(new.email),'@',1)),
    lower(new.email),
    null
  );

  insert into public.unit_memberships(org_id,unit_id,profile_id,role)
  values(v_invite.org_id,v_invite.unit_id,new.id,'staff');

  if v_invite.engagement_type='volunteer' then
    update public.employment_records
    set employment_type='volunteer',
        unit_id=v_invite.unit_id,
        manager_profile_id=public.employment_manager_for_unit(v_invite.org_id,v_invite.unit_id,new.id),
        membership_role='staff',
        working_pattern=v_pattern,
        employment_status='active',
        updated_at=now(),
        updated_by=v_invite.invited_by
    where profile_id=new.id;

    perform public.employment_append_snapshot(
      new.id,
      'employment_details_changed',
      current_date,
      'Volunteer engagement created from an authorised Manager invitation.',
      v_invite.invited_by,
      null
    );

    insert into public.employee_roster(
      org_id,profile_id,full_name,source_display_name,source_department_text,
      job_title,employment_type,employment_status,identity_state,
      source_system,source_row_key,created_by,updated_by
    )
    select
      v_invite.org_id,new.id,p.full_name,p.full_name,u.name,
      p.job_title,'volunteer','active','linked',
      'volunteer_invitation',v_invite.id::text,v_invite.invited_by,v_invite.invited_by
    from public.profiles p
    join public.units u on u.id=v_invite.unit_id
    where p.id=new.id
    on conflict(profile_id) do update
      set employment_type='volunteer',
          employment_status='active',
          identity_state='linked',
          updated_by=v_invite.invited_by,
          updated_at=now()
    returning id into v_employee_id;

    if v_employee_id is null then
      select id into v_employee_id from public.employee_roster where profile_id=new.id;
    end if;

    insert into public.employee_unit_memberships(
      org_id,employee_id,unit_id,is_primary,context_label,created_by,updated_by
    ) values(
      v_invite.org_id,v_employee_id,v_invite.unit_id,true,
      'Volunteer invitation placement',v_invite.invited_by,v_invite.invited_by
    )
    on conflict(employee_id,unit_id) do update
      set is_primary=true,updated_by=v_invite.invited_by,updated_at=now();

    if coalesce(v_pattern->>'kind','not_recorded') in ('no_attendance','event_based','specific_days','custom') then
      insert into public.volunteer_working_pattern_versions(
        org_id,profile_id,unit_id,pattern_kind,configuration,effective_from,reason,created_by
      ) values(
        v_invite.org_id,new.id,v_invite.unit_id,v_pattern->>'kind',
        v_pattern-'kind',current_date,
        'Initial working arrangement from volunteer invitation.',v_invite.invited_by
      );
    end if;
  end if;

  update public.pending_invitations
  set resolved_at=now()
  where id=v_invite.id;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(
    v_invite.org_id,new.id,'account_activated','profile',new.id,
    jsonb_build_object(
      'invitation_id',v_invite.id,
      'unit_id',v_invite.unit_id,
      'engagement_type',v_invite.engagement_type
    )
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public,anon,authenticated;
