# CEAC Security Hardening & Technical Support Programme

Date: 6 October 2026
Status: ACTIVE
Baseline: protected main `3feb68e9fa46da9888a7dfa9cef942b1f6133f7c`
Owner decisions: `docs/security/CEAC_OWNER_SECURITY_DECISIONS_2026-10-06.md`

## Purpose

Close current security, resilience, privacy, operational and support risks structurally before broad production onboarding. This programme is evidence-driven. A warning is not automatically a defect; an accepted risk is not silently ignored.

## Non-negotiable rules

- GitHub remains canonical.
- No weakening of RLS, capability, audit or test gates to get green.
- No force-push/reset/revert of newer accepted work.
- Security changes use least privilege and preserve actor attribution.
- Protected HR/payroll data is never exposed merely to silence an advisor.
- Privilege is capability-based, not inferred from title.
- Historical records survive account/unit transitions.
- Attendance evidence does not automatically become guilt, discipline or pay consequence.
- Production secrets never enter client code or repository history.
- Every security-relevant migration receives clean replay, SQL/authority tests, role/RLS acceptance and exact-main verification.

## Gate S1 — Privileged identity & MFA readiness

Build now:
- privileged-capability inventory;
- AAL2/MFA guard for sensitive operations;
- negative tests for password-only privileged sessions;
- session/recovery controls;
- privileged-role changes invalidate access as appropriate;
- go-live enrollment checklist.

Defer only:
- final human enrollment on real privileged accounts until onboarding/go-live.

Exit evidence:
- tests prove AAL2 gate;
- no test-account workflow is broken during active build;
- final production enrollment remains an explicit unresolved go-live gate.

## Gate S2 — SECURITY DEFINER semantic review

Current live baseline:
- 239 public SECURITY DEFINER functions;
- 135 authenticated-callable;
- 0 anonymous-callable;
- fixed configuration/search-path posture currently passes live inspection.

Work:
1. Generate canonical inventory of all authenticated-callable definer RPCs.
2. Classify: browser API / safe helper / internal helper / obsolete.
3. Verify every browser-facing function:
   - derives actor from `auth.uid()`;
   - server-checks capability and object scope;
   - rejects self-escalation / arbitrary-profile mutation;
   - preserves separation of duties;
   - records actor/time/reason for consequential actions.
4. Revoke authenticated EXECUTE from internal-only helpers.
5. Remove obsolete exposed RPCs only when proven unused and dependency-safe.
6. Add an allowlisted security ceiling test so future exposure cannot grow silently.

Exit:
- reviewed inventory committed;
- live callable count reconciled to intentional surface;
- negative cross-role/object tests pass;
- Security Advisor findings classified.

## Gate S3 — Onboarding & account lifecycle

- Resolve Technical Support organisation model before mutating Gabriel production placement.
- Implement/test joiner, additional responsibility, transfer, manager change, delegation, deactivate, departure.
- Preserve work/history while revoking active access.
- Validate real invitation flow through Administration once Technical Support model is accepted.

## Gate S4 — Repository & software supply chain

- Owner-approved target: private repository.
- Keep protected main and required checks.
- Inspect collaborators/app permissions.
- Secret-scan repository/history where available.
- Review Dependabot PRs by risk and compatibility; no automatic major-version upgrades.
- Pin/least-privilege GitHub Actions permissions where practical.
- Close clearly superseded provisional PRs after evidence confirms no unique accepted work remains.

## Gate S5 — Password / auth hardening

Prepare now:
- safe auth error messages;
- rate-limit/retry handling;
- password-reset lifecycle tests;
- invitation token/revocation/expiry tests;
- session invalidation tests;
- paid-plan readiness checklist for leaked-password protection.

Activate paid-only controls when CEAC upgrades.

## Gate S6 — RLS / database performance hardening

Priorities:
1. security-sensitive/high-frequency foreign keys;
2. RLS init-plan rewrites where semantics remain identical;
3. duplicate permissive policy consolidation where safe;
4. no-primary-key review table-by-table;
5. unused-index review after production workload evidence.

Never:
- open `hr_private` direct browser access merely to clear warnings;
- add hundreds of indexes without workload/selectivity analysis;
- rewrite accepted authority semantics solely for advisor cleanliness.

Exit:
- before/after advisor report;
- query-plan evidence on critical flows;
- migration replay and role/RLS gates green.

## Gate S7 — Recovery, privacy & data governance

Technical:
- documented backup scope;
- database restore test to safe non-production target;
- storage/file recovery plan;
- migration recovery runbook;
- recovery evidence and responsible owner;
- operational runbook for account reset, secret rotation, deployment recovery and incident handling.

Governance:
- CEAC DPC registration is currently unresolved/not registered;
- formal privacy notice absent;
- processing/handover agreement absent;
- Technical Support intended as post-handover technical owner.

Create:
- data inventory/classification;
- role/data-access matrix;
- proposed retention schedule;
- privacy notice draft;
- handover/security-operations runbook.

No legal claims are invented; unresolved compliance items remain explicit blockers/risks.

## Gate S8 — Attendance / discipline / payroll consequence safety

Implement confirmed non-consequential schedule evidence:
- default Monday 12:00–17:00;
- Tuesday–Friday 10:00–17:00;
- effective-dated person/unit/contract exceptions;
- grace/pattern facts;
- correction and exception paths;
- Group Pastor exception authority.

Do not implement automatic:
- misconduct;
- disciplinary outcome;
- salary deduction;
- payroll penalty.

Those require later approved policy/legal rules.

## Technical Support operating surface

Technical Support should be a service-operations/security role, not a hidden super-admin.

Default dashboard domains:
1. Service health — app, database, auth, jobs, integrations, deployment.
2. Security operations — auth anomalies, privilege changes, rejected privileged calls, security advisories.
3. Identity operations — invitations, activation failures, dormant/deactivated accounts, MFA readiness (status only).
4. Access governance — capability changes, unit/manager assignments, delegation expiry, quarterly access review.
5. Reliability — backup status, restore-test age, migration drift, job failures, storage/integration health.
6. Incident management — incidents, severity, affected service/unit, owner, timeline, resolution/post-incident review.
7. Change management — deployments, migrations, feature flags/config changes, failed changes, rollback evidence.
8. Asset/service inventory — integrations, service accounts, environments, owners, expiry/rotation dates.
9. Department support — open technical issues by unit, recurring problems, response/resolution times; no employee performance scoring.
10. Knowledge/runbooks — known issues, recovery steps, handover docs, vendor/support contacts.

Restricted by default:
- salary figures/content;
- medical details;
- private HR documents;
- confidential employee narrative;
- executive private content.

Technical Support sees whether a protected subsystem is healthy and whether access failed; it does not automatically see the protected payload.

## Next implementation order

1. Commit owner decisions and this programme.
2. Complete S2 inventory + semantic audit.
3. Complete S6 advisor-driven hardening tranche.
4. Resolve Technical Support organisation model and build operating surface/authority contract.
5. Prepare S1/S5 final-production controls without breaking test phase.
6. Implement S7 recovery/governance documentation and technical checks.
7. Carry S8 confirmed schedule facts; keep consequences disabled.
8. Full cross-role/security regression and production acceptance.
