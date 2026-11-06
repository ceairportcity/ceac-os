begin;
-- Run after notification_completion inside a rollback transaction.
do $test$
declare org uuid:=gen_random_uuid(); team uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); executive uuid:=gen_random_uuid();
 work uuid:=gen_random_uuid(); memo uuid:=gen_random_uuid(); device uuid:=gen_random_uuid(); version uuid:=gen_random_uuid(); count_before integer; notice uuid; fk text; unread_before integer; saved timestamptz; changed timestamptz; rejected boolean:=false;
begin
 insert into public.organisations(id,name,short_code)values(org,'Synthetic notification acceptance','N'||left(org::text,7));
 insert into public.units(id,org_id,name,code)values(team,org,'Synthetic team','NOTIFY');
 -- Only the fixture's inviter FK is deferred to bootstrap an empty staging tenant.
 -- Auth activation still consumes real invitation rows; no Auth trigger is disabled.
 select conname into fk from pg_constraint where conrelid='public.pending_invitations'::regclass and contype='f'
 and pg_get_constraintdef(oid) like 'FOREIGN KEY (invited_by)%';
 execute format('alter table public.pending_invitations alter constraint %I deferrable initially deferred',fk);
 insert into public.pending_invitations(org_id,email,full_name,unit_id,role,invited_by,expires_at)values
 (org,staff||'@example.invalid','Synthetic staff',team,'staff',staff,now()+interval '1 day'),
 (org,manager||'@example.invalid','Synthetic manager',team,'staff',staff,now()+interval '1 day'),
 (org,executive||'@example.invalid','Synthetic executive',team,'staff',staff,now()+interval '1 day');
 insert into auth.users(id,email,email_confirmed_at)values(staff,staff||'@example.invalid',now()),(manager,manager||'@example.invalid',now()),(executive,executive||'@example.invalid',now());

 insert into public.profiles(id,org_id,full_name,email,active,is_exec)values
 (staff,org,'Synthetic staff',staff||'@example.invalid',true,false),(manager,org,'Synthetic manager',manager||'@example.invalid',true,false),(executive,org,'Synthetic executive',executive||'@example.invalid',true,true)
 on conflict(id)do update set org_id=excluded.org_id,active=true,is_exec=excluded.is_exec;
 insert into public.unit_memberships(org_id,unit_id,profile_id,role)values(org,team,staff,'staff'),(org,team,manager,'manager') on conflict(profile_id,unit_id)do update set role=excluded.role;
 insert into public.work_items(id,org_id,unit_id,ref,title,assignee_id,assigned_by,kind,status,origin,visibility)
 values(work,org,team,'NOTIFY-SYNTH','Synthetic work',staff,manager,'task','in_review','assigned','unit');
 if private.ceac_responsible_reviewer_id(work) is distinct from manager then raise exception 'Ordinary reviewer route changed';end if;
 if not public.ceac_push_work_recipient(work,manager,'work_submitted') or public.ceac_push_work_recipient(work,executive,'work_submitted') then raise exception 'Reviewer notice escaped its responsible reviewer';end if;
 update public.unit_memberships set role='manager' where profile_id=staff and unit_memberships.unit_id=team;
 if private.ceac_responsible_reviewer_id(work) is distinct from executive then raise exception 'Manager work did not route to Executive';end if;
 update public.profiles set is_admin=true where id=manager;
 if private.ceac_responsible_reviewer_id(work) is distinct from manager then raise exception 'Assigning Admin route lost';end if;
 insert into public.memos(id,org_id,sender_id,status)values(memo,org,manager,'draft');
 insert into public.memo_versions(id,memo_id,version_no,subject,body)values(version,memo,1,'Synthetic subject','Synthetic body');
 update public.memos set current_version_id=version where id=memo;
 -- LOCAL AUTH SIMULATION BEGIN
 select updated_at into saved from public.memos where id=memo;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated','aal','aal1')::text,true);
 perform set_config('request.jwt.claim.sub',manager::text,true);
 changed:=public.set_memo_preview_privacy(memo,true,saved);
 if changed is null then raise exception 'Preview privacy was not saved';end if;
 begin perform public.set_memo_preview_privacy(memo,false,saved);
 exception when others then rejected:=true;end;
 if not rejected then raise exception 'An outdated draft changed its preview policy';end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 -- LOCAL AUTH SIMULATION END

 insert into public.memo_recipients(memo_id,profile_id,kind)values(memo,staff,'to');
 update public.memos set status='sent' where id=memo;
 if not(select confidential from public.memos where id=memo)then raise exception 'Existing private memo default was weakened';end if;
 if not public.ceac_push_context_visible('memo',memo,staff) or public.ceac_push_context_visible('memo',memo,executive)then raise exception 'Memo participant boundary failed';end if;
 insert into public.ceac_push_subscriptions(id,org_id,profile_id,endpoint,endpoint_hash,p256dh,auth_key)
 values(device,org,staff,'https://fcm.googleapis.com/synthetic-acceptance',repeat('a',64),repeat('b',87),repeat('c',22));
 unread_before:=public.ceac_push_unread_count(staff);
 perform private.ceac_emit_notification(org,staff,'memo',memo,'memo_response',gen_random_uuid());
 perform private.ceac_emit_notification(org,staff,'memo',memo,'memo_response',gen_random_uuid());
 select count(*)into count_before from public.ceac_push_jobs where subscription_id=device and status='pending';
 if count_before<>1 then raise exception 'Memo reply queue was not coalesced: %',count_before;end if;
 if public.ceac_push_unread_count(staff)<>unread_before then raise exception 'Thread unread count is not one';end if;
 delete from public.memo_recipients where memo_id=memo and profile_id=staff;
 if public.ceac_push_context_visible('memo',memo,staff) or public.ceac_push_unread_count(staff)<>unread_before-1 then raise exception 'Revoked access survived dispatch/badge check';end if;
 if has_table_privilege('authenticated','public.ceac_push_subscriptions','select') or has_table_privilege('anon','public.ceac_push_jobs','select')then raise exception 'Device/queue data exposed';end if;
 if has_function_privilege('authenticated','public.ceac_push_context_visible(text,uuid,uuid)','execute') or has_function_privilege('anon','public.ceac_push_test(uuid,uuid)','execute')then raise exception 'Service-only push helpers exposed';end if;
end
$test$;

rollback;
