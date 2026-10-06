-- Additive onboarding and location evidence; no schedule/discipline/payroll policy.
alter table public.pending_invitations add column revoked_at timestamptz,
  add column revoked_by uuid references public.profiles(id), add column revocation_reason text;
alter table public.work_sessions add column location_accuracy_m double precision,
  add column location_captured_at timestamptz, add column office_location_id uuid references public.office_locations(id),
  add column start_geofence text, add column end_lat double precision, add column end_lng double precision,
  add column end_accuracy_m double precision, add column end_location_captured_at timestamptz,
  add column end_location_status text, add column end_location_failure text, add column end_device_time timestamptz;

-- Inactive profiles must not retain operational org/role authority through an old JWT.
create or replace function public.app_org_id() returns uuid language sql stable security definer set search_path=public as $$
  select org_id from public.profiles where id=auth.uid() and active;
$$;
create or replace function public.app_is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select is_admin from public.profiles where id=auth.uid() and active),false);
$$;
create or replace function public.app_is_exec() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select is_exec from public.profiles where id=auth.uid() and active),false);
$$;
create or replace function public.app_my_units() returns setof uuid language sql stable security definer set search_path=public as $$
  select m.unit_id from public.unit_memberships m join public.profiles p on p.id=m.profile_id where p.id=auth.uid() and p.active;
$$;
create or replace function public.app_managed_units() returns setof uuid language sql stable security definer set search_path=public as $$
  select m.unit_id from public.unit_memberships m join public.profiles p on p.id=m.profile_id where p.id=auth.uid() and p.active and m.role='manager';
$$;
create or replace function public.app_led_sub_teams() returns setof uuid language sql stable security definer set search_path=public as $$
  select s.id from public.sub_teams s join public.profiles p on p.id=s.lead_id where p.id=auth.uid() and p.active;
$$;

