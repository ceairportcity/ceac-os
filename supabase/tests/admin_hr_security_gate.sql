\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Baseline structural guarantees
-- ---------------------------------------------------------------------------

do $$
declare n integer;
begin
  select count(*) into n
  from pg_class c
  join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='public'
    and c.relkind='r'
    and not c.relrowsecurity;
  if n<>0 then
    raise exception 'Security gate failure: % public table(s) do not have RLS enabled.',n;
  end if;
end $$;

do $$
declare n integer;
begin
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public'
    and p.prosecdef
    and has_function_privilege('anon',p.oid,'EXECUTE');
  if n<>0 then
    raise exception 'Security gate failure: % SECURITY DEFINER function(s) are callable by anon.',n;
  end if;
end $$;

do $$
declare n integer;
begin
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public'
    and p.prosecdef
    and (
      p.proconfig is null
      or not exists (
        select 1 from unnest(p.proconfig) cfg
        where cfg like 'search_path=%'
      )
    );
  if n<>0 then
    raise exception 'Security gate failure: % SECURITY DEFINER function(s) lack a fixed search_path.',n;
  end if;
end $$;

-- The accepted baseline had 68 signed-in callable SECURITY DEFINER functions.
-- Migration 069 added three reviewed Room RPC/helper functions.
-- Migration 071 adds one reviewed meeting-scheduling RPC: schedule_meeting.
-- Migration 072 adds one reviewed participant-aware authority helper:
-- app_can_manage_meeting(uuid). It binds to auth.uid(), the active org, and
-- approved manager/admin/executive/organiser authority; it has a fixed
-- search_path and no anon EXECUTE.
-- Stage 3 adds two reviewed capability-gated protected-HR RPCs:
-- hr_protected_summary(uuid) and hr_protected_record(uuid,text,jsonb,uuid,text).
-- Stage 7 adds nine reviewed performance-development RPCs:
-- open_performance_review_cycle, refresh_performance_evidence,
-- assign_performance_reviewer, record_appraisal_entry,
-- share_performance_review, close_performance_review_cycle,
-- record_development_plan_version, record_performance_feedback,
-- respond_to_performance_feedback.
-- Each is bound to auth.uid() plus explicit performance/reviewer/self authority.
-- Stage 8 adds two reviewed learning RPCs:
-- learning_complete_module(uuid,uuid) and
-- learning_admin_action(uuid,text,uuid,text).
-- Stage 9 adds six reviewed workforce RPCs.
-- Stage 10 adds four reviewed asset RPCs:
-- asset_record_item, asset_assign, asset_return and asset_lifecycle_action.
-- Each Stage 10 RPC binds to auth.uid() and requires asset.manage.
-- Stage 11 adds six reviewed compliance RPCs:
-- compliance_record_policy, compliance_acknowledge_policy,
-- compliance_submit_evidence, compliance_review_evidence,
-- compliance_request_exception and compliance_exception_action.
-- Self-service actions bind to auth.uid(); decision actions require compliance.manage.
-- Migration 094 adds two reviewed self-service account RPCs:
-- my_sessions() and my_account_activity(integer). They expose only the
-- signed-in person's own sessions/audit activity, accept no target-person
-- identifier, revoke anon/PUBLIC execution, and bind rows to auth.uid().
-- Migration 095 adds two reviewed ministry RPCs:
-- create_ministry_number(uuid,text,text) and
-- record_ministry_number(uuid,date,numeric,text). They keep both ministry
-- tables directly read-only in the browser. Definition is Unit Head/Admin;
-- recording is unit member, Unit Head, or Admin and is append-only.
-- FPG5 adds seven reviewed Payroll RPCs. They are authenticated-only,
-- capability-gated, keep protected payroll tables outside browser access, and
-- preserve Administration prepare / Group Pastor approval separation.
-- ERC4 adds two reviewed employee-subject protected-HR RPCs:
-- hr_employee_protected_summary and hr_employee_protected_record.
-- Both remain capability-gated by hr_private.access, bind to auth.uid(),
-- and do not expose protected tables directly.
-- ERC6 adds one reviewed Payroll readiness RPC. It returns configuration
-- completeness only, exposes no salary/bank values, and is payroll-capability-gated.
-- OCR3 adds six reviewed operational-file functions:
-- app_can_read_operational_context, app_can_write_operational_context,
-- app_can_access_operational_file, register_operational_file,
-- link_operational_file and finalize_operational_file.
-- They are authenticated-only, fixed-search-path, organisation/context-bound,
-- and covered by operational_clarity_files_gate.sql plus the generic definer checks above.
-- Foundation 111 reviews seven additional RPCs: additive unit responsibility,
-- work-lane membership, invitation revoke/list/resend, self-bound end evidence
-- and self-bound continuation evidence. Their role/evidence failures are tested
-- by onboarding_access_presence_gate.sql; fixed search path and no anon grants
-- remain mandatory. The exact inventory is also enforced by Platform Kernel.
-- Phase 2 migration 112 adds six reviewed RPCs: capability-bound daily pattern
-- versions, self-bound notices/returns/checkpoints, manager-bound responses and
-- a sanitised evidence read. attendance_phase2_gate.sql tests their identities,
-- tenant isolation, privacy, append-only history, concurrency and no anon access.
-- S2 migration 114 reduced the reviewed authenticated surface to 132.
-- Phase 6C explicitly reviews 136 signed-in-callable functions. The go-live annual leave policy keeps the public workforce_request_leave RPC but shifts it to a narrow SECURITY INVOKER wrapper, reducing this exact count to 135. No new definer privilege is granted.
-- The current integrated bundle adds 12 reviewed authenticated definer
-- RPC/predicate interfaces across migrations 140-146 while revoking the
-- legacy direct attendance-correction and unsafe direct performance-share RPC
-- grants, resulting in exactly 145 authenticated SECURITY DEFINER functions.
-- A separate exact signature check rejects substitutions or additions.
-- The historical net +4 were needed for front-desk attendance corroboration and
-- authorised per-person/manager evidence views. Two legacy office-code RPCs
-- were already removed by migration 124; migration 125 safely revokes grants
-- only on historical variants where their definitions remain.
-- Exact Phase 6 signatures, actor/organisation authority, and the service-only
-- network corroboration boundary are tested below and in
-- attendance_phase6_integrity_gate.sql. No other surface growth is allowed.
do $$
declare n integer;
begin
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public'
    and p.prosecdef
    and has_function_privilege('authenticated',p.oid,'EXECUTE');
  -- 158 functions already explicitly reviewed in the Stage 2 exact-signature
  -- allowlist; migration185 adds one HR-only canonical roster creation RPC.
  -- Any additional unreviewed function remains prohibited.
  -- Three Executive-only read summaries are individually enumerated in
  -- security_definer_surface_gate.sql, with negative-role and schema checks.
  if n<>179 then
    raise exception 'Security gate failure: expected 176 reviewed interfaces plus 3 Executive-only read summaries (179), found %.',n;
  end if;
