# CEAC Operational Refinement sequence

Date: 6 October 2026
Programme is OPEN; only Phase 2 is authorised for implementation after this continuity lock.
Canonical baseline: protected main `a88877379150c820bc74cce736dbf44bce09eeef`; production migration 111.
Suggested active branch: `chatgpt/attendance-working-patterns-permissions-2026-10-06`.

The adjacent `CEAC_POST_ONBOARDING_MASTER_IMPROVEMENT_REGISTER_2026-10-06.md` is the complete 50-item checklist. This sequence supersedes older conflicting phase directions only for this authorised post-onboarding refinement. Accepted domain/security/design contracts remain protected.

## Phase dependencies

| Phase | Scope | Dependency / entry gate | Current state |
|---|---|---|---|
| 1 | Foundation: onboarding, People & Access, multiple units, scoped invitations, review/action visibility, start/end evidence, last activity | Preserve accepted PRs #106/#111/#112 and migration 111 | Implemented and technical/deployment checks pass; authenticated live role inspection and actual email/password setup remain unverified |
| 2 | Attendance, Working Patterns & Permissions | Commit this lock first; reuse Stage 9 and Work Engine; secure privacy/authority boundaries | NEXT — authorised A–L scope below |
| 3 | Compliance Operating Surface | Phase 2 accepted/merged/deployed; operational data and compliance visibility secure | NEXT — no final dashboard in Phase 2 |
| 4 | Notification & Work-State Communication | Phase 3 acceptance; preserve independent unread and action states | NEXT |
| 5 | Admin Product Redesign | Phase 4 acceptance; literal approved design/reference and functioning controls | NEXT |
| 6 | Volunteer & Special Operating Models | Phase 5 acceptance; audit payroll/attendance/headcount/appraisal/HR/performance populations | NEXT; PFCC special workspace and anti-gaming options DEFERRED |
| 7 | Compliance Cases, Pastor Override & Disciplinary Governance | Phase 6 acceptance; final authority/lifecycle/history confirmed; legal policy review for consequences | DISCUSS BEFORE BUILD; financial consequences LEGAL / POLICY REVIEW |
| 8 | Scoring / Awards / Compliance Points | Phase 7 acceptance and explicitly approved transparent policy; no composite score inferred | DISCUSS BEFORE BUILD |

## Verification and continuation

One active writer. Fetch canonical main/branch before writes; reconcile forward without reset/force-push/revert. Do not recreate accepted work or weaken tests. Commit implementation, replay migrations, run capability/RLS/SQL/security gates and authenticated browser/responsive/persistence acceptance, pass full Quality Gate, normal protected merge, exact-main verification and deployment evidence. Never fabricate production records or claim real email/password setup from fixtures. Document genuine blocked evidence distinctly from technical PASS.

Use factual attendance context; no misconduct finding or automatic Payroll linkage. Manager first-line workflow uses existing explicit Work Engine authority; final disciplinary route remains a future discussion. Medical operational notices must not collect detailed medical information. Per-person schedule differences remain possible. Draft office hours are an opt-in configuration template, never silent production data.

## Phase 2 objective and exact authorised scope


Create a trustworthy operational layer that distinguishes:

EXPECTED ATTENDANCE

from

RECORDED PRESENCE

from

AUTHORISED EXCEPTIONS

from

COMPLIANCE REVIEW

without scoring or automatic punishment.

==================================================
PHASE 2 — IMPLEMENTATION SCOPE
==================================================

A. WORKING PATTERNS

Audit existing Working Pattern architecture before adding anything.

Represent expected work schedule through authoritative working-pattern records.

Current CEAC policy draft:

Monday:
12:00 PM reporting time
5:00 PM normal close

Tuesday–Friday:
10:00 AM reporting time
5:00 PM normal close

Do not assume every employee will always follow this pattern.

Working Pattern must support future per-person/per-contract differences.

Do not use attendance policy to calculate Payroll automatically.

------------------------------------------

B. EXPECTED VS ACTUAL ATTENDANCE

For an employee/day expose facts such as:

Expected start:
10:00 AM

Verified start:
10:13 AM

Start state:
Late against recorded working pattern

But do not automatically mark misconduct.

Preserve:
- advance notice;
- permission;
- leave;
- explanation;
- work-session evidence.

“No session recorded” remains factual wording.

------------------------------------------

C. LATE ARRIVAL NOTICE

Implement a lightweight workflow using existing Request/Decision infrastructure where feasible.

Staff can record:
- expected arrival;
- reason;
- note;
- time submitted.