create or replace function public.admin_record_unit_responsibility(p_profile_id uuid,p_unit_id uuid,p_role text,p_action text,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_org uuid:=public.app_org_id(); v_old jsonb;
begin
  if auth.uid() is null or not public.app_has_capability('people.manage',null) then raise exception 'People administration is required.' using errcode='42501'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'Explain this responsibility change.'; end if;
  if p_action is null or p_role is null or p_action not in ('add','remove') or p_role not in ('staff','sub_team_lead','manager') then raise exception 'Choose a valid responsibility action.'; end if;
  if not exists(select 1 from public.profiles where id=p_profile_id and org_id=v_org and active) or not exists(select 1 from public.units where id=p_unit_id and org_id=v_org and active) then raise exception 'Choose an active person and unit in this organisation.' using errcode='42501'; end if;
  perform 1 from public.units where id=p_unit_id for update;
  select to_jsonb(m) into v_old from public.unit_memberships m where profile_id=p_profile_id and unit_id=p_unit_id;
  if p_action='remove' then
    if v_old is null then raise exception 'That membership has already ended.'; end if;
    if exists(select 1 from public.employment_records where profile_id=p_profile_id and unit_id=p_unit_id) then raise exception 'Transfer the primary unit through the employment record before ending this membership.'; end if;
    if exists(select 1 from public.sub_teams s where s.unit_id=p_unit_id and s.lead_id=p_profile_id) then raise exception 'Reassign the work-lane lead before ending this membership.'; end if;
    delete from public.sub_team_members sm using public.sub_teams s where sm.sub_team_id=s.id and s.unit_id=p_unit_id and sm.profile_id=p_profile_id;
    delete from public.employee_unit_memberships eum using public.employee_roster er where eum.employee_id=er.id and er.profile_id=p_profile_id and eum.unit_id=p_unit_id and not eum.is_primary;
    delete from public.unit_memberships where profile_id=p_profile_id and unit_id=p_unit_id;
  else
    if p_role='manager' and exists(select 1 from public.unit_memberships where unit_id=p_unit_id and role='manager' and profile_id<>p_profile_id) then raise exception 'This unit already has a Unit Head. Use the existing Unit Head replacement action.'; end if;
    if p_role='manager' and exists(select 1 from public.employment_records where profile_id=p_profile_id and employment_type='volunteer') then raise exception 'Wider volunteer Manager authority needs an approved population review first.'; end if;
    insert into public.unit_memberships(org_id,profile_id,unit_id,role) values(v_org,p_profile_id,p_unit_id,p_role)
      on conflict(profile_id,unit_id) do update set role=excluded.role;
    insert into public.employee_unit_memberships(org_id,employee_id,unit_id,is_primary,context_label,created_by,updated_by) select v_org,er.id,p_unit_id,false,btrim(p_reason),auth.uid(),auth.uid() from public.employee_roster er where er.profile_id=p_profile_id and er.org_id=v_org on conflict(employee_id,unit_id) do nothing;
  end if;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
    values(v_org,auth.uid(),'unit_responsibility_changed','profile',p_profile_id,jsonb_build_object('unit_id',p_unit_id,'action',p_action,'role',p_role,'reason',btrim(p_reason),'previous',v_old));
end;
$$;

create or replace function public.admin_set_work_lane_membership(p_profile_id uuid,p_sub_team_id uuid,p_member boolean,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_org uuid:=public.app_org_id(); v_unit uuid;
begin
  if auth.uid() is null or not public.app_has_capability('people.manage',null) then raise exception 'People administration is required.' using errcode='42501'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'Explain the work-lane change.'; end if;
  select unit_id into v_unit from public.sub_teams where id=p_sub_team_id and org_id=v_org and active;
  if v_unit is null or not exists(select 1 from public.unit_memberships m join public.profiles p on p.id=m.profile_id where m.profile_id=p_profile_id and m.unit_id=v_unit and p.active and p.org_id=v_org) then raise exception 'The person must belong to this active unit first.' using errcode='42501'; end if;
  if p_member is null then raise exception 'Choose a membership action.'; end if;
  if p_member then insert into public.sub_team_members(sub_team_id,profile_id) values(p_sub_team_id,p_profile_id) on conflict do nothing;
  else delete from public.sub_team_members where sub_team_id=p_sub_team_id and profile_id=p_profile_id; end if;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta) values(v_org,auth.uid(),'work_lane_membership_changed','profile',p_profile_id,jsonb_build_object('sub_team_id',p_sub_team_id,'member',p_member,'reason',btrim(p_reason)));
end;
$$;

create or replace function public.admin_revoke_staff_invitation(p_invitation_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare i public.pending_invitations; v_profile uuid;
begin
  if auth.uid() is null or not public.app_has_capability('people.manage',null) then raise exception 'People administration is required.' using errcode='42501'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'Explain why the invitation is being cancelled.'; end if;
  select * into i from public.pending_invitations where id=p_invitation_id and org_id=public.app_org_id() for update;
  if i.id is null or i.revoked_at is not null then raise exception 'That invitation is unavailable.'; end if;
  -- OTP may already have created an unconfirmed auth/profile row; prevent that stale link gaining access.
  select p.id into v_profile from public.profiles p join auth.users u on u.id=p.id where p.org_id=i.org_id and lower(p.email)=lower(i.email) and u.email_confirmed_at is null;
  if i.resolved_at is not null and v_profile is null then raise exception 'This person has activated. Manage their existing account instead.'; end if;
  update public.pending_invitations set revoked_at=now(),revoked_by=auth.uid(),revocation_reason=btrim(p_reason),expires_at=least(expires_at,now()) where id=i.id;
  if v_profile is not null then update public.profiles set active=false where id=v_profile; end if;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta) values(i.org_id,auth.uid(),'invitation_revoked','pending_invitation',i.id,jsonb_build_object('reason',btrim(p_reason)));
end;
$$;

create or replace function public.admin_access_invitations()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.app_has_capability('people.manage',null) then raise exception 'People administration is required.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'full_name',i.full_name,'unit_id',i.unit_id,'invited_at',i.invited_at,'expires_at',i.expires_at,'revoked_at',i.revoked_at,'account_created',u.id is not null,'activation_state',case when i.revoked_at is not null then 'cancelled' when u.email_confirmed_at is not null then 'verified' when i.expires_at<=now() then 'expired' else 'awaiting_verification' end) order by i.invited_at desc)
    from public.pending_invitations i left join auth.users u on lower(u.email)=lower(i.email)
    where i.org_id=public.app_org_id()),'[]'::jsonb);
end;
$$;

