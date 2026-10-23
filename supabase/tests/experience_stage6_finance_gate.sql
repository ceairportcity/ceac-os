-- Experience Stage 6 gate: department-owned spending stays scoped and append-only.
\set ON_ERROR_STOP on

do $gate$
declare
  v_policy text;
  v_def text;
begin
  select coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')
    into v_policy
  from pg_policy p
  where p.polrelid='public.spend_lines'::regclass
    and p.polname='sp_insert';

  if v_policy not ilike '%app_managed_units%'
     or v_policy not ilike '%unit_id%' then
    raise exception 'Stage 6 finance gate failure: manager spend policy is not scoped to managed units.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='spend_lines'
      and cmd in ('UPDATE','DELETE','ALL')
      and permissive='PERMISSIVE' -- A restrictive Stage 2 TOTP guard cannot grant mutation.
  ) then
    raise exception 'Stage 6 finance gate failure: spend_lines is no longer append-only.';
  end if;

  if to_regprocedure('public.unit_operating_position(uuid)') is null then
    raise exception 'Stage 6 finance gate failure: unit_operating_position is missing.';
  end if;

  select pg_get_functiondef('public.unit_operating_position(uuid)'::regprocedure)
    into v_def;
  if v_def not ilike '%state = ''confirmed''%'
     or v_def not ilike '%reverses_id%'
     or v_def not ilike '%state = ''approved''%'
     or v_def not ilike '%app_managed_units%' then
    raise exception 'Stage 6 finance gate failure: operating position lost its confirmed-in / append-only-out / commitment / authority contract.';
  end if;

  if (select p.prosecdef from pg_proc p where p.oid='public.unit_operating_position(uuid)'::regprocedure) then
    raise exception 'Stage 6 finance gate failure: read-only operating position must remain SECURITY INVOKER and respect RLS.';
  end if;

  if not has_function_privilege('authenticated','public.unit_operating_position(uuid)','EXECUTE')
     or has_function_privilege('anon','public.unit_operating_position(uuid)','EXECUTE') then
    raise exception 'Stage 6 finance gate failure: operating position grants are wrong.';
  end if;
end
$gate$;

-- A6: disposable functional authority / exclusion / restoration proof.
begin;
create temporary table demo_finance_baseline(record_table text,record_id uuid,fingerprint text);
insert into public.organisations(id,name,short_code) values('aa600000-0000-4000-8000-000000000098','A6 isolated foreign tenant','A6F');
insert into public.units(id,org_id,name,code) values('aa600000-0000-4000-8000-000000000099','aa600000-0000-4000-8000-000000000098','A6 foreign unit','A6F');
insert into public.budgets(id,org_id,unit_id,year,amount_minor,currency,note)
values('aa600030-0000-4000-8000-000000000098','aa600000-0000-4000-8000-000000000098','aa600000-0000-4000-8000-000000000099',2099,999999,'CAD','Demo · foreign budget');
insert into public.spend_lines(id,org_id,unit_id,spent_on,description,amount_minor,entered_by,currency)
values('aa600031-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010',
 '20000000-0000-4000-8000-000000000011','2099-01-01','Demo · isolated spend',1200,'31000000-0000-4000-8000-000000000003','CAD');
insert into public.budgets(id,org_id,unit_id,year,amount_minor,currency,note)
values('aa600030-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010',
 '20000000-0000-4000-8000-000000000011',2099,3000,'CAD','Demo · isolated budget');
insert into public.finance_requests(id,org_id,unit_id,requested_by,title,amount_minor,currency,state)
values('aa600032-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010',
 '20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000003','Demo · isolated request',500,'CAD','approved');
insert into public.finance_requests(id,org_id,unit_id,requested_by,title,amount_minor,currency,state)
values('aa600032-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010',
 '20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000003','Demo · multi-stage request',500,'CAD','submitted');
insert into public.finance_approval_rules(org_id,currency,no_request_below_minor,admin_limit_minor,finance_limit_minor)
 values('10000000-0000-4000-8000-000000000010','CAD',0,0,0)
 on conflict(org_id,currency) do update set admin_limit_minor=0,finance_limit_minor=0;
