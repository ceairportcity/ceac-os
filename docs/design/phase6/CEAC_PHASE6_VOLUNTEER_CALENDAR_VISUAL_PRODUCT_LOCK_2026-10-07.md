# CEAC Phase 6 — Volunteer, Calendar & Personal Planning Visual/Product Lock

**Date:** 7 October 2026
**Status:** OWNER-APPROVED, BINDING NEXT-PHASE CONTRACT
**Entry dependency:** Phase 5 Admin Product Redesign acceptance
**Canonical visual reference:** `docs/design/phase6/CEAC_PHASE6_APPROVED_NINE_SURFACE_REFERENCE.webp`
**Reference SHA-256:** `4ebebd2cc72bd4a95eeb077fa1610ecfd65dac04038683b582b3330989bbcf9c`

This contract records the product owner's explicit instruction that the nine-surface visual board is a literal implementation authority, not inspiration.

## Non-negotiable visual acceptance

The delivered product MUST visibly reproduce the approved reference composition and behaviour for surfaces 1–9. A generic CEAC redesign, a monochrome approximation, a replacement layout, or merely reusing the same design language is not acceptance.

The implementation may improve spacing, responsive fit, accessibility and small interaction details only when the result preserves every approved visible concept and is demonstrably equal or better. It may not remove, flatten, relocate or materially simplify an approved surface merely for implementation convenience.

Acceptance requires direct rendered comparison against the approved reference at desktop and mobile sizes.

### The nine required surfaces

1. **Staff / Volunteer Calendar — Desktop Day Workspace**
   - Existing Calendar family is evolved, not replaced.
   - Month calendar remains a strong primary context.
   - Selecting a date opens a premium day workspace with date heading, meaningful summary metrics, and Schedule / Tasks / Notes.
   - Schedule is a real time-based agenda, not a generic list.
   - Meaningful icon and semantic colour differentiation is required. Do not render every event/state in one colour.
   - People/avatar context may appear where it materially improves meeting/event understanding.

2. **Day Workspace — Tasks**
   - Dated tasks and unscheduled tasks are visually distinct.
   - Checklist completion, timing and reminders are visible without clutter.
   - Personal tasks are not silently converted into authoritative Manager-issued Work.
   - Optional links to CEAC Work/Projects preserve the authoritative source.

3. **Day Workspace — Notes**
   - Daily journal, general notes, personal notes and linked meeting notes use distinct icons/semantic surface treatment.
   - Linked meeting notes remain authoritative in the Meeting record and are surfaced, not duplicated.
   - The approved varied-colour/icon treatment is mandatory.

4. **Add Item Composer — Event / Task / Note**
   - One compact composer family adapts by item type.
   - Event, Task and Note retain the approved compact structure.
   - No return to long, burdensome full-page forms where the approved composer is sufficient.

5. **Manager — People & Volunteers**
   - Volunteer management lives inside the Manager People/Team architecture rather than as a random extra dashboard.
   - The approved people directory/table composition, person photos/avatars, classification tabs and filtering are required.
   - Employees, Volunteers and Leads can be intentionally filtered without creating a fifth role panel.

6. **Manager — Add Volunteer**
   - Simple guided Manager-led volunteer invitation/setup flow.
   - Manager is the normal creator/inviter for volunteers within authorised scope.
   - Administration/HR retains formal people-record, compensation and protected-HR authority.

7. **Volunteer Working Pattern**
   - Volunteer attendance is flexible and explicit: no attendance tracking, event-based, specific days or custom schedule as applicable.
   - No employee-style absence/late implication exists when no working pattern requires attendance.
   - Office presence rules apply only where an authorised working pattern/role requires them.

8. **Manager View — Volunteer Profile**
   - Premium person workspace with photo, identity, role, working pattern, reporting line, Work, Calendar, Feedback and appropriate Documents context.
   - Volunteer operational performance belongs primarily to the Manager relationship.
   - Volunteers do not automatically enter ordinary office Compliance-attendance monitoring.
   - Protected HR remains capability-bound.

9. **Mobile — Calendar Day**
   - Mobile is recomposed, not a shrunken desktop grid.
   - The selected day, Schedule / Tasks / Notes and add action remain immediately usable.
   - Approved semantic colour/icon differentiation remains.
   - No horizontal overflow or cramped desktop-table behaviour is acceptable.

## Cross-role calendar rule

The Calendar/Day Workspace concept is a shared CEAC product family and must be available, with role-appropriate data and authority, across:

- Staff;
- Volunteers through the Staff experience;
- Managers;
- Administration/HR;
- Executive;
- Group Pastor.

This does not mean every role sees the same data. It means the interaction grammar and visual quality remain coherent across the product.

Managers must retain a clear distinction between **My calendar** and authorised **Unit calendar** context. Private personal notes and personal to-dos are not exposed to a Manager merely because of the reporting relationship.

## Personal planning model

Calendar is the single time-oriented destination.

A selected date exposes a Day Workspace containing:

- **Schedule** — authoritative meetings, CEAC deadlines, ministry/programme events, approved leave and other role-authorised time context;
- **Tasks** — private personal to-dos/checklists, optionally dated, timed, reminded or linked to authoritative CEAC Work/Projects;
- **Notes** — private day notes/journal plus surfaced linked meeting notes.

Tasks may be dated or unscheduled. Unscheduled tasks stay in an explicit unscheduled queue until dated.

Reminders are normally properties of Events, Tasks or Notes rather than a fourth standalone content system. A lightweight "remind me" action may create a personal task when no other object exists.

Personal Notes and personal Tasks are private by default. Authoritative Work, Meetings and Projects continue to obey their existing RLS/capability boundaries.

## Volunteer operating model — owner decisions locked

- Volunteer is a valid engagement/employment classification already recognised by CEAC.
- No separate Volunteer panel is created; volunteers use the Staff experience.
- Managers normally add/invite volunteers for their authorised unit/team/sub-team.
- Volunteer work, meetings, follow-ups, projects, feedback and outcomes remain attributable to the Manager relationship.
- Volunteers may be Team/Sub-team Leads when explicitly assigned, but that does not automatically create Unit Head, HR, Compliance, Admin or Executive authority.
- HR/Admin maintains the formal people record and protected documentation.
- Volunteers are excluded from ordinary salary payroll by default.
- A Manager may recommend compensation/status change, but HR/Admin formally controls compensation/engagement changes.
- A compensation/employment-status change must be attributable, effective-dated, visible to the volunteer, notify the volunteer and support the applicable agreement/contract/acknowledgement flow.
- A stipend/support arrangement must not silently convert the person into a salaried employee.
- Volunteers may have no office attendance obligation, event-based attendance, specific days or a custom working pattern.
- No configured attendance obligation means CEAC tracks work/responsibilities rather than labelling the volunteer absent/late.
- Volunteer HR records are proportionate; employee-specific statutory/payroll fields are not fabricated or required where they do not apply.
- Manager feedback and work outcomes remain available; volunteers do not automatically enter a future employee composite scoring/appraisal system.

## Phase 6B — attendance-integrity scope

Phase 6 may extend attendance-integrity evidence without creating surveillance or automatic punishment.

Approved direction:

1. preserve existing factual GPS/geofence/start/end/foreground evidence;
2. permit approved office-network corroboration as additional evidence where technically reliable;
3. permit an optional short-lived rotating office/front-desk verification code for stronger presence confirmation when required;
4. keep NFC as reserve-only unless a real operational need is demonstrated.

No single network/IP reading is authoritative proof of presence. No anti-gaming signal may automatically create misconduct, salary deduction or Payroll consequence.

## Deferred to Phase 7

The specialised **Healing Streams / PFCC workspace** moves from Phase 6 to Phase 7.

Binding organisational classification remains unchanged:

- Healing Streams remains a programme/campaign, not a new department;
- it remains associated with PFCC / the recorded responsible leadership context unless formally changed;
- the specialised workspace must not manufacture organisational authority.

## Future native/downloadable app

A downloadable/native packaging discussion is deliberately deferred until the core web workflows, permissions and data contracts are stable. The later programme may package the existing product and add native capabilities such as stronger push notifications, background handling, biometrics and device integration without rewriting the CEAC domain model.

## Acceptance gate

Phase 6 cannot be accepted unless:

- every applicable reference surface 1–9 is rendered and directly compared with the canonical visual reference;
- semantic icon/colour differentiation is visibly present;
- desktop and mobile are both first-class;
- role/RLS/privacy boundaries remain intact;
- Manager and HR volunteer responsibilities behave as locked above;
- private personal planning data is not exposed across reporting relationships;
- no new attendance-integrity signal creates automatic disciplinary or payroll consequences;
- existing accepted CEAC design/security/domain contracts are preserved.

**No compromise rule:** a materially different implementation is a failed visual/product acceptance even if tests are green.
