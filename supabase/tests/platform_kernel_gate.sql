\set ON_ERROR_STOP on

begin;

-- CEAC OS Platform Kernel gate.
-- This gate protects whole-system invariants before the enterprise expansion
-- programme may proceed past Stage 0.

do $public_rls$
declare n integer;
begin
  select count(*) into n
  from pg_class c
  join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='public'
    and c.relkind='r'
    and not c.relrowsecurity;
  if n<>0 then
    raise exception 'Platform Kernel gate failure: % public application table(s) lack RLS.',n;
  end if;
end
$public_rls$;

do $definer_anonymous$
declare n integer;
begin
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public'
    and p.prosecdef
    and has_function_privilege('anon',p.oid,'EXECUTE');
  if n<>0 then
    raise exception 'Platform Kernel gate failure: % public SECURITY DEFINER function(s) are executable by anon.',n;
  end if;
end
$definer_anonymous$;

do $definer_search_path$
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
    raise exception 'Platform Kernel gate failure: % public SECURITY DEFINER function(s) lack a fixed search_path.',n;
  end if;
end
$definer_search_path$;

-- Stage 0 semantic review identified six internal-only helpers that do not
-- need direct authenticated execution. Migration 074 reduces the reviewed
-- browser-callable SECURITY DEFINER surface from 73 to 67. Stage 1A adds two reviewed Administration-only employment RPCs, bringing the reviewed surface to 69. Stage 1B adds no browser-callable definer functions. Stage 1C adds the reviewed capability helper plus grant/revoke RPCs, bringing the surface to 72. Stage 1D adds only internal helpers. Stage 1E adds the reviewed workflow-step completion RPC, bringing the surface to 73. Stages 1F–2 add no browser-callable SECURITY DEFINER functions. Stage 3 adds two reviewed protected-HR RPCs, bringing the surface to 75. Stages 4–6 add no browser-callable SECURITY DEFINER functions. Stage 7 adds nine reviewed review/development RPCs with explicit actor/reviewer/self authority, bringing the surface to 84. Stage 8 adds two reviewed Learning RPCs (learner self-completion and capability-gated Administration correction), bringing the surface to 86. Stage 9 adds six reviewed workforce RPCs with explicit self/manager/capability authority, bringing the surface to 92. Stage 10 adds four reviewed asset RPCs gated by asset.manage, bringing the surface to 96. Stage 11 adds six reviewed compliance RPCs with self-bound submission/acknowledgement and compliance.manage decision authority, bringing the surface to 102. Migration 094 adds two reviewed self-service account RPCs, my_sessions() and my_account_activity(integer), bringing the reviewed surface to 104. Both are authenticated-only and bind their rows directly to auth.uid(). Migration 095 adds create_ministry_number(uuid,text,text) and record_ministry_number(uuid,date,numeric,text), bringing the reviewed surface to 106; both are authenticated-only, keep direct ministry-table writes closed, and separate scheduleless ministry-number authority from typed-work Routine authority. FPG5 Payroll brings the reviewed authenticated SECURITY DEFINER surface to 113. ERC4 adds two reviewed employee-subject protected-HR RPCs, bringing it to 115. ERC6 adds the reviewed Payroll readiness RPC, bringing it to 116. OCR3 adds six reviewed operational-file functions — app_can_read_operational_context, app_can_write_operational_context, app_can_access_operational_file, register_operational_file, link_operational_file and finalize_operational_file — bringing the exact reviewed authenticated surface to 122. These functions are authenticated-only, fixed-search-path, organisation/context-bound and covered by operational_clarity_files_gate.sql.
-- Foundation 111 adds seven reviewed RPCs: responsibility, work-lane membership,
-- invitation revoke/list/resend, and self-bound end-location and continuation evidence.
-- onboarding_access_presence_gate.sql covers authority and evidence failures.
-- Go-live baseline: 135 authenticated SECURITY DEFINER RPCs after the approved narrow
-- workforce_request_leave SECURITY INVOKER wrapper. The integrated one-bundle release
-- adds twelve reviewed caller-scoped interfaces and removes two obsolete direct
-- execution grants (attendance correction and performance publication): 145.
-- The currently reviewed authenticated-definer surface has 179 EXACT
-- signatures, including three separately checked Executive-only read summaries.
-- security_definer_surface_gate.sql locks the full named 179-signature set,
-- separately from this regression count. The independent anon-denial and
-- internal-helper revocation tests are retained; count alone is not a security
-- allowlist, and future grants must be independently reviewed by signature.
-- Phase 2 migration 112 adds six reviewed RPCs: capability-bound daily pattern
-- versions, self-bound notices/returns/checkpoints, manager-bound responses and
-- a sanitised evidence read. attendance_phase2_gate.sql tests their identities,
-- tenant isolation, privacy, append-only history, concurrency and no anon access.
do $definer_surface$
declare n integer;
begin
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public'
    and p.prosecdef
    and has_function_privilege('authenticated',p.oid,'EXECUTE');

  -- This count must agree with the separately exact-enumerated 179-signature
  -- security_definer_surface_gate.sql; never broaden approved EXECUTE grants.
  if n<>179 then
    raise exception 'Platform Kernel gate failure: expected 179 individually reviewed authenticated SECURITY DEFINER interfaces (exact signatures checked independently); found %.',n;
  end if;

  if to_regprocedure('public.app_stage2_universal_aal_allowed()') is null
     or not has_function_privilege('authenticated','public.app_stage2_universal_aal_allowed()','EXECUTE')
     or has_function_privilege('anon','public.app_stage2_universal_aal_allowed()','EXECUTE')
     or pg_get_functiondef('public.app_stage2_universal_aal_allowed()'::regprocedure) not ilike '%auth.mfa_factors%'
     or pg_get_functiondef('public.app_stage2_universal_aal_allowed()'::regprocedure) not ilike '%method == "totp"%' then
    raise exception 'Platform Kernel gate failure: reviewed Stage 2 authenticator verifier missing, unverified or publicly accessible.';
  end if;

  if to_regprocedure('public.my_sessions()') is null
     or to_regprocedure('public.my_account_activity(integer)') is null then
    raise exception 'Platform Kernel gate failure: reviewed migration 094 account RPC(s) are missing.';
  end if;

  if not has_function_privilege('authenticated','public.my_sessions()','EXECUTE')
     or not has_function_privilege('authenticated','public.my_account_activity(integer)','EXECUTE')
     or has_function_privilege('anon','public.my_sessions()','EXECUTE')
     or has_function_privilege('anon','public.my_account_activity(integer)','EXECUTE') then
    raise exception 'Platform Kernel gate failure: migration 094 account RPC execution grants are not the reviewed authenticated-only shape.';
  end if;

  if pg_get_functiondef('public.my_sessions()'::regprocedure) not ilike '%s.user_id = auth.uid()%'
     or pg_get_functiondef('public.my_account_activity(integer)'::regprocedure) not ilike '%e.actor_id = auth.uid() or e.subject_profile_id = auth.uid()%' then
    raise exception 'Platform Kernel gate failure: migration 094 account RPC(s) are not visibly bound to auth.uid().';
  end if;

  if to_regprocedure('public.create_ministry_number(uuid,text,text)') is null
     or to_regprocedure('public.record_ministry_number(uuid,date,numeric,text)') is null then
    raise exception 'Platform Kernel gate failure: reviewed migration 095 ministry RPC(s) are missing.';
  end if;

  if not has_function_privilege('authenticated','public.create_ministry_number(uuid,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.record_ministry_number(uuid,date,numeric,text)','EXECUTE')
     or has_function_privilege('anon','public.create_ministry_number(uuid,text,text)','EXECUTE')
     or has_function_privilege('anon','public.record_ministry_number(uuid,date,numeric,text)','EXECUTE') then
    raise exception 'Platform Kernel gate failure: migration 095 ministry RPC execution grants are not authenticated-only.';
  end if;

  if pg_get_functiondef('public.create_ministry_number(uuid,text,text)'::regprocedure) not ilike '%p_unit_id in (select app_managed_units())%'
     or pg_get_functiondef('public.create_ministry_number(uuid,text,text)'::regprocedure) not ilike '%app_is_admin()%'
     or pg_get_functiondef('public.create_ministry_number(uuid,text,text)'::regprocedure) not ilike '%insert into recurring_operations%' then
    raise exception 'Platform Kernel gate failure: create_ministry_number does not match reviewed Unit Head/Admin authority.';
  end if;

  if pg_get_functiondef('public.record_ministry_number(uuid,date,numeric,text)'::regprocedure) not ilike '%ro.unit_id in (select app_my_units())%'
     or pg_get_functiondef('public.record_ministry_number(uuid,date,numeric,text)'::regprocedure) not ilike '%ro.unit_id in (select app_managed_units())%'
     or pg_get_functiondef('public.record_ministry_number(uuid,date,numeric,text)'::regprocedure) not ilike '%ro.work_item_id is not null%'
     or pg_get_functiondef('public.record_ministry_number(uuid,date,numeric,text)'::regprocedure) not ilike '%insert into operation_occurrences%' then
    raise exception 'Platform Kernel gate failure: record_ministry_number does not match reviewed scheduleless unit authority.';
  end if;

  -- Permissive INSERT/UPDATE/DELETE/ALL policies would reopen direct
  -- ministry-number writes. Stage 2's RESTRICTIVE ALL TOTP policy only
  -- narrows existing permissions; it cannot grant a write by itself.
  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename in ('recurring_operations','operation_occurrences')
      and cmd in ('INSERT','UPDATE','DELETE','ALL')
      and permissive='PERMISSIVE'
  ) then
    raise exception 'Platform Kernel gate failure: permissive direct ministry-table writes were reopened.';
  end if;
  if (select count(*) from pg_policies
      where schemaname='public'
        and tablename in ('recurring_operations','operation_occurrences')
        and policyname='stage2_universal_totp_gate'
        and permissive='RESTRICTIVE'
        and cmd='ALL'
        and qual like '%app_stage2_universal_aal_allowed%'
        and with_check like '%app_stage2_universal_aal_allowed%')<>2 then
    raise exception 'Platform Kernel gate failure: Stage 2 restrictive TOTP protection missing from both ministry tables.';
  end if;

  if has_function_privilege('authenticated','public.app_can_publish_announcements()','EXECUTE')
     or has_function_privilege('authenticated','public.app_threshold(uuid,text,numeric)','EXECUTE')
     or has_function_privilege('authenticated','public.next_close_version(uuid,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.next_work_ref(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.submit_project_close(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.submit_report(uuid,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.app_can_write_operational_context(text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.cancel_ministry_event(uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.link_work_items(uuid,uuid,text)','EXECUTE') then
    raise exception 'Platform Kernel gate failure: an internal-only privileged helper remains directly executable by authenticated.';
  end if;

  if to_regprocedure('public.payroll_list_runs()') is null
     or to_regprocedure('public.payroll_run_detail(uuid)') is null
     or to_regprocedure('public.payroll_create_run(text,date,date,text,date,text)') is null
     or to_regprocedure('public.payroll_set_line(uuid,uuid,uuid,text,text,text,bigint,text)') is null
     or to_regprocedure('public.payroll_submit_run(uuid,text)') is null
     or to_regprocedure('public.payroll_approve_run(uuid,text)') is null
     or to_regprocedure('public.payroll_create_correction(uuid,text)') is null
     or to_regprocedure('public.payroll_readiness_summary()') is null then
    raise exception 'Platform Kernel gate failure: reviewed FPG5 Payroll RPC surface is incomplete.';
  end if;

  if has_function_privilege('anon','public.payroll_list_runs()','EXECUTE')
     or has_function_privilege('anon','public.payroll_run_detail(uuid)','EXECUTE')
     or has_function_privilege('anon','public.payroll_create_run(text,date,date,text,date,text)','EXECUTE')
     or has_function_privilege('anon','public.payroll_set_line(uuid,uuid,uuid,text,text,text,bigint,text)','EXECUTE')
     or has_function_privilege('anon','public.payroll_submit_run(uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.payroll_approve_run(uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.payroll_create_correction(uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.payroll_readiness_summary()','EXECUTE') then
    raise exception 'Platform Kernel gate failure: anon can execute a protected Payroll RPC.';
  end if;
