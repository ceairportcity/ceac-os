\set ON_ERROR_STOP on
begin;
-- These fixtures and every mutation are isolated and rolled back.
do $$ declare signature text; begin
 foreach signature in array array[
 'public.workforce_record_pattern(uuid,uuid,date,date,jsonb,jsonb,text,uuid)',
 'public.attendance_create_notice(text,timestamptz,timestamptz,text,text)',
 'public.attendance_respond_notice(uuid,text,text)',
 'public.attendance_record_return(uuid)',
 'public.record_work_checkpoint(uuid,text,double precision,double precision,double precision,timestamptz,timestamptz,text)',
 'public.attendance_day_evidence(date)'] loop
  if to_regprocedure(signature) is null or has_function_privilege('anon',signature,'EXECUTE') or not has_function_privilege('authenticated',signature,'EXECUTE') then raise exception 'Unreviewed Phase 2 RPC grant: %',signature; end if;
  if pg_get_functiondef(to_regprocedure(signature)) not ilike '%auth.uid()%' or pg_get_functiondef(to_regprocedure(signature)) not ilike '%app_org_id()%' then raise exception 'Missing actor/tenant binding: %',signature; end if;
 end loop;
 if has_table_privilege('authenticated','public.attendance_notices','INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.attendance_returns','INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.work_session_checkpoints','INSERT,UPDATE,DELETE') then raise exception 'Direct attendance evidence mutations opened'; end if;
end $$;
create temporary table phase2_ids(name text primary key,id uuid);
grant all on phase2_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
do $$ declare day_id uuid; pattern_id uuid; next_id uuid; k text:=lower(to_char(current_date,'Dy')); begin
 day_id:=public.workforce_record_day_type(null,'Isolated phase2 workday',null,true,true,true);
 pattern_id:=public.workforce_record_pattern('31000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000011',current_date,null,jsonb_build_object(k,day_id),jsonb_build_object(k,jsonb_build_object('start','00:00','end',(least(localtimestamp+interval '30 minutes',(current_date+1)::timestamp-interval '1 microsecond')::time)::text)),'Isolated per-day pattern',null);
 insert into phase2_ids values('pattern',pattern_id);
 next_id:=public.workforce_record_pattern('31000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000011',current_date+1,null,jsonb_build_object(k,day_id),jsonb_build_object(k,jsonb_build_object('start','12:00','end','17:00')),'Future pattern version',pattern_id);
 if (select clock_map->k->>'start' from public.workforce_schedule_versions where id=pattern_id)<>'00:00' then raise exception 'Original pattern rewritten'; end if;
 begin
  perform public.workforce_record_pattern('31000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000011',current_date+2,null,jsonb_build_object(k,day_id),'{}','Conflicting stale revision',pattern_id);
  raise exception 'Stale pattern revision accepted';
 exception when others then if sqlerrm not like 'The pattern has changed%' then raise; end if; end;
 if not exists(select 1 from jsonb_array_elements(public.attendance_day_evidence(current_date)) r where r->>'profile_id'='31000000-0000-4000-8000-000000000001' and r->>'schedule_id'=pattern_id::text) then raise exception 'Future version displaced current pattern'; end if;
