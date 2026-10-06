# Active programme — CEAC Operational Refinement, Post-Onboarding

Continue CEAC OS from the live canonical repository state. GitHub is canonical; use one writer, fetch protected `main` before any write, reconcile forward, and never reset, force-push, revert or overwrite newer work.

Read first:

- `CEAC_POST_ONBOARDING_MASTER_IMPROVEMENT_REGISTER_2026-10-06.md`
- `CEAC_OPERATIONAL_REFINEMENT_SEQUENCE_2026-10-06.md`
- `CEAC_COMPLIANCE_PHASE3_ACCEPTANCE_2026-10-06.md`
- `../architecture/CEAC_COMPLIANCE_PHASE3_CONTRACT_2026-10-06.md`
- repository `AGENTS.md`

## Accepted baseline

Phase 2 — Attendance, Working Patterns & Permissions is complete at protected main `a482ab602bacb511c18436e256dd932526f14fdd`, PR #113 and production migration `20261006062907_112_attendance_patterns_permissions`. Its documentation closure is protected main `97d2b4a7a3220a7764f5eaa3e43c8d31672374b0`.

Phase 3 — Compliance Operating Surface is complete at application main `4179b71ed8757ece726c4282363edaacc8b158b6`, PR #115 and production migration `20261006121001_113_compliance_operating_surface`. Candidate CI `37459882464`, Migration Replay `37459882456`, Account Security `37459882462` and Quality Gate `37459882570` pass. Exact-main CI `37461255542`, Migration Replay `37461255582`, Account Security `37461255588` and Quality Gate `37461255543` pass, including the complete SQL/authority suite and 682 browser tests. Production deployment `6883512877` succeeded and the public app returned HTTP 200.

Production inspection remained factual: 18 employee-roster rows, 8 work sessions, 2 Compliance policy versions, 2 applicability rows, 0 requirements, 3 acknowledgements, 0 evidence versions, 0 exception versions and 4 announcements. Two existing explicit legacy announcement publishers became two canonical organisation-wide `post_announcement` grants. No policy, acknowledgement, evidence, exception, attendance, work-session or announcement fixture was created.

Do not reopen Phase 3. `compliance.manage` is not announcement, attendance-decision, protected-HR, disciplinary, Payroll or executive authority. Office-wide policy instructions require separate organisation-wide `post_announcement`. Missing attendance remains “No session recorded”, not unexplained absence or misconduct. No scoring, consequences, automated dress monitoring or background surveillance exists.

## Next authorised sequence position

Phase 4 — Notification & Work-State Communication is NEXT but not started. Before implementing it, audit the existing notification, announcement-receipt, Work Engine action/review and attention-state contracts and commit a bounded Phase 4 contract. Preserve independent unread/information state and actionable work/review state: reading a notice must not complete, approve, submit or resolve the underlying work.

Use the same completion protocol: explicit contract, contained implementation, local build/tests, clean migration replay if SQL changes, cumulative security/authority gates, authenticated phone/desktop browser acceptance, candidate full Quality Gate, protected PR merge, production migration only when required, exact-main gates, deployment evidence, truthful production inspection and a documentation-only closure. Do not create production fixtures.

## Still unresolved

- Actual invited-user email delivery, password activation and authenticated deployed-role inspection remain unverified. Fixture accounts are not real-user evidence.
- Monday 12:00, Tuesday–Friday 10:00 and 17:00 close remain unapplied policy drafts.
- Final close/grace behavior, idle reconciliation, unexplained-absence definition, Compliance reports/cases, disciplinary routing, Pastor override, Payroll consequences, scoring/awards, volunteer/PFCC policy and anti-gaming options remain at their recorded later gates.

The overall Operational Refinement programme remains OPEN.