end $$;

-- Explicit Phase 6C allowlist: these are the reviewed actor/tenant-scoped
-- browser-facing SECURITY DEFINER functions. Their underlying raw tables
-- remain private; obsolete code-window overloads are not browser-executable.
do $phase6_reviewed_surface$
declare
  v_signature text;
  v_function oid;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.attendance_integrity_status()',
    'public.attendance_set_office_code(boolean,integer)',
    'public.attendance_verify_office_code(text,uuid)',
    'public.attendance_corroboration_for_day(date)',
    'public.attendance_day_evidence(date)'
  ] loop
    v_function := to_regprocedure(v_signature);
    if v_function is null then
      raise exception 'Phase 6 reviewed attendance function missing: %',v_signature;
    end if;
    if not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
      where p.oid=v_function and ns.nspname='public' and p.prosecdef
    ) or not has_function_privilege('authenticated',v_function,'EXECUTE')
      or has_function_privilege('anon',v_function,'EXECUTE') then
      raise exception 'Phase 6 reviewed attendance RPC violates its exact access contract: %',v_signature;
    end if;
    v_definition := pg_get_functiondef(v_function);
    if v_definition not ilike '%auth.uid%'
       and v_definition not ilike '%app_org_id%'
       and v_definition not ilike '%app_has_capability%' then
      raise exception 'Phase 6 reviewed attendance RPC lacks an actor/tenant boundary: %',v_signature;
    end if;
  end loop;
end
$phase6_reviewed_surface$;