create or replace function public.prepare_staff_invitation_resend(p_invitation_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare i public.pending_invitations; v_user uuid;
begin
  select * into i from public.pending_invitations where id=p_invitation_id for update;
  if auth.uid() is null or i.id is null or i.org_id is distinct from public.app_org_id() or not (public.app_has_capability('people.manage',null) or i.unit_id in (select public.app_managed_units())) then raise exception 'You cannot resend this invitation.' using errcode='42501'; end if;
  if not exists(select 1 from public.units where id=i.unit_id and org_id=i.org_id and active) then raise exception 'The invitation unit is inactive.'; end if;
  if i.revoked_at is not null then raise exception 'That invitation was cancelled. Manage the account with Administration.'; end if;
  select id into v_user from auth.users where lower(email)=lower(i.email);
  if exists(select 1 from auth.users where id=v_user and email_confirmed_at is not null) then raise exception 'That account is verified. Use password recovery instead.'; end if;
  if v_user is not null and not exists(select 1 from public.profiles where id=v_user and org_id=i.org_id and active) then raise exception 'The account is inactive. Administration must review it first.'; end if;
  update public.pending_invitations set expires_at=now()+interval '7 days',invited_at=now(),invited_by=auth.uid() where id=i.id;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta) values(i.org_id,auth.uid(),'invitation_resend_requested','pending_invitation',i.id,'{}'::jsonb);
  return jsonb_build_object('email',i.email,'account_created',v_user is not null);
end;
$$;

-- Server enforces fresh office evidence even when a client bypasses the Start Work UI.
create or replace function public.guard_office_session_location()
returns trigger language plpgsql security definer set search_path=public as $$
declare o public.office_locations; d double precision; x double precision; evidence jsonb;
begin
  if auth.uid() is null then return new; end if; -- service fixture/import retains historical evidence
  if new.profile_id is distinct from auth.uid() or new.org_id is distinct from public.app_org_id() then raise exception 'Only your own active work session can be started.' using errcode='42501'; end if;
  if new.flags ? 'continued_from_session_id' then
    evidence:=nullif(current_setting('ceac.recovery_location',true),'')::jsonb;
    if evidence is not null then
      new.lat:=(evidence->>'lat')::double precision; new.lng:=(evidence->>'lng')::double precision;
      new.location_accuracy_m:=(evidence->>'accuracy')::double precision;
      new.location_captured_at:=(evidence->>'captured_at')::timestamptz;
    end if;
  end if;
  new.server_received_at:=now(); new.started_at:=now(); new.last_confirmed_at:=now();
  if new.ended_at is not null then raise exception 'Start a new open work session.'; end if;
  new.end_lat:=null; new.end_lng:=null; new.end_accuracy_m:=null; new.end_location_captured_at:=null; new.end_location_status:=null; new.end_location_failure:=null; new.end_device_time:=null;
  if (new.lat is null)<>(new.lng is null) then raise exception 'Provide both location coordinates.'; end if;
  if new.lat is not null and (new.lat not between -90 and 90 or new.lng is null or new.lng not between -180 and 180) then raise exception 'A valid fresh location is required.'; end if;
  if new.location_accuracy_m is not null and not (new.location_accuracy_m>=0 and new.location_accuracy_m<'Infinity'::double precision) then raise exception 'Location accuracy is invalid.'; end if;
  if new.place='office' then
    if new.lat is null or new.lng is null or new.lat not between -90 and 90 or new.lng not between -180 and 180 then raise exception 'Allow location access to verify an office start. No office session was started.'; end if;
    if new.location_captured_at is null or new.location_captured_at<now()-interval '2 minutes' or new.location_captured_at>now()+interval '30 seconds' or new.device_time is null then raise exception 'A fresh location is required. Try Start work again.'; end if;
    select * into o from public.office_locations where org_id=new.org_id and is_primary order by set_at desc limit 1;
    if o.id is null then raise exception 'The CEAC office location is not configured. Ask Administration, or choose an off-site session.'; end if;
    x:=power(sin(radians(new.lat-o.lat::double precision)/2),2)+cos(radians(o.lat::double precision))*cos(radians(new.lat))*power(sin(radians(new.lng-o.lng::double precision)/2),2);
    d:=6371000*2*asin(sqrt(least(1,greatest(0,x))));
    if d>o.radius_meters then raise exception 'Your recorded location is outside the CEAC office. Retry location or choose off-site work.'; end if;
    new.office_location_id:=o.id; new.start_geofence:='inside';
    -- Poor accuracy is evidence, never a hidden assertion of precise/live presence.
    new.flags:=coalesce(new.flags,'{}'::jsonb)||jsonb_build_object('location_accuracy_exceeds_radius',coalesce(new.location_accuracy_m>o.radius_meters,false));
  else new.office_location_id:=null; new.start_geofence:='not_applicable'; end if;
  return new;
