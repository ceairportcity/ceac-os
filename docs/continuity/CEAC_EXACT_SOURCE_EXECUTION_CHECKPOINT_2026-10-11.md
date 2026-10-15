# CEAC exact-source execution checkpoint — 11 October 2026

Status: IMPLEMENTATION CONTINUED; RELEASE NO-GO. No production SQL, Auth settings, main merge, Vercel settings, visibility or billing changed.

## Live reconciliation and application repair

Canonical private repository: ceairportcity/ceac-os.
Main independently fetched: 827fbe7391467dd13d6e411527416402a252993c.
The attachment ended at PR #34, but full open-PR inventory found #35–#38. Do not recreate their work.
PR #35 / integrated #37 HEAD: ea6c46b13d7b24e9bf4321c3ce5fc708b4132ba9. Work History header/loading repair already exists.
PR #38 HEAD checked immediately before writing: eb9d81bb3db28423519e24790929082b3b671c69.
PR #39 application repair: 97a1f9af175c0f45008797bbbffa357d35198cef, stacked onto #38.

The production build of exact #38 failed at AccountMfaSetup.jsx:203 with Expected closing brace but found EOF. Added only the missing final function brace. No auth behaviour or assertion changed. Before/after build reproduced locally.

A private working source snapshot was reconstructed via the authenticated GitHub connector. Every one of the 782 tracked blobs at application SHA 97a1f9af175c0f45008797bbbffa357d35198cef matched its GitHub Git-blob SHA; zero missing/mismatched. This is an exact source snapshot, NOT a full authenticated Git clone with ancestry, and must not be represented as a complete run of run-independent-release-gate.sh.

## Executed checks

