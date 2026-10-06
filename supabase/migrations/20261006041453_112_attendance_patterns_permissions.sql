-- Phase 2: facts and attributable exceptions, never attendance consequences.
alter table public.workforce_schedule_versions add column clock_map jsonb not null default '{}'::jsonb
  check (jsonb_typeof(clock_map)='object');

create function public.workforce_record_pattern(p_profile_id uuid,p_unit_id uuid,p_effective_from date,p_effective_to date,
  p_day_map jsonb,p_clock_map jsonb,p_reason text,p_supersedes_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_org uuid:=public.app_org_id(); v_id uuid; prior public.workforce_schedule_versions; pair record; t_start time; t_end time;
begin
  if auth.uid() is null or not public.app_has_capability('workforce.manage',null) then raise exception 'Workforce administration is required.' using errcode='42501'; end if;
  if jsonb_typeof(p_clock_map) is distinct from 'object' or jsonb_typeof(p_day_map) is distinct from 'object' then raise exception 'Choose a valid working pattern.'; end if;
  for pair in select * from jsonb_each(p_day_map) loop
    if pair.key not in ('sun','mon','tue','wed','thu','fri','sat') or not exists(select 1 from public.workforce_day_types where id=(pair.value#>>'{}')::uuid and org_id=v_org and active) then raise exception 'Choose an active day type in this organisation.'; end if;
  end loop;
  for pair in select * from jsonb_each(p_clock_map) loop
    if pair.key not in ('sun','mon','tue','wed','thu','fri','sat') or not p_day_map ? pair.key or jsonb_typeof(pair.value) is distinct from 'object'
       or exists(select 1 from jsonb_object_keys(pair.value) k where k not in ('start','end')) then raise exception 'Choose valid daily hours.'; end if;
    t_start:=nullif(pair.value->>'start','')::time; t_end:=nullif(pair.value->>'end','')::time;
    if (t_start is null)<>(t_end is null) or (t_start is not null and t_end<=t_start) then raise exception 'Daily hours need a start and a later end on the same day.'; end if;
  end loop;
  if not exists(select 1 from public.profiles where id=p_profile_id and org_id=v_org and active) then raise exception 'Choose an active person in your organisation.' using errcode='42501'; end if;
  if p_unit_id is not null and not exists(select 1 from public.unit_memberships where profile_id=p_profile_id and unit_id=p_unit_id and org_id=v_org) then raise exception 'Choose the person’s recorded unit.' using errcode='42501'; end if;
  if p_effective_from is null or (p_effective_to is not null and p_effective_to<p_effective_from) or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Choose valid effective dates and record a reason.'; end if;
  if p_supersedes_id is not null then
    select * into prior from public.workforce_schedule_versions where id=p_supersedes_id and org_id=v_org and profile_id=p_profile_id for update;
    if prior.id is null or exists(select 1 from public.workforce_schedule_versions where supersedes_id=prior.id) then raise exception 'The pattern has changed. Reload before recording a new version.'; end if;
  end if;
  insert into public.workforce_schedule_versions(org_id,schedule_key,version,profile_id,unit_id,effective_from,effective_to,source,day_map,clock_map,supersedes_id,reason,created_by)
    values(v_org,coalesce(prior.schedule_key,gen_random_uuid()),coalesce(prior.version+1,1),p_profile_id,p_unit_id,p_effective_from,p_effective_to,'person',p_day_map,p_clock_map,p_supersedes_id,btrim(p_reason),auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create table public.attendance_notices(
  work_item_id uuid primary key references public.work_requests(work_item_id) on delete restrict,
  org_id uuid not null references public.organisations(id), profile_id uuid not null references public.profiles(id),
  unit_id uuid not null references public.units(id), kind text not null check(kind in ('late_arrival','temporary_permission','emergency_absence','medical_absence')),
  starts_at timestamptz not null, expected_return_at timestamptz,
  reason text, note text, created_at timestamptz not null default now(), created_by uuid not null references public.profiles(id),
  check(expected_return_at is null or expected_return_at>starts_at),
  check(kind<>'temporary_permission' or expected_return_at is not null),
  check(kind<>'medical_absence' or (reason is null and note is null))
);
create index attendance_notices_subject_idx on public.attendance_notices(org_id,profile_id,starts_at);
create table public.attendance_returns(
  id uuid primary key default gen_random_uuid(), work_item_id uuid not null references public.attendance_notices(work_item_id),
  org_id uuid not null references public.organisations(id), profile_id uuid not null references public.profiles(id),
  actor_id uuid not null references public.profiles(id), returned_at timestamptz not null default now(),
  work_session_id uuid references public.work_sessions(id), evidence_type text not null default 'self_report' check(evidence_type='self_report'),
  unique(work_item_id)
);
create table public.work_session_checkpoints(
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organisations(id),
  profile_id uuid not null references public.profiles(id), actor_id uuid not null references public.profiles(id),
  work_session_id uuid not null references public.work_sessions(id), checkpoint_type text not null check(checkpoint_type in ('periodic','pre_close')),
  received_at timestamptz not null default now(), captured_at timestamptz, device_time timestamptz,
  lat double precision, lng double precision, accuracy_m double precision, office_location_id uuid references public.office_locations(id),
  geofence text not null check(geofence in ('inside','outside','not_configured','not_verified')),
  failure text, schedule_version_id uuid references public.workforce_schedule_versions(id), expected_close_at timestamptz,
  slot text not null, unique(work_session_id,checkpoint_type,slot),
  check ((lat is null and lng is null and captured_at is null and geofence='not_verified') or
    (lat between -90 and 90 and lng between -180 and 180 and captured_at is not null and geofence<>'not_verified'))
);
create index work_session_checkpoints_scope_idx on public.work_session_checkpoints(org_id,profile_id,received_at desc);
alter table public.attendance_notices enable row level security;
alter table public.attendance_returns enable row level security;
alter table public.work_session_checkpoints enable row level security;
create policy attendance_notices_read on public.attendance_notices for select to authenticated using(
  org_id=public.app_org_id() and (profile_id=auth.uid() or public.app_has_capability('workforce.manage',null) or unit_id in(select public.app_managed_units())));
create policy attendance_returns_read on public.attendance_returns for select to authenticated using(
  org_id=public.app_org_id() and exists(select 1 from public.attendance_notices n where n.work_item_id=attendance_returns.work_item_id));
create policy work_session_checkpoints_read on public.work_session_checkpoints for select to authenticated using(
  org_id=public.app_org_id() and (profile_id=auth.uid() or public.app_has_capability('workforce.manage',null)
    or exists(select 1 from public.unit_memberships m where m.profile_id=work_session_checkpoints.profile_id and m.org_id=work_session_checkpoints.org_id and m.unit_id in(select public.app_managed_units()))));
revoke all on public.attendance_notices,public.attendance_returns,public.work_session_checkpoints from public,anon,authenticated;
grant select on public.attendance_notices,public.attendance_returns,public.work_session_checkpoints to authenticated;
grant all on public.attendance_notices,public.attendance_returns,public.work_session_checkpoints to service_role;
create trigger attendance_notices_immutable before update or delete on public.attendance_notices for each row execute function public.platform_audit_immutable();
create trigger attendance_returns_immutable before update or delete on public.attendance_returns for each row execute function public.platform_audit_immutable();
create trigger work_session_checkpoints_immutable before update or delete on public.work_session_checkpoints for each row execute function public.platform_audit_immutable();
create trigger audit_attendance_notices after insert on public.attendance_notices for each row execute function public.platform_audit_capture('attendance_notice','work_item_id','profile_id');
create trigger audit_attendance_returns after insert on public.attendance_returns for each row execute function public.platform_audit_capture('attendance_return','id','profile_id');
create trigger audit_work_session_checkpoints after insert on public.work_session_checkpoints for each row execute function public.platform_audit_capture('work_session_checkpoint','id','profile_id');

create function public.attendance_create_notice(p_kind text,p_starts_at timestamptz,p_expected_return_at timestamptz,p_reason text,p_note text)
returns uuid language plpgsql security definer set search_path=public as $$
declare e public.employment_records; v_org uuid:=public.app_org_id(); v_id uuid:=gen_random_uuid(); manager_id uuid; v_title text;
begin
  if auth.uid() is null or v_org is null then raise exception 'Sign in to record attendance context.' using errcode='42501'; end if;
  select * into e from public.employment_records where profile_id=auth.uid() and org_id=v_org and employment_status='active';
  if e.profile_id is null or e.unit_id is null then raise exception 'An active employment unit is required. Ask Administration.' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('late_arrival','temporary_permission','emergency_absence','medical_absence') or p_starts_at is null then raise exception 'Choose the notice and its date/time.'; end if;
  if p_expected_return_at<=p_starts_at or (p_kind='temporary_permission' and p_expected_return_at is null) then raise exception 'Choose a return time after departure.'; end if;
  if p_kind='medical_absence' and (nullif(btrim(p_reason),'') is not null or nullif(btrim(p_note),'') is not null) then raise exception 'Medical notices contain dates and status only. Use Protected HR for medical details.'; end if;
  if p_kind<>'medical_absence' and length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Give a short operational reason.'; end if;
  if length(coalesce(p_reason,''))>600 or length(coalesce(p_note,''))>1200 then raise exception 'Keep the operational context brief.'; end if;
  select p.id into manager_id from public.profiles p where p.id=e.manager_profile_id and p.id<>auth.uid() and p.org_id=v_org and p.active
    and exists(select 1 from public.unit_memberships m where m.profile_id=p.id and m.unit_id=e.unit_id and m.role='manager');
  if manager_id is null then select m.profile_id into manager_id from public.unit_memberships m join public.profiles p on p.id=m.profile_id where m.unit_id=e.unit_id and m.org_id=v_org and m.role='manager' and p.active and p.id<>auth.uid() order by m.profile_id limit 1; end if;
  v_title:=case p_kind when 'late_arrival' then 'Late arrival notice' when 'temporary_permission' then 'Temporary permission to leave' when 'emergency_absence' then 'Emergency absence notice' else 'Medical absence notice' end;
  perform set_config('ceac.typed_create','on',true);
  insert into public.work_items(id,org_id,ref,kind,unit_id,assignee_id,assigned_by,title,expected_outcome,origin,visibility,confidential,status)
    values(v_id,v_org,public.next_work_ref(e.unit_id,null),'request',e.unit_id,manager_id,auth.uid(),v_title,'Record an attributable response to attendance context.','self_created','unit',true,'waiting_on');
  insert into public.work_requests(work_item_id,requester_id,responsible_profile_id,responsible_unit_id) values(v_id,auth.uid(),manager_id,e.unit_id);
  insert into public.attendance_notices(work_item_id,org_id,profile_id,unit_id,kind,starts_at,expected_return_at,reason,note,created_by)
    values(v_id,v_org,auth.uid(),e.unit_id,p_kind,p_starts_at,p_expected_return_at,nullif(btrim(p_reason),''),nullif(btrim(p_note),''),auth.uid());
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta) values(v_org,auth.uid(),'attendance_notice_recorded','work_item',v_id,jsonb_build_object('kind',p_kind));
  return v_id;
end;
$$;

create function public.attendance_respond_notice(p_work_item_id uuid,p_outcome text,p_note text)
returns uuid language plpgsql security definer set search_path=public as $$
declare n public.attendance_notices;
begin
  select * into n from public.attendance_notices where work_item_id=p_work_item_id and org_id=public.app_org_id();
  if auth.uid() is null or n.work_item_id is null then raise exception 'That notice is unavailable.' using errcode='42501'; end if;
  if p_outcome='cancelled' then
    if n.profile_id<>auth.uid() then raise exception 'Only the requester can cancel this notice.' using errcode='42501'; end if;
  elsif n.profile_id=auth.uid() or not (n.unit_id in(select public.app_managed_units()) or public.app_has_capability('workforce.manage',null)) then
    raise exception 'Your managed unit or workforce authority is required; you cannot approve your own notice.' using errcode='42501';
  end if;
  if p_outcome is null or p_outcome not in ('fulfilled','declined','cancelled') or length(btrim(coalesce(p_note,'')))<3 then raise exception 'Choose a response and explain it briefly.'; end if;
  if n.kind='medical_absence' and p_note<>'Operational response recorded' then raise exception 'Medical responses record status only.'; end if;
  return public.respond_work_request(p_work_item_id,p_outcome,p_note);
end;
$$;

create function public.attendance_record_return(p_work_item_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare n public.attendance_notices; v_id uuid; session_id uuid;
begin
  select * into n from public.attendance_notices where work_item_id=p_work_item_id and org_id=public.app_org_id() and profile_id=auth.uid();
  if auth.uid() is null or n.work_item_id is null or n.kind<>'temporary_permission' then raise exception 'Record only your own temporary-permission return.' using errcode='42501'; end if;
  if now()<n.starts_at then raise exception 'Departure is still in the future.'; end if;
  select id into session_id from public.work_sessions where profile_id=auth.uid() and org_id=n.org_id and ended_at is null order by started_at desc limit 1;
  insert into public.attendance_returns(work_item_id,org_id,profile_id,actor_id,work_session_id) values(n.work_item_id,n.org_id,auth.uid(),auth.uid(),session_id) returning id into v_id;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta) values(n.org_id,auth.uid(),'attendance_return_reported','work_item',n.work_item_id,'{}');
  return v_id;
end;
$$;

-- Enforce attendance authority even through the existing Item response screen.
create function public.guard_attendance_response() returns trigger language plpgsql security definer set search_path=public as $$
declare n public.attendance_notices;
begin
  select * into n from public.attendance_notices where work_item_id=new.work_item_id;
  if n.work_item_id is null then return new; end if;
  if new.request_state not in ('fulfilled','declined','cancelled') then raise exception 'Attendance notices use acknowledge/approve, decline or cancel. Record a new notice for changed context.'; end if;
  if new.requester_id is distinct from old.requester_id or new.responsible_profile_id is distinct from old.responsible_profile_id or new.responsible_unit_id is distinct from old.responsible_unit_id then raise exception 'Attendance routing is preserved.' using errcode='42501'; end if;
  if auth.uid() is null or n.org_id is distinct from public.app_org_id() then raise exception 'An active attendance actor is required.' using errcode='42501'; end if;
  if new.request_state='cancelled' then
    if n.profile_id<>auth.uid() and not public.app_has_capability('workforce.manage',null) then raise exception 'You cannot cancel this attendance notice.' using errcode='42501'; end if;
  elsif n.profile_id=auth.uid() or not (n.unit_id in(select public.app_managed_units()) or public.app_has_capability('workforce.manage',null)) then
    raise exception 'Managed-unit or workforce authority is required; self-approval is prohibited.' using errcode='42501';
  end if;
  if n.kind='medical_absence' and new.response_note is distinct from 'Operational response recorded' then raise exception 'Medical responses record status only.'; end if;
  insert into public.platform_audit_events(org_id,actor_id,action,resource_type,resource_id,subject_profile_id,source_table,changed_fields,context)
    values(n.org_id,auth.uid(),'attendance_notice.response','attendance_notice',n.work_item_id,n.profile_id,'public.work_requests',array['request_state'],jsonb_build_object('prior_state',old.request_state,'new_state',new.request_state));
  return new;
end;
$$;
revoke all on function public.guard_attendance_response() from public,anon,authenticated;
create trigger attendance_request_response_guard before update on public.work_requests for each row execute function public.guard_attendance_response();

create function public.record_work_checkpoint(p_session_id uuid,p_type text,p_lat double precision,p_lng double precision,p_accuracy_m double precision,p_captured_at timestamptz,p_device_time timestamptz,p_failure text)
returns uuid language plpgsql security definer set search_path=public as $$
declare s public.work_sessions; o public.office_locations; pattern public.workforce_schedule_versions; v_key text; close_at timestamptz;
  v_verified boolean; x double precision; v_geo text; v_slot text; v_id uuid;
begin
  select * into s from public.work_sessions where id=p_session_id for update;
  if auth.uid() is null or s.id is null or s.profile_id is distinct from auth.uid() or s.org_id is distinct from public.app_org_id() or s.ended_at is not null then raise exception 'Only your own open work session can record presence.' using errcode='42501'; end if;
  if p_type is null or p_type not in ('periodic','pre_close') then raise exception 'Choose a supported presence check.'; end if;
  select * into pattern from public.workforce_schedule_versions v where v.org_id=s.org_id and v.profile_id=s.profile_id
    and v.effective_from<=(now() at time zone 'Africa/Accra')::date and (v.effective_to is null or v.effective_to>=(now() at time zone 'Africa/Accra')::date)
    and not exists(select 1 from public.workforce_schedule_versions successor where successor.supersedes_id=v.id and successor.effective_from<=(now() at time zone 'Africa/Accra')::date and (successor.effective_to is null or successor.effective_to>=(now() at time zone 'Africa/Accra')::date)) order by created_at desc,id desc limit 1;
  v_key:=lower(to_char(now() at time zone 'Africa/Accra','Dy'));
  if exists(select 1 from public.workforce_day_types where id=nullif(pattern.day_map->>v_key,'')::uuid and session_expected) then
    close_at:=(((now() at time zone 'Africa/Accra')::date + case when pattern.clock_map ? v_key then nullif(pattern.clock_map->v_key->>'end','')::time else pattern.expected_end end) at time zone 'Africa/Accra');
  end if;
  if p_type='pre_close' and (close_at is null or now()<close_at-interval '1 hour' or now()>=close_at) then raise exception 'The recorded working pattern is outside its pre-close window.'; end if;
  v_slot:=case when p_type='pre_close' then (close_at at time zone 'Africa/Accra')::date::text else floor(extract(epoch from now())/3600)::bigint::text end;
  select id into v_id from public.work_session_checkpoints where work_session_id=s.id and checkpoint_type=p_type and slot=v_slot;
  if v_id is not null then return v_id; end if;
  v_verified:=coalesce(p_lat between -90 and 90 and p_lng between -180 and 180 and p_captured_at>=now()-interval '2 minutes' and p_captured_at<=now()+interval '30 seconds' and (p_accuracy_m is null or (p_accuracy_m>=0 and p_accuracy_m<'Infinity'::double precision)),false);
  select * into o from public.office_locations where org_id=s.org_id and is_primary order by set_at desc limit 1;
  v_geo:='not_verified';
  if v_verified then
    v_geo:='not_configured';
    if o.id is not null then
      x:=power(sin(radians(p_lat-o.lat::double precision)/2),2)+cos(radians(o.lat::double precision))*cos(radians(p_lat))*power(sin(radians(p_lng-o.lng::double precision)/2),2);
      v_geo:=case when 6371000*2*asin(sqrt(least(1,greatest(0,x))))<=o.radius_meters then 'inside' else 'outside' end;
    end if;
  end if;
  insert into public.work_session_checkpoints(org_id,profile_id,actor_id,work_session_id,checkpoint_type,captured_at,device_time,lat,lng,accuracy_m,office_location_id,geofence,failure,schedule_version_id,expected_close_at,slot)
    values(s.org_id,s.profile_id,auth.uid(),s.id,p_type,case when v_verified then p_captured_at end,p_device_time,case when v_verified then p_lat end,case when v_verified then p_lng end,case when v_verified then p_accuracy_m end,o.id,v_geo,case when not v_verified then left(coalesce(nullif(p_failure,''),'Location unavailable or invalid'),200) end,pattern.id,close_at,v_slot) returning id into v_id;
  return v_id;
end;
$$;

-- The only organisation-wide Compliance read path is explicitly sanitised.
-- It does not grant access to leave reasons, notice narratives or protected HR.
create function public.attendance_day_evidence(p_date date default current_date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_org uuid:=public.app_org_id(); v_result jsonb; v_key text;
begin
  if auth.uid() is null or v_org is null then raise exception 'Sign in to view authorised attendance evidence.' using errcode='42501'; end if;
  if p_date is null then raise exception 'Choose a date.'; end if;
  v_key:=lower(to_char(p_date,'Dy'));
  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id',emp.id,'profile_id',emp.profile_id,'name',coalesce(p.full_name,emp.full_name),'unit_id',coalesce(e.unit_id,em.unit_id),'schedule_id',pattern.id,
    'expected_today',dt.session_expected,'day_type',dt.name,
    'expected_start',case when pattern.clock_map ? v_key then pattern.clock_map->v_key->>'start' else pattern.expected_start::text end,
    'expected_end',case when pattern.clock_map ? v_key then pattern.clock_map->v_key->>'end' else pattern.expected_end::text end,
    'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'started_at',s.started_at,'ended_at',s.ended_at,'start_geofence',s.start_geofence,'location_captured_at',s.location_captured_at,'end_location_status',s.end_location_status) order by s.started_at) from public.work_sessions s where s.profile_id=e.profile_id and s.org_id=v_org and (s.started_at at time zone 'Africa/Accra')::date=p_date),'[]'::jsonb),
    'latest_location',(select jsonb_build_object('captured_at',loc.captured_at,'lat',loc.lat,'lng',loc.lng,'accuracy_m',loc.accuracy_m,'type',loc.kind,'geofence',loc.geofence) from (
      select s.location_captured_at captured_at,s.lat,s.lng,s.location_accuracy_m accuracy_m,'start' kind,s.start_geofence geofence from public.work_sessions s where s.profile_id=e.profile_id and s.org_id=v_org and (s.started_at at time zone 'Africa/Accra')::date=p_date
      union all select s.end_location_captured_at,s.end_lat,s.end_lng,s.end_accuracy_m,'end',null from public.work_sessions s where s.profile_id=e.profile_id and s.org_id=v_org and (s.started_at at time zone 'Africa/Accra')::date=p_date
      union all select c.captured_at,c.lat,c.lng,c.accuracy_m,c.checkpoint_type,c.geofence from public.work_session_checkpoints c where c.profile_id=e.profile_id and c.org_id=v_org and (c.received_at at time zone 'Africa/Accra')::date=p_date
    ) loc where loc.captured_at is not null order by loc.captured_at desc limit 1),
    'checkpoints',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'type',c.checkpoint_type,'received_at',c.received_at,'captured_at',c.captured_at,'geofence',c.geofence,'failure',c.failure,'accuracy_m',c.accuracy_m) order by c.received_at desc) from public.work_session_checkpoints c where c.profile_id=e.profile_id and c.org_id=v_org and (c.received_at at time zone 'Africa/Accra')::date=p_date),'[]'::jsonb),
    'last_activity_at',(select max(a.at) from public.activity_events a where a.org_id=v_org and a.actor_id=e.profile_id and a.at<((p_date+1)::timestamp at time zone 'Africa/Accra')),
    'approved_leave',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'start_date',l.start_date,'end_date',l.end_date,'state',case when l.start_date>p_date then 'upcoming' else 'current' end)) from public.leave_requests l where l.org_id=v_org and l.profile_id=e.profile_id and l.status='approved' and l.end_date>=p_date),'[]'::jsonb),
    'notices',coalesce((select jsonb_agg(jsonb_build_object('id',n.work_item_id,'kind',n.kind,'starts_at',n.starts_at,'expected_return_at',n.expected_return_at,'created_at',n.created_at,'created_by',n.created_by,'request_state',r.request_state,'responded_at',r.responded_at,'responded_by',r.responded_by,'returned_at',ret.returned_at,'return_evidence_type',ret.evidence_type,
      'can_respond',n.profile_id<>auth.uid() and (n.unit_id in(select public.app_managed_units()) or public.app_has_capability('workforce.manage',null)),
      'reason',case when n.profile_id=auth.uid() or n.unit_id in(select public.app_managed_units()) or public.app_has_capability('workforce.manage',null) then n.reason end,
      'note',case when n.profile_id=auth.uid() or n.unit_id in(select public.app_managed_units()) or public.app_has_capability('workforce.manage',null) then n.note end,
      'response_note',case when n.profile_id=auth.uid() or n.unit_id in(select public.app_managed_units()) or public.app_has_capability('workforce.manage',null) then r.response_note end,
      'responses',coalesce((select jsonb_agg(jsonb_build_object('actor_id',rr.actor_id,'outcome',rr.outcome,'created_at',rr.created_at) order by rr.created_at) from public.work_request_responses rr where rr.work_item_id=n.work_item_id),'[]'::jsonb)) order by n.created_at desc)
      from public.attendance_notices n join public.work_requests r on r.work_item_id=n.work_item_id left join public.attendance_returns ret on ret.work_item_id=n.work_item_id
      where n.org_id=v_org and n.profile_id=e.profile_id and (n.starts_at at time zone 'Africa/Accra')::date<=p_date and coalesce((n.expected_return_at at time zone 'Africa/Accra')::date,(n.starts_at at time zone 'Africa/Accra')::date)>=p_date),'[]'::jsonb)
    ) order by coalesce(p.full_name,emp.full_name)),'[]'::jsonb) into v_result
  from public.employee_roster emp left join public.employment_records e on e.profile_id=emp.profile_id and e.org_id=emp.org_id
  left join public.profiles p on p.id=emp.profile_id
  left join lateral(select m.unit_id from public.employee_unit_memberships m where m.employee_id=emp.id and m.org_id=emp.org_id and m.is_primary order by m.unit_id limit 1) em on true
  left join lateral(select v.* from public.workforce_schedule_versions v where v.org_id=v_org and v.profile_id=e.profile_id and v.effective_from<=p_date and (v.effective_to is null or v.effective_to>=p_date)
    and not exists(select 1 from public.workforce_schedule_versions successor where successor.supersedes_id=v.id and successor.effective_from<=p_date and (successor.effective_to is null or successor.effective_to>=p_date)) order by v.created_at desc,v.id desc limit 1) pattern on true
  left join public.workforce_day_types dt on dt.id=nullif(pattern.day_map->>v_key,'')::uuid and dt.org_id=v_org
  where emp.org_id=v_org and emp.employment_status='active' and (p.id is null or p.active) and (emp.profile_id=auth.uid() or public.app_has_capability('workforce.manage',null) or public.app_has_capability('compliance.manage',null)
    or em.unit_id in(select public.app_managed_units()) or exists(select 1 from public.unit_memberships m where m.profile_id=emp.profile_id and m.org_id=v_org and m.unit_id in(select public.app_managed_units())));
  return v_result;
end;
$$;

revoke all on function public.workforce_record_pattern(uuid,uuid,date,date,jsonb,jsonb,text,uuid),public.attendance_create_notice(text,timestamptz,timestamptz,text,text),public.attendance_respond_notice(uuid,text,text),public.attendance_record_return(uuid),public.record_work_checkpoint(uuid,text,double precision,double precision,double precision,timestamptz,timestamptz,text),public.attendance_day_evidence(date) from public,anon;
grant execute on function public.workforce_record_pattern(uuid,uuid,date,date,jsonb,jsonb,text,uuid),public.attendance_create_notice(text,timestamptz,timestamptz,text,text),public.attendance_respond_notice(uuid,text,text),public.attendance_record_return(uuid),public.record_work_checkpoint(uuid,text,double precision,double precision,double precision,timestamptz,timestamptz,text),public.attendance_day_evidence(date) to authenticated,service_role;