end;
$$;
create trigger work_sessions_office_location_guard before insert on public.work_sessions for each row execute function public.guard_office_session_location();
revoke all on function public.guard_office_session_location() from public,anon,authenticated;

create or replace function public.end_work_session_with_location(p_session_id uuid,p_lat double precision,p_lng double precision,p_accuracy_m double precision,p_captured_at timestamptz,p_device_time timestamptz,p_failure text)
returns public.work_sessions language plpgsql security definer set search_path=public as $$
declare s public.work_sessions; v_verified boolean;
begin
  if auth.uid() is null then raise exception 'Sign in to end work.' using errcode='42501'; end if;
  select * into s from public.work_sessions where id=p_session_id for update;
  if s.id is null or s.profile_id is distinct from auth.uid() or s.org_id is distinct from public.app_org_id() then raise exception 'Only your own session can be ended.' using errcode='42501'; end if;
  v_verified:=coalesce(p_lat between -90 and 90 and p_lng between -180 and 180 and p_captured_at>=now()-interval '2 minutes' and p_captured_at<=now()+interval '30 seconds' and (p_accuracy_m is null or (p_accuracy_m>=0 and p_accuracy_m<'Infinity'::double precision)),false);
  s:=public.end_work_session(p_session_id);
  update public.work_sessions set end_lat=case when v_verified then p_lat end,end_lng=case when v_verified then p_lng end,end_accuracy_m=case when v_verified then p_accuracy_m end,end_location_captured_at=case when v_verified then p_captured_at end,end_device_time=p_device_time,end_location_status=case when v_verified then 'recorded' else 'not_verified' end,end_location_failure=case when v_verified then null else left(coalesce(nullif(btrim(p_failure),''),'Location unavailable or invalid'),200) end where id=s.id returning * into s;
  return s;
end;
$$;

-- Existing role/event permissions remain decisive. This exposes timestamps, not private event bodies.
create or replace function public.visible_last_ceac_activity()
returns table(profile_id uuid,last_activity_at timestamptz) language sql stable security invoker set search_path=public as $$
  select actor_id,max(at) from public.activity_events where org_id=public.app_org_id() group by actor_id;
$$;

revoke all on function public.admin_record_unit_responsibility(uuid,uuid,text,text,text),public.admin_set_work_lane_membership(uuid,uuid,boolean,text),public.admin_revoke_staff_invitation(uuid,text),public.admin_access_invitations(),public.prepare_staff_invitation_resend(uuid),public.end_work_session_with_location(uuid,double precision,double precision,double precision,timestamptz,timestamptz,text),public.visible_last_ceac_activity() from public,anon;
grant execute on function public.admin_record_unit_responsibility(uuid,uuid,text,text,text),public.admin_set_work_lane_membership(uuid,uuid,boolean,text),public.admin_revoke_staff_invitation(uuid,text),public.admin_access_invitations(),public.prepare_staff_invitation_resend(uuid),public.end_work_session_with_location(uuid,double precision,double precision,double precision,timestamptz,timestamptz,text),public.visible_last_ceac_activity() to authenticated,service_role;

create or replace function public.create_pending_invitation(
  p_email text,
  p_full_name text,
  p_unit_id uuid,
  p_role text default 'staff'
)
returns public.pending_invitations
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid;
  v_invite public.pending_invitations;
  v_email text:=lower(btrim(coalesce(p_email,'')));
  v_name text:=nullif(btrim(coalesce(p_full_name,'')),'');