Node 22.22.0.
- Fresh npm ci: PASS.
- Locked-dependency production build (Vite 8.3.0): PASS.
- Build with the repository CI-style no-save Playwright installation (Vite 8.3.4): PASS after repair; FAIL before repair.
- node --test tests/*.test.mjs: 20 passed, 0 failed/skipped.
- Existing performance and FPG8 reconciliation subset: 6 passed, 0 failed/skipped.
- Seven Experience V2 source-spec files: 42 passed, 1 failed, 0 skipped.
- Visual-source contract, Actions pinning and resilience source checks passed on the reconstructed PR #34 precursor. Their changes were not part of the one-line repair.
- npm audit --audit-level=high: PASS / zero vulnerabilities on the precursor; not a complete security audit.
- PWA manifest and network-only business-data source assertions: 2 passed. Offline browser case NOT VERIFIED: browser launch failed before page execution.
- Full authenticated browser, full SQL replay, real MFA UI and full Level C comparisons: NOT EXECUTED in this environment.

Unresolved source test:
tests/experience-v2-stage15-debt.spec.js:40 — Stage 15A keeps Experience V2 free of hidden role override debt.
It rejects .executive-app selectors in src/experience-v2/executive-overview/executive-redesign.css. Keep the assertion. Reconcile actual stylesheet architecture against the later owner-approved Executive reference, with rendered role isolation evidence; do not rename selectors or weaken the test merely to turn it green.

## Execution-environment evidence

Existing Vercel test sessions are stopped; trace/log retrieval returned 410 sandbox_stopped. Prior PR #37/#38 evidence records exhausted October Hobby sandbox allocation through 1 November; no new chargeable sandbox created.
Current local process has no Docker privileges. Chromium was obtained, but launch failed with socket() Operation not permitted before any page could execute. The default headless-shell download also failed; an explicit existing full Chromium binary had the same OS restriction. No unchanged retries required.
Vercel scoped team/billing reads returned 403 for thestandardinst-6345s-projects; there is no authenticated Vercel CLI fallback here.
Fresh PR #39 Actions run IDs: 38106397754 (Migration Replay), 38106397747 (Account Security), 38106397786 (CI), 38106397753 (Quality Gate). Failed jobs ran for approximately two seconds with ZERO executed steps; downstream browser/SQL jobs skipped. These are neither passing application tests nor evidence that the repaired source fails.

## Independently reconfirmed production baseline (read-only)

Supabase efjljhftsesssumtshvp:
- 161 public tables; all 161 RLS enabled.
- Zero anonymous-executable public SECURITY DEFINER functions.
- 132 authenticated-executable public SECURITY DEFINER functions. Definitions retrieved for preliminary review, not a completed semantic/attack audit.
- Ten hr_private tables: all have RLS; neither anon nor authenticated has direct SELECT.
- Zero verified Auth MFA factors.
- One organisation; privileged_mfa_required remains false.
- Leaked-password protection advisor warning remains. Existing owner security decisions explicitly defer paid-plan activation until an approved upgrade; do not add a paid plan.
- One annual leave request currently exists. Do not rewrite it without restored-copy dry run.
- 119 applied migration version/name pairs exactly match source; zero missing/mismatched. 129 source SQL files, ten unapplied, ordered:
- 20261007090000_119_phase6_volunteer_operating_model
- 20261007093000_120_phase6_private_day_planning
- 20261007094500_121_phase6_personal_planning_extensions
- 20261007095500_122_phase6_personal_event_note_primitives
- 20261007102000_123_phase6_attendance_integrity
- 20261007103000_123_phase6_attendance_integrity
- 20261007104000_124_phase6_attendance_integrity_reconcile
- 20261007180500_go_live_annual_leave_policy
- 20261010010000_125_restrict_legacy_office_code_rpcs
- 20261010030000_126_phase6_network_service_role_guard
- Interim attendance tables are dropped by 20261007104000 only after an explicit emptiness guard. Rehearse the complete order and leave-policy/data enrichment against restored production data.
- Production encrypted backup and tested restore NOT DONE. Reuse PR #30; current connectors do not provide a complete logical dump/restore or Storage-object export path. Do not substitute catalog queries or synthetic replay for production recovery.

## Remaining product/security work, not merely deployment

Technical Support six-workspace panel is IMPLEMENTATION PENDING in the locked spec. There is no dedicated route/panel or complete support backend in this candidate. PR #17 is a backend CONTRACT, not completed schema/UI.
S3 temporary capability expiry PR #14 is independent and absent from this 129-file product stack. S7 Storage PR #20 and S8 attendance PR #18 also record pending contracts. Reconcile their actual diffs/authority and canonical migration sequencing before claiming the final release has all security work. Do not assume ten is the final pending-migration count after integration.
PR #16 contains earlier independent MFA work; compare it with #38/#39 before consolidating, without discarding legitimate work.
PR #36 carries documentation/backup preparation not automatically included in #37/#38 ancestry. Reconcile #28/#30/#36 separately; never merge an archive or duplicate source history.
Real invitation issuance/delivery, privileged AAL2 enrollment, cross-org negative access tests, session revocation and independent second review remain gates.

## Existing hosting

Vercel project prj_bAv4ggX6umjp54UjjLqqGm7bBcIB is preserved.
Production dpl_2P6xxmtxYM2zFRzRoU2ZbnbFw54f is READY, deployed from thestandardinst-star/ceac-os main 827fbe7391467dd13d6e411527416402a252993c.
https://ceac-os-git.vercel.app returned HTTP 200 and CEAC page content.
https://cacos.vercel.app returned HTTP 200 and different page content; availability/ownership is NOT established. Do not assign or remove aliases on that basis.
Existing-project Git-App access to ceairportcity still needs verification; no relink/deployment attempted.

## Exact next execution

1. Provide a genuinely free/included CEAC test environment supporting Docker/Supabase and Chromium, preferably the repository's existing private Codespaces workflow. Reuse an existing Codespace if present; never enable paid overages or create replacement production infrastructure.
2. Fetch all live heads again, recover full canonical Git ancestry, obtain/check out PR #39 exact application SHA, run the existing independent release procedures with isolated fixtures. Retain the known source failure and resolve its actual architectural cause.
3. Reconcile independent security work, implement missing Technical Support backend/UI to its locked authority contract, and verify real MFA flows. Final combined SHA must pass complete source/build/migration/SQL/browser/visual gates.
4. Securely authenticate the approved Supabase CLI and configure an owner-controlled encryption key/destination outside Git. Never paste credentials into chat. Complete encrypted production backup including relevant Auth/Storage dependencies, restore drill and exact pending-migration dry run.
5. Obtain genuine independent review and owner visual/merge-risk acceptance; then verify existing Vercel Git-App access, protected exact-SHA preview, owner-approved cutover and role smoke/rollback.

Do not declare COMPLETED, merge main or apply production migrations from this checkpoint.
