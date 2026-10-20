\set ON_ERROR_STOP on
begin;
update public.organisations set universal_totp_required=false where id='10000000-0000-4000-8000-000000000010';
-- All fixture changes are rolled back. No real person or provider is contacted.
insert into public.workforce_day_types(id,org_id,name,session_expected,active)
 values('71000000-0000-4000-8000-000000000169','10000000-0000-4000-8000-000000000010','Rollback routine reminder workday',true,true);
insert into public.workforce_schedule_versions(org_id,schedule_key,version,profile_id,effective_from,source,day_map,expected_start,expected_end,reason,created_by)
 values('10000000-0000-4000-8000-000000000010',gen_random_uuid(),1,'31000000-0000-4000-8000-000000000001',current_date,'person',
 jsonb_build_object('mon','71000000-0000-4000-8000-000000000169','tue','71000000-0000-4000-8000-000000000169','wed','71000000-0000-4000-8000-000000000169','thu','71000000-0000-4000-8000-000000000169','fri','71000000-0000-4000-8000-000000000169','sat','71000000-0000-4000-8000-000000000169','sun','71000000-0000-4000-8000-000000000169'),
 '00:00','24:00','Rollback-only working pattern','31000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
do $create$
declare name text;w uuid;
begin
 foreach name in array array['due','off','paused','recorded'] loop
  w:=public.create_typed_work(p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',
   p_title=>'Rollback reminder '||name,p_assignee_id=>auth.uid(),p_expected_outcome=>'Inspect the venue',
   p_details=>jsonb_build_object('origin','self_created','schedule_kind','daily','starts_on',current_date,
    'timezone','Africa/Accra','due_time',to_char(now() at time zone 'Africa/Accra','HH24:MI'),
    'reminder_minutes_before',case when name='off' then null else 15 end));
  perform set_config('ceac.test.reminder_'||name,w::text,true);
  if name='paused' then perform public.set_routine_paused(w,true,'Do not send paused reminders'); end if;
  if name='recorded' then perform public.record_routine_occurrence(w,current_date,null,'Actual recorded inspection'); end if;
 end loop;
 begin
  perform private.deliver_routine_reminders();raise exception 'Staff invoked privileged worker';
 exception when insufficient_privilege then null;end;
 begin
  perform public.app_heartbeat();raise exception 'Staff invoked controlled heartbeat';
 exception when insufficient_privilege then null;end;
 begin
  perform public.create_typed_work(p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',p_title=>'Invalid reminder',
   p_assignee_id=>auth.uid(),p_expected_outcome=>'Inspect',p_details=>jsonb_build_object('origin','self_created','schedule_kind','daily','starts_on',current_date,'reminder_minutes_before',1441));
  raise exception 'Invalid reminder accepted';
 exception when check_violation then null;end;
end;
$create$;
reset role;
-- Fresh sweep, deterministic fixtures regardless of other synthetic prior tests.
update private.routine_reminder_sweep set last_operation_id=null;
select public.app_heartbeat();
select public.app_heartbeat();
select public.app_heartbeat();
do $worker$
begin
 if (select count(*) from public.routine_reminder_deliveries where work_item_id=current_setting('ceac.test.reminder_due')::uuid)<>1 then
  raise exception 'Actual due reminder missing or duplicated';end if;
 if exists(select 1 from public.routine_reminder_deliveries where work_item_id=any(array[
  current_setting('ceac.test.reminder_off')::uuid,current_setting('ceac.test.reminder_paused')::uuid,current_setting('ceac.test.reminder_recorded')::uuid])) then
  raise exception 'Disabled, paused or recorded routine produced a reminder';end if;
 if not exists(select 1 from public.job_runs where job_name='heartbeat' and status='ok' and detail ? 'routine_reminders') then
  raise exception 'Delivery not present in existing job audit';end if;
end;
$worker$;
set local role authenticated;
do $recipient$
begin
 if (select count(*) from public.routine_reminder_deliveries where work_item_id=current_setting('ceac.test.reminder_due')::uuid)<>1
  or (select count(*) from public.my_work_attention_queue() where action_kind='routine_due' and work_item_id=current_setting('ceac.test.reminder_due')::uuid)<>1 then
  raise exception 'Recipient cannot see actual delivery in existing action queue';end if;
 begin
  insert into public.routine_reminder_deliveries(org_id,operation_id,work_item_id,for_profile_id,scheduled_on,due_at)
  select org_id,operation_id,work_item_id,for_profile_id,scheduled_on+1,due_at from public.routine_reminder_deliveries limit 1;
  raise exception 'Staff forged reminder';
 exception when insufficient_privilege then null;end;
end;
$recipient$;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000006',true);
do $colleague$
begin
 if exists(select 1 from public.routine_reminder_deliveries where work_item_id=current_setting('ceac.test.reminder_due')::uuid)
  or exists(select 1 from public.my_work_attention_queue() where action_kind='routine_due' and work_item_id=current_setting('ceac.test.reminder_due')::uuid) then
  raise exception 'Colleague read recipient delivery';end if;
end;
$colleague$;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);
do $foreign$
begin
 if exists(select 1 from private.routine_schedule_dates(array[current_setting('ceac.test.reminder_due')::uuid],current_date,current_date,'10000000-0000-4000-8000-000000000010')) then
  raise exception 'Private helper bypassed source RLS';end if;
 begin
  perform private.routine_schedule_dates(array[current_setting('ceac.test.reminder_due')::uuid],current_date,current_date,'10000000-0000-4000-8000-000000000999');
  raise exception 'Private helper accepted foreign organisation';
 exception when insufficient_privilege then null;end;
