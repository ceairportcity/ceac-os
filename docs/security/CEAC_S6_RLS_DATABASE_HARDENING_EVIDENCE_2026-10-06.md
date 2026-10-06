# CEAC OS S6 RLS / Database Hardening Evidence — 6 October 2026

Status: IMPLEMENTED / LIVE MIGRATION 115 APPLIED / EXACT-HEAD LEVEL B PASSED

Implementation branch: `chatgpt/security-s6-2026-10-06`
Accepted application head before evidence: `d1388c75637b5088e721312f92008858a80afce1`
Baseline protected main: `2b398eb39ae200c9bd0bb7bd914c136f87623177`
Live migration: `115_s6_hot_path_rls_fk_hardening`

## Scope

This tranche followed the S6 rule to harden security-sensitive/high-frequency database paths without mechanically clearing every advisor warning.

Implemented:

- 8 targeted FK indexes on hot authority/work/session/submission/alert paths;
- 3 semantics-preserving RLS init-plan rewrites:
  - `unit_memberships.memberships_read`;
  - `capability_grants.capability_grants_read`;
  - `work_sessions.stage9_work_sessions_workforce_read`;
- a dedicated cumulative SQL gate preserving Staff cross-profile capability isolation.

Not changed:

- protected `hr_private` direct-access boundaries;
- duplicate permissive policies without exact semantic proof;
- unused indexes based only on immature workload statistics;
- old reconciliation-backup snapshot tables.

## Advisor evidence

Performance Advisor before migration 115:

| Finding | Before |
| --- | ---: |
| Unindexed foreign keys | 363 |
| Auth RLS init-plan | 111 |
| No primary key | 14 |
| Unused index | 79 |
| Multiple permissive policies | 177 |

Performance Advisor after live migration 115:

| Finding | After | Interpretation |
| --- | ---: | --- |
| Unindexed foreign keys | 355 | Reduced by the 8 reviewed hot-path indexes. |
| Auth RLS init-plan | 108 | Reduced by the 3 reviewed policy rewrites. |
| No primary key | 14 | All 14 are in the old `ceac_reconcile_backup_20260923` snapshot schema; no active public/HR production table was altered to clear them. |
| Unused index | 87 | Expected immediate increase: the 8 new indexes had no accumulated production usage at the moment of re-check. Do not delete them from zero-age statistics. |
| Multiple permissive policies | 177 | Retained pending table-by-table semantic proof; overlapping policies encode distinct authority paths. |

Security Advisor after migration 115 remained unchanged from the accepted S2 posture:

- RLS enabled / no policy: 12 informational findings, including deliberate deny-direct-access protected tables/counters;
- authenticated SECURITY DEFINER functions: 132, matching the exact S2 allowlist;
- anonymous callable SECURITY DEFINER functions: 0;
- leaked-password protection: still not active and remains a paid-plan/go-live activation item.

## Exact-head verification

At `d1388c75637b5088e721312f92008858a80afce1`:

- CI — PASS;
- Migration Replay — PASS;
- Account Security — PASS;
- Level B SQL and authority contracts — PASS;
- browser shards 1/4, 2/4, 3/4, 4/4 — PASS;
- exact-head product evidence merge — PASS;
- role-and-RLS — PASS;
- Quality Gate — PASS;
- Vercel — PASS.

## Security conclusion

S6 does not claim that every performance advisory is a defect.

The accepted result is a measured reduction on the most relevant live paths while preserving existing RLS, capability, protected-HR and separation-of-duties semantics. Remaining advisor findings are either deferred for stronger workload evidence or require a separate semantic review before any change.
