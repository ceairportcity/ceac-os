begin;
-- Synthetic, rollback-only integration. No account/email/password or data survives.
do $test$
declare org uuid:=gen_random_uuid(); other_org uuid:=gen_random_uuid(); team uuid:=gen_random_uuid(); other_team uuid:=gen_random_uuid();
 staff uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); admin uuid:=gen_random_uuid(); executive uuid:=gen_random_uuid(); second_exec uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 work uuid:=gen_random_uuid(); manager_work uuid:=gen_random_uuid(); admin_work uuid:=gen_random_uuid(); secret uuid:=gen_random_uuid(); confidential_work uuid:=gen_random_uuid(); foreign_work uuid:=gen_random_uuid(); routine uuid;
 message uuid:=gen_random_uuid(); milestone uuid:=gen_random_uuid(); answer uuid:=gen_random_uuid(); attention uuid:=gen_random_uuid(); result uuid; context jsonb; fk text; u record; before_status text;
begin
 insert into public.organisations(id,name,short_code) values(org,'Synthetic oversight acceptance','O'||left(org::text,7)),(other_org,'Synthetic other tenant','O'||left(other_org::text,7));
 insert into public.units(id,org_id,name,code) values(team,org,'Oversight test team','OVERSIGHT'),(other_team,other_org,'Other tenant team','OTHER');
 select conname into fk from pg_constraint where conrelid='public.pending_invitations'::regclass and contype='f' and pg_get_constraintdef(oid) like 'FOREIGN KEY (invited_by)%';
 execute format('alter table public.pending_invitations alter constraint %I deferrable initially deferred',fk);
 for u in select * from (values(staff,'Synthetic staff',org,team,false,false),(manager,'Synthetic manager',org,team,false,false),(admin,'Synthetic Admin',org,team,true,false),(executive,'Synthetic executive',org,team,false,true),(second_exec,'Synthetic named executive',org,team,false,true),(outsider,'Other tenant person',other_org,other_team,false,false)) v(id,name,org_id,unit_id,is_admin,is_exec) loop
 insert into public.pending_invitations(org_id,email,full_name,unit_id,role,invited_by,expires_at)
 values(u.org_id,u.id||'@example.invalid',u.name,u.unit_id,'staff',u.id,now()+interval '1 day');
 insert into auth.users(id,email,email_confirmed_at) values(u.id,u.id||'@example.invalid',now());
 insert into public.profiles(id,org_id,full_name,email,active,is_admin,is_exec) values(u.id,u.org_id,u.name,u.id||'@example.invalid',true,u.is_admin,u.is_exec)
 on conflict(id) do update set active=true,is_admin=excluded.is_admin,is_exec=excluded.is_exec;
 end loop;
 insert into public.unit_memberships(org_id,unit_id,profile_id,role) values(org,team,manager,'manager') on conflict(profile_id,unit_id) do update set role=excluded.role;
 insert into public.work_items(id,org_id,unit_id,ref,title,assignee_id,assigned_by,kind,status,origin,visibility,confidential) values
 (work,org,team,'OW-STAFF','Shared staff work',staff,manager,'task','in_progress','assigned','unit',false),
 (manager_work,org,team,'OW-MGR','Manager work',manager,manager,'task','in_progress','self_created','unit',false),
 (admin_work,org,team,'OW-ADMIN','Admin assigned manager work',manager,admin,'task','in_progress','assigned','unit',false),
 (secret,org,team,'OW-PRIVATE','Private work',staff,staff,'task','in_progress','self_created','private',false),
 (confidential_work,org,team,'OW-CONF','Confidential work',staff,manager,'task','in_progress','assigned','unit',true),
 (foreign_work,other_org,other_team,'OW-OTHER','Other tenant work',outsider,outsider,'task','in_progress','self_created','unit',false);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','aal','aal1')::text,true);perform set_config('request.jwt.claim.sub',staff::text,true);
 execute 'set local role authenticated';
 context:=public.work_oversight_context(work);
 if context->>'reviewer_id'<>manager::text then raise exception 'Wrong staff reviewer';end if;
 begin perform public.set_work_supervisor(manager_work,second_exec,'Unauthorised');raise exception 'Staff changed supervision';exception when insufficient_privilege then null;end;
 begin perform public.work_oversight_context(secret);raise exception 'Private work exposed';exception when insufficient_privilege then null;end;
 begin perform public.work_oversight_context(confidential_work);raise exception 'Confidential work exposed';exception when insufficient_privilege then null;end;
 begin perform public.work_oversight_context(foreign_work);raise exception 'Other tenant work exposed';exception when insufficient_privilege then null;end;
 begin perform 1 from private.work_oversight_entries;raise exception 'Direct private history exposed';exception when insufficient_privilege then null;end;
 result:=public.add_work_oversight_entry(work,'update','First shared progress',message);
 if result<>message or public.add_work_oversight_entry(work,'update','First shared progress',message)<>message then raise exception 'Retry is not idempotent';end if;
 begin perform public.add_work_oversight_entry(work,'update','Changed payload',message);raise exception 'Changed retry accepted';exception when invalid_parameter_value then null;end;
 perform public.add_work_oversight_entry(work,'milestone','First milestone ready',milestone);
 begin perform public.add_work_oversight_entry(work,'accepted','Self approval',gen_random_uuid(),milestone);raise exception 'Self approval allowed';exception when insufficient_privilege then null;end;
 begin perform public.add_work_oversight_entry(work,'milestone','Duplicate request',gen_random_uuid());raise exception 'Duplicate request allowed';exception when invalid_parameter_value then null;end;
 if (public.work_oversight_queue()->'rows')::text like '%'||foreign_work::text||'%' then raise exception 'Queue crossed tenant';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',admin::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 perform public.set_work_supervisor(manager_work,second_exec,'Named executive reporting line');
 if public.app_responsible_reviewer_id(manager_work)<>second_exec then raise exception 'Named reviewer not used';end if;
 if public.app_responsible_reviewer_id(admin_work)<>admin then raise exception 'Assigning Admin exception lost';end if;
 begin perform public.set_work_supervisor(manager_work,manager,'Self route');raise exception 'Self-supervisor allowed';exception when insufficient_privilege then null;end;
 begin perform public.set_work_supervisor(manager_work,outsider,'Other tenant route');raise exception 'Foreign supervisor allowed';exception when insufficient_privilege then null;end;
 begin perform public.add_work_oversight_entry(work,'accepted','Admin is not the named reviewer',gen_random_uuid(),milestone);raise exception 'Admin became default approver';exception when insufficient_privilege then null;end;
 perform public.add_work_oversight_entry(manager_work,'attention','Please decide the next direction',attention);
 begin perform public.add_work_oversight_entry(manager_work,'attention','Duplicate nudge',gen_random_uuid());raise exception 'Duplicate attention request allowed';exception when invalid_parameter_value then null;end;
 perform public.add_work_oversight_entry(manager_work,'follow_up','Please share progress',gen_random_uuid());
 begin perform public.add_work_oversight_entry(manager_work,'follow_up','Too soon',gen_random_uuid());raise exception 'Rapid repeat follow-up allowed';exception when invalid_parameter_value then null;end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',manager::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 perform public.add_work_oversight_entry(work,'accepted','Milestone accepted; continue the assignment',answer,milestone);
 begin perform public.add_work_oversight_entry(work,'changes_requested','Stale response',gen_random_uuid(),milestone);raise exception 'Second decision allowed';exception when invalid_parameter_value then null;end;
 execute 'reset role';
 select status into before_status from public.work_items where id=work;
 if before_status<>'in_progress' then raise exception 'Milestone changed whole assignment state';end if;
 if exists(select 1 from public.submissions where work_item_id=work) then raise exception 'Progress created a formal submission';end if;
 if (select count(*) from private.work_oversight_entries where id=message)<>1 then raise exception 'Retry created duplicate';end if;
 if (select count(*) from public.ceac_notification_events where source_event_id=message)<>0 then raise exception 'Routine progress generated approval alert';end if;
 if (select count(*) from public.ceac_notification_events where source_event_id=attention and recipient_id=second_exec)<>1 then raise exception 'Attention did not reach named executive';end if;
 if private.ceac_responsible_reviewer_id(manager_work)<>second_exec then raise exception 'Notification reviewer disagrees with app reviewer';end if;
 perform set_config('request.jwt.claim.sub',second_exec::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',second_exec,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 perform public.add_work_oversight_entry(manager_work,'answered','Proceed with the agreed direction',gen_random_uuid(),attention);
 if not (public.my_ceac_notifications())::text like '%'||manager_work::text||'%' then raise exception 'Executive cannot open shared-work notification';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',admin::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated','aal','aal1')::text,true);
 update public.profiles set active=false where id=second_exec;
 perform set_config('request.jwt.claim.sub',second_exec::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',second_exec,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 begin perform public.work_oversight_context(manager_work);raise exception 'Revoked actor retained access';exception when insufficient_privilege then null;end;
 execute 'reset role';
 if has_table_privilege('authenticated','private.work_reporting_lines','insert') or has_table_privilege('authenticated','private.work_oversight_entries','update') or has_function_privilege('anon','public.work_oversight_queue(integer)','execute') then raise exception 'Unsafe API grants';end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 raise notice 'PASS: oversight tenant/privacy/RPC authority, named supervision, Admin exception, idempotency, independent milestones, final-state separation, notification recipient and revocation';
end $test$;
rollback;