end;
$foreign$;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
select public.record_routine_occurrence(current_setting('ceac.test.reminder_due')::uuid,current_date,null,'Actual inspection clears action only');
do $resolved$
begin
 if exists(select 1 from public.my_work_attention_queue() where action_kind='routine_due' and work_item_id=current_setting('ceac.test.reminder_due')::uuid) then
  raise exception 'Recorded proof did not clear action';end if;
 if (select count(*) from public.routine_reminder_deliveries where work_item_id=current_setting('ceac.test.reminder_due')::uuid)<>1 then
  raise exception 'Recording removed durable delivery evidence';end if;
end;
$resolved$;
reset role;
-- Non-working days and hours must suppress new delivery without guessing days.
update public.workforce_day_types set session_expected=false where id='71000000-0000-4000-8000-000000000169';
set local role authenticated;
select public.set_routine_paused(current_setting('ceac.test.reminder_paused')::uuid,false,'Resume for non-working day probe');
reset role;
update private.routine_reminder_sweep set last_operation_id=null;
select public.app_heartbeat();
do $quiet$
begin
 if exists(select 1 from public.routine_reminder_deliveries where work_item_id=current_setting('ceac.test.reminder_paused')::uuid) then
  raise exception 'Reminder ignored non-working day';end if;
end;
$quiet$;
-- Explicit day-specific blanks must not inherit broad legacy default hours.
update public.workforce_day_types set session_expected=true where id='71000000-0000-4000-8000-000000000169';
update public.workforce_schedule_versions
 set clock_map=jsonb_build_object(lower(to_char(current_date,'Dy')),jsonb_build_object('start',null,'end',null))
 where profile_id='31000000-0000-4000-8000-000000000001' and reason='Rollback-only working pattern';
update private.routine_reminder_sweep set last_operation_id=null;
select public.app_heartbeat();
do $blank_override$
begin
 if exists(select 1 from public.routine_reminder_deliveries where work_item_id=current_setting('ceac.test.reminder_paused')::uuid) then
  raise exception 'Explicit blank daily hours inherited legacy general hours';end if;
end;
$blank_override$;
-- A valid but currently closed explicit window must also suppress delivery.
update public.workforce_schedule_versions
 set clock_map=jsonb_build_object(lower(to_char(current_date,'Dy')),
  case when (now() at time zone 'Africa/Accra')::time>=time '12:00'
   then jsonb_build_object('start','00:00','end','12:00')
   else jsonb_build_object('start','12:00','end','24:00') end)
 where profile_id='31000000-0000-4000-8000-000000000001' and reason='Rollback-only working pattern';
update private.routine_reminder_sweep set last_operation_id=null;
select public.app_heartbeat();
do $closed_hours$
begin
 if exists(select 1 from public.routine_reminder_deliveries where work_item_id=current_setting('ceac.test.reminder_paused')::uuid) then
  raise exception 'Reminder ignored explicit closed daily hours';end if;
end;
$closed_hours$;
-- Without a day override, legitimate recorded general hours still work.
update public.workforce_schedule_versions set clock_map='{}'::jsonb
 where profile_id='31000000-0000-4000-8000-000000000001' and reason='Rollback-only working pattern';
update private.routine_reminder_sweep set last_operation_id=null;
select public.app_heartbeat();
do $general_hours$
begin
 if (select count(*) from public.routine_reminder_deliveries where work_item_id=current_setting('ceac.test.reminder_paused')::uuid)<>1 then
  raise exception 'Valid general hours no longer deliver reminders';end if;
end;
$general_hours$;
update public.organisations set universal_totp_required=true where id='10000000-0000-4000-8000-000000000010';
set local role authenticated;
do $assurance$
begin
 begin
  perform private.routine_schedule_dates(array[current_setting('ceac.test.reminder_due')::uuid],current_date,current_date,'10000000-0000-4000-8000-000000000010');
  raise exception 'Helper bypassed future assurance';
 exception when insufficient_privilege then null;end;
 if exists(select 1 from public.routine_reminder_deliveries where work_item_id=current_setting('ceac.test.reminder_due')::uuid) then
  raise exception 'Delivery bypassed future assurance';end if;
end;
$assurance$;
reset role;
rollback;
select 'Routine reminder delivery gate passed' as result;
