-- Existing isolated role fixtures; no persistent records or permissions.
\set ON_ERROR_STOP on
begin;
update public.units set handles_finance=true where id='20000000-0000-4000-8000-000000000012';
insert into public.finance_approval_rules(org_id,currency,no_request_below_minor,admin_limit_minor,finance_limit_minor)
 values('10000000-0000-4000-8000-000000000010','GHS',0,100000,1000000)
 on conflict(org_id,currency) do update set admin_limit_minor=100000,finance_limit_minor=1000000;
update public.unit_memberships set role='manager'
 where profile_id='31000000-0000-4000-8000-000000000003' and unit_id='20000000-0000-4000-8000-000000000011';
insert into public.spend_lines(id,org_id,unit_id,spent_on,description,amount_minor,currency,entered_by)
values('a7280000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011','2099-01-01','Synthetic receipt source',100,'GHS','31000000-0000-4000-8000-000000000003'),
('a7280000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011','2099-01-01','Synthetic other receipt source',100,'GHS','31000000-0000-4000-8000-000000000003'),
('a7280000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000012','2099-01-01','Synthetic Finance receipt source',100,'GHS','31000000-0000-4000-8000-000000000005');
insert into public.organisations(id,name,short_code) values('a7280000-0000-4000-8000-000000000098','Synthetic foreign finance tenant','F728');
insert into public.units(id,org_id,name,code) values('a7280000-0000-4000-8000-000000000099','a7280000-0000-4000-8000-000000000098','Synthetic foreign finance unit','F728');
insert into public.spend_lines(id,org_id,unit_id,spent_on,description,amount_minor,currency,entered_by)
values('a7280000-0000-4000-8000-000000000099','a7280000-0000-4000-8000-000000000098','a7280000-0000-4000-8000-000000000099','2099-01-01','Synthetic foreign expense',100,'GHS','31000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into public.finance_requests(id,org_id,unit_id,requested_by,title,amount_minor,currency,independent_path)
values('a7280000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000003','Synthetic independent request',100,'GHS',null);
do $gate$
begin
 if public.app_can_read_operational_context('spend_line','a7280000-0000-4000-8000-000000000099') then raise exception 'Admin read foreign expense receipts';end if;
 begin perform public.register_operational_file('spend_line','a7280000-0000-4000-8000-000000000099','expense_receipt','foreign.pdf','application/pdf',4);raise exception 'Admin attached foreign receipt';exception when insufficient_privilege then null;end;
 if (select independent_path from public.finance_requests where id='a7280000-0000-4000-8000-000000000001') is distinct from array['finance','exec']::text[] then raise exception 'Admin request did not take the independent path';end if;
 begin perform public.decide_finance_request('a7280000-0000-4000-8000-000000000001','approved',null);raise exception 'Requester approved own request';exception when insufficient_privilege then null;end;
 begin
  insert into public.finance_requests(org_id,unit_id,requested_by,title,amount_minor,currency,state)
  values('10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011',auth.uid(),'Forged approved request',100,'GHS','approved');
  raise exception 'Browser inserted a pre-approved request';exception when insufficient_privilege then null;end;
 begin
  update public.finance_requests set independent_path=null,state='cancelled' where id='a7280000-0000-4000-8000-000000000001';
  raise exception 'Browser changed independent path';exception when insufficient_privilege then null;end;
end $gate$;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
do $gate$
begin
 begin perform public.decide_finance_request('a7280000-0000-4000-8000-000000000001','approved',null);raise exception 'Executive skipped Finance';
 exception when raise_exception then if sqlerrm not like 'This request needs Finance%' then raise;end if;end;
end $gate$;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
do $gate$
begin
 if public.decide_finance_request('a7280000-0000-4000-8000-000000000001','approved',null)<>'awaiting exec' then raise exception 'Finance did not advance to independent Executive';end if;
 if (select state from public.finance_requests where id='a7280000-0000-4000-8000-000000000001')<>'submitted' then raise exception 'One approval was treated as complete';end if;
end $gate$;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
do $gate$
begin
 if public.decide_finance_request('a7280000-0000-4000-8000-000000000001','approved',null)<>'approved' then raise exception 'Independent Executive approval failed';end if;
end $gate$;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
do $gate$
declare first_id uuid; f record;
begin
 first_id:=public.fulfil_finance_request('a7280000-0000-4000-8000-000000000001','2099-01-01','Synthetic independently approved payout');
 if first_id is null then raise exception 'Approved payout has no linked spend';end if;
 begin perform public.fulfil_finance_request('a7280000-0000-4000-8000-000000000001',null,null);raise exception 'Payout duplicated';
 exception when raise_exception then if sqlerrm not like 'Only an approved request%' then raise;end if;end;
 select * into f from public.register_operational_file('spend_line','a7280000-0000-4000-8000-000000000011','expense_receipt','synthetic-receipt.pdf','application/pdf',4);
 if f.storage_path not like '%/expense-receipt/a7280000-0000-4000-8000-000000000011/%' then raise exception 'Receipt lost bound private path';end if;
 begin perform public.finalize_operational_file(f.file_id);raise exception 'Receipt finalised without Storage';
 exception when raise_exception then if sqlerrm not like 'The file upload is not present%' then raise;end if;end;
 insert into storage.objects(bucket_id,name,owner) values(f.storage_bucket,f.storage_path,auth.uid());
 perform public.finalize_operational_file(f.file_id);
 if not public.app_can_access_operational_file(f.file_id) then raise exception 'Admin cannot read uploaded receipt';end if;
 begin perform public.link_operational_file(f.file_id,'spend_line','a7280000-0000-4000-8000-000000000012','expense_receipt');raise exception 'Receipt moved to a different expense';exception when insufficient_privilege then null;end;
 begin perform public.register_operational_file('spend_line','a7280000-0000-4000-8000-000000000011','project_file','bad.pdf','application/pdf',4);raise exception 'Wrong receipt relation accepted';
 exception when raise_exception then if sqlerrm not like 'That file relation%' then raise;end if;end;
end $gate$;
-- Ordinary Manager threshold routing and expense behaviour remain available.
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into public.finance_requests(id,org_id,unit_id,requested_by,title,amount_minor,currency)
values('a7280000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000002','Synthetic ordinary request',100,'GHS');
do $gate$
begin
 if (select independent_path from public.finance_requests where id='a7280000-0000-4000-8000-000000000002') is not null then raise exception 'Ordinary Manager route changed';end if;
 begin perform public.decide_finance_request('a7280000-0000-4000-8000-000000000002','approved',null);raise exception 'Manager self-approved';exception when insufficient_privilege then null;end;
 if public.app_can_attach_spend_receipt('a7280000-0000-4000-8000-000000000011') then raise exception 'Manager gained receipt upload authority';end if;
end $gate$;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
do $gate$
begin
 begin perform public.decide_finance_request('a7280000-0000-4000-8000-000000000002','declined',null);raise exception 'Unreasoned decline accepted';exception when invalid_parameter_value then null;end;
 if public.decide_finance_request('a7280000-0000-4000-8000-000000000002','approved',null)<>'approved' then raise exception 'Ordinary low-value Administration decision changed';end if;
end $gate$;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
do $gate$
begin
 if public.app_can_read_operational_context('spend_line','a7280000-0000-4000-8000-000000000011') then raise exception 'Staff read expense receipts';end if;
 begin perform public.register_operational_file('spend_line','a7280000-0000-4000-8000-000000000011','expense_receipt','denied.pdf','application/pdf',4);raise exception 'Staff uploaded receipt';exception when insufficient_privilege then null;end;
end $gate$;
reset role;
do $gate$
begin
 if (select prosecdef from pg_proc where oid='public.app_can_attach_spend_receipt(uuid)'::regprocedure) then raise exception 'Receipt predicate bypasses RLS';end if;
 if has_function_privilege('anon','public.app_can_attach_spend_receipt(uuid)','EXECUTE') or has_function_privilege('authenticated','public.guard_finance_request_independence()','EXECUTE') then raise exception 'Unexpected new anonymous or trigger surface';end if;
 if (select count(*) from public.finance_request_decisions where request_id='a7280000-0000-4000-8000-000000000001')<>2 then raise exception 'Independent decision count incorrect';end if;
end $gate$;
-- Pending receipt bytes and finalisation both recheck an Finance membership revocation.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
do $pending$
declare f record;
begin
 select * into f from public.register_operational_file('spend_line','a7280000-0000-4000-8000-000000000013','expense_receipt','revoked-receipt.pdf','application/pdf',4);
 perform set_config('ceac_test.receipt_id',f.file_id::text,true);
 perform set_config('ceac_test.receipt_path',f.storage_path,true);
end $pending$;
reset role;
delete from public.unit_memberships where profile_id='31000000-0000-4000-8000-000000000005' and unit_id='20000000-0000-4000-8000-000000000012';
set local role authenticated;
do $revoked$
begin
 begin
  insert into storage.objects(bucket_id,name,owner) values('ceac-operational-private',current_setting('ceac_test.receipt_path'),auth.uid());
  raise exception 'Revoked account inserted receipt bytes';exception when insufficient_privilege then null;end;
 begin perform public.finalize_operational_file(current_setting('ceac_test.receipt_id')::uuid);raise exception 'Revoked account finalised receipt';exception when insufficient_privilege then null;end;
end $revoked$;
reset role;
rollback;
