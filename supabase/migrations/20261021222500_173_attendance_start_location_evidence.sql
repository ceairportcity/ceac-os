-- Existing CEAC attendance-day evidence: add first-start GPS without replacing tenant scope.
-- Only Admin / workforce.manage / organisation Compliance sees new precise start data.
-- This preserves each existing sanitised policy/leave/notice field and never creates location tracking.
CREATE OR REPLACE FUNCTION public.attendance_day_evidence(p_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'started_at',s.started_at,'ended_at',s.ended_at,'start_geofence',s.start_geofence,'location_captured_at',s.location_captured_at,'start_lat',case when public.app_is_admin() or public.app_has_capability('workforce.manage',null) or public.app_has_capability('compliance.manage',null) then s.lat else null end,'start_lng',case when public.app_is_admin() or public.app_has_capability('workforce.manage',null) or public.app_has_capability('compliance.manage',null) then s.lng else null end,'start_location_accuracy_m',case when public.app_is_admin() or public.app_has_capability('workforce.manage',null) or public.app_has_capability('compliance.manage',null) then s.location_accuracy_m else null end,'end_location_status',s.end_location_status) order by s.started_at) from public.work_sessions s where s.profile_id=e.profile_id and s.org_id=v_org and (s.started_at at time zone 'Africa/Accra')::date=p_date),'[]'::jsonb),
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
$function$

COMMENT ON FUNCTION public.attendance_day_evidence(date) IS
 'Existing sanitised day evidence with separately restricted historical start-GPS data; not live tracking.';
