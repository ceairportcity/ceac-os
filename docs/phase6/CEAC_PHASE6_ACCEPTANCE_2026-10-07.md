# CEAC Phase 6 — Volunteer, Calendar & Attendance Integrity Acceptance

**Date:** 7 October 2026
**Status:** CANDIDATE / FULL LEVEL-B ACCEPTANCE REQUESTED
**Implementation PR:** #140
**Implementation branch:** `chatgpt/phase6-volunteer-planning-attendance-2026-10-07`
**Binding contract:** `docs/design/phase6/CEAC_PHASE6_VOLUNTEER_CALENDAR_VISUAL_PRODUCT_LOCK_2026-10-07.md`

## Scope implemented

### Phase 6A — Volunteer operating model

- Volunteer remains an engagement classification inside the Staff experience; no fifth CEAC role or panel exists.
- Managers can invite volunteers inside authorised scope and select explicit working patterns.
- Manager Volunteer Profile supports day-to-day working-pattern changes and formal-change recommendations.
- Administration retains formal engagement, compensation, payroll and protected-HR authority.
- Volunteer engagement/status changes are effective-dated, attributable and visible to the volunteer with acknowledgement.
- Active volunteers are excluded from ordinary salary payroll by default.
- A volunteer cannot silently acquire Unit Head authority.

### Phase 6B — Shared personal planning / Calendar Day Workspace

- Existing Calendar family is evolved rather than replaced.
- Month context remains primary; selecting a date opens Schedule / Tasks / Notes.
- Private personal events, tasks, reminders and day notes are owner-only under RLS.
- Unscheduled tasks remain a distinct queue until dated.
- Event / Task / Note use one compact composer family.
- Authoritative meetings, Work, Projects, ministry events and leave remain sourced from their existing records.
- Manager calendar explicitly separates My calendar from authorised Unit calendar.
- Staff/Volunteer, Manager, Administration and Executive calendar routes share the same interaction grammar.
- Phone layout is recomposed and protected against horizontal overflow.

### Phase 6C — Attendance integrity / anti-gaming

- Existing GPS/geofence, start/end and foreground checkpoint evidence remains intact.
- Short-lived front-desk office-code corroboration is optional, rate-limited and bound to the signed-in person's own open office session.
- Trusted office-network corroboration is service-only; browser-provided IP/network claims are not accepted as proof.
- Corroboration history is append-only and presented as additional factual evidence only.
- No corroboration signal creates automatic absence, misconduct, disciplinary action, salary deduction or Payroll consequence.
- Volunteers with explicit no-attendance/not-recorded obligation are excluded from ordinary Compliance attendance monitoring and display "No attendance obligation" rather than employee-style lateness/absence semantics.
- NFC remains unimplemented/reserve-only, as required by the owner lock.

## Phase 7 boundary

Healing Streams / PFCC specialised workspace remains deferred to Phase 7. Phase 6 does not manufacture new organisational authority or a programme department.

## Acceptance still required

Phase 6 is not complete until all of the following are verified on the exact candidate head:

- CI PASS.
- Migration Replay PASS.
- Account Security PASS.
- Quality Gate PASS including the complete SQL/RLS/security contract suite and all four browser shards.
- Phase 6A volunteer desktop/mobile acceptance.
- Phase 6B Calendar desktop/mobile acceptance for the applicable approved reference surfaces.
- Phase 6C attendance-integrity product/authority/privacy acceptance.
- direct rendered comparison against `docs/design/phase6/CEAC_PHASE6_APPROVED_NINE_SURFACE_REFERENCE.webp`;
- no horizontal overflow on required phone surfaces;
- Phase 5 is cleanly merged to protected `main`;
- Phase 6 is reconciled to that accepted `main`, merged through protected-main rules, and exact-main verification passes.


## Nine-surface rendered evidence

The Level-B browser suite now captures the binding reference states individually under `test-artifacts/`:

1. `phase6-reference-01-calendar-day-*.png` — Staff / Volunteer Calendar desktop/day workspace.
2. `phase6-reference-02-day-tasks-*.png` — Day Workspace Tasks.
3. `phase6-reference-03-day-notes-*.png` — Day Workspace Notes.
4. `phase6-reference-04-add-item-composer-*.png` — compact Event / Task / Note composer.
5. `phase6-reference-05-people-volunteers-*.png` — Manager People & Volunteers.
6. `phase6-reference-06-add-volunteer-*.png` — Manager Add Volunteer.
7. `phase6-reference-07-working-pattern-*.png` — Volunteer Working Pattern.
8. `phase6-reference-08-volunteer-profile-*.png` — Manager Volunteer Profile.
9. `phase6-reference-09-mobile-calendar-day.png` — Mobile Calendar Day.

Phase 6C also captures `phase6c-attendance-integrity-staff-mobile.png` for the corroborating-evidence flow.

These screenshots are acceptance evidence only. They do not replace the canonical owner reference; final acceptance still requires the rendered states to preserve the composition and behaviour locked in `CEAC_PHASE6_APPROVED_NINE_SURFACE_REFERENCE.webp`.


## Deliberate preview deployment checkpoint

A `[vercel]` documentation-only checkpoint is used to request a deliberate Phase 6 preview deployment from the repository's existing Git→Vercel integration. This changes no product behavior, authority, schema, security boundary, or acceptance criteria.


## Temporary GitHub continuity verification

Protected `main` remains frozen at `827fbe7391467dd13d6e411527416402a252993c`. Phase 6 was reconciled forward with the current Phase 5 head `e1f80ecc51d24db79e9d85a987871db0f4e59155` through two-parent merge commit `f0ba65783b8f7427c25991f36a8b01914d24f078`. The resulting Phase 6 history is ahead of Phase 5 with no Phase 5 commits left behind; no reset, rebase or force-push was used.

Continuity verification on the reconciled tree confirms:

- the superseded migration `20261007015815_117_privileged_mfa_aal2_enforcement.sql` is absent and the canonical `20261007075418_privileged_mfa_aal2_enforcement.sql` remains present;
- Volunteer remains an engagement classification rather than a fifth application role/panel;
- private personal planning tables and checklist/event extensions remain owner-only under RLS;
- ordinary salary Payroll excludes volunteers by default;
- Phase 6 attendance corroboration writes evidence/audit state only and contains no automatic absence, misconduct, discipline, salary deduction or Payroll consequence path;
- migration 124 removes the earlier redundant attendance draft tables/functions before retaining the approved Phase 6 corroboration model;
- the browser suite contains all nine binding Phase 6 reference screenshot hooks plus the dedicated Phase 6C mobile evidence capture;
- the Phase 6 SQL gate is registered in the repository gate runner;
- high-risk Phase 6 application files and the Phase 6 test harness resolve their repository-local source targets.

Phase 5 product code had already reached a fully green four-workflow checkpoint at `9a635216a90c759a3edaeeb457189630a939b883`. No Phase 5 `src/` application file changed between that checkpoint and the current Phase 5 head; subsequent Phase 5 changes are repository reconciliation, migration-filename parity, acceptance metadata and a baseline test assertion.

This is IMPLEMENTED / CONTINUITY-VERIFIED state, not protected-main acceptance. Exact-head GitHub Actions, generated Phase 6 browser artifacts, protected-main merge and exact-main verification remain pending while GitHub Actions are unavailable for the flagged owner account. Preview deployment is also not recorded as successful: Vercel reported the project deployment-rate limit and this session has no authorised access to the owning Vercel team.
