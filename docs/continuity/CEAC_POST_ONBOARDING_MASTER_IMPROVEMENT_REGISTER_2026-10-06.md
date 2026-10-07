# CEAC post-onboarding master improvement register

Date: 6 October 2026
Programme: CEAC Operational Refinement — Post-Onboarding
Canonical source: GitHub. Owner authorisation: supplied execution brief, 6 October 2026.
Baseline protected main: `a88877379150c820bc74cce736dbf44bce09eeef`.

This is the complete 50-item programme checklist. Status vocabulary: DONE, NEXT, DISCUSS BEFORE BUILD, DEFERRED, LEGAL / POLICY REVIEW. DONE identifies an accepted implemented capability or binding constraint; it does not imply the overall programme or unverified real-user activation is complete. NEXT may include partly implemented work. Each item retains the supplied requirements below. Phase 2 starts only after this register and sequence are committed. Existing security, privacy, audit, approved work semantics, currency separation and design contracts remain binding.

Sequence authority: `CEAC_OPERATIONAL_REFINEMENT_SEQUENCE_2026-10-06.md` in this directory. No scoring, punishment, continuous GPS or automatic payroll consequences.

## 1. Staff onboarding and account activation

- Status: **NEXT**
- Implementation phase: 1
- Dependencies: Accepted foundation and existing authority contracts.
- Canonical architecture area: Auth, People & Access, lifecycle and capability architecture; migrations 106/111; PRs #106/#111/#112.
- Current evidence / partial implementation: Invitation/own-password screens and redirects implemented; real email delivery and password setup remain unverified. No shared password.

- Admin can invite ordinary Staff.
- Managers retain limited invitation rights within authorised units.
- Activation must enter CEAC directly and never expose the product owner’s Vercel account/protection flow.
- Each user creates their own password.
- No shared beta password.
- Pending invitation state must be visible.

## 2. Admin People & Access

- Status: **NEXT**
- Implementation phase: 1
- Dependencies: Accepted foundation and existing authority contracts.
- Canonical architecture area: Auth, People & Access, lifecycle and capability architecture; migrations 106/111; PRs #106/#111/#112.
- Current evidence / partial implementation: Core surface, additive responsibilities, resend/revoke and lifecycle links implemented. Later Admin UX refinement remains separate.

- Control Center → People & Access becomes the administrative home for onboarding/access.
- Invite.
- Assign.
- Reassign.
- Manager.
- Team/sub-team.
- Additional responsibility.
- Pending invitation.
- Resend.
- Revoke/cancel where supported.
- Deactivate access.
- Offboarding/access termination.
- Admin Overview must not become a configuration dump.

## 3. One identity, multiple responsibilities

- Status: **DONE**
- Implementation phase: 1
- Dependencies: Accepted foundation and existing authority contracts.
- Canonical architecture area: Auth, People & Access, lifecycle and capability architecture; migrations 106/111; PRs #106/#111/#112.
- Current evidence / partial implementation: Two-headship switching/persistence tested. Do not mutate Catherine’s real identity merely to create evidence.

- One profile/account/email can belong to multiple units.
- Adding a responsibility must not create another account.
- Pastor Catherine must support:
  - Children’s Church Unit Head;
  - Compliance Unit Head;
  under one identity.
- Unit switching must preserve organisation-wide capability grants.

## 4. Department / Manager / team assignment

- Status: **DONE**
- Implementation phase: 1
- Dependencies: Accepted foundation and existing authority contracts.
- Canonical architecture area: Auth, People & Access, lifecycle and capability architecture; migrations 106/111; PRs #106/#111/#112.
- Current evidence / partial implementation: Primary transfer and additive membership are separate audited paths already implemented.

- Administration controls organisational placement.
- Unit.
- Manager.
- Team/sub-team.
- Transfer.
- Additional membership.
- Membership removal/end.

## 5. Volunteers

- Status: **NEXT — OWNER DECISIONS LOCKED**
- Implementation phase: 6
- Dependencies: Phase 1 accepted foundations; Phase 5 acceptance before implementation.
- Canonical architecture area: Employee roster/engagement, Staff/sub-team authority and population contracts; Phase 6 visual/product lock.
- Current evidence / partial implementation: Product-owner operating model and mandatory visual reference locked 7 October 2026 in `docs/design/phase6/CEAC_PHASE6_VOLUNTEER_CALENDAR_VISUAL_PRODUCT_LOCK_2026-10-07.md`.

