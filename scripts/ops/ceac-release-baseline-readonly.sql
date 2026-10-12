-- CEAC OS: read-only production release-baseline signals.
-- This is NOT a release authorisation, backup/restore test, privilege penetration test,
-- migration rehearsal or visual acceptance. Do not run pending migrations from this file.
-- Intentionally returns aggregate counts/booleans only; no personal/HR records.
-- Manifest is the 24 unapplied timestamp versions independently reconciled
-- against production on 12 Oct 2026 (PR #50, comment 6129962791).
-- Reconcile it again against the live migration ledger before actual cutover.
WITH expected_pending(version) AS (
  VALUES
    ('20261007083250'),('20261007090000'),('20261007093000'),
    ('20261007094500'),('20261007095500'),('20261007102000'),
    ('20261007103000'),('20261007104000'),('20261007180500'),
    ('20261010010000'),('20261010030000'),('20261011100000'),
    ('20261011103000'),('20261011110000'),('20261011113000'),
    ('20261011120000'),('20261011123000'),('20261011130000'),
    ('20261011183000'),('20261011190000'),('20261011193000'),
    ('20261011195500'),('20261011201000'),('20261012041000')
)
SELECT
  current_timestamp AS inspected_at,
  (SELECT count(*) FROM supabase_migrations.schema_migrations) AS applied_migrations,
  (SELECT count(*) FROM expected_pending) AS release_manifest_pending_versions,
  (SELECT count(*) FROM expected_pending p
    JOIN supabase_migrations.schema_migrations m ON m.version=p.version) AS expected_pending_already_applied,
  (SELECT count(*) FROM expected_pending p WHERE NOT EXISTS
    (SELECT 1 FROM supabase_migrations.schema_migrations m WHERE m.version=p.version))
      AS expected_pending_still_unapplied,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r') AS public_tables,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity) AS public_tables_rls_enabled,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='hr_private' AND c.relkind='r') AS protected_hr_tables,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='hr_private' AND c.relkind='r'
      AND has_table_privilege('authenticated',c.oid,'SELECT')) AS protected_hr_authenticated_select_grants,
  -- Backup scope signals only: counts never substitute for encrypted Auth/Storage restore.
  (SELECT count(*) FROM auth.users) AS auth_users_needing_preservation,
  (SELECT count(*) FROM storage.buckets WHERE id IN ('ceac-hr-private','ceac-operational-private'))
    AS required_storage_buckets_present,
  (SELECT count(*) FROM storage.buckets
    WHERE id IN ('ceac-hr-private','ceac-operational-private') AND public)
    AS required_storage_buckets_public,
  (SELECT count(*) FROM storage.objects
    WHERE bucket_id IN ('ceac-hr-private','ceac-operational-private'))
    AS private_storage_objects_needing_preservation,
  (SELECT count(*) FROM auth.mfa_factors WHERE status='verified') AS verified_production_mfa_factors,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND has_function_privilege('anon',p.oid,'EXECUTE')) AS public_definer_anon_executable,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')) AS public_definer_authenticated_executable,
  (SELECT count(*) FROM public.leave_requests) AS existing_leave_requests,
  (SELECT count(*) FROM public.leave_requests WHERE lower(kind)='annual') AS existing_annual_leave_requests,
  (SELECT count(*) FROM public.leave_policy_rules r
    JOIN public.leave_policy_versions v ON v.id=r.policy_version_id
    WHERE r.leave_kind='annual' AND r.routing_confirmed
      AND v.source_reference='CEAC_OWNER_LEAVE_ROUTING_2026-10-02') AS annual_policy_rows_targeted_by_pending_update,
  (SELECT count(*) FROM public.employment_records) AS existing_employment_records,
  (SELECT count(*) FROM public.pending_invitations
    WHERE resolved_at IS NULL AND revoked_at IS NULL) AS unresolved_invitations,
  (to_regclass('public.attendance_presence_evidence') IS NOT NULL) AS redundant_attendance_evidence_table_preexists,
  (to_regclass('public.office_presence_code_attempts') IS NOT NULL) AS redundant_attendance_attempts_table_preexists,
  (to_regclass('public.office_presence_code_windows') IS NOT NULL) AS redundant_attendance_code_windows_table_preexists;
