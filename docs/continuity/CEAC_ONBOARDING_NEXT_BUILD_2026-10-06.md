# Onboarding, Access & Presence Foundation

Date: 6 October 2026
Status: IMPLEMENTED / AUTOMATED VERIFICATION PASS / AUTH REDIRECTS VERIFIED / MERGED / EXACT-MAIN TECHNICAL PASS / LIVE AUTHENTICATION UNVERIFIED
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
PR #111 merged by signed squash at `4ce12ee5d4bd29348b14d0795d5b59e338764d70`. Migration 111 is applied. The exact-main CI #37403093498, Migration Replay #37403093444, Account Security #37403093473 and full Quality Gate #37403093459 all pass. Exact-main production deployment `dpl_AXraHFjsrMFUMG6wMWLf3NYaeQj1` is READY and serves the public app. Live authenticated role acceptance and actual email/password setup remain unverified. The original prerequisite continuity commit preceded implementation.
On completion record exact protected main, completed items, remaining deferred questions, discovered architectural issues, next recommended tranche and updated next-chat prompt. The wider onboarding/compliance programme remains open.

## Foundation implementation under review
Migration 111 adds seven authenticated-only, fixed-search-path RPCs, preserves the existing primary-transfer flow, and guards office starts including stale-session recovery. End location is best effort and legacy ends explicitly remain unverified. No periodic tracking is introduced. People & Access composes existing employment, Unit Head and lifecycle pages. Existing capability grants remain independent of unit context.

Verified implementation head: `7e8ce725eb049b3bc95c6b18b5d1fcdfff7a6d46`. Local build and seven Node tests pass. Exact-head CI #37400328793, Migration Replay #37400328792, Account Security #37400328846 and full Level B Quality Gate #37400328877 pass. The cumulative SQL suite and all 677 authenticated browser tests pass, including phone/laptop People & Access, two Manager headships under one profile, switching/reload persistence and unchanged organisation grants. Vercel commit status is success; this does not prove deployed production acceptance.

The owner confirmed the public Auth URL settings were saved on 6 October 2026. Fresh harmless invalid-token probes now route invitation verification to `https://ceac-os-git.vercel.app/activate` and recovery verification to `https://ceac-os-git.vercel.app/reset-password`, both rendering CEAC without Vercel authentication. The expired-token message is expected for these deliberately invalid probes. No email was sent and no account was created. This resolves the previous redirect release blocker; actual email delivery and personal password setup remain unverified.

Canonical PR head `da7ccbb2e114cd90e5d041df91bb196228017c9b` passed CI #37402358929, Migration Replay #37402358931, Account Security #37402358958 and Quality Gate #37402358930 through the documentation-only path. The application tree is identical to the fully verified implementation head above. Production migration 111 was applied successfully through the Supabase connector; all three new guard triggers are installed. Protected main was still `76cea2e457b7d624f54ca961ad14bb62ea359ebd` before merge.

Next: complete live authenticated role acceptance and actual email/password setup evidence. Actual email delivery and personal password setup remain unverified. Do not fabricate production invitations, people, work or presence to create evidence.
The implementation also preserves the 12px office-evidence text floor, uses the factual heading “Today’s work location evidence”, and updates the affected source-map-js dependency to 1.2.2; the dependency audit passes. Wider deferred policy questions above remain open. After foundation acceptance, the next recommended tranche is to confirm attendance/short-absence and grace-policy decisions before implementing further Compliance workflows.

## Sign-in diagnostic correction
The owner authorised live test-account sign-in, but secure-browser attempts returned the same visible mismatch message. Source inspection found that SignIn.jsx labels every returned Auth error as a password mismatch. The underlying rejection is therefore unconfirmed. Vercel has no project environment overrides, so the app uses the canonical Supabase fallback. Available logs did not establish the cause. A contained correction maps documented Auth codes/statuses to safe messages, catches thrown connection errors and restores the button with finally. No raw error bodies, credentials, account identifiers or tokens are logged or displayed. Tests cover service, network, rate-limit, verification and credential rejection. Do not change passwords, user verification, access grants or Auth policies to manufacture acceptance.
