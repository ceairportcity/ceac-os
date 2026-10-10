-- Phase 6C forward-only service role guard repair.
-- SECURITY DEFINER changes current_user to the function owner; checking it
-- against service_role incorrectly denied every legitimate trusted caller.
-- Use the validated JWT role and preserve service-only EXECUTE privileges.
-- Do not modify earlier migrations or production history.

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
  if auth.role() is distinct from 'service_role' then
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

revoke all on function public.attendance_record_network_corroboration(text,uuid,uuid,boolean,text)
  from public,anon,authenticated;
grant execute on function public.attendance_record_network_corroboration(text,uuid,uuid,boolean,text)
  to service_role;

comment on function public.attendance_record_network_corroboration(text,uuid,uuid,boolean,text) is
  'Service-only JWT role guard. Append-only corroboration, never automatic payroll or absence.';
