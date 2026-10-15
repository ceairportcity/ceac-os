-- 123 — Phase 6C: attendance-integrity corroboration.
-- Corroborating evidence only. No automatic absence, misconduct, discipline,
-- salary deduction or Payroll consequence is created by these signals.

create table if not exists public.attendance_integrity_settings(
  org_id uuid primary key references public.organisations(id) on delete cascade,
  front_desk_code_enabled boolean not null default false,
  front_desk_code_ttl_minutes integer not null default 10
    check(front_desk_code_ttl_minutes between 5 and 60),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_verification_codes(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  code_value text not null check(code_value ~ '^[A-F0-9]{6}$'),
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  check(valid_until>valid_from)
);
create index if not exists attendance_verification_codes_active_idx
  on public.attendance_verification_codes(org_id,valid_until desc)
  where revoked_at is null;

create table if not exists public.attendance_network_sources(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  label text not null check(length(btrim(label)) between 2 and 120),
  source_key text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.attendance_corroboration_events(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  work_session_id uuid references public.work_sessions(id) on delete restrict,
  evidence_type text not null check(evidence_type in ('front_desk_code','office_network')),
  result text not null check(result in ('verified','not_verified')),
  source_label text not null,
  source_reference text,
  verification_code_id uuid references public.attendance_verification_codes(id) on delete restrict,
  received_at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb check(jsonb_typeof(detail)='object')
);
create index if not exists attendance_corroboration_scope_idx
  on public.attendance_corroboration_events(org_id,profile_id,received_at desc);

alter table public.attendance_integrity_settings enable row level security;
alter table public.attendance_verification_codes enable row level security;
alter table public.attendance_network_sources enable row level security;
alter table public.attendance_corroboration_events enable row level security;

revoke all on public.attendance_integrity_settings,
  public.attendance_verification_codes,
  public.attendance_network_sources,
  public.attendance_corroboration_events
from public,anon,authenticated;

grant all on public.attendance_integrity_settings,
  public.attendance_verification_codes,
  public.attendance_network_sources,
  public.attendance_corroboration_events
to service_role;

create trigger attendance_corroboration_immutable
before update or delete on public.attendance_corroboration_events
for each row execute function public.platform_audit_immutable();

create or replace function public.attendance_integrity_status()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_settings public.attendance_integrity_settings;
  v_code public.attendance_verification_codes;
  v_network_ready boolean;
  v_workforce boolean;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Sign in to view attendance-integrity status.' using errcode='42501';
  end if;
  v_workforce:=public.app_has_capability('workforce.manage',null);
  select * into v_settings from public.attendance_integrity_settings where org_id=v_org;
  select * into v_code from public.attendance_verification_codes
   where org_id=v_org and revoked_at is null and valid_from<=now() and valid_until>now()
   order by issued_at desc limit 1;
  select exists(select 1 from public.attendance_network_sources where org_id=v_org and active)
    into v_network_ready;
  return jsonb_build_object(
    'front_desk_code_enabled',coalesce(v_settings.front_desk_code_enabled,false),
    'front_desk_code_ttl_minutes',coalesce(v_settings.front_desk_code_ttl_minutes,10),
    'front_desk_code_active',v_code.id is not null,
    'front_desk_code_valid_until',v_code.valid_until,
    'front_desk_code',case when v_workforce then v_code.code_value end,
    'network_corroboration_ready',coalesce(v_network_ready,false),
    'network_note',case when v_network_ready
      then 'Trusted infrastructure may add network corroboration.'
      else 'No trusted office-network integration is configured.' end,
    'effect_note','Corroboration is evidence only. It does not create absence, misconduct, deductions or Payroll effects.'
  );
end;
$$;

create or replace function public.attendance_set_office_code(
  p_enabled boolean,
  p_ttl_minutes integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_code text;
  v_until timestamptz;
begin
  if v_actor is null or v_org is null
     or not public.app_has_capability('workforce.manage',null) then
    raise exception 'Workforce Administration authority is required.' using errcode='42501';
  end if;
  if p_ttl_minutes is null or p_ttl_minutes not between 5 and 60 then
    raise exception 'Verification-code lifetime must be between 5 and 60 minutes.';
  end if;
  insert into public.attendance_integrity_settings(
    org_id,front_desk_code_enabled,front_desk_code_ttl_minutes,updated_by,updated_at
  ) values(v_org,coalesce(p_enabled,false),p_ttl_minutes,v_actor,now())
  on conflict(org_id) do update set
    front_desk_code_enabled=excluded.front_desk_code_enabled,
    front_desk_code_ttl_minutes=excluded.front_desk_code_ttl_minutes,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at;

  update public.attendance_verification_codes
    set revoked_at=coalesce(revoked_at,now())
    where org_id=v_org and revoked_at is null and valid_until>now();

  if coalesce(p_enabled,false) then
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    v_until:=now()+make_interval(mins=>p_ttl_minutes);
    insert into public.attendance_verification_codes(
      org_id,code_value,valid_from,valid_until,issued_by
    ) values(v_org,v_code,now(),v_until,v_actor);
  end if;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'attendance_integrity_code_configured','organisation',v_org,
    jsonb_build_object('enabled',coalesce(p_enabled,false),'ttl_minutes',p_ttl_minutes));

  return jsonb_build_object(
    'enabled',coalesce(p_enabled,false),'code',v_code,'valid_until',v_until,
    'effect_note','Front-desk verification is corroborating evidence only.'
  );
end;
$$;

create or replace function public.attendance_verify_office_code(
  p_code text,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_settings public.attendance_integrity_settings;
  v_session public.work_sessions;
  v_code public.attendance_verification_codes;
  v_verified boolean:=false;
  v_event uuid;
  v_received timestamptz:=now();
begin
  if v_actor is null or v_org is null then
    raise exception 'Sign in to verify office presence.' using errcode='42501';
  end if;
  select * into v_settings from public.attendance_integrity_settings where org_id=v_org;
  if not coalesce(v_settings.front_desk_code_enabled,false) then
    raise exception 'Front-desk verification is not enabled.';
  end if;

  if p_session_id is null then
    select * into v_session from public.work_sessions
      where org_id=v_org and profile_id=v_actor and ended_at is null
      order by started_at desc limit 1;
  else
    select * into v_session from public.work_sessions
      where id=p_session_id and org_id=v_org and profile_id=v_actor and ended_at is null;
  end if;
  if v_session.id is null then
    raise exception 'Open your work session before using office verification.';
  end if;

  if (select count(*) from public.attendance_corroboration_events
      where org_id=v_org and profile_id=v_actor and evidence_type='front_desk_code'
        and result='not_verified' and received_at>now()-interval '10 minutes')>=5 then
    raise exception 'Too many recent verification attempts. Try again later.';
  end if;

  select * into v_code from public.attendance_verification_codes
    where org_id=v_org and revoked_at is null and valid_from<=now() and valid_until>now()
      and code_value=upper(btrim(coalesce(p_code,'')))
    order by issued_at desc limit 1;
  v_verified:=v_code.id is not null;

  insert into public.attendance_corroboration_events(
    org_id,profile_id,actor_id,work_session_id,evidence_type,result,
    source_label,verification_code_id,received_at,detail
  ) values(
    v_org,v_actor,v_actor,v_session.id,'front_desk_code',
    case when v_verified then 'verified' else 'not_verified' end,
    'Front desk code',v_code.id,v_received,
    jsonb_build_object(
      'note',case when v_verified then 'Short-lived office code accepted.' else 'Code invalid or expired.' end,
      'automatic_consequence',false
    )
  ) returning id into v_event;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'attendance_corroboration_recorded','attendance_corroboration',v_event,
    jsonb_build_object('type','front_desk_code','result',
      case when v_verified then 'verified' else 'not_verified' end));

  return jsonb_build_object(
    'verified',v_verified,'received_at',v_received,
    'message',case when v_verified
      then 'Office verification recorded as corroborating evidence.'
      else 'That code was not verified. No absence or disciplinary state was created.' end
  );
end;
$$;

create or replace function public.attendance_corroboration_for_day(
  p_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_result jsonb;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Sign in to view authorised attendance corroboration.' using errcode='42501';
  end if;
  if p_date is null then raise exception 'Choose a date.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'profile_id',c.profile_id,'work_session_id',c.work_session_id,
    'evidence_type',c.evidence_type,'result',c.result,'source_label',c.source_label,
    'received_at',c.received_at
  ) order by c.received_at desc),'[]'::jsonb)
  into v_result
  from public.attendance_corroboration_events c
  left join public.employment_records e on e.profile_id=c.profile_id and e.org_id=c.org_id
  left join public.employee_roster er on er.profile_id=c.profile_id and er.org_id=c.org_id
  where c.org_id=v_org
    and (c.received_at at time zone 'Africa/Accra')::date=p_date
    and (
      c.profile_id=auth.uid()
      or public.app_has_capability('workforce.manage',null)
      or exists(select 1 from public.unit_memberships m
        where m.profile_id=c.profile_id and m.org_id=v_org
          and m.unit_id in(select public.app_managed_units()))
      or (
        public.app_has_capability('compliance.manage',null)
        and not (
          coalesce(e.employment_type,er.employment_type)='volunteer'
          and coalesce(e.working_pattern->>'kind','not_recorded') in ('no_attendance','not_recorded')
        )
      )
    );
  return v_result;