end
$definer_surface$;


-- Protected HR is deliberately outside browser-exposed public data.
do $hr_boundary$
begin
  if to_regprocedure('public.hr_employee_protected_summary(uuid)') is null
     or to_regprocedure('public.hr_employee_protected_record(uuid,text,jsonb,uuid,text)') is null then
    raise exception 'Platform Kernel gate failure: reviewed ERC4 employee protected-HR RPC surface is incomplete.';
  end if;

  if has_function_privilege('anon','public.hr_employee_protected_summary(uuid)','EXECUTE')
     or has_function_privilege('anon','public.hr_employee_protected_record(uuid,text,jsonb,uuid,text)','EXECUTE') then
    raise exception 'Platform Kernel gate failure: anon can execute an ERC4 protected-HR RPC.';
  end if;

  if not exists(select 1 from pg_namespace where nspname='hr_private') then
    raise exception 'Platform Kernel gate failure: hr_private schema is missing.';
  end if;

  if has_schema_privilege('anon','hr_private','USAGE')
     or has_schema_privilege('authenticated','hr_private','USAGE') then
    raise exception 'Platform Kernel gate failure: browser roles have USAGE on hr_private.';
  end if;

  if has_table_privilege('anon','hr_private.documents','SELECT')
     or has_table_privilege('authenticated','hr_private.documents','SELECT')
     or has_table_privilege('anon','hr_private.audit_events','SELECT')
     or has_table_privilege('authenticated','hr_private.audit_events','SELECT') then
    raise exception 'Platform Kernel gate failure: protected HR tables are directly browser-readable.';
  end if;