- No fifth Volunteer panel. Volunteers use the Staff experience.
- Managers normally add/invite volunteers within their authorised organisational scope.
- Volunteer work remains operationally owned through the Manager relationship: Work, projects, meetings, follow-ups, feedback and outcomes.
- Volunteers may hold explicit team/sub-team-lead authority but do not automatically become Unit Managers, HR, Compliance, Admin or Executive users.
- HR/Admin maintains formal people/protected-HR records and controls compensation/engagement-status changes.
- Volunteers are excluded from ordinary salary payroll by default.
- A Manager may recommend a compensation/status change; HR/Admin performs the attributable effective-dated change.
- The volunteer must be notified of a formal status/compensation change, see the changed state and receive/acknowledge the applicable agreement or contract.
- Stipend/support does not silently convert a volunteer into a salaried employee.
- Volunteer working patterns may be: no attendance tracking, event-based, specific days or custom schedule.
- No configured attendance obligation means no employee-style absence/late inference.
- Volunteer HR requirements remain proportionate; do not fabricate employee-only statutory/payroll data.
- Manager feedback and attributable outcomes remain visible; do not silently place volunteers into a future composite employee scoring model.
- Audit Payroll, Attendance, headcount, Appraisal, HR and Performance populations before rollout.
- The approved visual treatment for Manager People & Volunteers, Add Volunteer, Working Pattern and Volunteer Profile is mandatory.

## 6. Healing Streams / PFCC

- Status: **NEXT — MOVED TO PHASE 7**
- Implementation phase: 7
- Dependencies: Phase 1 accepted foundations; Phase 6 acceptance before specialised-workspace implementation.
- Canonical architecture area: Programme/ministry operating model, employee roster/engagement and existing organisational authority.
- Current evidence / partial implementation: Product owner moved the specialised Healing Streams / PFCC workspace from Phase 6 to Phase 7 on 7 October 2026.

- Healing Streams does not automatically become a new department.
- It remains a programme/campaign associated with PFCC / the recorded responsible leadership context for now.
- Phase 7 may implement the specialised PFCC / Healing Streams workspace.
- The specialised workspace must not manufacture department, job-title or system authority.

## 7. Start Work location enforcement

- Status: **DONE**
- Implementation phase: 1
- Dependencies: Accepted foundation and existing authority contracts.
- Canonical architecture area: Auth, People & Access, lifecycle and capability architecture; migrations 106/111; PRs #106/#111/#112.
- Current evidence / partial implementation: Migration 111 enforces office start and recovery; no invented coordinates.

- Location-required office Start Work requires usable location.
- Store:
  - coordinates;
  - accuracy;
  - geofence result;
  - device time;
  - server time.
- Null GPS cannot silently count as verified office presence.

## 8. Periodic presence verification

- Status: **DONE**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Phase 2 records one server-deduplicated hourly attempt while an open session is visible and focused. Automatic collection never prompts for a new location grant, records unavailable/denied evidence factually, supports sessions carried into a new day and never blocks ordinary work. It does not use background or continuous location monitoring.

- Start verification is not enough.
- Add periodic verification while application is active and permission is available.
- No continuous background GPS surveillance.

## 9. Last CEAC activity

- Status: **DONE**
- Implementation phase: 1
- Dependencies: Accepted foundation and existing authority contracts.
- Canonical architecture area: Auth, People & Access, lifecycle and capability architecture; migrations 106/111; PRs #106/#111/#112.
- Current evidence / partial implementation: visible_last_ceac_activity exposes existing attributable event timestamps; additional meaningful events must use server authority.

- Preserve meaningful attributable application activity.
- Keep separate from location.
- Do not equate activity with productivity.

## 10. Pre-closing location verification

- Status: **DONE**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Phase 2 derives the final-hour window from the person's effective daily pattern and validates it on the server. The checkpoint is append-only and labelled `pre_close`; missing permission remains an explicit failed attempt. No generic 4 PM rule or close/grace consequence was added.

- Attempt location approximately one hour before expected workday end where app is active.
- This is intended to detect early departure loopholes.

## 11. End Work location evidence

- Status: **DONE**
- Implementation phase: 1
- Dependencies: Accepted foundation and existing authority contracts.
- Canonical architecture area: Auth, People & Access, lifecycle and capability architecture; migrations 106/111; PRs #106/#111/#112.
- Current evidence / partial implementation: Best-effort endpoint and honest failure states implemented in migration 111.