begin
  if auth.uid() is null then
    raise exception 'Sign in to invite someone.' using errcode='42501';
  end if;

  v_org:=public.app_org_id();
  if v_org is null then
    raise exception 'Your organisation could not be identified.' using errcode='42501';
  end if;

  if v_email='' or position('@' in v_email)<2 then
    raise exception 'Enter a valid email address.';
  end if;
  if v_name is null then
    raise exception 'Enter the person''s name.';
  end if;
  if p_unit_id is null then
    raise exception 'Choose a unit.';
  end if;
  if coalesce(p_role,'staff')<>'staff' then
    raise exception 'New accounts are invited as Staff. Administration can assign official authority after onboarding.'
      using errcode='42501';
  end if;

  if not exists (
    select 1 from public.units u
    where u.id=p_unit_id and u.org_id=v_org and u.active
  ) then
    raise exception 'That unit is not an active unit in your organisation.' using errcode='42501';
  end if;

  if not public.app_has_capability('people.manage',null)
     and p_unit_id not in (select public.app_managed_units()) then
    raise exception 'You can only invite Staff into a unit you manage.' using errcode='42501';
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(p.email)=v_email and p.org_id=v_org
  ) then
    raise exception 'That email already has a CEAC account.';
  end if;

  if not public.app_has_capability('people.manage',null) and exists(select 1 from public.pending_invitations where org_id=v_org and lower(email)=v_email and unit_id not in (select public.app_managed_units())) then
    raise exception 'Administration must review this existing invitation.' using errcode='42501';
  end if;
  insert into public.pending_invitations(
    org_id,email,full_name,unit_id,role,invited_by,invited_at,resolved_at,expires_at
  )
  values(
    v_org,v_email,v_name,p_unit_id,'staff',auth.uid(),now(),null,now()+interval '7 days'
  )
  on conflict (org_id,lower(email)) do update
  set full_name=excluded.full_name,
      unit_id=excluded.unit_id,
      role='staff',
      invited_by=auth.uid(),
      invited_at=now(),
      resolved_at=null,revoked_at=null,revoked_by=null,revocation_reason=null,
      expires_at=now()+interval '7 days'
  returning * into v_invite;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(
    v_org,auth.uid(),'staff_invited','pending_invitation',v_invite.id,
    jsonb_build_object('unit_id',p_unit_id)
  );

  return v_invite;
end;
$$;

revoke all on function public.create_pending_invitation(text,text,uuid,text) from public,anon;
grant execute on function public.create_pending_invitation(text,text,uuid,text) to authenticated,service_role;


-- Executive-origin work follows its assigning authority; it cannot certify itself.
create or replace function public.app_can_review_item(item_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.work_items w where w.id=item_id and w.org_id=public.app_org_id()
    and w.kind in ('task','deliverable','meeting_outcome') and w.visibility<>'private'
    and (public.app_is_admin() or (public.app_is_exec() and w.origin='assigned_by_exec' and w.assigned_by=auth.uid())
      or (w.confidential=false and (w.unit_id in (select public.app_managed_units()) or w.sub_team_id in (select public.app_led_sub_teams())))));
$$;
create or replace function public.guard_executive_work_self_certification()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and new.status='self_certified' and old.status is distinct from new.status and old.visibility<>'private' and (old.origin='assigned_by_exec' or (old.origin='assigned' and old.assigned_by is distinct from auth.uid())) then raise exception 'Work assigned by another authority must be submitted for review.'; end if;
  return new;
end;
$$;
create trigger work_items_upward_review_guard before update on public.work_items for each row execute function public.guard_executive_work_self_certification();
revoke all on function public.guard_executive_work_self_certification() from public,anon,authenticated;

-- Legacy end callers still produce an honest, explicitly unverified endpoint.
create or replace function public.guard_session_end_evidence() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if old.ended_at is null and new.ended_at is not null then
    new.end_location_status:='not_verified';
    new.end_location_failure:='Location was not recorded when this session ended';
  end if;
  return new;
end;
$$;
create trigger work_sessions_end_evidence_guard before update on public.work_sessions for each row execute function public.guard_session_end_evidence();
revoke all on function public.guard_session_end_evidence() from public,anon,authenticated;

-- Recovery keeps the existing reconciliation history, with a fresh start check.
create or replace function public.continue_work_session_with_location(p_session_id uuid,p_lat double precision,p_lng double precision,p_accuracy_m double precision,p_captured_at timestamptz)
returns public.work_sessions language plpgsql security definer set search_path=public as $$
declare s public.work_sessions;
begin
  perform set_config('ceac.recovery_location',jsonb_build_object('lat',p_lat,'lng',p_lng,'accuracy',p_accuracy_m,'captured_at',p_captured_at)::text,true);
  s:=public.reconcile_work_session(p_session_id,'continue',null,null);
  perform set_config('ceac.recovery_location','',true);
  return s;
end;
$$;
revoke all on function public.continue_work_session_with_location(uuid,double precision,double precision,double precision,timestamptz) from public,anon;
grant execute on function public.continue_work_session_with_location(uuid,double precision,double precision,double precision,timestamptz) to authenticated,service_role;
