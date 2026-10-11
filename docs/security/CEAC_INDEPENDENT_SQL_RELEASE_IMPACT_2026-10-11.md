# CEAC independent SQL release-impact and report-tenant assurance

**Date:** 11 October 2026 (UTC). **Status:** NOT EXECUTED IN DISPOSABLE POSTGRES; RELEASE NO-GO.

**Frozen production release candidate:** PR #44 at `e00f13873409e4cc16ec1493b60b71d5cde1114a`. Its 130 migration files must remain frozen.
**Existing production DB:** `efjljhftsesssumtshvp`, 119 recorded applied migrations. **Independent security branch:** `chatgpt/security-report-tenant-integrity-assurance-20261011`, based on the frozen SHA; adds one proposed 127 forward migration after those 130 source files, making **131 files on this security branch only**.
**Other development:** PR #47 proceeds independently; do not edit that branch, PR #44 or main.

## Executed read-only checks against real production

- The 119 live migration version/name pairs correspond exactly to 119 of the 130 original source files; no duplicate timestamp versions. **11 unapplied versions** remain. Source timestamp and approved blob identities are recorded in Issue #46.
- Current production contains **one report**. Cross-org inconsistencies by existing join checks: report versus period **0**, report versus unit **0**, report versus project **0**, project versus its lead unit **0**. This does not prove authorization safety; it only checks presently linked rows.
- Source and live DB agree that current `public.save_report_draft(uuid,text,uuid,uuid,text,text)` lacks validation that `p_unit_id` and `p_project_id` belong to the report period's organisation. Both are ordinary single-column foreign keys, not cross-org composite constraints. `SECURITY DEFINER` skips RLS.
- Read-only live snapshot: **2 leave requests**, **1 owner-confirmed annual policy rule**, **0** draft attendance redundant tables (the 3 slated for removal are absent until migration replay), **0** privileged MFA factors, **0** organisations enforcing privileged MFA, **9 Auth users**, **2 Storage buckets and 0 Storage objects**.
- Static catalogue audit: 161 public tables RLS-enabled, 10 protected HR tables RLS-enabled; no direct `anon`/`authenticated` protected-HR SELECT; 0 anonymous-callable public SECURITY DEFINER functions, 132 authenticated-callable. Fixed search paths and explicit actor/organisation/helper references are present in the inspected signed-in-callable bodies. This is NOT a proof of correct semantics; the function above is a counterexample.

## Exact original pending sequence (frozen baseline 130 files)

1. `20261007083250_118_capability_delegation_expiry.sql` — capability expiry column, grant/revocation guard and approximately 18 function definitions; role/authority impact; must test last permanent authority-manager and temporary grant expiration.
2. `20261007090000_119_phase6_volunteer_operating_model.sql` — three new tables, HR/engagement and invitation modifications; must ensure volunteers remain excluded from payroll by default and no unauthorised staff conversions.
3. `20261007093000_120_phase6_private_day_planning.sql` — private tasks and notes: prove owner-only privacy, no manager/HR evidence exposure.
4. `20261007094500_121_phase6_personal_planning_extensions.sql` — adds personal planning fields/reminder policies: prove RLS and foreign-key safety.
5. `20261007095500_122_phase6_personal_event_note_primitives.sql` — creates owner-only calendar event primitives; deny cross-profile reads.
6. `20261007102000_123_phase6_attendance_integrity.sql` — early draft attendance-code tables and RPCs. Not duplicate version of item 7.
7. `20261007103000_123_phase6_attendance_integrity.sql` — later distinct-timestamp network/code/corroboration model; protect append-only signals from absence/payroll automatic consequences.
8. `20261007104000_124_phase6_attendance_integrity_reconcile.sql` — **three DROP TABLE statements** (redundant intermediate attendance tables) with a non-empty-table `RAISE EXCEPTION` guard. Note that two DROP FUNCTION statements precede the guard in the SQL file. Confirm the migration is executed atomically in disposable test; otherwise a guard failure could leave partially removed functions. Never waive/reorder the guard on production.
9. `20261007180500_go_live_annual_leave_policy.sql` — **real data UPDATE operations** with explicit owner annual policy rules, historical leave calculations, 24-day entitlement and quarterly accrual. Compare original and restored-copy effects for all existing leave requests. Do not invent secondary leave entitlements.
10. `20261010010000_125_restrict_legacy_office_code_rpcs.sql` — restrictions of historical office-code RPC grants; keep old callable surfaces closed.
11. `20261010030000_126_phase6_network_service_role_guard.sql` — service-role-only network corroboration function with JWT role guard; prove anon/authenticated denial and service-context acceptance in local tests.

The two `123` labels have **distinct full timestamp versions**, therefore no duplicate migration key. File/blob identity and exact replay order cannot be relaxed to make deployment succeed.

## Isolated forward report-tenant repair on this security branch

- New file: `supabase/migrations/20261011100000_127_report_draft_tenant_integrity.sql`. The function signature, existing GRANT privileges, security-definer setting and original role checks remain unchanged.
- Denies a foreign report period; validates that the supplied unit and any project belong to the same organisation; restricts existing draft lookups, updates, and version queries to the reporting-period organisation. `42501` error for new cross-tenant link violations.
- New rollback-only adversarial SQL gate: `supabase/tests/report_draft_tenant_integrity_gate.sql`, registered in the existing `scripts/ci/run-sql-security-gates.sh`. It requires local role fixtures, creates an **unrelated synthetic tenant**, tests positive same-tenant create/update and cross-tenant unit/project/period denial, verifies no foreign draft, and ROLLBACKs everything.
- New Node source-level contract: `tests/report-draft-security-forward.test.mjs`, added to existing `npm run verify:source`.
- Thirteen **static** exact-branch checks passed via GitHub source connector (exact blob SHA, authority text, tenant checks, test registration). **No PostgreSQL query against a disposable database has been executed to test this SQL.** Do not conflate source checks, production catalog reads or the Vercel preview with runtime assurance.

## Related privileged report RPCs still requiring behavioural review

`save_and_submit_report` delegates to `save_report_draft`, so the new guard covers its incoming report period, unit and project. Its evidence-reference checks use `work_items.unit_id`, `work_sessions` and unit membership without explicitly requiring every referenced row's `org_id` to equal the report's organisation. `correct_report` and `submit_report` check report org and managerial/Admin authority but do not independently validate the organisation of every pre-existing linked unit/project. This is a cross-org corrupted-link risk requiring separate synthetic adversarial fixtures and explicit reviewer decision, not a declaration of a proved live exploit.

## No-go execution order

1. Secure offsite production encrypted database backup and actual isolated restoration, with Auth and Storage checks, privately. Never import real rows into public test hosts.
2. Run frozen **130-migration** replay and all 4 browser shards on exact PR #44 HEAD in a trusted Docker-enabled private Codespace or other already-authorised machine; retain per-step status, exit code, exact SHA and hashes. Without a runner summary it is **NOT VERIFIED**.
3. On this independent security branch only, run **131-version** disposable replay plus new SQL gate and Node gate. Both the original baseline and increment must pass. If PR #47 eventually changes SQL, invalidate relevant checks and review separately.
4. Document data effects, approvals, schema/RLS/definer checks and owner/second-reviewer acceptance before a later approved forward migration. Do **not** merge PR #44, this branch or PR #47 as a verification shortcut.

**No production DDL, data updates, Auth changes, merge, deploy or backup claim was made by this file.**