-- Every signed-in callable definer RPC must visibly bind itself to the caller
-- directly or through an approved authority/visibility helper.
do $rpc_authority$
declare n integer; v_unbound text;
begin
  select count(*), string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
  into n, v_unbound
  from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public'
    and p.prosecdef
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and pg_get_functiondef(p.oid) not ilike '%auth.uid%'
    and pg_get_functiondef(p.oid) not ilike '%app_is_%'
    and pg_get_functiondef(p.oid) not ilike '%app_managed_units%'
    and pg_get_functiondef(p.oid) not ilike '%app_can_%'
    and pg_get_functiondef(p.oid) not ilike '%app_visible_%'
    and pg_get_functiondef(p.oid) not ilike '%app_my_units%'
    and pg_get_functiondef(p.oid) not ilike '%app_led_sub_teams%';
  if n<>0 then
    raise exception 'Security gate failure: % authenticated SECURITY DEFINER RPC(s) lack an approved actor/authority binding: %',n,coalesce(v_unbound,'unknown');
  end if;
end
$rpc_authority$;

-- Migration 094 self-service account RPC review. These two functions are
-- deliberately SECURITY DEFINER because auth.sessions and the audit source are
-- not directly browser-readable. Keep the callable surface exact and own-data-only.
do $account_self_service$
declare
  v_sessions oid;
  v_activity oid;
  v_sessions_def text;
  v_activity_def text;
begin
  v_sessions := to_regprocedure('public.my_sessions()');
  v_activity := to_regprocedure('public.my_account_activity(integer)');

  if v_sessions is null or v_activity is null then
    raise exception 'Security gate failure: account self-service RPC(s) are missing.';
  end if;

  if not has_function_privilege('authenticated',v_sessions,'EXECUTE')
     or not has_function_privilege('authenticated',v_activity,'EXECUTE') then
    raise exception 'Security gate failure: account self-service RPC(s) are not available to signed-in users.';
  end if;

  if has_function_privilege('anon',v_sessions,'EXECUTE')
     or has_function_privilege('anon',v_activity,'EXECUTE') then
    raise exception 'Security gate failure: account self-service RPC(s) are callable by anon.';
  end if;

  select pg_get_functiondef(v_sessions) into v_sessions_def;
  select pg_get_functiondef(v_activity) into v_activity_def;

  if v_sessions_def not ilike '%s.user_id = auth.uid()%'
     or v_activity_def not ilike '%e.actor_id = auth.uid() or e.subject_profile_id = auth.uid()%' then
    raise exception 'Security gate failure: account self-service RPC(s) are not visibly bound to auth.uid().';
  end if;
end
$account_self_service$;

-- Migration 095 ministry-number definition review. Definition authority is
-- intentionally narrower than occurrence recording: Unit Heads may define a
-- number only for a managed unit; Administration may define one for any unit.
-- Direct browser writes to recurring_operations remain closed.
do $ministry_number_definition$
declare
  v_create oid;
  v_record oid;
  v_create_def text;
  v_record_def text;
  v_write_policies integer;
begin
  v_create := to_regprocedure('public.create_ministry_number(uuid,text,text)');
  v_record := to_regprocedure('public.record_ministry_number(uuid,date,numeric,text)');
  if v_create is null or v_record is null then
    raise exception 'Security gate failure: reviewed ministry-number RPC(s) are missing.';
  end if;

  if not has_function_privilege('authenticated',v_create,'EXECUTE')
     or not has_function_privilege('authenticated',v_record,'EXECUTE')
     or has_function_privilege('anon',v_create,'EXECUTE')
     or has_function_privilege('anon',v_record,'EXECUTE') then
    raise exception 'Security gate failure: ministry-number RPC execution grants are not authenticated-only.';
  end if;

  select pg_get_functiondef(v_create) into v_create_def;
  select pg_get_functiondef(v_record) into v_record_def;

  if v_create_def not ilike '%p_unit_id in (select app_managed_units())%'
     or v_create_def not ilike '%app_is_admin()%'
     or v_create_def not ilike '%insert into recurring_operations%' then
    raise exception 'Security gate failure: create_ministry_number does not visibly enforce reviewed Unit Head/Admin authority.';
  end if;

  if v_record_def not ilike '%ro.unit_id in (select app_my_units())%'
     or v_record_def not ilike '%ro.unit_id in (select app_managed_units())%'
     or v_record_def not ilike '%app_is_admin()%'
     or v_record_def not ilike '%ro.work_item_id is not null%'
     or v_record_def not ilike '%insert into operation_occurrences%' then
    raise exception 'Security gate failure: record_ministry_number does not visibly enforce reviewed scheduleless unit authority.';
  end if;

  select count(*) into v_write_policies
  from pg_policies
  where schemaname='public'
    and tablename in ('recurring_operations','operation_occurrences')
    and cmd in ('INSERT','UPDATE','DELETE','ALL')
    and permissive='PERMISSIVE'; -- A RESTRICTIVE MFA gate can only deny; it cannot confer browser writes.

  if v_write_policies<>0 then
    raise exception 'Security gate failure: ministry tables direct browser write policy was reopened.';
  end if;
