\set ON_ERROR_STOP on
begin;
do $reviewed_surface$
declare signature text; definition text;
begin
 foreach signature in array array[
  'public.admin_record_unit_responsibility(uuid,uuid,text,text,text)',
  'public.admin_set_work_lane_membership(uuid,uuid,boolean,text)',
  'public.admin_revoke_staff_invitation(uuid,text)',
  'public.admin_access_invitations()',
  'public.prepare_staff_invitation_resend(uuid)',
  'public.end_work_session_with_location(uuid,double precision,double precision,double precision,timestamptz,timestamptz,text)',
  'public.continue_work_session_with_location(uuid,double precision,double precision,double precision,timestamptz)'
 ] loop
  if to_regprocedure(signature) is null or not has_function_privilege('authenticated',signature,'EXECUTE') or has_function_privilege('anon',signature,'EXECUTE') then raise exception 'Unreviewed foundation execution grants: %',signature; end if;
  definition:=pg_get_functiondef(to_regprocedure(signature));
  if definition not ilike '%auth.uid()%' or definition not ilike '%app_org_id()%' then raise exception 'Foundation RPC lacks actor and organisation binding: %',signature; end if;
 end loop;
end $reviewed_surface$;
-- All mutations below are isolated and rolled back.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
do $$ begin
  begin
    perform public.admin_access_invitations();
    raise exception 'Manager gained organisation invitation authority';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_pending_invitation('foundation-outside@ceac.local.test','Outside','20000000-0000-4000-8000-000000000012','staff');
    raise exception 'Manager invited outside managed unit';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_pending_invitation('foundation-role@ceac.local.test','Role','20000000-0000-4000-8000-000000000011','manager');
    raise exception 'Manager granted authority through invite';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.units(id,org_id,name,code,active) values('20000000-0000-4000-8000-000000000111','10000000-0000-4000-8000-000000000010','Foundation secondary unit','FND111',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
select public.admin_record_unit_responsibility('31000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000111','manager','add','Isolated second responsibility test');
do $$ begin
  if (select count(*) from public.unit_memberships where profile_id='31000000-0000-4000-8000-000000000002' and role='manager')<>2 then raise exception 'Adding responsibility replaced existing headship'; end if;
  begin
    perform public.admin_record_unit_responsibility('31000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000011','manager','remove','Primary removal test');
    raise exception 'Primary membership removal unexpectedly succeeded';
  exception when others then if sqlerrm not like 'Transfer the primary unit%' then raise; end if; end;
end $$;
select public.admin_record_unit_responsibility('31000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000111','manager','remove','End isolated responsibility');
reset role;
-- Inactivity revokes authority even with the old authenticated identity.
update public.profiles set active=false where id='31000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
do $$ begin
 if public.app_org_id() is not null or exists(select public.app_managed_units()) then raise exception 'Inactive identity retained authority'; end if;
end $$;
reset role;
update public.profiles set active=true where id='31000000-0000-4000-8000-000000000002';
-- Staff cannot start an office session with missing or stale evidence.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
do $$ declare s public.work_sessions; begin
 begin
  insert into public.work_sessions(org_id,profile_id,place) values(public.app_org_id(),auth.uid(),'office');
  raise exception 'Missing office location accepted';
 exception when others then if sqlerrm not like 'Allow location access%' then raise; end if; end;
 begin
  insert into public.work_sessions(org_id,profile_id,place,lat,lng,location_captured_at,device_time) values(public.app_org_id(),auth.uid(),'office',5.6037,-0.187,now()-interval '5 minutes',now());
  raise exception 'Stale office location accepted';
 exception when others then if sqlerrm not like 'A fresh location is required%' then raise; end if; end;
 insert into public.work_sessions(org_id,profile_id,place,lat,lng,location_captured_at,device_time) values(public.app_org_id(),auth.uid(),'office',5.6037,-0.187,now(),now()) returning * into s;
 if s.start_geofence<>'inside' or s.office_location_id is null then raise exception 'Fresh office evidence missing'; end if;
 s:=public.end_work_session_with_location(s.id,null,null,null,null,now(),'Permission denied');
 if s.ended_at is null or s.end_location_status<>'not_verified' or s.end_lat is not null then raise exception 'Unavailable GPS prevented honest end'; end if;
 insert into public.work_sessions(org_id,profile_id,place,lat,lng,location_captured_at,device_time) values(public.app_org_id(),auth.uid(),'office',5.6037,-0.187,now(),now()) returning * into s;
 s:=public.end_work_session_with_location(s.id,0,0,12,now(),now(),null);
 if s.end_location_status<>'recorded' or s.end_lat<>0 or s.end_lng<>0 then raise exception 'Valid zero endpoint was lost'; end if;
end $$;
rollback;
select 'Onboarding access and presence foundation gate passed' as result;
