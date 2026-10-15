# CEAC OS — private release verification checkpoint (10 October 2026)

**Status: NO-GO for unrestricted production cutover or Technical Support handover.**
This report records independently observed checks and missing evidence. **It is not a release-approval certificate.** No branch, database, Vercel production deployment, repository visibility or billing change is authorized by this file. Superseding authority: `docs/continuity/CEAC_GO_LIVE_PRIVATE_HANDOVER_LOCK_2026-10-10.md` on PR #28.

## Reconciled source and PR state

- Canonical **private** GitHub repo: `ceairportcity/ceac-os`.
- Baseline `main`: `827fbe7391467dd13d6e411527416402a252993c`, no enforceable native branch protection observed.
- Draft release integration PR **#27**: `386e59086fa79e1d27b28c42677d2252877cf0e0`; NOT merged.
- PR **#28**: `860dc298fc3403ec05a769c7bbc4fecc9a123114`, four continuity-only files; NOT merged; four Actions runs failed before executed steps.
- Draft verification tooling PR **#29**: separate descendant branch based on PR #27; script and protocol created; **NOT merged**. The current PR head may advance with this document; refetch before review.
- Product/security dependency chain remains unmerged: historical security parity #22; Phase 5 #19 → Phase 6 #15 → Executive #21 → PWA/recovery #23 → decisions #24 → leave/Guide #25. Security #14, #16–#18, #20 and other independent branches require separate reconciliation before inclusion.
- Previous passing workflow outcomes for #19 and #22 belong to those **older exact heads** and are not final integration acceptance. PR #26 executed genuine failures; the two reported test-contract corrections are present in PR #27.

## Current independent checks and evidence

| Gate | Actual evidence | State |
| --- | --- | --- |
| Private GitHub / main continuity | GitHub repo and main API queried, above exact SHA; protected=false | VERIFIED at checkpoint |
| Actions run starts, PR #28 | CI, Migration Replay, Account Security, Quality Gate failed before steps; explicit CI rerun also failed before steps | BLOCKED, cause unknown |
| Bash syntax for new private independent runner | Network-denied isolated Vercel sandbox ran `bash -n` on reviewed script; exit 0 | PASS (tooling only) |
| Fail-closed preflight of runner | Invalid private clone passed to exact script; nonzero exit 2; sandbox stopped | PASS (negative smoke only) |
| Historical migration filename/version parity for exact PR #27 SHA | Direct recursive Git tree versus read-only SQL on production Supabase `schema_migrations`: **119/119 applied versions match names**, 0 missing/duplicate/drift; 129 repo SQL migration files, 10 unapplied | PASS (filename/version parity ONLY) |
| Exact PR #27 npm ci / unit / dependency audit / build | No complete independent source checkout available to execute runner | NOT VERIFIED |
| Exact PR #27 disposable clean migration replay | 10 pending production migrations remain unapplied; no complete external execution | NOT VERIFIED |
| Complete SQL / RLS / Payroll boundary / MFA function contract tests | No executed final-candidate run | NOT VERIFIED |
| Account Security, four Playwright shards and screenshots | No executed final-candidate run | NOT VERIFIED |
| Owner-approved literal mockup visual Level C | No fresh rendered comparison accepted | NOT VERIFIED |
| Real staff invitations / activation / MFA AAL2 / role workflows | No witnessed authorised real-user acceptance | NOT VERIFIED |
| Independent second security reviewer and SHA-bound manual merge acceptance | No approval evidenced | NOT VERIFIED |
| Source-linked candidate Vercel preview / backup restore / rollback exercise | No accepted preview, cutover, production migration or restore evidence | NOT VERIFIED |

## Supabase production — read-only observations

Project `efjljhftsesssumtshvp` reported `ACTIVE_HEALTHY`:
- **119** migrations applied; **10 new candidate migrations unapplied**. Latest applied migration version observed: `20261007075418`.
- **0** public application tables without RLS; **0** anonymous-executable public SECURITY DEFINER routines.
- **132** authenticated-executable public SECURITY DEFINER routines; the release candidate's reviewed count is **135 after its pending migrations**. This difference is not a production defect by itself. Each callable routine still requires appropriate authority checks.
- `ceac-hr-private` Storage bucket is **non-public**.
- Aggregate workforce/auth facts: **18 employee roster entries**, **2 roster records with profile links**, **8 auth accounts**, **7 confirmed emails**, **6 accounts with prior sign-in**, **0 invite-created auth accounts identified by `auth.users.invited_at`**. Aggregate data do not prove invitation flow.
- **0 verified MFA factors and 0 accounts with verified MFA** at inspection; privileged AAL2 acceptance remains unproven.
- Advisor findings include **12 INFO RLS-without-policy** reports (many internal/private tables), **132 WARN authenticated SECURITY DEFINER** reports (may include intentionally reviewable RPCs), and **1 WARN leaked-password protection** configuration. No warning was waived or silently fixed.

## Vercel source, production and handover

Existing project **`ceac-os`**, id `prj_bAv4ggX6umjp54UjjLqqGm7bBcIB`, was **preserved**. Last inspected production deployment `dpl_2P6xxmtxYM2zFRzRoU2ZbnbFw54f` was marked **READY** at the original baseline SHA `827fbe7391467dd13d6e411527416402a252993c`, and still attributed to `thestandardinst-star/ceac-os`, **not** the new source connection or the go-live candidate. Project SSO protection was enabled for all except custom domains. READY is not evidence of correct actual staff login.

The official Vercel GitHub App access to private `ceairportcity/ceac-os` has not been verified; do not change existing production source or release before that authorization and an exact candidate preview exist. No backup restore test, rollback approval, private collaborator/MFA inventory, verified Technical Support panel or business-authority restriction review has been completed. The Technical Support specification is marked **implementation pending**; a written specification alone cannot constitute handover.

## Hard stop / next release requirements

1. Owner checks GitHub **Settings → Billing & licensing → Usage (Actions)** and **Budgets and alerts**. The app's GitHub account connector cannot verify usage/budget restrictions; do not claim an exhausted allowance based solely on zero-step failures. No paid upgrade/spending authorisation is given.
2. Arrange **read-only authenticated private Git checkout** on a capable no-extra-charge, disposable host. The complete existing gates must execute at the current PR #27 final combined SHA (and again after any repair SHA changes), with private logs, checksums and isolated clean databases. New script resides on draft PR #29; it does not claim its own Level B acceptance.
3. Close real-account activation and privileged MFA/AAL2 role tests; review data privacy/authority, mandatory visual references and ten pending migration effects. No direct production SQL from test harness.
4. Obtain independent second reviewer, recorded no-enforced-protection risk acceptance and SHA-specific sign-off; normal non-force GitHub PR merges in dependency order, then exact-main tests.
5. Authorize Vercel App access, verify isolated preview, backup and **restore**, rollback and a separately approved production cutover. Record deployed SHA and perform genuine live smoke.
6. Verify repository still **PRIVATE** and Technical Support access is least-privilege; complete Guide, runbooks, escalations, operational limits and written owner handover.

**Until then: NO-GO for unrestricted production and private handover.** Limited pilot is a separate recorded owner decision subject to its own minimum safe role/privacy/MFA gate, not an assumed alternative or excuse to bypass tests.
