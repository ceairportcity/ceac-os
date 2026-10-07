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
