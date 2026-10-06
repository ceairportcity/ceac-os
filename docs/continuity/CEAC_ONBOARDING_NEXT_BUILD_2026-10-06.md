# Onboarding, Access & Presence Foundation

Date: 6 October 2026
Status: IMPLEMENTED / AUTOMATED VERIFICATION PASS / RELEASE BLOCKED ON AUTH CONFIGURATION
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
Not complete. PR #111 is open; the foundation has not been merged or applied to production. The original prerequisite continuity commit preceded implementation.
On completion record exact protected main, completed items, remaining deferred questions, discovered architectural issues, next recommended tranche and updated next-chat prompt. The wider onboarding/compliance programme remains open.

## Foundation implementation under review
Migration 111 adds seven authenticated-only, fixed-search-path RPCs, preserves the existing primary-transfer flow, and guards office starts including stale-session recovery. End location is best effort and legacy ends explicitly remain unverified. No periodic tracking is introduced. People & Access composes existing employment, Unit Head and lifecycle pages. Existing capability grants remain independent of unit context.

Verified implementation head: `7e8ce725eb049b3bc95c6b18b5d1fcdfff7a6d46`. Local build and seven Node tests pass. Exact-head CI #37400328793, Migration Replay #37400328792, Account Security #37400328846 and full Level B Quality Gate #37400328877 pass. The cumulative SQL suite and all 677 authenticated browser tests pass, including phone/laptop People & Access, two Manager headships under one profile, switching/reload persistence and unchanged organisation grants. Vercel commit status is success; this does not prove deployed production acceptance.

Production remains at migration 110, with protected main `76cea2e457b7d624f54ca961ad14bb62ea359ebd` (reconciled again after verification). Do not apply migration 111 or merge while the activation release blocker remains. A harmless invalid-token Auth probe showed that both intended public `/activate` and `/reset-password` redirects fall back to the Vercel-protected deployment hostname. No email was sent and no account was created. Supabase dashboard sign-in remains unverified; the secure credential request was declined. Respect that choice and resume authentication only when the owner asks. Browser credentials must be supplied through the secure authentication handoff.

Next: finish dashboard authentication; set the public Site URL to `https://ceac-os-git.vercel.app` and preserve existing approved redirects while ensuring the exact `/activate` and `/reset-password` routes are accepted. Verify persisted settings and actual redirect routing. Then reconcile exact-head gates and live migrations, apply the reviewed migration, use a normal protected PR merge, verify exact-main gates/deployment and authenticated deployed roles, and record final completion. Actual email delivery and personal password setup remain unverified. Do not fabricate production invitations, people, work or presence to create evidence.

The implementation also preserves the 12px office-evidence text floor, uses the factual heading “Today’s work location evidence”, and updates the affected source-map-js dependency to 1.2.2; the dependency audit passes. Wider deferred policy questions above remain open. After foundation acceptance, the next recommended tranche is to confirm attendance/short-absence and grace-policy decisions before implementing further Compliance workflows.
