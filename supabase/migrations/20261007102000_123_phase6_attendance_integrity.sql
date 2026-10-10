-- 123 — Phase 6C: attendance integrity corroboration.
-- Adds a short-lived rotating office code as append-only corroborating evidence.
-- Existing GPS/geofence and foreground checkpoints remain primary factual signals.
-- No evidence row creates absence, misconduct, leave, pay, Payroll or disciplinary effects.

create table if not exists public.office_presence_code_windows(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  office_location_id uuid not null references public.office_locations(id) on delete restrict,
  code_salt text not null,
  code_verifier text not null,
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check(expires_at>issued_at),
  check(length(code_salt)>=20),
  check(length(code_verifier)=32)
);

create index if not exists office_presence_code_active_idx
  on public.office_presence_code_windows(org_id,office_location_id,expires_at desc)
  where revoked_at is null;

alter table public.office_presence_code_windows enable row level security;
revoke all on public.office_presence_code_windows from public,anon,authenticated;
grant all on public.office_presence_code_windows to service_role;

create table if not exists public.office_presence_code_attempts(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  work_session_id uuid not null references public.work_sessions(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);

create index if not exists office_presence_code_attempts_rate_idx
  on public.office_presence_code_attempts(profile_id,attempted_at desc);

alter table public.office_presence_code_attempts enable row level security;
revoke all on public.office_presence_code_attempts from public,anon,authenticated;
grant all on public.office_presence_code_attempts to service_role;

create table if not exists public.attendance_presence_evidence(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  work_session_id uuid not null references public.work_sessions(id) on delete restrict,
  evidence_kind text not null
    check(evidence_kind in ('office_code','network_corroboration')),
  outcome text not null
    check(outcome in ('corroborated','not_verified')),
  observed_at timestamptz not null default now(),
  office_location_id uuid references public.office_locations(id) on delete restrict,
  code_window_id uuid references public.office_presence_code_windows(id) on delete restrict,
  detail jsonb not null default '{}'::jsonb
    check(jsonb_typeof(detail)='object')
);

create unique index if not exists attendance_presence_evidence_code_once_idx
  on public.attendance_presence_evidence(work_session_id,evidence_kind,code_window_id)
  where code_window_id is not null;

create index if not exists attendance_presence_evidence_scope_idx
  on public.attendance_presence_evidence(org_id,profile_id,observed_at desc);

alter table public.attendance_presence_evidence enable row level security;

drop policy if exists attendance_presence_evidence_read
  on public.attendance_presence_evidence;
create policy attendance_presence_evidence_read
on public.attendance_presence_evidence
for select
to authenticated
using (
  org_id=public.app_org_id()
  and (
    profile_id=auth.uid()
    or public.app_has_capability('workforce.manage',null)
    or public.app_has_capability('compliance.manage',null)
    or exists(
      select 1
      from public.unit_memberships m
      where m.profile_id=attendance_presence_evidence.profile_id
        and m.org_id=attendance_presence_evidence.org_id
        and m.unit_id in(select public.app_managed_units())
    )
  )
);

revoke all on public.attendance_presence_evidence from public,anon,authenticated;
grant select on public.attendance_presence_evidence to authenticated;
grant all on public.attendance_presence_evidence to service_role;

drop trigger if exists attendance_presence_evidence_immutable
  on public.attendance_presence_evidence;
create trigger attendance_presence_evidence_immutable
before update or delete on public.attendance_presence_evidence
for each row execute function public.platform_audit_immutable();

drop trigger if exists audit_attendance_presence_evidence
  on public.attendance_presence_evidence;
create trigger audit_attendance_presence_evidence
after insert on public.attendance_presence_evidence
for each row execute function public.platform_audit_capture(
  'attendance_presence_evidence','id','profile_id'
);

create or replace function public.attendance_create_office_code(
  p_office_location_id uuid default null,
  p_valid_minutes integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_office public.office_locations;
  v_id uuid:=gen_random_uuid();
  v_salt text:=replace(gen_random_uuid()::text,'-','');
  v_code text:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_expires timestamptz;
begin
  if auth.uid() is null or v_org is null
     or not (
       public.app_is_admin()
       or public.app_has_capability('workforce.manage',null)
     ) then
    raise exception 'Workforce administration is required to rotate an office presence code.'
      using errcode='42501';
  end if;

  if p_valid_minutes is null or p_valid_minutes<5 or p_valid_minutes>30 then
    raise exception 'Office presence codes must expire within 5 to 30 minutes.';
  end if;

  select *
  into v_office
  from public.office_locations o
  where o.org_id=v_org
    and (
      (p_office_location_id is not null and o.id=p_office_location_id)
      or (p_office_location_id is null and o.is_primary)
    )
  order by o.is_primary desc,o.set_at desc
  limit 1;

  if v_office.id is null then
    raise exception 'Configure an office location before issuing a presence code.';
  end if;

  update public.office_presence_code_windows
  set revoked_at=now()
  where org_id=v_org
    and office_location_id=v_office.id
    and revoked_at is null
    and expires_at>now();

  v_expires:=now()+make_interval(mins=>p_valid_minutes);

  insert into public.office_presence_code_windows(
    id,org_id,office_location_id,code_salt,code_verifier,
    issued_by,issued_at,expires_at
  ) values(
    v_id,v_org,v_office.id,v_salt,md5(v_salt||v_code),
    auth.uid(),now(),v_expires
  );

  insert into public.activity_events(
    org_id,actor_id,verb,object_type,object_id,meta
  ) values(
    v_org,auth.uid(),'office_presence_code_rotated','office_presence_code',v_id,
    jsonb_build_object(
      'office_location_id',v_office.id,
      'expires_at',v_expires,
      'valid_minutes',p_valid_minutes
    )
  );

  return jsonb_build_object(
    'id',v_id,
    'code',v_code,
    'office_location_id',v_office.id,
    'office_name',v_office.name,
    'issued_at',now(),
    'expires_at',v_expires,
    'evidence_label','Corroborating office evidence only'
  );
end;
$$;

revoke all on function public.attendance_create_office_code(uuid,integer)
  from public,anon;
grant execute on function public.attendance_create_office_code(uuid,integer)
  to authenticated,service_role;

create or replace function public.attendance_verify_office_code(
  p_session_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  s public.work_sessions;
  w public.office_presence_code_windows;
  v_failures integer;
  v_evidence uuid;
  v_code text:=upper(btrim(coalesce(p_code,'')));
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Sign in to record attendance evidence.' using errcode='42501';
  end if;

  select *
  into s
  from public.work_sessions
  where id=p_session_id
  for update;

  if s.id is null
     or s.org_id is distinct from v_org
     or s.profile_id is distinct from auth.uid()
     or s.ended_at is not null then
    raise exception 'Only your own open work session can record office-code evidence.'
      using errcode='42501';
  end if;

  if s.place is distinct from 'office' then
    return jsonb_build_object(
      'ok',false,
      'reason','Office-code corroboration is only available for a session recorded as office work.'
    );
  end if;

  select count(*)::integer
  into v_failures
  from public.office_presence_code_attempts a
  where a.profile_id=auth.uid()
    and a.attempted_at>now()-interval '10 minutes'
    and not a.succeeded;

  if v_failures>=5 then
    return jsonb_build_object(
      'ok',false,
      'reason','Too many unsuccessful code attempts. Wait before trying again.'
    );
  end if;

  select *
  into w
  from public.office_presence_code_windows x
  where x.org_id=v_org
    and x.revoked_at is null
    and x.expires_at>now()
    and x.code_verifier=md5(x.code_salt||v_code)
  order by x.issued_at desc
  limit 1;

  insert into public.office_presence_code_attempts(
    org_id,profile_id,work_session_id,succeeded
  ) values(
    v_org,auth.uid(),s.id,w.id is not null
  );

  if w.id is null then
    return jsonb_build_object(
      'ok',false,
      'reason','That office code is invalid or has expired.'
    );
  end if;

  insert into public.attendance_presence_evidence(
    org_id,profile_id,actor_id,work_session_id,evidence_kind,outcome,
    observed_at,office_location_id,code_window_id,detail
  ) values(
    v_org,auth.uid(),auth.uid(),s.id,'office_code','corroborated',
    now(),w.office_location_id,w.id,
    jsonb_build_object(
      'statement','Short-lived office code matched. This corroborates, but does not prove, physical presence.',
      'session_place',s.place
    )
  )
  on conflict(work_session_id,evidence_kind,code_window_id)
  where code_window_id is not null
  do nothing
  returning id into v_evidence;

  if v_evidence is null then
    select e.id
    into v_evidence
    from public.attendance_presence_evidence e
    where e.work_session_id=s.id
      and e.evidence_kind='office_code'
      and e.code_window_id=w.id;
  end if;

  return jsonb_build_object(
    'ok',true,
    'evidence_id',v_evidence,
    'observed_at',now(),
    'office_location_id',w.office_location_id,
    'statement','Office code matched. This is corroborating evidence only; GPS, work context and authorised review remain separate.'
  );
end;
$$;

revoke all on function public.attendance_verify_office_code(uuid,text)
  from public,anon;
grant execute on function public.attendance_verify_office_code(uuid,text)
  to authenticated,service_role;

comment on table public.attendance_presence_evidence is
  'Append-only corroborating attendance evidence. No row is an automatic absence, misconduct, pay or disciplinary decision.';
comment on table public.office_presence_code_windows is
  'Short-lived office-code verifier windows. Plaintext code is returned only at creation and is not stored.';
comment on function public.attendance_verify_office_code(uuid,text) is
  'Records corroborating office-code evidence for the signed-in user own open office session. Does not alter payroll, leave or discipline.';
