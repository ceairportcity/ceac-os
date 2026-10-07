# CEAC Pre-Restoration Go-Live Handoff — 7 October 2026

Status: PREPARED ON ISOLATED STACK / GITHUB ACCEPTANCE PENDING

This document records the work intentionally prepared while normal GitHub acceptance/merge flow is unavailable. It is not a claim that protected-main acceptance or production deployment has occurred.

## Canonical repository

Repository:
`thestandardinst-star/ceac-os`

Protected main at the latest reconciliation:
`827fbe7391467dd13d6e411527416402a252993c`

Main already contains the accepted security baseline through:
- Security S2 exact SECURITY DEFINER allowlist;
- Security S6 hot RLS/FK hardening;
- Security S4 Actions pinning/least privilege;
- Security S7 recovery/privacy/handover controls;
- Security S1/S5 auth readiness and sanitised recovery errors;
- Security S1 privileged AAL2 database enforcement;
- S1 migration-history reconciliation.

Re-fetch main before any future write.

## Existing product stack

Current stacked product lineage:
1. PR #145 — Phase 5 Admin product redesign — head `chatgpt/phase5-admin-product-redesign-2026-10-07`
2. PR #140 — Phase 6 Volunteer / planning / attendance — base Phase 5
3. PR #147 — Executive product redesign — base Phase 6
4. PR #149 — Resilience / installable PWA / recovery — base Executive redesign
5. PR #150 — Go-live owner decisions — base Resilience

PR #150 head used as the parent for the work in this handoff:
`ab4847fb96eb70cfa93bda615ba8a32b1793371e`

Prepared branch:
`chatgpt/pre-restoration-go-live-ready-2026-10-07`

Do not flatten, reset or force-push this stack. When normal GitHub flow returns, reconcile each successor forward after its predecessor is accepted.

## Prepared work A — Annual Leave go-live implementation

Binding owner policy:
- 24 working days per leave year;
- 6 working days per completed quarter;
- joiner first completed quarter pro-rated to the portion of the quarter served;
- ordinary unused Annual leave expires at year end;
- no routine automatic carry-forward;
- explicit legally/contractually protected exceptions remain preservable;
- Sick/Maternity/Paternity/Study quantities remain unconfigured unless separately confirmed;
- leave/attendance never automatically posts a Payroll deduction.

Prepared implementation:
- `supabase/migrations/20261007180500_go_live_annual_leave_policy.sql`
- `supabase/tests/go_live_annual_leave_policy_gate.sql`
- `src/screens/Me.jsx`
- `src/screens/Workforce.jsx`
- Payroll/Leave rule documentation alignment.

Important implementation choices:
- Annual request usage is counted from attributable effective-dated workforce schedules.
- Missing schedule/day-type evidence returns an unavailable working-day result rather than silently assuming Monday-Friday.
- Joiner pro-rating uses calendar-day portion served in the completed join quarter; the resulting credit remains working-day entitlement. This avoids inventing a pre-employment schedule.
- Protected/correction exceptions are append-only and attributable with reversal support.
- New privileged Annual Leave implementation logic is outside the exposed public schema; public browser RPCs remain narrow wrappers.
- Secondary leave quantities remain explicitly unresolved.

## Prepared work B — CEAC Guide / adoption

Owner-locked contract:
`docs/guide/CEAC_GUIDE_PRODUCT_LOCK_2026-10-07.md`

Prepared product:
- permanent desktop Guide immediately above the user/profile block;
- Guide under Mobile More;
- contextual page Help entry;
- searchable role-aware/context-aware content;
- role-specific Getting Started checklist;
- progress/resume/reset/dismiss/show;
- Documents/Files and Notifications/Updates coverage;
- Annual Leave guidance aligned to the new confirmed policy;
- privacy, support, installable-app and offline boundaries;
- Guide version `2026.10.07`.

Offline rule:
- Guide content is static shell content;
- only minimal expiring Guide checklist preference state is local;
- no CEAC business/API data is cached for Guide use.

## Verification prepared in source

The branch adds/updates:
- SQL Annual Leave acceptance gate in the complete security suite;
- exact SECURITY DEFINER surface adjustment for the new leave wrapper architecture;
- Guide browser acceptance;
- Guide acceptance included in shell-targeted Level A runs;
- documentation describing unverified gates accurately.

## What is NOT yet accepted

Do not claim any of the following until GitHub normal operation returns and exact-head checks run:
- build/CI pass for this prepared branch;
- Migration Replay pass;
- Account Security pass;
- full SQL/RLS acceptance pass;
- Playwright/browser pass;
- visual/responsive Guide acceptance;
- protected-main merge;
- production migration;
- production Vercel acceptance.

No production database change from the prepared Annual Leave migration has been applied by this branch.

## Separate open security PRs still requiring convergence

At the latest reconciliation these remained open against main and are NOT silently merged into this product branch:
- #138 — Security S3 capability-expiry
- #142 — Security S1 browser MFA foundation
- #143 — Technical Support backend authority contract
- #144 — Security S8 attendance safety backend contract
- #146 — Security S7 private Storage hardening
- #148 — historical migration parity

These must be reconciled by actual diff/authority overlap after GitHub restoration. In particular, re-check:
- `supabase/tests/security_definer_surface_gate.sql`;
- migration numbering/history;
- authentication/shell overlap;
- Workforce/attendance authority overlap.

Do not resolve conflicts by weakening tests, RLS, MFA, audit or authority checks.

## Restoration execution order

When normal GitHub operation returns:

1. Re-fetch protected `main`, all open PRs and all stacked branch heads.
2. Confirm no newer legitimate writer advanced any branch in this lineage.
3. Resume acceptance of the product stack from its oldest unaccepted predecessor. After each predecessor is accepted into protected main, reconcile/retarget the next stacked PR to the new main without rewriting accepted work.
4. Reconcile the separate open security PRs by real diff and authority semantics; do not blindly merge overlapping security gates/migrations.
5. Reconcile this pre-restoration branch last against the accepted owner-decision/product lineage and any newly accepted security changes.
6. Run exact-head:
   - CI/build;
   - Migration Replay;
   - Account Security;
   - complete SQL/RLS/security gates;
   - full Level B Quality Gate/browser shards.
7. Inspect Guide at desktop and supported phone widths.
8. Only after green exact-head acceptance, merge through protected-main rules.
9. Apply production migration only through the accepted migration path.
10. Perform post-merge exact-main and deployed-product verification before calling the work complete.

GitHub remains canonical. No production acceptance may be inferred from this pre-restoration source preparation.