- Attempt fresh location on End Work.
- Session must still close if location fails.
- Record endpoint verification failure truthfully.

## 12. Admin / Compliance location map

- Status: **DONE**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: The authorised Workforce evidence view shows the latest discrete recorded point, verified start, latest location, last CEAC activity and session state. Its north-up relative plot has no street provider and explicitly makes no live-movement claim. Compliance receives the sanitised organisation read only.

- Show today’s verified work-location evidence.
- Show:
  - verified start;
  - last verified location;
  - last CEAC activity;
  - session state.
- Never imply continuous live location unless technically true.

## 13. Working hours / contractual working patterns

- Status: **DONE**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Phase 2 adds day-specific clocks to immutable effective person schedule versions while preserving legacy common-clock interpretation. Production contains zero pattern assignments after deployment; the 12:00/10:00/17:00 discussion remains an unapplied policy draft.

- Current office policy draft:
  - Monday 12:00 PM reporting;
  - Tuesday–Friday 10:00 AM reporting;
  - current discussed close 5:00 PM.
- Represent through Working Pattern / contract context.
- Do not hardcode generic session logic around one schedule.

## 14. Forgotten/open sessions at closing

- Status: **DISCUSS BEFORE BUILD**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions; explicit owner or legal/policy confirmation before consequential implementation.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Prepare non-consequential structure only; final grace/automatic closing remains unconfirmed.

- Need scheduled-close confirmation.
- Potential choices:
  - End at scheduled close;
  - Continue working;
  - I finished earlier.
- Exact grace/auto-close policy still needs confirmation.

## 15. Idle handling

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- Inactivity does not automatically mean no work.
- Preserve prompt/reconciliation model.
- Avoid false records for people working in other software.

## 16. Attendance evidence ≠ guilt

- Status: **DONE**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Phase 2 presents expected hours, first recorded start, verified office start, session state, leave/notices and verification failures as separate facts. No evidence state creates misconduct, an absence finding, a score, a deduction or a Payroll change.

- No session.
- Late start.
- Missing GPS.
- Early departure.
- No end verification.
These are evidence states, not final misconduct decisions.

## 17. Short-duration workplace permissions

- Status: **DONE**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Phase 2 adds late-arrival, temporary-permission, emergency-absence and medical-absence notices on the existing Request/Decision engine. The notice, manager response and self-reported actual return preserve actor/time/history; self-approval and out-of-scope decisions are rejected.

- Late arrival notice.
- Temporary permission to leave.
- Emergency absence.
- Medical absence notification.
- Prefer reuse of existing Request/Decision architecture.

## 18. Leave visibility

- Status: **DONE**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Phase 2 exposes approved current and upcoming leave dates/status in the authorised roster evidence read. Compliance does not receive leave categories, reasons or protected medical detail, and the existing leave lifecycle remains unchanged.

- Compliance sees approved/current/upcoming leave necessary for workforce monitoring.
- Protected details remain appropriately restricted.

## 19. Compliance as a CEAC department

- Status: **DONE**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Phase 3 keeps each Compliance employee in the ordinary recorded organisation structure: recorded unit, recorded Manager, existing Work and existing team/project memberships. Organisation-wide `compliance.manage` is an independent grant and does not manufacture a Compliance unit, move a person, or bypass Work/Project RLS.

- Own unit.
- Own Manager.
- Own work.
- Own team/projects where relevant.

## 20. Compliance as organisation-wide capability

- Status: **DONE**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Existing organisation capability grants persist independently of selected unit. No implicit grant from job title.

- Organisation-level compliance authority persists independently of selected unit.

## 21. Compliance-specific Overview

- Status: **DONE**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Phase 3 adds the organisation-wide Compliance Overview from the sanitised `attendance_day_evidence(date)` read plus existing policy/evidence/exception data. It separates expected hours, recorded/verified starts, presence, factual lateness, approved leave, notices and policy attention. “No session recorded” remains a fact, not unexplained absence or misconduct. Work/project access stays behind ordinary RLS, and disciplinary escalation remains outside this phase.

Future overview should include:
- expected today;
- verified starts;
- presence;
- lateness;
- approved leave;
- upcoming leave;
- permissions;
- unexplained exceptions;
- relevant work/project delays;
- policy attention;
- escalations.

