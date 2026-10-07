-- 124 — Phase 6C forward reconciliation after concurrent attendance-integrity work.
-- Keep the earlier canonical 123 attendance_integrity model and remove only the
-- redundant schema/function surface introduced by the later overlapping draft.

drop function if exists public.attendance_create_office_code(uuid,integer);
drop function if exists public.attendance_verify_office_code(uuid,text);

do $$
begin
  if exists(select 1 from public.attendance_presence_evidence)
     or exists(select 1 from public.office_presence_code_attempts)
     or exists(select 1 from public.office_presence_code_windows) then
    raise exception 'Redundant Phase 6C draft tables contain data; reconcile explicitly before removal.';
  end if;
end
$$;

drop table if exists public.attendance_presence_evidence;
drop table if exists public.office_presence_code_attempts;
drop table if exists public.office_presence_code_windows;

alter table public.attendance_integrity_settings
  drop constraint if exists attendance_integrity_settings_front_desk_code_ttl_minutes_check;
alter table public.attendance_integrity_settings
  add constraint attendance_integrity_settings_front_desk_code_ttl_minutes_check
  check(front_desk_code_ttl_minutes between 5 and 30);

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
  if p_ttl_minutes is null or p_ttl_minutes not between 5 and 30 then
    raise exception 'Verification-code lifetime must be between 5 and 30 minutes.';
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

  select * into v_settings
  from public.attendance_integrity_settings
  where org_id=v_org;

  if not coalesce(v_settings.front_desk_code_enabled,false) then
    raise exception 'Front-desk verification is not enabled.';
  end if;

  if p_session_id is null then
    select * into v_session
    from public.work_sessions
    where org_id=v_org and profile_id=v_actor and ended_at is null
    order by started_at desc
    limit 1;
  else
    select * into v_session
    from public.work_sessions
    where id=p_session_id
      and org_id=v_org
      and profile_id=v_actor
      and ended_at is null;
  end if;

  if v_session.id is null then
    raise exception 'Open your work session before using office verification.';
  end if;

  if v_session.place is distinct from 'office' then
    return jsonb_build_object(
      'verified',false,
      'received_at',v_received,
      'message','Office-code corroboration is available only for a work session recorded as office work. No attendance conclusion was created.'
    );
  end if;

  if (
    select count(*)
    from public.attendance_corroboration_events
    where org_id=v_org
      and profile_id=v_actor
      and evidence_type='front_desk_code'
      and result='not_verified'
      and received_at>now()-interval '10 minutes'
  )>=5 then
    return jsonb_build_object(
      'verified',false,
      'received_at',v_received,
      'message','Too many recent verification attempts. Wait before trying again. No attendance conclusion was created.'
    );
  end if;

  select * into v_code
  from public.attendance_verification_codes
  where org_id=v_org
    and revoked_at is null
    and valid_from<=now()
    and valid_until>now()
    and code_value=upper(btrim(coalesce(p_code,'')))
  order by issued_at desc
  limit 1;

  v_verified:=v_code.id is not null;

  insert into public.attendance_corroboration_events(
    org_id,profile_id,actor_id,work_session_id,evidence_type,result,
    source_label,verification_code_id,received_at,detail
  ) values(
    v_org,v_actor,v_actor,v_session.id,'front_desk_code',
    case when v_verified then 'verified' else 'not_verified' end,
    'Front desk code',v_code.id,v_received,
    jsonb_build_object(
      'note',case when v_verified
        then 'Short-lived office code accepted as corroborating evidence.'
        else 'Code invalid or expired.' end,
      'automatic_consequence',false,
      'session_place',v_session.place
    )
  ) returning id into v_event;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'attendance_corroboration_recorded','attendance_corroboration',v_event,
    jsonb_build_object(
      'type','front_desk_code',
      'result',case when v_verified then 'verified' else 'not_verified' end
    ));

  return jsonb_build_object(
    'verified',v_verified,
    'received_at',v_received,
    'message',case when v_verified
      then 'Office verification recorded as corroborating evidence only.'
      else 'That code was not verified. No absence, pay or disciplinary state was created.' end
  );
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
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception 'Trusted service execution is required.' using errcode='42501';
  end if;

  select * into v_source
  from public.attendance_network_sources
  where source_key=p_source_key and active
  limit 1;

  if v_source.id is null then
    raise exception 'Trusted network source is unavailable.' using errcode='42501';
  end if;

  select * into v_session
  from public.work_sessions
  where id=p_session_id
    and org_id=v_source.org_id
    and profile_id=p_profile_id;

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

revoke all on function public.attendance_set_office_code(boolean,integer),
  public.attendance_verify_office_code(text,uuid),
  public.attendance_record_network_corroboration(text,uuid,uuid,boolean,text)
from public,anon;

grant execute on function public.attendance_set_office_code(boolean,integer),
  public.attendance_verify_office_code(text,uuid)
to authenticated,service_role;

grant execute on function public.attendance_record_network_corroboration(text,uuid,uuid,boolean,text)
to service_role;

comment on function public.attendance_verify_office_code(text,uuid) is
  'Records short-lived front-desk code corroboration for the signed-in user own open office session. Evidence only; no automatic absence, pay or discipline.';
comment on function public.attendance_record_network_corroboration(text,uuid,uuid,boolean,text) is
  'Service-only optional trusted-network corroboration. Browser-provided IP/network claims are not accepted.';