end
$hr_boundary$;

do $hr_bucket$
declare v_public boolean;
begin
  select public into v_public from storage.buckets where id='ceac-hr-private';
  if v_public is null then
    raise exception 'Platform Kernel gate failure: ceac-hr-private bucket is missing.';
  end if;
  if v_public then
    raise exception 'Platform Kernel gate failure: ceac-hr-private bucket is public.';
  end if;
end
$hr_bucket$;

-- Sensitive HCM/payroll data must not leak into ordinary profiles as the
-- enterprise programme expands.
do $profile_boundary$
declare n integer;
begin
  select count(*) into n
  from information_schema.columns
  where table_schema='public'
    and table_name='profiles'
    and column_name ~* '(ghana|ssnit|tax|tin|bank|salary|compensation|payroll|payslip|national_id|passport|account_number)';
  if n<>0 then
    raise exception 'Platform Kernel gate failure: protected HCM/payroll field(s) were added to public.profiles.';
  end if;
end
$profile_boundary$;

-- The locked Platform Kernel includes migration 073/private Meeting notes.
do $meeting_private_notes$
declare n integer;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='meeting_private_notes'
  ) then
    raise exception 'Platform Kernel gate failure: meeting_private_notes is missing.';
  end if;

  select count(*) into n
  from pg_policies
  where schemaname='public'
    and tablename='meeting_private_notes'
    and policyname in (
      'meeting_private_notes_read',
      'meeting_private_notes_insert',
      'meeting_private_notes_update'
    );
  if n<>3 then
    raise exception 'Platform Kernel gate failure: expected 3 private Meeting-note policies, found %.',n;
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace ns on ns.oid=t.relnamespace
    where ns.nspname='public'
      and t.relname='meeting_records'
      and c.conname='meeting_records_kind_check'
      and pg_get_constraintdef(c.oid) like '%decision%'
  ) then
    raise exception 'Platform Kernel gate failure: shared Meeting records are not decision-only.';
  end if;
end
$meeting_private_notes$;

-- Clean replay must record the current immutable Stage 0 migration.
do $migration_074$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260922033628'
  ) then
    raise exception 'Platform Kernel gate failure: local migration history does not contain 074 RPC-surface reduction.';
  end if;
end
$migration_074$;

rollback;

select 'CEAC OS Platform Kernel gate passed' as result;