end
$ministry_number_definition$;

-- Migration 067 changes default privileges. Prove a new function is not
-- silently exposed to signed-in or anonymous users.
create function public.security_gate_default_probe()
returns integer
language sql
as $$ select 1 $$;

do $gate$
declare v_oid oid:='public.security_gate_default_probe()'::regprocedure::oid;
begin
  if has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or exists (
       select 1
       from pg_proc p
       cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
       where p.oid=v_oid
         and a.grantee=0
         and a.privilege_type='EXECUTE'
     ) then
    raise exception 'Security gate failure: newly created public functions still receive broad EXECUTE by default.';
  end if;
end
$gate$;

drop function public.security_gate_default_probe();

-- ---------------------------------------------------------------------------
-- HR-data boundary
-- ---------------------------------------------------------------------------

do $$
declare n integer;
begin
  select count(*) into n
  from information_schema.columns
  where table_schema='public'
    and table_name='profiles'
    and column_name ~* '(ghana|ssnit|tax|tin|bank|salary|payroll|payslip|national_id|passport|contract_(file|document)|account_number)';
  if n<>0 then
    raise exception 'Security gate failure: protected HR field(s) were added to public.profiles.';
  end if;
end $$;

do $$
declare n integer;
begin
  select count(*) into n
  from storage.buckets
  where public
    and name ~* '(hr|human.?resources|contract|payslip|payroll|salary|employee.?document|staff.?document)';
  if n<>0 then
    raise exception 'Security gate failure: an HR/protected-document Storage bucket is public.';
  end if;
end $$;

-- Protected HR foundation must remain outside the browser-exposed public schema.
do $hr_schema$
begin
  if not exists(select 1 from pg_namespace where nspname='hr_private') then
    raise exception 'Security gate failure: hr_private schema is missing.';
  end if;

  if has_schema_privilege('anon','hr_private','USAGE')
     or has_schema_privilege('authenticated','hr_private','USAGE') then
    raise exception 'Security gate failure: anon/authenticated has USAGE on hr_private.';
  end if;

  if has_table_privilege('anon','hr_private.documents','SELECT')
     or has_table_privilege('authenticated','hr_private.documents','SELECT')
     or has_table_privilege('anon','hr_private.audit_events','SELECT')
     or has_table_privilege('authenticated','hr_private.audit_events','SELECT') then
    raise exception 'Security gate failure: protected HR tables are directly readable by browser roles.';
  end if;
end
$hr_schema$;

do $hr_bucket$
declare v_public boolean;
begin
  select public into v_public
  from storage.buckets
  where id='ceac-hr-private';

  if v_public is null then
    raise exception 'Security gate failure: ceac-hr-private bucket is missing.';
  end if;
  if v_public then
    raise exception 'Security gate failure: ceac-hr-private bucket is public.';
  end if;
end
$hr_bucket$;

-- Stage 3 explicitly reviews private HR Storage access. The bucket stays
-- private; browser access is capability-gated and constrained to the caller's
-- organisation path. No generic/public policy is permitted.
do $hr_storage_policy$
declare
  n integer;
  unsafe integer;