end $$;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
do $$ declare n uuid; med uuid; s public.work_sessions; c uuid; c2 uuid; body jsonb; begin
 n:=public.attendance_create_notice('temporary_permission',now()-interval '15 minutes',now()+interval '30 minutes','Private operational fixture reason','Private notice context');
 med:=public.attendance_create_notice('medical_absence',now(),null,null,null);
 insert into phase2_ids values('notice',n),('medical',med);
 if not exists(select 1 from public.attendance_notices where work_item_id=n and profile_id=auth.uid() and created_by=auth.uid()) then raise exception 'Notice attribution missing'; end if;
 begin perform public.attendance_create_notice('medical_absence',now(),null,'Secret diagnosis',null); raise exception 'Medical narrative accepted'; exception when others then if sqlerrm not like 'Medical notices contain dates%' then raise; end if; end;
 begin perform public.attendance_respond_notice(n,'fulfilled','Self approval'); raise exception 'Self approval accepted'; exception when insufficient_privilege then null; end;
 begin perform public.respond_work_request(n,'fulfilled','Item screen bypass'); raise exception 'Generic Request self approval accepted'; exception when others then if sqlerrm not like 'You are not responsible%' and sqlerrm not like 'Managed-unit%' then raise; end if; end;
 perform public.attendance_record_return(n);
 if not exists(select 1 from public.attendance_returns where work_item_id=n and evidence_type='self_report' and actor_id=auth.uid()) then raise exception 'Attributable self return missing'; end if;
 insert into public.work_sessions(org_id,profile_id,place) values(public.app_org_id(),auth.uid(),'elsewhere') returning * into s;
 insert into phase2_ids values('session',s.id);
 c:=public.record_work_checkpoint(s.id,'periodic',null,null,null,null,now(),'Permission denied');
 c2:=public.record_work_checkpoint(s.id,'periodic',0,0,12,now(),now(),null);
 if c<>c2 or not exists(select 1 from public.work_session_checkpoints where id=c and lat is null and geofence='not_verified' and failure='Permission denied') then raise exception 'Failed evidence was rewritten or duplicate hourly event created'; end if;
 c:=public.record_work_checkpoint(s.id,'pre_close',0,0,12,now(),now(),null);
 if not exists(select 1 from public.work_session_checkpoints where id=c and lat=0 and lng=0 and schedule_version_id=(select id from phase2_ids where name='pattern') and expected_close_at is not null) then raise exception 'Pattern-derived preclose/zero coordinate evidence missing'; end if;
 body:=public.attendance_day_evidence(current_date);
 if jsonb_array_length(body)<>1 then raise exception 'Staff saw other employee evidence'; end if;
 if body::text not like '%Private operational fixture reason%' then raise exception 'Self notice context disappeared'; end if;
 s:=public.end_work_session_with_location(s.id,null,null,null,null,now(),'Unavailable endpoint');
 begin perform public.record_work_checkpoint(s.id,'periodic',0,0,12,now(),now(),null); raise exception 'Closed session accepted checkpoint'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
select public.attendance_respond_notice((select id from phase2_ids where name='notice'),'fulfilled','Approved operational fixture');
select public.attendance_respond_notice((select id from phase2_ids where name='medical'),'fulfilled','Operational response recorded');
do $$ begin
 if exists(select 1 from public.attendance_notices where profile_id='31000000-0000-4000-8000-000000000005') then raise exception 'Manager saw another unit'; end if;
 if not exists(select 1 from jsonb_array_elements(public.attendance_day_evidence(current_date)) r cross join lateral jsonb_array_elements(r->'notices') n where n->>'id'=(select id::text from phase2_ids where name='notice') and n->>'request_state'='fulfilled' and n->>'responded_by'=auth.uid()::text) then raise exception 'Recorded response/history missing'; end if;
end $$;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000007',true);
do $$ begin
 if exists(select 1 from public.attendance_notices where work_item_id=(select id from phase2_ids where name='notice')) then raise exception 'Other unit manager saw private notice'; end if;
 begin perform public.attendance_respond_notice((select id from phase2_ids where name='notice'),'declined','Outside scope'); raise exception 'Other manager changed notice'; exception when insufficient_privilege then null; end;
 begin perform public.record_work_checkpoint((select id from phase2_ids where name='session'),'periodic',0,0,12,now(),now(),null); raise exception 'Other person wrote checkpoint'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.capability_grants(org_id,profile_id,capability,grant_reason) values('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000005','compliance.manage','Isolated Compliance fixture');
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);
do $$ declare body jsonb; begin
 body:=public.attendance_day_evidence(current_date);
 if body::text like '%Private operational fixture reason%' or body::text like '%Private notice context%' or body::text like '%Approved operational fixture%' then raise exception 'Compliance received private narratives'; end if;
 if not exists(select 1 from jsonb_array_elements(body) r cross join lateral jsonb_array_elements(r->'notices') n where n->>'id'=(select id::text from phase2_ids where name='medical') and n->>'kind'='medical_absence') then raise exception 'Compliance lost sanitised operational medical state'; end if;
 if exists(select 1 from public.attendance_notices where work_item_id=(select id from phase2_ids where name='notice')) then raise exception 'Compliance raw notice access opened'; end if;
 begin perform public.attendance_respond_notice((select id from phase2_ids where name='notice'),'fulfilled','Compliance bypass'); raise exception 'Compliance decided without workforce authority'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.platform_audit_events where resource_type='attendance_notice' and action='attendance_notice.response' and context->>'prior_state'='waiting' and subject_profile_id='31000000-0000-4000-8000-000000000001') then raise exception 'Prior-state response audit missing'; end if;
 begin update public.work_session_checkpoints set failure='Rewrite' where work_session_id=(select id from phase2_ids where name='session'); raise exception 'Checkpoint history rewritten'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Attendance Phase 2 authority/privacy/evidence gate passed' as result;
