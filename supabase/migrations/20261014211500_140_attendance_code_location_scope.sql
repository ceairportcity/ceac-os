-- Forward-only next-bundle correction: front-desk codes must belong to the
-- actual selected, authorised office or programme location of a work session.
-- The 123/124 migrations are still pending on the original 119-migration DB.
-- Never accept any valid code from a different venue in the same organisation.
-- Existing successful verification is merely corroboration, not GPS proof or
-- an automatic absence, payroll or disciplinary decision.

alter table public.attendance_verification_codes
  add column if not exists office_location_id uuid references public.office_locations(id) on delete restrict;

do $guard$
begin
  if exists(select 1 from public.attendance_verification_codes where office_location_id is null) then
    raise exception 'Unscoped attendance code windows require explicit reconciliation before enabling location codes.';
  end if;
end
$guard$;

alter table public.attendance_verification_codes
  alter column office_location_id set not null;

create index if not exists attendance_code_location_active_idx
  on public.attendance_verification_codes(org_id,office_location_id,valid_until desc)
  where revoked_at is null;

-- The existing 2-argument API remains a primary-location compatibility path.
-- All new authorised programme/location issuance uses the 3-argument API.

create or replace function public.attendance_set_office_code(
  p_enabled boolean,
  p_ttl_minutes integer,
  p_office_location_id uuid
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
  v_location_id uuid;
begin
  if v_actor is null or v_org is null
     or not public.app_has_capability('workforce.manage',null) then
    raise exception 'Workforce Administration authority is required.' using errcode='42501';
  end if;
  if p_ttl_minutes is null or p_ttl_minutes not between 5 and 30 then
    raise exception 'Verification-code lifetime must be between 5 and 30 minutes.';
  end if;

  if coalesce(p_enabled,false) then
    select id into v_location_id
    from public.office_locations
    where org_id=v_org
      and id=p_office_location_id;
    if v_location_id is null then
      raise exception 'Choose an authorised duty location in this organisation.' using errcode='42501';
    end if;
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
    where org_id=v_org and revoked_at is null and valid_until>now()
      and (not coalesce(p_enabled,false) or office_location_id=v_location_id);

  if coalesce(p_enabled,false) then
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    v_until:=now()+make_interval(mins=>p_ttl_minutes);
    insert into public.attendance_verification_codes(
      org_id,office_location_id,code_value,valid_from,valid_until,issued_by
    ) values(v_org,v_location_id,v_code,now(),v_until,v_actor);
  end if;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'attendance_integrity_code_configured','organisation',v_org,
    jsonb_build_object('enabled',coalesce(p_enabled,false),'ttl_minutes',p_ttl_minutes,'office_location_id',v_location_id));

  return jsonb_build_object(
    'enabled',coalesce(p_enabled,false),'code',v_code,'valid_until',v_until,
    'office_location_id',v_location_id,
    'effect_note','Front-desk verification is corroborating evidence only.'
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
  v_primary uuid;
begin
  if coalesce(p_enabled,false) then
    select id into v_primary from public.office_locations
    where org_id=v_org and is_primary
    order by set_at desc limit 1;
    if v_primary is null then raise exception 'No primary authorised office location has been configured.'; end if;
  end if;
  return public.attendance_set_office_code(p_enabled,p_ttl_minutes,v_primary);
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

  if v_session.office_location_id is null or not exists (
    select 1 from public.office_locations o
    where o.id=v_session.office_location_id and o.org_id=v_org
  ) then
    return jsonb_build_object(
      'verified',false,
      'received_at',v_received,
      'message','This work session has no approved duty location. End it and start at the correct registered office or programme location.'
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
    and office_location_id=v_session.office_location_id
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
      'session_place',v_session.place,
      'office_location_id',v_session.office_location_id
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

-- Explicit permissions: no PUBLIC/anonymous execute on definer RPCs.
revoke all on function public.attendance_set_office_code(boolean,integer,uuid) from public,anon;
grant execute on function public.attendance_set_office_code(boolean,integer,uuid) to authenticated,service_role;
revoke all on function public.attendance_set_office_code(boolean,integer) from public,anon;
grant execute on function public.attendance_set_office_code(boolean,integer) to authenticated,service_role;
revoke all on function public.attendance_verify_office_code(text,uuid) from public,anon;
grant execute on function public.attendance_verify_office_code(text,uuid) to authenticated,service_role;