end;
$$;

create or replace function public.attendance_record_network_corroboration(
  p_source_key text,
  p_profile_id uuid,
  p_session_id uuid,
  p_verified boolean,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_source public.attendance_network_sources;
  v_session public.work_sessions;
  v_id uuid;
begin
  if current_user<>'service_role' then
    raise exception 'Trusted service execution is required.' using errcode='42501';
  end if;
  select * into v_source from public.attendance_network_sources
    where source_key=p_source_key and active limit 1;
  if v_source.id is null then
    raise exception 'Trusted network source is unavailable.' using errcode='42501';
  end if;
  select * into v_session from public.work_sessions
    where id=p_session_id and org_id=v_source.org_id and profile_id=p_profile_id;
  if v_session.id is null then
    raise exception 'The supplied work session does not match this network source.';
  end if;
  insert into public.attendance_corroboration_events(
    org_id,profile_id,actor_id,work_session_id,evidence_type,result,
    source_label,source_reference,detail
  ) values(
    v_source.org_id,p_profile_id,null,p_session_id,'office_network',
    case when coalesce(p_verified,false) then 'verified' else 'not_verified' end,
    v_source.label,nullif(left(btrim(coalesce(p_reference,'')),200),''),
    jsonb_build_object(
      'note','Trusted infrastructure supplied an additional network signal.',
      'automatic_consequence',false
    )
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.attendance_integrity_status(),
  public.attendance_set_office_code(boolean,integer),
  public.attendance_verify_office_code(text,uuid),
  public.attendance_corroboration_for_day(date),
  public.attendance_record_network_corroboration(text,uuid,uuid,boolean,text)
from public,anon;

grant execute on function public.attendance_integrity_status(),
  public.attendance_set_office_code(boolean,integer),
  public.attendance_verify_office_code(text,uuid),
  public.attendance_corroboration_for_day(date)
to authenticated,service_role;

grant execute on function public.attendance_record_network_corroboration(text,uuid,uuid,boolean,text)
to service_role;

create or replace function public.attendance_day_evidence(p_date date default current_date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_org uuid:=public.app_org_id(); v_result jsonb; v_key text;
begin
  if auth.uid() is null or v_org is null then raise exception 'Sign in to view authorised attendance evidence.' using errcode='42501'; end if;
  if p_date is null then raise exception 'Choose a date.'; end if;
  v_key:=lower(to_char(p_date,'Dy'));
  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id',emp.id,'profile_id',emp.profile_id,'name',coalesce(p.full_name,emp.full_name),'employment_type',coalesce(e.employment_type,emp.employment_type),'working_pattern',coalesce(e.working_pattern,'{}'::jsonb),'unit_id',coalesce(e.unit_id,em.unit_id),'schedule_id',pattern.id,
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
      where n.org_id=v_org and n.profile_id=e.profile_id and coalesce((n.expected_return_at at time zone 'Africa/Accra')::date,(n.starts_at at time zone 'Africa/Accra')::date)>=p_date),'[]'::jsonb)
    ) order by coalesce(p.full_name,emp.full_name)),'[]'::jsonb) into v_result
  from public.employee_roster emp left join public.employment_records e on e.profile_id=emp.profile_id and e.org_id=emp.org_id
  left join public.profiles p on p.id=emp.profile_id
  left join lateral(select m.unit_id from public.employee_unit_memberships m where m.employee_id=emp.id and m.org_id=emp.org_id and m.is_primary order by m.unit_id limit 1) em on true
  left join lateral(select v.* from public.workforce_schedule_versions v where v.org_id=v_org and v.profile_id=e.profile_id and v.effective_from<=p_date and (v.effective_to is null or v.effective_to>=p_date)
    and not exists(select 1 from public.workforce_schedule_versions successor where successor.supersedes_id=v.id and successor.effective_from<=p_date and (successor.effective_to is null or successor.effective_to>=p_date)) order by v.created_at desc,v.id desc limit 1) pattern on true
  left join public.workforce_day_types dt on dt.id=nullif(pattern.day_map->>v_key,'')::uuid and dt.org_id=v_org
  where emp.org_id=v_org and emp.employment_status='active' and (p.id is null or p.active) and (emp.profile_id=auth.uid()
    or public.app_has_capability('workforce.manage',null)
    or (
      public.app_has_capability('compliance.manage',null)
      and not (
        coalesce(e.employment_type,emp.employment_type)='volunteer'
        and coalesce(e.working_pattern->>'kind','not_recorded') in ('no_attendance','not_recorded')
      )
    )
    or em.unit_id in(select public.app_managed_units()) or exists(select 1 from public.unit_memberships m where m.profile_id=emp.profile_id and m.org_id=v_org and m.unit_id in(select public.app_managed_units())));
  return v_result;
end;
$$;

revoke all on function public.attendance_day_evidence(date) from public,anon;
grant execute on function public.attendance_day_evidence(date) to authenticated,service_role;

comment on table public.attendance_corroboration_events is
  'Append-only corroborating presence evidence. Never an automatic absence, discipline or Payroll input.';
comment on table public.attendance_network_sources is
  'Trusted infrastructure sources only. Browser-side IP/network guesses are intentionally not accepted as proof.';
