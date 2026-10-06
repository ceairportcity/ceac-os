# CEAC Compliance Operating Surface — Phase 3 acceptance

Date: 6 October 2026
Status: COMPLETE
Application main: `4179b71ed8757ece726c4282363edaacc8b158b6`
Pull request: #115
Production migration: `20261006121001_113_compliance_operating_surface`

## Accepted outcome

Phase 3 turns the existing Stage 11 Compliance engine and the Phase 2 sanitised attendance evidence into one factual operating surface. An organisation-wide `compliance.manage` holder receives an Overview plus the existing Policies, Requirements, Evidence and Exceptions lifecycle. The Overview distinguishes expected attendance, recorded starts, verified-office starts, recorded presence, verified lateness, approved leave, notices and policy attention. A missing session is displayed as “No session recorded”; it is not an absence or misconduct finding.

Compliance employees remain ordinary members of their recorded unit with their recorded Manager, Work and project access. No Compliance unit, identity, work bypass or executive authority is manufactured.

Office-wide policy instructions require a separate organisation-wide `post_announcement` grant. Migration 113 adds the canonical sensitive capability definition, migrates the two existing explicit legacy publisher assignments, and makes the existing announcement helper use canonical grants. `compliance.manage` alone cannot publish, while Admin and executive authority retain the accepted existing path. Announcement authorship remains the signed-in actor.

Conduct and dress requirements use the ordinary versioned policy and manual evidence workflow. Phase 3 adds no camera feed, automated dress detection, biometric classification, AI judgement, employee score or automatic consequence.

## Verification evidence

| Boundary | Evidence | Result |
|---|---|---|
| Local source | `npm ci`, production dependency audit, build, changed-line and shell checks | PASS; zero production dependency vulnerabilities |
| Candidate CI | Run `37459882464` at `328941116432099dd47984049f7c3f331cbed61c` | PASS |
| Candidate migration replay | Run `37459882456` | PASS |
| Candidate account security | Run `37459882462` | PASS |
| Candidate Quality Gate | Run `37459882570`; complete SQL/authority suite; browser shards 190 + 162 + 171 + 159; role/RLS coordinator | PASS, 682 browser tests |
| Protected merge | PR #115 → `4179b71ed8757ece726c4282363edaacc8b158b6` | PASS |
| Exact-main CI | Run `37461255542` | PASS |
| Exact-main migration replay | Run `37461255582` | PASS |
| Exact-main account security | Run `37461255588` | PASS |
| Exact-main Quality Gate | Run `37461255543`; complete SQL/authority suite and the same 682 browser tests | PASS |
| Production database | Project `efjljhftsesssumtshvp`; migration `20261006121001_113_compliance_operating_surface` | APPLIED / HEALTHY |
| Production deployment | GitHub deployment `6883512877`, environment Production; public alias returned HTTP 200 | SUCCESS |

## Production inspection

The inspection was aggregate and read-only after applying the reviewed migration. No fixture or acceptance record was inserted.

| Record or contract | Observed state |
|---|---:|
| Employee roster | 18 |
| Work sessions | 8 |
| Compliance policy versions | 2 |
| Policy applicability rows | 2 |
| Compliance requirements | 0 |
| Policy acknowledgements | 3 |
| Evidence versions | 0 |
| Exception versions | 0 |
| Announcements | 4 |
| Legacy explicit announcement publishers | 2 |
| Canonical active organisation-wide announcement grants | 2 |
| Sensitive `post_announcement` definitions | 1 |

The live helper definition contains the canonical `post_announcement` check and no `compliance.manage` check. `anon` and `authenticated` cannot execute it; `service_role` can. The two canonical grants are migrations of existing explicit authority, not invented users or new publisher decisions.

The post-DDL advisor review continues to report the previously classified deny-direct-access RLS/no-policy tables and the broader reviewed set of authenticated security-definer RPCs. Migration 113 creates no table or policy and its internal helper is absent from the authenticated-callable set. No broad RLS or function-authority rewrite is justified by this phase.

## Accepted register items

- 19 — ordinary recorded department/unit, Manager, Work and project context retained without manufacturing a Compliance unit;
- 20 — organisation-wide capability remains independent of selected unit;
- 21 — factual Compliance Overview;
- 22 — policy management operating lifecycle;
- 23 — attributable capability-based policy announcements;
- 25 — versioned conduct/dress policy with manual evidence and no automated monitoring;
- 45 — immutable acknowledgement of an applicable policy version.

Items 24 and 28–32 remain outside Phase 3. Item 27 remains unresolved because no session may not be converted into unexplained absence. Item 47 remains broader than this phase because later cases and executive overrides are not designed.

## Remaining evidence and policy boundaries

- Actual invited-user email delivery, password activation and authenticated deployed-role inspection remain unverified. Repository fixture accounts prove technical role/RLS behavior only.
- Draft Monday 12:00 / Tuesday–Friday 10:00 / 17:00 hours remain unapplied policy.
- No final close/grace rule, unexplained-absence definition, disciplinary case route, Pastor override, Payroll consequence, points, awards, rankings, automated dress monitoring or background GPS exists.

## Next phase

Phase 4 — Notification & Work-State Communication is next. It must preserve the separation between unread/information state and actionable work or review state. It must not reopen Phase 3 or silently broaden announcement, Compliance, attendance, HR, Payroll or executive authority.
