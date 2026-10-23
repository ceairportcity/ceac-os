# Live audit A5 — leave approval-stage correction

23 October 2026. Baseline: `b92123c91f811592b232e08c1926e30fc1a24af3` (completed A4/date repair). This is the next sequential live-audit fix; account reconciliation remains deferred.

## Verified defect and correction

Administration Overview labelled pending confirmed leave requests as waiting for Administration and offered Approve/Decline. Time & Leave correctly labelled those same pending records as awaiting Manager approval. The inspected deployed server permits Administration final approval only after the request has reached the Manager-approved (`escalated`) state for the five owner-confirmed kinds.

Use one shared presentation helper for the approval-stage wording in Overview and Administration Time & Leave. Overview pending requests show Manager-stage guidance and navigation to the reviewed Time & Leave workspace; Manager-approved confirmed requests retain existing final-decision controls. Custom or missing route evidence defers to Time & Leave rather than inventing a route. The Overview mutation handler independently rejects nonfinal stages and unsupported decisions before making a server request. Server authority remains decisive if the loaded state is stale.

No database function, policy, RLS, role, permission, leave request, balance, employee or account is modified by this fix. The added SQL is a rollback-only regression in the existing registered workforce gate. It directly verifies that Administration cannot approve, decline or manually escalate a pending confirmed annual request; normal Manager-first and Administration-final success checks follow.

## Scope distinction

The Manager-subject escalation text in `LEAVE_RULES_v1.md` is under **Unauthorised absence and consequence review**. This UI correction does not turn that disciplinary-review escalation into a new leave-routing permission. Those independent attendance/consequence authority rules are preserved. A requester's Manager title is not evidence that the request has passed Manager approval.

## Verification ledger

- Actual signed-in production Overview defect reproduced before changes; production request state independently read. No live decision submitted.
- Modern Web Guidance search found no workflow-specific entry; Forms guide reviewed. Semantic existing buttons and visible stage text retained; client guards do not replace server security.
- Local changed-area Node selection: 21/21, exit 0.
- Local full registered source suite: 607/607, exit 0, `npm run verify:source`, Node 24.19.0, `/workspace/scratch/9bb931db4346/a5-source-check.log`.
- Local `npm run build`: exit 0, Node 24.19.0, `/workspace/scratch/9bb931db4346/a5-build.log`.
- `git diff --check`: exit 0. No CSS or design reference changes.
- The old source assertion for the busy latch initially failed when the new stage check shared that same line. The existing latch was preserved as its original independent guard; the new stage guard runs before it. Assertions were not weakened.
- Exact-candidate Node 22 CI, SQL negative probes, affected/required browser checks, deployment and final actual-production Overview/Time & Leave comparison: **PENDING** at this source checkpoint. Record their exact SHA and results in the PR and private audit execution report after completion. No production acceptance is claimed here.

Original A2 working files in the separate source checkout remain untouched. No new secondary leave quantities or identity links are introduced. Continue only this audit finding until its live verification is complete.
