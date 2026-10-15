-- 130 — Close direct browser DML on report evidence references (review only).
-- Read-only production inspection, 11 Oct 2026, proved that BOTH anon and
-- authenticated currently have INSERT, UPDATE, DELETE and TRUNCATE on this
-- table, despite RLS. Its permissive rer_write RLS checks access to the parent
-- draft report, but not the referenced object_type/object_id or its org_id.
-- A manager with legitimate draft access could therefore bypass the audited
-- save_and_submit_report SECURITY DEFINER evidence validation and insert
-- arbitrary foreign/fabricated evidence references directly via PostgREST.
--
-- No browser component uses direct evidence-ref DML: ManagerReports reads
-- refs via SELECT and submits evidence using save_and_submit_report RPC.
-- Preserve authenticated SELECT under the current report-bound RLS policy.
-- The RPC's SECURITY DEFINER owner retains writes. Keep service_role rights.
-- No data mutation, RLS disable, table drop or change to grants on other tables.
-- REPLAY/REVIEW ONLY. No production apply without backup/restore,
-- disposable 134-version SQL replay, role/UI acceptance and owner authority.

REVOKE ALL ON TABLE public.report_evidence_refs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.report_evidence_refs TO authenticated;
GRANT ALL ON TABLE public.report_evidence_refs TO service_role;

COMMENT ON TABLE public.report_evidence_refs IS
  'Report-specific evidence references. Authenticated callers may read rows under reports RLS, but cannot write them directly. New/changed evidence must pass save_and_submit_report authority and same-org validation.';