## 22. Compliance policy management

- Status: **DONE**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Phase 3 accepts and exposes the existing Stage 11 versioned policy, applicability, requirement, acknowledgement, evidence-review and exception-decision lifecycle as the operating surface. Successor versions preserve history; no silent overwrite or score was added.

- policies;
- applicability;
- requirements;
- acknowledgements;
- evidence;
- exceptions;
- review.
Reuse existing architecture where possible.

## 23. Compliance announcements

- Status: **DONE**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Phase 3 adds the canonical sensitive `post_announcement` capability, migrates the two existing explicit legacy publisher assignments, and makes the policy-instruction action depend on an organisation-wide canonical grant. `compliance.manage` alone cannot publish. Existing announcement draft/publish/close/receipt lifecycle and the real `auth.uid()` author are preserved.

- authorised office-wide compliance/policy instructions.
- capability-based, not Admin impersonation.

## 24. Compliance reporting / escalation

- Status: **NEXT**
- Implementation phase: 7
- Dependencies: Phase 1 accepted foundations; Phase 6 acceptance before later-phase implementation.
- Canonical architecture area: Lifecycle, protected HR, capability authority and future attributable decision architecture.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- receive reports;
- document;
- review;
- escalate.
Final disciplinary case engine still requires design.

## 25. Dress code / professional conduct

- Status: **DONE**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Phase 3 represents conduct requirements as ordinary versioned policies with optional manual evidence and reviewed exceptions. It adds no camera feed, automated dress detection, biometric classification, AI judgement or misconduct inference.

- Preserve policy.
- Manual evidence/reporting.
- No automated camera/dress surveillance.

## 26. Lateness policy

- Status: **DONE**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Phase 2 compares the effective expected start with a server work-session start backed by inside-office start evidence. Prior notice, explanation and decision context remain visible and attributable. An unverified start is not labelled verified late, and no automatic punishment exists.

- compare expected start with verified start;
- preserve prior notice;
- preserve explanation;
- preserve approval/context;
- do not auto-punish based solely on timestamp.

## 27. Absence policy

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Phase 2 now distinguishes no session, approved leave and attributable emergency/medical notices without treating a missing session as absence. The final definition and decision route for an unexplained absence remain unresolved, so this item stays NEXT.

- distinguish:
  - no session;
  - authorised absence;
  - leave;
  - emergency;
  - unexplained absence.
- no automatic conclusion from missing session.

## 28. Manager / Compliance / Admin authority route

- Status: **DISCUSS BEFORE BUILD**
- Implementation phase: 7
- Dependencies: Phase 1 accepted foundations; Phase 6 acceptance before later-phase implementation; explicit owner or legal/policy confirmation before consequential implementation.
- Canonical architecture area: Lifecycle, protected HR, capability authority and future attributable decision architecture.
- Current evidence / partial implementation: Recommended routing is not a blanket authority approval. Phase 2 uses existing managed-unit Request/Decision authority; final disciplinary route requires confirmation.

Needs final confirmation.
Current recommended model:
- Manager = first line;
- Compliance = monitor/review/escalate;
- Admin/HR = employment administration;
- Pastor = final executive intervention.

## 29. Pastor Executive Override

- Status: **DISCUSS BEFORE BUILD**
- Implementation phase: 7
- Dependencies: Phase 1 accepted foundations; Phase 6 acceptance before later-phase implementation; explicit owner or legal/policy confirmation before consequential implementation.
- Canonical architecture area: Lifecycle, protected HR, capability authority and future attributable decision architecture.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- future explicit override;
- preserve original decision;
- new decision;
- reason;
- actor;
- timestamp.
- no silent overwrite.

## 30. Monetary deductions / disciplinary consequences

- Status: **LEGAL / POLICY REVIEW**
- Implementation phase: 7
- Dependencies: Phase 1 accepted foundations; Phase 6 acceptance before later-phase implementation; explicit owner or legal/policy confirmation before consequential implementation.
- Canonical architecture area: Lifecycle, protected HR, capability authority and future attributable decision architecture.
- Current evidence / partial implementation: No automatic attendance or compliance Payroll consequence.

LEGAL / POLICY REVIEW.
Do not automate attendance/compliance penalties into Payroll.

## 31. Compliance points

