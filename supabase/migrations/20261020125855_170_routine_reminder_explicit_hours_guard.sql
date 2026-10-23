-- 170: an explicitly recorded day override is authoritative, including blanks.
-- Forward correction: retain169 and preserve existing receipt/history/ACLs.
-- A blank day-specific start/end suppresses delivery. General hours apply only
-- when no day override exists; no attendance or HR configuration is changed.
create or replace function private.deliver_routine_reminders()
returns integer language plpgsql security definer set search_path='' as $worker$
declare v_ids uuid[];v_last uuid;v_group record;v_count integer:=0;v_added integer;v_day date:=(now() at time zone 'Africa/Accra')::date;
 v_clock time:=(now() at time zone 'Africa/Accra')::time;v_key text:=(array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from now() at time zone 'Africa/Accra')::integer+1];
begin
 if not pg_catalog.pg_try_advisory_xact_lock(1682026,169) then return 0; end if;
 select last_operation_id into v_last from private.routine_reminder_sweep where singleton for update;
 select array_agg(batch.id order by batch.id) into v_ids from (
  select r.id from public.recurring_operations r
  where (v_last is null or r.id>v_last)
   and exists(select 1 from public.routine_schedule_versions v where v.operation_id=r.id and v.reminder_minutes_before is not null)
  order by r.id limit 200
 ) batch;
 if coalesce(cardinality(v_ids),0)=0 then
  update private.routine_reminder_sweep set last_operation_id=null where singleton;
  return 0;
 end if;
 for v_group in
  select r.org_id,array_agg(r.work_item_id order by r.id) work_ids
  from public.recurring_operations r where r.id=any(v_ids) group by r.org_id
 loop
  insert into public.routine_reminder_deliveries(org_id,operation_id,work_item_id,for_profile_id,scheduled_on,due_at)
  select r.org_id,r.id,w.id,w.assignee_id,d.scheduled_on,d.due_at
  from private.routine_schedule_dates(v_group.work_ids,v_day-2,v_day+2,v_group.org_id) d
  join public.recurring_operations r on r.id=d.operation_id and r.org_id=v_group.org_id
  join public.routine_schedule_versions v on v.operation_id=r.id and v.version=d.schedule_version
  join public.work_items w on w.id=r.work_item_id and w.org_id=r.org_id
  join public.profiles p on p.id=w.assignee_id and p.org_id=w.org_id and p.active
  join public.units u on u.id=w.unit_id and u.org_id=w.org_id and u.active
  -- Follow recorded effective workforce days/hours; never infer a person's
  -- attendance, hard-code Sundays/church days or invent a missing pattern.
  join lateral(
   select s.* from public.workforce_schedule_versions s
   where s.org_id=w.org_id and s.profile_id=w.assignee_id
    and (s.unit_id is null or s.unit_id=w.unit_id)
    and s.effective_from<=v_day and (s.effective_to is null or s.effective_to>=v_day)
    and not exists(select 1 from public.workforce_schedule_versions n
     where n.supersedes_id=s.id and n.effective_from<=v_day and (n.effective_to is null or n.effective_to>=v_day))
   order by s.created_at desc,s.id desc limit 1
  ) pattern on true
  join public.workforce_day_types dt on dt.id=nullif(pattern.day_map->>v_key,'')::uuid and dt.org_id=w.org_id and dt.active
  where d.state<>'recorded' and v.reminder_minutes_before is not null
   and d.due_at-make_interval(mins=>v.reminder_minutes_before)<=now()
   and d.due_at>=now()-interval '24 hours'
   and w.visibility<>'private' and w.status not in ('completed','cancelled','self_certified')
   and exists(select 1 from public.unit_memberships m where m.org_id=w.org_id and m.unit_id=w.unit_id and m.profile_id=w.assignee_id)
   and dt.session_expected
   and v_clock>=(case when pattern.clock_map ? v_key then nullif(pattern.clock_map->v_key->>'start','')::time else pattern.expected_start end)
   and v_clock<(case when pattern.clock_map ? v_key then nullif(pattern.clock_map->v_key->>'end','')::time else pattern.expected_end end)
   and not exists(select 1 from public.leave_requests l where l.org_id=w.org_id and l.profile_id=w.assignee_id
    and l.status='approved' and v_day between l.start_date and l.end_date)
  on conflict(operation_id,scheduled_on,for_profile_id) do nothing;
  get diagnostics v_added=row_count;v_count:=v_count+v_added;
 end loop;
 update private.routine_reminder_sweep set last_operation_id=v_ids[cardinality(v_ids)] where singleton;
 return v_count;
end;
$worker$;
revoke all on function private.deliver_routine_reminders() from public,anon,authenticated,service_role;
