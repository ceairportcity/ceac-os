-- CEAC owner-confirmed Volunteer workflow: Manager nominates; HR activates.
-- Must follow 20261007090000_119_phase6_volunteer_operating_model.sql.
-- No existing user, volunteer, employee roster, or historical invitation is
-- altered by this migration. Only volunteer sign-ups after this migration
-- require an explicit HR decision, including direct/unsolicited OTP attempts.

alter table public.pending_invitations
  add column if not exists volunteer_approved_by uuid references public.profiles(id) on delete restrict,
  add column if not exists volunteer_approved_at timestamptz,
  add column if not exists volunteer_approval_reason text;

alter table public.pending_invitations
  add constraint pending_volunteer_hr_approval_complete_check
  check (
    (volunteer_approved_by is null and volunteer_approved_at is null and volunteer_approval_reason is null)
    or
    (volunteer_approved_by is not null and volunteer_approved_at is not null
      and length(btrim(coalesce(volunteer_approval_reason,''))) >= 3)
  );

-- Prevent a Manager from supplying the approval fields through their
-- pre-existing scoped invitation-update policy. Only the reviewed HR RPC can
-- set these fields, once. Approval and engagement classification are immutable
-- after the HR decision.
create or replace function public.volunteer_hr_approval_fields_guard()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if old.volunteer_approved_at is not null and
    (new.volunteer_approved_at is distinct from old.volunteer_approved_at
     or new.volunteer_approved_by is distinct from old.volunteer_approved_by
     or new.volunteer_approval_reason is distinct from old.volunteer_approval_reason
     or new.engagement_type is distinct from old.engagement_type
     or new.engagement_working_pattern is distinct from old.engagement_working_pattern) then
    raise exception 'An HR-approved volunteer invitation is immutable.'
      using errcode='42501';
  end if;

  if new.volunteer_approved_at is distinct from old.volunteer_approved_at
     or new.volunteer_approved_by is distinct from old.volunteer_approved_by
     or new.volunteer_approval_reason is distinct from old.volunteer_approval_reason then
    if new.engagement_type <> 'volunteer'
       or auth.uid() is null
       or not public.app_has_capability('people.manage',null)
       or current_setting('ceac.volunteer_approval_operation',true) is distinct from 'hr_authorised' then
      raise exception 'Only a verified HR approval operation may authorise volunteer activation.'
        using errcode='42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.volunteer_hr_approval_fields_guard() from public,anon,authenticated;
drop trigger if exists volunteer_hr_approval_fields_guard on public.pending_invitations;
create trigger volunteer_hr_approval_fields_guard
before update on public.pending_invitations
for each row execute function public.volunteer_hr_approval_fields_guard();

create or replace function public.volunteer_approve_pending_invitation(
  p_invitation_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_invite public.pending_invitations;
begin
  if v_actor is null or v_org is null or not public.app_has_capability('people.manage',null) then
    raise exception 'HR employee-access authority is required.'
      using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'Record the reason for approving this volunteer.';
  end if;

  select * into v_invite
  from public.pending_invitations
  where id=p_invitation_id and org_id=v_org
    and engagement_type='volunteer'
    and resolved_at is null and revoked_at is null and expires_at>now()
  for update;

  if v_invite.id is null then
    raise exception 'An active pending volunteer request was not found.';
  end if;
  if v_invite.volunteer_approved_at is not null then
    raise exception 'The volunteer request was already approved; review its activation status.';
  end if;
  perform set_config('ceac.volunteer_approval_operation','hr_authorised',true);
  update public.pending_invitations
  set volunteer_approved_by=v_actor,
      volunteer_approved_at=now(),
      volunteer_approval_reason=btrim(p_reason)
  where id=v_invite.id and org_id=v_org;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'volunteer_invitation_hr_approved','pending_invitation',v_invite.id,
    jsonb_build_object('unit_id',v_invite.unit_id,'reason',btrim(p_reason)));

  return jsonb_build_object('invitation_id',v_invite.id,'email',v_invite.email,
    'approved',true,'account_created',false);
end;
$$;

revoke all on function public.volunteer_approve_pending_invitation(uuid,text) from public,anon;
grant execute on function public.volunteer_approve_pending_invitation(uuid,text) to authenticated;

-- Continue to create the real Auth identity only through the established
-- invitation code path. Disallow a volunteer pending HR approval even if a
-- client bypasses Manager UI and calls signInWithOtp directly.
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

  -- Enforce HR approval at the database account-creation boundary, not
  -- merely in Manager UI or in activation-email delivery.
  if v_invite.engagement_type='volunteer'
     and (v_invite.volunteer_approved_at is null or v_invite.volunteer_approved_by is null) then
    raise exception 'Volunteer account activation requires prior HR approval.'
      using errcode='42501';
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