insert into demo_finance_baseline
 select 'spend_lines',s.id,md5(to_jsonb(s)::text) from public.spend_lines s where id='aa600031-0000-4000-8000-000000000001'
 union all select 'budgets',b.id,md5(to_jsonb(b)::text) from public.budgets b where id='aa600030-0000-4000-8000-000000000001'
 union all select 'finance_requests',r.id,md5(to_jsonb(r)::text) from public.finance_requests r where id in ('aa600032-0000-4000-8000-000000000001','aa600032-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
do $archive$
declare r record;
begin
 if exists(select 1 from public.admin_finance_demo_records() where record_id='aa600030-0000-4000-8000-000000000098') then
   raise exception 'A6: Administration archive reader disclosed a foreign record';
 end if;
 begin
   perform public.admin_set_finance_demo_record('budgets','aa600030-0000-4000-8000-000000000098',true,'unused',0,'Cross-tenant classification attempt.');
   raise exception 'A6: cross-tenant classification was allowed';
 exception when insufficient_privilege then null; end;
 for r in select * from public.admin_finance_demo_records() where record_id::text like 'aa6000%' loop
   perform public.admin_set_finance_demo_record(r.record_table,r.record_id,true,r.fingerprint,r.event_no,'Confirmed synthetic demonstration record.');
 end loop;
 if exists(select 1 from public.spend_lines where id='aa600031-0000-4000-8000-000000000001')
   or exists(select 1 from public.budgets where id='aa600030-0000-4000-8000-000000000001')
   or exists(select 1 from public.finance_requests where id='aa600032-0000-4000-8000-000000000001') then
   raise exception 'A6: archived demo financial rows remain in live reads';
 end if;
 if (select count(*) from public.admin_finance_demo_records() where record_id::text like 'aa6000%' and is_demo)<>4 then
   raise exception 'A6: archive lost its Administration review path';
 end if;
 if exists(select 1 from public.unit_budget_position('20000000-0000-4000-8000-000000000011',2099) where currency='CAD')
   or exists(select 1 from public.unit_operating_position('20000000-0000-4000-8000-000000000011') where currency='CAD') then
   raise exception 'A6: a financial aggregate still counts archived demonstration data';
 end if;
 begin
   perform public.fulfil_finance_request('aa600032-0000-4000-8000-000000000001',null,null);
   raise exception 'A6: archived request was fulfilled';
 exception when raise_exception then
   if sqlerrm not like 'Demonstration finance records cannot%' then raise; end if;
 end;
 perform set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
 begin
   perform public.decide_finance_request('aa600032-0000-4000-8000-000000000002','approved','Blocked intermediate approval.');
   raise exception 'A6: archived request received an intermediate approval';
 exception when raise_exception then
   if sqlerrm not like 'Demonstration finance requests cannot be decided%' then raise; end if;
 end;
 perform set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
 begin
   insert into public.spend_lines(org_id,unit_id,spent_on,description,amount_minor,entered_by,currency,reverses_id)
    values('10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000011','2099-01-01','Forbidden live correction',1200,'31000000-0000-4000-8000-000000000003','CAD','aa600031-0000-4000-8000-000000000001');
   raise exception 'A6: live correction used an archived demonstration spend';
 exception when raise_exception then
   if sqlerrm not like 'Live spend cannot correct%' then raise; end if;
 end;
 begin
   insert into public.finance_demo_events(org_id,record_table,record_id,is_demo,reason,recorded_by)
    values('10000000-0000-4000-8000-000000000010','budgets','aa600030-0000-4000-8000-000000000001',false,'Unauthorised bypass attempt','31000000-0000-4000-8000-000000000003');
   raise exception 'A6: direct classification insert bypassed the audited function';
 exception when insufficient_privilege then null; end;
 for r in select * from public.admin_finance_demo_records() where record_id::text like 'aa6000%' loop
   begin
     perform public.admin_set_finance_demo_record(r.record_table,r.record_id,false,'stale',r.event_no,'Stale source revision must be rejected.');
     raise exception 'A6: stale source revision accepted';
   exception when serialization_failure then null; end;
   perform public.admin_set_finance_demo_record(r.record_table,r.record_id,false,r.fingerprint,r.event_no,'Restore synthetic record for comparison.');
   begin
     perform public.admin_set_finance_demo_record(r.record_table,r.record_id,true,r.fingerprint,r.event_no,'Stale classification revision must be rejected.');
     raise exception 'A6: stale classification revision accepted';
   exception when serialization_failure then null; end;
 end loop;
 if not exists(select 1 from public.unit_budget_position('20000000-0000-4000-8000-000000000011',2099)
   where currency='CAD' and budget_minor=3000 and spent_minor=1200 and committed_minor=500) then
   raise exception 'A6: restoring classifications did not restore the original financial position';
 end if;
end $archive$;

-- Manager, Staff and Executive retain their previous authority, not Administration archive authority.
do $roles$
declare v_actor uuid;
begin
 foreach v_actor in array array['31000000-0000-4000-8000-000000000001'::uuid,'31000000-0000-4000-8000-000000000002'::uuid,'31000000-0000-4000-8000-000000000004'::uuid] loop
   perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated','aal','aal1')::text,true);
   begin perform public.admin_finance_demo_records(); raise exception 'A6: non-Administration archive reader allowed';
   exception when insufficient_privilege then null; end;
   begin perform public.admin_set_finance_demo_record('budgets','aa600030-0000-4000-8000-000000000001',true,'stale',0,'Unauthorised classification attempt.'); raise exception 'A6: non-Administration archive write allowed';
   exception when insufficient_privilege then null; end;
 end loop;
end $roles$;
reset role;
do $preserved$
declare r record; v_current text;
begin
 for r in select * from demo_finance_baseline loop
   execute format('select md5(to_jsonb(t)::text) from public.%I t where id=$1',r.record_table) into v_current using r.record_id;
   if v_current is distinct from r.fingerprint then raise exception 'A6: original financial record changed'; end if;
 end loop;
 if (select count(*) from public.finance_demo_events where record_id::text like 'aa6000%')<>8 then
   raise exception 'A6: expected four archive and four restore audit events';
 end if;
 if exists(select 1 from public.finance_demo_events where record_id::text like 'aa6000%' and recorded_by<>'31000000-0000-4000-8000-000000000003') then
   raise exception 'A6: classification audit attribution is wrong';
 end if;
 if has_function_privilege('anon','public.admin_finance_demo_records()','EXECUTE')
   or has_function_privilege('anon','public.admin_set_finance_demo_record(text,uuid,boolean,text,bigint,text)','EXECUTE')
   or has_function_privilege('authenticated','public.guard_finance_demo_record()','EXECUTE') then
   raise exception 'A6: unexpected anonymous or internal-trigger execute grant';
 end if;
end $preserved$;
rollback;
