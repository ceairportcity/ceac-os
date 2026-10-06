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

- Status: **NEXT**
- Implementation phase: 6
- Dependencies: Phase 1 accepted foundations; Phase 5 acceptance before later-phase implementation.
- Canonical architecture area: Employee roster/engagement, Staff/sub-team authority and population contracts.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- No fifth Volunteer panel.
- Volunteers use Staff experience.
- Volunteers may hold sub-team/team-lead authority.
- Do not automatically make volunteers Unit Managers.
- Volunteer work remains attributable.
- Audit Payroll, Attendance, headcount, Appraisal, HR and Performance population rules before final volunteer rollout.

## 6. Healing Streams / PFCC

- Status: **DEFERRED**
- Implementation phase: 6
- Dependencies: Phase 1 accepted foundations; Phase 5 acceptance before later-phase implementation.
- Canonical architecture area: Employee roster/engagement, Staff/sub-team authority and population contracts.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- Healing Streams does not automatically become a new department.
- It remains associated with PFCC / Pastor Rebecca for now.
- Specialised PFCC workspace may be required later.
- DEFERRED.

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

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

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

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

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

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Initial start/end evidence map exists; latest periodic/pre-close evidence needs Phase 2 extension.

- Show today’s verified work-location evidence.
- Show:
  - verified start;
  - last verified location;
  - last CEAC activity;
  - session state.
- Never imply continuous live location unless technically true.

## 13. Working hours / contractual working patterns

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Schedule versions exist but use one clock pair across mapped days. Extend day-specific expected clocks; the 12:00/10:00/17:00 pattern is a draft template, never an automatic production assignment.

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

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- No session.
- Late start.
- Missing GPS.
- Early departure.
- No end verification.
These are evidence states, not final misconduct decisions.

## 17. Short-duration workplace permissions

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- Late arrival notice.
- Temporary permission to leave.
- Emergency absence.
- Medical absence notification.
- Prefer reuse of existing Request/Decision architecture.

## 18. Leave visibility

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Existing leave lifecycle reused; operational visibility must exclude reason/medical detail for Compliance.

- Compliance sees approved/current/upcoming leave necessary for workforce monitoring.
- Protected details remain appropriately restricted.

## 19. Compliance as a CEAC department

- Status: **NEXT**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

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

- Status: **NEXT**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

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

- Status: **NEXT**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Existing versioned policy/acknowledgement/evidence/exception engine exists; operating refinement belongs in Phase 3.

- policies;
- applicability;
- requirements;
- acknowledgements;
- evidence;
- exceptions;
- review.
Reuse existing architecture where possible.

## 23. Compliance announcements

- Status: **NEXT**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

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

- Status: **NEXT**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

- Preserve policy.
- Manual evidence/reporting.
- No automated camera/dress surveillance.

## 26. Lateness policy

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

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
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

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

- Status: **NEXT**
- Implementation phase: 3
- Dependencies: Phase 1 accepted foundations; Phase 2 acceptance before later-phase implementation.
- Canonical architecture area: Stage 11 Compliance policies, requirements, evidence and explicit compliance.manage.
- Current evidence / partial implementation: Acknowledgements already exist; policy operating refinement is Phase 3.

- important policy versions may require explicit acknowledgement.

## 46. Medical privacy

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Collect operational medical absence state only; detailed medical notes/documents stay in protected HR.

- Compliance may see medical absence state.
- detailed medical information remains Protected HR.

## 47. Auditability

- Status: **NEXT**
- Implementation phase: 2
- Dependencies: Phase 1 accepted foundations; Phase 1 acceptance before later-phase implementation; explicit schedule/authority records; no inference from missing sessions.
- Canonical architecture area: Stage 9 Workforce; schedule versions, sessions/events, leave and Request/Decision Work Engine.
- Current evidence / partial implementation: Existing audit is retained; new Phase 2 operations require immutable attributable history.

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

## 49. Anti-gaming reserve options

- Status: **DEFERRED**
- Implementation phase: 6
- Dependencies: Phase 1 accepted foundations; Phase 5 acceptance before later-phase implementation.
- Canonical architecture area: Employee roster/engagement, Staff/sub-team authority and population contracts.
- Current evidence / partial implementation: Required refinement is not accepted as complete; inspect and extend existing contracts before building.

Only if actual abuse appears:
- static office network/IP;
- rotating front-desk code;
- NFC.
Do not add now.

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
