# Onboarding, Access & Presence Foundation

Date: 6 October 2026
Status: IMPLEMENTED ON BRANCH / PROTECTED VERIFICATION PENDING
Branch: `chatgpt/onboarding-access-presence-2026-10-06`
Verified baseline protected main: `76cea2e457b7d624f54ca961ad14bb62ea359ebd`
GitHub is canonical. One active writer; reconcile forward; never force-push/reset newer work.

## Prerequisite
Commit Discovery, Locked Decisions and this plan before application implementation. Read AGENTS.md, final-product decisions/state, Admin/HR, lifecycle, workforce, compliance, capability and policy contracts. Preserve accepted PR #106 department onboarding.

## Contained sequence
1. Activation: explicit intended CEAC app URL, never arbitrary preview origin; verified own-password creation; test redirect from a protected-preview context. Confirm deployed route and Auth allowlist; do not claim email delivery from a unit test.
2. Control Center → People & Access: recompose existing invitation, employment, unit-head, lifecycle and authority surfaces. Add practical new-person/pending/resend/revoke actions. No protected HR duplication.
3. Existing person: separate additive membership/responsibility operation from primary transfer. Retain all other memberships; use audited existing unit-head assignment after membership exists. Catherine-type fixture: one profile, two manager units; switching context retains organisation grants.
4. Manager invitations: ordinary Staff only inside managed active units; server-side enforcement and negative tests.
5. Review: resolve actual server review authority; responsible Manager sees Approve/Return; only assignee submits; upward review remains distinct from self-certification.
6. Action visibility: explicit new/unread/action label, count and timestamp; Manager Needs review count; notification read never mutates review state.
7. Start evidence: fresh valid coordinates, accuracy where available, office geofence context, device/server timestamps; office missing GPS cannot create verified session. Server guard prevents direct-client bypass. No invented office coordinates.
8. End evidence: fresh best-effort location; failure reason recorded; close remains possible. Reuse work_sessions/work_session_events and immutable attendance history.
9. Last activity: expose existing attributable event timestamps where sufficient. No invasive tracking or heavy new subsystem; location and application activity remain separate.

## Architecture and verification
Prefer additive extensions to existing records/RPCs. Current live DB ends at 110; inspect again before numbering a migration. Preserve RLS, capability boundaries, employee lifecycle, append-only corrections, audit, Work Engine, Payroll authority, currency separation, accessibility and protected tests.

Required acceptance: meaningful local build/tests; clean migration replay; Account Security; cumulative SQL gates; authenticated role/browser flows, persistence and responsive checks; exact-head CI/Quality Gate; protected PR merge; exact-main post-merge gates; deployment and authenticated deployed-product verification. Do not weaken assertions to get green. Record external access blockers accurately.

## Explicit deferred boundary
- Final Compliance dashboard, conduct/case/disciplinary engine and scoring.
- Annual award score, league tables, opaque percentages and employee composite scores.
- Monetary deductions, payroll penalties or compliance-to-payroll automation (LEGAL / POLICY REVIEW REQUIRED).
- Pastor override engine.
- Final late-arrival, temporary permission, emergency and medical absence workflows.
- Scheduled pre-close/4 PM GPS workflow; periodic active-app checks beyond this foundation.
- 5 PM/5:30 PM auto-close or grace policy (NEEDS CONFIRMATION).
- Full contract-driven attendance engine beyond foundation.
- Healing Streams/PFCC workspace.
- Google Workspace SSO.
- Advanced volunteer Manager authority pending population audit.
- Continuous background GPS tracking (prohibited direction).

## Completion record
Not complete. No foundation implementation or protected verification is claimed by the continuity commit.
On completion record exact protected main, completed items, remaining deferred questions, discovered architectural issues, next recommended tranche and updated next-chat prompt. The wider onboarding/compliance programme remains open.

## Foundation implementation under review
Migration 111 adds seven authenticated-only, fixed-search-path RPCs, preserves the existing primary-transfer flow, and guards office starts including stale-session recovery. End location is best effort and legacy ends explicitly remain unverified. No periodic tracking is introduced. People & Access composes existing employment, Unit Head and lifecycle pages. Existing capability grants remain independent of unit context.

Local build and seven Node tests pass. Clean replay, cumulative SQL authority tests, responsive authenticated browser tests, protected merge, production migration and deployment are pending; this is not a completion claim. Auth redirect is pinned to the configured public app; dashboard allowlist inspection/email delivery is not yet verified.