- Status: **DISCUSS BEFORE BUILD**
- Implementation phase: 8
- Dependencies: Phase 1 accepted foundations; Phase 7 acceptance before later-phase implementation; explicit owner or legal/policy confirmation before consequential implementation.
- Canonical architecture area: Performance evidence; scoring is unapproved and cannot be inferred.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

Future model.
Do not implement until policy is fully defined.

## 32. Annual awards / scoring

- Status: **DISCUSS BEFORE BUILD**
- Implementation phase: 8
- Dependencies: Phase 1 accepted foundations; Phase 7 acceptance before later-phase implementation; explicit owner or legal/policy confirmation before consequential implementation.
- Canonical architecture area: Performance evidence; scoring is unapproved and cannot be inferred.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

Possible inputs:
- task completion;
- punctuality;
- compliance;
- Manager appraisal.
Do not build one composite employee score yet.

## 33. Manager appraisal

- Status: **DISCUSS BEFORE BUILD**
- Implementation phase: 8
- Dependencies: Phase 1 accepted foundations; Phase 7 acceptance before later-phase implementation; explicit owner or legal/policy confirmation before consequential implementation.
- Canonical architecture area: Performance evidence; scoring is unapproved and cannot be inferred.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

Potential future evidence source.
Do not silently combine with attendance/work counts.

## 34. Notifications redesign

- Status: **NEXT**
- Implementation phase: 4
- Dependencies: Phase 1 accepted foundations; Phase 3 acceptance before later-phase implementation.
- Canonical architecture area: Inbox, notifications, Work Engine and approved operational-clarity design.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- new work must be obvious;
- returned work must be obvious;
- review required must be obvious;
- new instructions/messages/policy updates must be obvious.

## 35. State colour / visual language

- Status: **DISCUSS BEFORE BUILD**
- Implementation phase: 4
- Dependencies: Phase 1 accepted foundations; Phase 3 acceptance before later-phase implementation; explicit owner or legal/policy confirmation before consequential implementation.
- Canonical architecture area: Inbox, notifications, Work Engine and approved operational-clarity design.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

Proposed semantic families:
- Blue = new/information;
- Amber = action/review;
- Red = urgent/exception/overdue;
- Green = approved/completed;
- Purple = policy/compliance/announcement;
- Grey = read/informational.
Do not rely on colour alone.

## 36. Unread state versus action state

- Status: **DONE**
- Implementation phase: 4
- Dependencies: Phase 1 accepted foundations; Phase 3 acceptance before later-phase implementation.
- Canonical architecture area: Inbox, notifications, Work Engine and approved operational-clarity design.
- Current evidence / partial implementation: Opening a notification does not decide work; preserve separate read and action state.

- opening notification ≠ reviewing work;
- read/unread and outstanding/completed are separate.

## 37. Manager Needs Review

- Status: **DONE**
- Implementation phase: 4
- Dependencies: Phase 1 accepted foundations; Phase 3 acceptance before later-phase implementation.
- Canonical architecture area: Inbox, notifications, Work Engine and approved operational-clarity design.
- Current evidence / partial implementation: Initial count/queue exists; broader communication refinement remains Phase 4.

- obvious count;
- obvious queue;
- no hunting through ordinary work lists.

## 38. Frank / Nana review routing

- Status: **DONE**
- Implementation phase: 1
- Dependencies: Accepted foundation and existing authority contracts.
- Canonical architecture area: Auth, People & Access, lifecycle and capability architecture; migrations 106/111; PRs #106/#111/#112.
- Current evidence / partial implementation: Initial responsible-reviewer and upward-review correction implemented; live authenticated evidence remains open.

- Nana submits Frank-assigned work;
- Frank sees Approve / Return for correction;
- Frank must not see Send for review on work where he is reviewer.

## 39. Explicit review ownership

- Status: **NEXT**
- Implementation phase: 4
- Dependencies: Phase 1 accepted foundations; Phase 3 acceptance before later-phase implementation.
- Canonical architecture area: Inbox, notifications, Work Engine and approved operational-clarity design.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- review authority should derive from work origin/review route where possible.
- Manager can be reviewer for one item and assignee for another.

## 40. Private work / agreed work

- Status: **DONE**
- Implementation phase: 1
- Dependencies: Accepted foundation and existing authority contracts.
- Canonical architecture area: Auth, People & Access, lifecycle and capability architecture; migrations 106/111; PRs #106/#111/#112.
- Current evidence / partial implementation: Accepted approved work models are retained.

- preserve these models.
- product owner explicitly approves them.

