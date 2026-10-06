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

Technical Support should be a service-operations/security role, not a hidden super-admin. The product must be value-first and plain-language. CEAC does not need an enterprise ITSM clone.

### Minimum valuable Technical Support v1

The panel answers six simple questions:

1. **What needs me now?**
   - urgent system problem;
   - failed invite or sign-in;
   - backup/recovery problem;
   - security warning requiring action;
   - unresolved support request.
   This is the home queue and should be the first screen.

2. **Is the system working?**
   - CEAC app available;
   - sign-in working;
   - database/storage working;
   - important scheduled jobs working;
   - integrations working;
   - current release healthy.
   Use plain states: Working / Needs attention / Down. Technical details stay behind an optional disclosure.

3. **Who can get in?**
   - active users;
   - invited but not activated;
   - deactivated/leavers;
   - privileged users;
   - expiring temporary access;
   - access changes awaiting approval.
   Technical Support diagnoses and executes approved access operations but cannot grant itself HR, payroll or executive authority.

4. **What is broken for people?**
   - support requests by department/person;
   - affected service;
   - urgency;
   - owner;
   - status;
   - resolution.
   Show recurring technical problems by department without creating employee performance scores.

5. **Are we protected and can we recover?**
   - important security warnings;
   - unusual sign-in/access failures;
   - backup status;
   - last successful restore test;
   - unresolved high-risk issue;
   - secrets/keys due for rotation where applicable.
   Translate technical findings into plain language and a next action.

6. **What changed?**
   - latest app release;
   - database change;
   - access/permission change;
   - configuration/integration change;
   - failed change or rollback.
   Every significant change should say who changed it, when, whether it succeeded and what it affected.

### Explanation pattern

Every alert/problem defaults to four lines:
- **What happened**
- **Who/what is affected**
- **What to do next**
- **Approval needed from** (only when applicable)

Technical terms such as RLS, RPC, migration drift, AAL2 and SECURITY DEFINER belong under **Technical details**, not in the default operating view.

### Useful but secondary

Keep available, but do not let these dominate v1:
- service/integration inventory and ownership;
- runbooks / known fixes;
- recovery procedures;
- support contacts;
- device/infrastructure inventory only when CEAC actually begins managing enough devices/services for it to add value;
- trend reporting on recurring technical faults and response time.

### Department view

For each CEAC unit, Technical Support may see technical-operational context only:
- open technical issues;
- account/invitation failures;
- system features/integrations failing for that unit;
- affected users;
- current incident/status;
- resolved issue history.

Do not expose that unit's confidential HR/payroll/content merely because Technical Support is troubleshooting it.

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


## Build sequencing decision — 6 October 2026

Security hardening does **not** wait for the remaining product phases to finish.

Treat security as a cross-cutting programme running beside the phase roadmap, with strict collision control.

### Start now

These can proceed immediately because they protect the existing system and are largely independent of Phase 4+ feature UI work:

- S2 SECURITY DEFINER inventory, semantic review and exposure reduction;
- S6 RLS/query/index hardening;
- repository/supply-chain hardening that does not destabilise application dependencies;
- account-lifecycle authority tests;
- backup/recovery assessment and runbook work;
- data classification/access-matrix work;
- MFA/AAL2 technical readiness that does not force final human enrollment;
- password/invitation/reset hardening tests;
- Technical Support authority/data contract and backend health model;
- security regression tests and advisor baselines.

### Build carefully in parallel

Technical Support backend contracts, support-case model, health/alert model and permission boundaries may be built now when they touch isolated files/migrations and pass the normal gates.

Do not overwrite or compete with active phase work. Before every write, reconcile the live protected-main HEAD and any active canonical implementation PR.

### Wait for the current product-phase surface before final UI integration

The full Technical Support panel UI should be integrated only after the currently active phase work that touches shared shell/navigation/notification surfaces is accepted, or on a reconciled branch that incorporates that accepted work.

Reason: Technical Support itself depends on notifications/work-state communication and shares navigation/auth/access primitives. Building its final UI against a stale shell would create avoidable conflicts and duplicate work.

### Do not wait

Do not delay security defects merely because later feature phases remain. A discovered authorization, data-exposure, backup, authentication or privilege problem takes precedence over ordinary feature expansion.

### Merge discipline

Prefer small security tranches:
1. document/decision lock;
2. security inventory/tests;
3. low-risk database/RLS hardening;
4. account/auth hardening;
5. recovery/governance controls;
6. Technical Support backend;
7. Technical Support UI after shared product surfaces settle;
8. final security acceptance.

Each tranche must reconcile forward from live main and pass the protected-main gates before the next high-risk tranche.