Normal decision/visibility route must preserve audit history.

Do not invent punitive outcomes.

------------------------------------------

D. TEMPORARY PERMISSION TO LEAVE

Staff request should support:
- reason;
- departure time;
- expected duration;
- expected return time.

Record:
- requester;
- decision;
- decision maker;
- timestamp;
- actual return evidence where available.

Do not treat this as annual leave.

------------------------------------------

E. EMERGENCY ABSENCE

Support an attributable emergency notification/request without forcing normal advance approval where impossible.

Preserve:
- time communicated;
- reason/context;
- authority response;
- audit history.

------------------------------------------

F. MEDICAL ABSENCE NOTIFICATION

Support medical absence state.

Compliance / Manager may see appropriate operational status.

Detailed medical information must remain behind protected HR boundaries.

------------------------------------------

G. LEAVE VISIBILITY

Ensure authorised roles can distinguish:
- working;
- approved leave;
- upcoming approved leave;
- temporary permission;
- late-arrival notice;
- emergency absence;
- no session recorded.

Do not imply absence solely because no work session exists.

------------------------------------------

H. PERIODIC ACTIVE-APP PRESENCE VERIFICATION

Build only if technically reliable with the existing PWA/web model.

Do not create continuous GPS monitoring.

When:
- session is active;
- app is active/foregrounded;
- permission remains available;

CEAC may record a new location verification event.

Store:
- timestamp;
- coordinates;
- accuracy;
- geofence result;
- reason/checkpoint type.

Do not block ordinary work if an intermediate verification fails.

Record failure truthfully.

------------------------------------------

I. PRE-CLOSE PRESENCE CHECK

Derive pre-close time from the person’s expected working pattern.

Do not hardcode “4 PM” generically.

Approximately one hour before expected close:

if app is active and technically possible,
attempt a fresh presence verification.

Record checkpoint type:

pre_close

Do not claim location if no reading is obtained.

------------------------------------------

J. END-OF-DAY FOUNDATION

Do NOT yet implement final automatic 5:00/5:30 closure policy.

However, prepare the architecture so session-close policy can later support:

- scheduled close;
- continue working;
- finished earlier;
- grace period;
- attributable correction.

If required, add only non-consequential structural support.

Do not invent the final grace rule.

------------------------------------------

K. ADMIN / COMPLIANCE ATTENDANCE EVIDENCE

Improve existing attendance/workforce evidence where safe.

Display factual states such as:

- expected today;
- session started;
- verified office start;
- latest verified location;
- last CEAC activity;
- approved leave;
- temporary permission;
- late-arrival notice;
- no session recorded;
- end location not verified.

Do not yet build the complete Compliance dashboard.

------------------------------------------

L. AUDIT / RLS

All new attendance/permission records must preserve:

- actor;
- subject;
- created time;
- decision actor;
- decision time;
- prior state where correction/versioning applies.

Staff sees own records.
Manager sees authorised managed-unit context.
Compliance/Admin access only through approved capability boundaries.
Protected HR remains protected.

==================================================
EXPLICIT PHASE 2 STOP BOUNDARY
==================================================

DO NOT IMPLEMENT YET:

- final Compliance dashboard;
- disciplinary case engine;
- compliance scoring;
- awards scoring;
- salary deduction;
- payroll penalty;
- Pastor override;
- full volunteer policy;
- Healing Streams/PFCC specialised workspace;
- continuous background GPS;
- AI dress-code monitoring;
- employee ranking;
- final 5:00/5:30 auto-close rule unless separately confirmed.

If implementation reaches one of these boundaries:
document it and continue with unaffected Phase 2 work.


## Completion record

Not complete. Record exact protected main, implemented A–L scope, migration versions, tests/gates/deployment, unresolved decisions, architectural findings and Phase 3 entry point only after verification. Mark only genuinely completed register items DONE. The overall programme remains OPEN.

## Phase 2 implementation candidate

Continuity prerequisite committed at `7b2195625ed91cb77090fcf695d93bd7abf0bc41` before any Phase 2 application write. Additive architecture: `docs/architecture/CEAC_ATTENDANCE_PHASE2_CONTRACT_2026-10-06.md`. Candidate migration: `20261006041453_112_attendance_patterns_permissions.sql`. Implementation and local build/unit checks are prepared; complete SQL/RLS, migration replay, role browsers, exact-head gates and deployment remain pending. No production working patterns, notices, sessions or capability grants were invented. No completion claim is authorised by this candidate.