## 41. Self-certification versus upward review

- Status: **DONE**
- Implementation phase: 1
- Dependencies: Accepted foundation and existing authority contracts.
- Canonical architecture area: Auth, People & Access, lifecycle and capability architecture; migrations 106/111; PRs #106/#111/#112.
- Current evidence / partial implementation: Existing self-certification/upward review boundaries remain protected.

- Manager-owned/private work;
- Manager-assigned-upward work;
- agreed work;
- subordinate submissions
must not collapse into one generic action.

## 42. Admin UI deep redesign

- Status: **NEXT**
- Implementation phase: 5
- Dependencies: Phase 1 accepted foundations; Phase 4 acceptance before later-phase implementation.
- Canonical architecture area: Administration panels and approved operational-clarity/final-product references.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- current Admin panel still needs major UX/functionality improvement.
- several controls were confusing/non-functional during real onboarding.

## 43. Admin Overview

- Status: **NEXT**
- Implementation phase: 5
- Dependencies: Phase 1 accepted foundations; Phase 4 acceptance before later-phase implementation.
- Canonical architecture area: Administration panels and approved operational-clarity/final-product references.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- operational attention surface;
- not full organisation configuration.

## 44. Control Center

- Status: **NEXT**
- Implementation phase: 5
- Dependencies: Phase 1 accepted foundations; Phase 4 acceptance before later-phase implementation.
- Canonical architecture area: Administration panels and approved operational-clarity/final-product references.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- must become the real configuration/control surface.

## 45. Policy acknowledgement

- Status: **DONE**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Phase 3 accepts the existing self-bound, immutable acknowledgement of an applicable policy version and exposes outstanding acknowledgement attention without converting it into a score or automatic consequence.

- important policy versions may require explicit acknowledgement.

## 46. Medical privacy

- Status: **DONE**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Medical attendance notices accept dates and operational status only; UI and server reject reason/note narratives. Compliance sees sanitised status, raw notice tables remain closed through a Compliance grant alone, and detailed medical information stays in Protected HR.

- Compliance may see medical absence state.
- detailed medical information remains Protected HR.

## 47. Auditability

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Phase 2 pattern versions, notices, responses, returns and checkpoints preserve actors/timestamps and immutable or successor history; response audit records prior/new state. The broader item stays NEXT because later policy decisions, cases and future executive overrides are not yet built.

Preserve actors/timestamps/history for:
- reassignment;
- access;
- policy decisions;
- permissions;
- attendance corrections;
- compliance actions;
- work reviews;
- deactivations;
- future executive overrides.

## 48. Offline / PWA constraints

- Status: **DONE**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Only foreground, best-effort checks; suspended/offline PWA cannot guarantee GPS capture.

- do not claim background GPS reliability a browser/PWA cannot guarantee.
- represent only verified evidence.

## 49. Attendance-integrity / anti-gaming options

- Status: **NEXT — PHASE 6**
- Implementation phase: 6
- Dependencies: Phase 1/2 factual attendance foundations; Phase 5 acceptance; preserve no-punishment/no-automatic-Payroll boundary.
- Canonical architecture area: Workforce presence evidence, working-pattern applicability and Phase 6 visual/product lock.
- Current evidence / partial implementation: Existing discrete GPS/geofence/start/end/foreground evidence is accepted. Product owner moved attendance-integrity discussion into Phase 6 on 7 October 2026.

Phase 6 direction:
- preserve existing factual GPS/geofence evidence;
- allow approved office-network/IP corroboration as an additional signal where technically reliable;
- allow an optional short-lived rotating office/front-desk code for stronger presence confirmation where required;
- keep NFC reserve-only unless real operational need is demonstrated;
- do not treat one IP/network observation as authoritative proof of presence;
- do not create continuous background surveillance;
- no integrity signal automatically creates misconduct, deduction or Payroll consequence.

Exact trigger/frequency details for network/code use may be finalised during Phase 6 implementation without weakening these boundaries.

## 50. Overall product communication agency

- Status: **NEXT**
- Implementation phase: 4
- Dependencies: Phase 1 accepted foundations; Phase 3 acceptance before later-phase implementation.
- Canonical architecture area: Inbox, notifications, Work Engine and approved operational-clarity design.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- new;
- changed;
- urgent;
- waiting;
- review;
- completed;
- policy;
- exception;
must be understandable at a glance.
