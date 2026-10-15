# CEAC OS — Executed Private Local Release-Gate Evidence

**Evidence date:** 2026-10-10 UTC
**Private canonical GitHub repository:** `ceairportcity/ceac-os`
**Exact application release candidate PR #27:** `386e59086fa79e1d27b28c42677d2252877cf0e0`
**Production `main` baseline:** `827fbe7391467dd13d6e411527416402a252993c`
**Verification fixes on draft PR #29:** `369abc98a9851f7c000961d2dce7660552c61985`
**Gate decision:** **TECHNICAL PARTIAL PASS — RELEASE NO-GO** pending all mandatory browser, owner visual, real MFA, DR and reviewer gates.

## Isolated execution environment

CEAC's existing, already connected Vercel project `ceac-os` hosted a disposable, private Sandbox session `sbx_pCWlUfLG628QIn0mU7EJljg4Ne9F` (2 vCPUs, 4 GB; Docker 25.0.16, Supabase CLI pinned 2.117.0, PostgreSQL client 17.10, Node.js 22). No production Supabase credentials or live database URLs were passed to it. All testing used `127.0.0.1` with synthetic records. No GitHub public visibility, account upgrade, production application deployment or production database migration occurred.

The immutable integrated release source was transferred from **private GitHub** through the authorised connector and private Vercel Sandbox API without exporting repository access tokens. Each of the **177 `supabase/` source blobs**, including **129 migration files**, was individually checked against the exact PR #27 Git object SHA: **177/177 matched**, 0 missing, 0 corrupted. Two revised SQL test blobs subsequently matched the latest approved-for-testing draft PR #29 commits: `01740888abb18ae32cbf110944ab904e40be7c46` and `d04b1d753eab6e2a26c41c3280192d710ac9ef7d`.

## Executed test results

| Gate | Result | Evidence |
|---|---|---|
| Production migration name/version historical parity | PASS: 119 applied match, 10 pending source files | Separate read-only Supabase migration ledger and Git tree verification |
| Clean isolated local Supabase migration replay | **PASS: 129/129**, through `20261010030000` | Fresh local PostgreSQL, exact legacy compatibility artifact, `supabase migration up --local`, verified migration ledger |
| Public ordinary tables with RLS disabled | **PASS: 0** | Local PostgreSQL catalog query after all 129 migrations |
| Deterministic synthetic role fixture | **PASS** | `scripts/seed-role-fixtures.mjs` on local auth and database |
| All SQL/RLS/protected-HR/payroll/security tests | **PASS: 41/41** using committed test fixes | `scripts/ci/run-sql-security-gates.sh`, all `psql -v ON_ERROR_STOP=1` |
| Independent fresh replay for Account Security | **PASS: 129/129** | A second clean, isolated local database run after safely discarding the first |
| Actual invitation/account/password/recovery workflow | **PASS** | `scripts/test-account-security.mjs`—invitation expiration/revocation, activation, password, recovery and global refresh-session revocation |
| Partial application unit, source-contract and signed-out Chromium smoke tests | Previously **PASS: 20 unit, 24 source-contract, 3 browser** | Independent Railway Docker image attestation on private code; distinct from authenticated browser acceptance |

### Reconciliation of the two historical SQL test failures

The first full SQL run passed 39 of 41 gates and identified *test-fixture drift*, not failed migration execution:

1. `supabase/tests/workforce_management_stage9_gate.sql` had expected the older 20-day/annual-accrual policy. Its valid-policy fixture and assertions now preserve the **owner's approved 24 working days, six days per completed quarter, manager-then-administration approvals, and no routine carryover**. The incomplete-policy rejection remains enforced. Commit `1fa39e883f44ae57f17dbda97265eeb32d785f18`.
2. `supabase/tests/go_live_annual_leave_policy_gate.sql` assumed an organisation-specific owner-routing record already exists. Historical migration 107 seeds this record only for organisations that existed when it ran, whereas a brand-new local replay has no real organisation. The test now creates a **synthetic owner-rule fixture through the real authorised workforce RPC** and explicitly supplies that historically confirmed routing prerequisite **inside its own rollback-only transaction**. It retains all exact values and security assertions. Commit `369abc98a9851f7c000961d2dce7660552c61985`.

The revised SQL files were refetched directly from the private draft branch, verified by Git object SHA and executed together: **all 41/41 gates PASSED**. No live policy rows or production records were changed. This synthetic fixture does not, by itself, prove the production organisation has the correct owner-confirmed routing data, which still needs production-safe pre-cutover review.

### Evidence digests

Only digests are committed. Raw logs remain private and require redaction before independent human review.

| Local log | SHA-256 |
|---|---|
| Clean 129-migration replay | `6f6a8585af709608a1c76a68b908e74ced2a3b41f101dc0f43289eda68daeba1` |
| Full 41/41 SQL security suite using GitHub-committed fixed source | `f6467cd9989e59a1f44aaeb15a3b5d7e3bef4bed973c281e08f898408166fb36` |
| Fresh-database account-security invitation and recovery flow | `941603e84681fd89a9eb4de9a40d80683bc6089ee471d618bc375f5a76bd7f26` |
| Account-security fresh 129-migration replay | `6f6a8585af709608a1c76a68b908e74ced2a3b41f101dc0f43289eda68daeba1` |

## Mandatory gates not claimed as passed

Complete authenticated browser shards, production representative owner Level C design-fidelity review, actual privileged-user MFA/AAL2 ceremony, protected-HR and payroll acceptance by independent reviewers, backup/restore and disaster-recovery drill, second-human reviewer acceptance and private-main merge controls, secure existing Vercel project Git linkage and preview, and separately authorised production migration/deployment/rollback window.

No approval, merge or cutover is implied by this report. **Keep all implementation PRs DRAFT and production unchanged until the full owner-locked handover criteria are met.**