begin
  select count(*) into n
  from pg_policies
  where schemaname='storage'
    and tablename='objects'
    and policyname in (
      'ceac_hr_private_select',
      'ceac_hr_private_insert',
      'ceac_hr_private_delete'
    );

  if n<>3 then
    raise exception 'Security gate failure: expected 3 reviewed ceac-hr-private Storage policies, found %.',n;
  end if;

  select count(*) into unsafe
  from pg_policies
  where schemaname='storage'
    and tablename='objects'
    and (
      coalesce(qual,'') ilike '%ceac-hr-private%'
      or coalesce(with_check,'') ilike '%ceac-hr-private%'
    )
    and (
      (coalesce(qual,'')||' '||coalesce(with_check,'')) not ilike '%hr_private.access%'
      or (coalesce(qual,'')||' '||coalesce(with_check,'')) not ilike '%foldername%'
      or (coalesce(qual,'')||' '||coalesce(with_check,'')) not ilike '%app_org_id%'
    );

  if unsafe<>0 then
    raise exception 'Security gate failure: protected HR Storage policy is not capability + organisation-path constrained.';
  end if;
end
$hr_storage_policy$;

do $hr_audit_trigger$
begin
  if not exists(
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='hr_private'
      and c.relname='audit_events'
      and t.tgname='hr_audit_events_immutable'
      and not t.tgisinternal
  ) then
    raise exception 'Security gate failure: HR audit immutability trigger is missing.';
  end if;
end
$hr_audit_trigger$;

-- ---------------------------------------------------------------------------
-- Role matrix using the local fixture organisation
-- ---------------------------------------------------------------------------

insert into public.organisations(id,name,short_code)
values('10000000-0000-4000-8000-000000000099','Other Security Test Org','OTHERQ');

insert into public.thresholds(org_id,name,label,value,unit_label)
values(
  '10000000-0000-4000-8000-000000000099',
  'security_probe',
  'security probe',
  777,
  'units'
);

insert into public.profile_personal_details(
  profile_id,org_id,emergency_contact_name,address_text,updated_by
) values(
  '31000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000010',
  'Private Emergency Contact',
  'Private Fixture Address',
  '31000000-0000-4000-8000-000000000001'
)
on conflict(profile_id) do update
set emergency_contact_name=excluded.emergency_contact_name,
    address_text=excluded.address_text,
    updated_by=excluded.updated_by,
    updated_at=now();

-- Staff
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $$
begin
  begin
    perform public.app_threshold(
      '10000000-0000-4000-8000-000000000099',
      'security_probe',
      0
    );
    raise exception 'Security gate failure: Staff read another organisation''s threshold.';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    perform public.admin_people_summary();
    raise exception 'Security gate failure: Staff called admin_people_summary().';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    update public.profiles
    set is_admin=true
    where id='31000000-0000-4000-8000-000000000001';
    raise exception 'Security gate failure: Staff self-promoted to Administration.';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
declare n integer;
begin
  select count(*) into n
  from public.profile_personal_details
  where profile_id='31000000-0000-4000-8000-000000000001';
  if n<>1 then
    raise exception 'Security gate failure: Staff cannot read their own private personal details.';
  end if;
end $$;

reset role;

-- Manager
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);

do $$
begin
  begin
    perform public.admin_people_summary();
    raise exception 'Security gate failure: Manager called admin_people_summary().';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
declare n integer;
begin
  select count(*) into n
  from public.profile_personal_details
  where profile_id='31000000-0000-4000-8000-000000000001';
  if n<>0 then
    raise exception 'Security gate failure: Manager read a Staff member''s private personal details.';
  end if;
end $$;

reset role;

-- Group Pastor / Executive: leadership access must not silently become HR-private access.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);

do $$
begin
  begin
    perform public.admin_people_summary();
    raise exception 'Security gate failure: Executive called Administration-only People RPC.';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
declare n integer;
begin
  select count(*) into n
  from public.profile_personal_details
  where profile_id='31000000-0000-4000-8000-000000000001';
  if n<>0 then
    raise exception 'Security gate failure: Executive read HR-private personal details by default.';
  end if;
end $$;

reset role;

-- Administration & HR
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);

do $$
declare summary jsonb;
begin
  summary:=public.admin_people_summary();
  if summary is null then
    raise exception 'Security gate failure: Administration People summary did not return.';
  end if;
end $$;

do $$
declare n integer;
begin
  select count(*) into n
  from public.profile_personal_details
  where profile_id='31000000-0000-4000-8000-000000000001';
  if n<>1 then
    raise exception 'Security gate failure: Administration cannot read protected personal details.';
  end if;
end $$;

rollback;

select 'Admin & HR security gate passed' as result;
