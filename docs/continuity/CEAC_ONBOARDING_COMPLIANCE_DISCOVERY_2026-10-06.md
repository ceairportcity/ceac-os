# CEAC onboarding and compliance discovery — 6 October 2026

Source: product-owner-supplied continuation and meeting discussion, 6 October 2026.
This document preserves the supplied operational findings, examples and policy draft. It is not an approved disciplinary policy. Existing accepted architecture and security remain protected.

## Classification index

| Topic | Classification | Implementation boundary |
|---|---|---|
| A Identity, invitations and onboarding | LOCKED | One account; multiple memberships; secure activation; Admin access surface; scoped Manager invitations |
| B Volunteer Staff experience | LOCKED | Engagement type remains separate from authority; no fifth panel |
| B Exceptional volunteer project/Manager authority | NEEDS CONFIRMATION | Audit payroll, attendance, headcount, appraisal and reporting populations first |
| C Location consent and evidence semantics | LOCKED | No continuous surveillance; location/activity/output separate |
| C Fresh office start and best-effort end location | LOCKED | Foundation tranche; server enforcement and attributable evidence |
| C Periodic active-app verification | PROPOSED | Locked long-term direction; not part of this first contained tranche |
| C Pre-close verification | DEFERRED | No scheduled 4 PM/pre-close workflow in this tranche |
| D Reporting times and closing time | PROPOSED | Working Pattern architecture; never hardcode policy |
| D Grace period / automatic ending | NEEDS CONFIRMATION | Exact 5 PM/5:30 PM behavior unresolved |
| E Compliance unit and organisation function | LOCKED | Reuse compliance.manage and existing policy infrastructure |
| E Final Compliance dashboard and responsibilities | PROPOSED | No final dashboard in this tranche |
| F Compliance / HR / Payroll separation | PROPOSED | Evidence monitoring vs employment consequences; no silent payroll writes |
| G Pastor final internal intervention principle | LOCKED | No invisible history rewriting |
| G Audited Executive Override engine | DEFERRED | Preserve original/override/reason/actor/time in future design |
| H Monetary/disciplinary deductions | LEGAL / POLICY REVIEW REQUIRED | No automated salary consequences |
| I Staff compliance source policy | LEGAL / POLICY REVIEW REQUIRED | Product-owner-supplied POLICY DRAFT; not executable policy |
| J Short-duration permissions | PROPOSED | Reuse Request/Decision; full workflow deferred |
| K Action visibility | LOCKED | Explicit state/text/count/time; opening is not approval |
| K Exact status palette | PROPOSED | Refine against accepted CEAC design system |
| L Manager review routing | LOCKED | Responsible reviewer approves/returns; preserve upward review |
| L Explicit review-owner evolution | PROPOSED | Audit existing route before introducing new authority |
| M Existing Work semantics | LOCKED | Private/agreed/self-managed/submission/review preserved |
| N Healing Streams / PFCC | DEFERRED | No new department or special workspace now |
| O Awards / scoring | DEFERRED | No composite score, league table or disciplinary score |

## Preserved owner source discussion and policy draft

The source below is retained substantially as supplied. Mixed-status sections are governed by the classification index above and the explicit tranche boundary; a locked future direction is not permission to build a deferred engine now.

DISCOVERY CONTEXT TO PRESERVE
==================================================

The product owner has begun real staff onboarding and has now met with Managers, Staff, Administration and Compliance.

The purpose of the current product refinement is:

- make staff onboarding easier;
- reduce training friction;
- make Administration capable of operating CEAC OS without TSI;
- align CEAC OS more closely to how the actual office operates;
- improve information visibility and operational clarity;
- strengthen attendance/presence evidence without creating intrusive continuous surveillance;
- avoid unnecessary system weight;
- reuse existing architecture wherever possible.

The current system is large and must not be made heavier merely because a new operational detail has been discovered.

Prefer:
- extending existing tables;
- existing capabilities;
- existing unit memberships;
- existing Work Engine;
- existing workforce records;
- existing compliance policy infrastructure;
- existing request/decision structures;
- existing lifecycle architecture.

Avoid creating parallel systems unnecessarily.

==================================================
A. IDENTITY, INVITATIONS AND ONBOARDING
==================================================

LOCKED:

1. One person = one CEAC identity/account.

A person may hold multiple roles and belong to multiple units under one account.

Do not create a second CEAC account merely because the same person heads two departments.

Example:

Pastor Catherine may simultaneously be:

- Unit Head — Children’s Church
- Unit Head — Compliance

using one email / profile / account.

Her responsibilities must be represented using multiple unit memberships and capabilities.

The existing unit switcher should remain the user-facing mechanism for changing operational unit context.

Organisation-wide capabilities must remain available regardless of which unit she currently has selected.

2. There must be two distinct administrative actions:

- Add new person
- Add responsibility / unit membership to existing person

Never use a second invitation merely to give an existing CEAC person another role.

3. Administration is the ultimate People & Access authority.

Administration must be able to:

- invite ordinary Staff;
- assign unit / department;
- assign Manager;
- assign team or sub-team where supported;
- reassign unit;
- change Manager;
- add additional unit membership;
- remove or end a membership;
- deactivate/revoke operational access;
- inspect pending invitations;
- resend invitations where technically supported;
- cancel/revoke pending invitations where technically supported;
- manage an existing person’s responsibilities.

4. Managers retain invitation authority, but only inside authorised managed units.

Managers must not be able to:

- assign somebody to another department;
- promote somebody to Unit Head;
- grant organisation-wide capabilities;
- deactivate organisation users outside their authority;
- alter protected employment authority.

5. Administrative onboarding/configuration should primarily live in:

Control Center → People & Access

Administration Overview should remain an attention / operating surface rather than becoming a configuration warehouse.

6. The current invitation redirect problem must be corrected.

Current issue:

the application uses:

window.location.origin + "/activate"

for email activation.

This can cause a staff invitation generated from a protected Vercel preview to send the employee into Vercel authentication.

That is unacceptable.

Invited users must enter CEAC OS directly.

They must never be required to know, use or access the product owner’s Vercel account.

For beta:
- CEAC may still physically be hosted on Vercel;
- the employee activation URL must point to the intended CEAC application route/domain, not Vercel dashboard/protection authentication.

Later:
- CEAC will use a unified production domain.

7. Do NOT introduce one shared CEAC password.

Keep the secure flow:

Invitation
→ verified activation
→ user creates own password
→ CEAC OS

The current AccountPassword flow requiring a strong password may be reused/refined.

The eventual long-term direction may be Google Workspace authentication, but do not implement this now unless already approved elsewhere.

==================================================
B. EMPLOYEES AND VOLUNTEERS
==================================================

LOCKED PRINCIPLE:

Do not create a fifth “Volunteer Panel”.

Volunteers who require system access should normally use the Staff experience.

Volunteers may hold:

- ordinary Staff access;
- sub-team-lead / team-lead authority where appropriate.

Do NOT automatically make volunteers Unit Managers.

PROPOSED / NEEDS CONFIRMATION:

Some exceptional volunteers may eventually require broader project authority.

Before enabling wider volunteer access, audit:

- Payroll population;
- Attendance/compliance population;
- Employee headcount;
- Appraisal population;
- HR reporting;
- Performance reporting.

Volunteer work must remain attributable.

Volunteers must not accidentally become payroll employees merely because they have CEAC accounts.

Employment / engagement type and system authority must remain separate concepts.

Example:

Volunteer + Staff panel

is valid.

Employee + Staff panel

is valid.

Employee + Manager authority

is valid.

Volunteer + sub-team-lead authority

is valid.

==================================================
C. WORK SESSIONS, GPS AND PRESENCE EVIDENCE
==================================================

The product owner has confirmed that employees consent to CEAC work-session location capture.

LOCKED DIRECTION:

Do not implement continuous 24/7 GPS tracking.

The intended evidence pattern is:

START VERIFICATION
→ PERIODIC VERIFICATION WHILE APP IS ACTIVE
→ PRE-CLOSE VERIFICATION
→ END WORK VERIFICATION

Also record:

LAST CEAC ACTIVITY

Location verification and application activity are different facts.

The interface must distinguish:

Last verified location

from:

Last CEAC activity

Neither may be described as productivity.

Neither may falsely claim continuous live tracking.

LOCKED:

1. For a person whose working arrangement requires office-location verification:

Start Work must require:

- location permission;
- fresh location;
- latitude;
- longitude;
- accuracy where available;
- geofence evaluation against the configured CEAC office;
- device time;
- server time.

Do not silently create a verified “Office” session with null GPS.

If location is denied/unavailable:

do not start an “office verified” session.

Explain clearly why location is required.

2. End Work should request a fresh location.

However:

location failure must NOT make it impossible to close a work session.

Instead record:

end location not verified

with attributable evidence.

3. Add lightweight periodic presence checks while the CEAC application is active and location permission is available.

Do not pretend a PWA can guarantee continuous background tracking when the browser/app is suspended.

4. Add a pre-close location checkpoint approximately one hour before expected end of work where technically feasible while the app is active.

This is intended to reduce the loophole where somebody verifies at the office in the morning and leaves early while allowing the session to remain open.

5. Record meaningful CEAC activity timestamps.

Examples include:

- opening CEAC;
- work update;
- checklist update;
- submission;
- message/action;
- review;
- other attributable application interaction.

Do not interpret “last activity” as proof of continuous work.

6. Admin map / Compliance presence view should be framed as:

TODAY’S VERIFIED WORK LOCATIONS

or:

LAST VERIFIED LOCATION

Never “live employee location” unless CEAC genuinely has a real-time signal.

Possible person card:

Nana Mensah
CEAC Office
Start verified 9:58 AM
Last location verification 4:03 PM
Last CEAC activity 4:17 PM

7. Off-site work should continue to attach location to work/session evidence rather than permanently exposing private personal location throughout the app.

8. Existing principle remains:

Presence, availability and output are separate facts.

Do not turn work-session hours into productivity scores or Payroll automatically.

==================================================
D. WORKING HOURS / SESSION ENDING
==================================================

CURRENT CEAC OFFICE POLICY DRAFT:

Mondays:
12:00 PM reporting time

Tuesday-Friday:
10:00 AM reporting time

Normal closing time currently discussed:
5:00 PM

PROPOSED — NOT YET TO BE FULLY IMPLEMENTED:

Do NOT hardcode these times directly inside generic session logic.

Use Working Pattern / contractual schedule architecture.

Proposed future sequence:

At normal closing time:
“Your normal workday has ended. Are you still working?”

Options could include:

- End at scheduled close
- Continue working
- I finished earlier

If Continue:
record an extended/overtime session fact.

If no response within an agreed grace period:
system may automatically close or flag the session according to final policy.

The exact 5:00 / 5:30 behavior remains NEEDS CONFIRMATION.

Do NOT fully implement this schedule-close engine in the first tranche.

==================================================
E. COMPLIANCE AS A CEAC FUNCTION
==================================================

IMPORTANT DISCOVERY:

Compliance is now confirmed as an important CEAC department / office function.

Pastor Catherine currently heads both:

- Compliance
- Children’s Church

This is one of the reasons multi-unit membership must work correctly.

Compliance is both:

1. an organisational department/team; and
2. an organisation-wide compliance authority/function.

Compliance's responsibilities discussed include:

- attendance / punctuality monitoring;
- reviewing work-session evidence;
- seeing who has started work;
- seeing verified work location;
- seeing approved leave;
- upcoming leave visibility;
- lateness / absence explanations;
- temporary permission to leave;
- policy communication;
- policy acknowledgement;
- monitoring compliance with office standards;
- dress-code / professional conduct issues;
- receiving or recording conduct reports;
- policy requirements from Pastor / Administration;
- project / operational delay visibility where relevant;
- compliance exceptions;
- reporting/escalation;
- potentially communicating ministry-wide compliance announcements.

Current CEAC already has:

compliance.manage

plus:

- compliance policy versions;
- applicability;
- policy requirements;
- acknowledgements;
- evidence;
- exceptions;
- review;
- audit trail.

Therefore do not create a parallel compliance database unless genuinely required.

PROPOSED FUTURE COMPLIANCE OVERVIEW:

Presence today
Attendance exceptions
Permissions / absences
Compliance cases / policies
Communications

Compliance may still retain ordinary Manager/team/project/work functionality underneath.

Do NOT build the final Compliance dashboard during the first tranche.

==================================================
F. COMPLIANCE AUTHORITY BOUNDARIES
==================================================

PROPOSED / STRONGLY RECOMMENDED:

Compliance monitors and records evidence.

HR/Admin administers employment consequences.

Payroll executes authorised payroll operations.

Pastor / Group Pastor retains executive authority and may later require an explicit audited override mechanism.

Compliance should NOT silently:

- modify payroll;
- rewrite attendance evidence;
- delete historical events;
- impose salary deductions automatically.

==================================================
G. PASTOR / EXECUTIVE OVERRIDE
==================================================

PRODUCT OWNER PRINCIPLE:

All policies, permissions and decisions may ultimately be intervened in by Pastor.

PROPOSED FUTURE IMPLEMENTATION:

Create an explicit Executive Override rather than invisible edits.

Preserve:

- original decision;
- overriding decision;
- reason;
- actor;
- timestamp.

Do not implement the final override engine in the first tranche.

==================================================
H. DISCIPLINE / MONETARY DEDUCTIONS
==================================================

LEGAL / POLICY REVIEW REQUIRED.

The supplied draft policy refers to:

- monetary deductions for repeated lateness;
- compliance-point deductions;
- possible financial consequences.

Do NOT automate:

lateness → payroll deduction

or:

compliance points → salary deduction

during this implementation tranche.

Preserve the policy discussion in Discovery.

Any financial disciplinary consequence must remain outside automatic Payroll until CEAC confirms the lawful employment/policy basis.

==================================================
I. STAFF COMPLIANCE POLICY — SOURCE DRAFT
==================================================

Preserve the following source policy in the Discovery document as a PRODUCT-OWNER-SUPPLIED POLICY DRAFT.

Do NOT rewrite it into implementation rules yet.

Title:

CEAC STAFF COMPLIANCE POLICY

Topics:

1. Reporting for Work
- Monday reporting time: 12:00 noon.
- Tuesday-Friday reporting time: 10:00 AM.
- Staff expected to be ready at designated workstation/duty location.
- Staff expected to remain at assigned duty location unless permission to leave is obtained.

2. Lateness
- staff expected to arrive on time;
- anticipated lateness should be communicated early;
- Manager / Compliance / Administration may receive explanation;
- repeated unjustified lateness may become disciplinary;
- Pastor may review/escalate.

3. Absence from Work
- authorisation required except emergencies;
- unexpected absence must be communicated promptly;
- unexplained absence may become disciplinary;
- repeated/prolonged unauthorised absence may escalate.

4. Permission to Leave During Working Hours
Request should state:
- reason;
- expected duration;
- expected return time.
Permission must not create automatic entitlement to future permission.

5. Late Arrival / Emergency Permission
- communicate as early as reasonably possible;
- prior permission may be impossible in a genuine emergency;
- emergency handling is circumstance-specific.

6. Medical Absence
- staff must notify Manager / Compliance / Administration promptly.

7. Extended Absence and Leave
- formal leave request required;
- approval must be received;
- employee resumes on approved date;
- extensions require approval.

8. Dress Code / Personal Appearance
- professional, clean, neat and presentable appearance;
- hygiene;
- appropriate footwear;
- no slippers;
- inappropriate/excessively casual/unclean attire prohibited;
- repeated issues may create compliance action.

9. Compliance
- Managers, Administration and Compliance participate in monitoring/enforcement;
- Pastor remains final internal authority.

Record the policy substantially as supplied by the product owner in the Discovery file so the exact source is not lost.

==================================================
J. SHORT-DURATION WORKDAY PERMISSIONS
==================================================

DISCOVERY:

Not every authorised absence is annual leave.

Examples:

- arriving late;
- leaving office temporarily;
- emergency absence;
- medical absence notification;
- short permission during the working day.

PROPOSED:

Reuse existing Request / Decision architecture rather than creating a large new module.

Potential request types:

Late arrival notice
Temporary leave from workplace
Emergency absence
Medical absence notification

Potential normal route:

Manager = first-line decision
Compliance = visibility / monitoring / escalation
Administration = employment administration / fallback
Pastor = possible future executive override

Do NOT fully implement this workflow in the first tranche.

==================================================
K. NOTIFICATIONS / ACTION VISIBILITY
==================================================

LOCKED PROBLEM:

The app currently does not make new actions obvious enough.

Examples reported during onboarding:

- new work is difficult to identify;
- new manager review items are visually buried;
- users sometimes have to inspect text manually to determine what changed;
- notification states are not sufficiently visible.

LOCKED DIRECTION:

Create a consistent action-visibility language.

Do not rely on colour alone.

Use:

- unread/new indicator;
- action label;
- stronger typography where appropriate;
- timestamp;
- badge/count where useful.

Suggested meaning:

Blue:
new assignment / information

Amber:
requires action / review

Red:
urgent / overdue / significant exception

Green:
completed / approved

Purple:
policy / announcement / compliance

Grey:
read / informational

Exact design may be refined against the CEAC design system.

Opening a notification does NOT mean the underlying work has been reviewed.

Notification-read state and work-decision state are different.

Manager surfaces should clearly expose:

Needs review · N

==================================================
L. MANAGER REVIEW BUG / REVIEW AUTHORITY
==================================================

LOCKED:

If Nana completes work assigned by Frank and submits it:

Frank is the review authority.

Frank must see:

APPROVE
RETURN FOR CORRECTION

Frank must NOT see:

SEND FOR REVIEW

for that submitted work.

Current Item code already contains Approve / Return paths.

If the wrong control appears, treat this as a routing/state/UI defect.

Review authority should follow the work’s origin/review route, not merely the fact that the current user is a Manager.

Correct examples:

Staff work assigned by Manager:
Staff submits
→ Manager approves / returns

Manager work assigned by Pastor/Admin:
Manager completes
→ Manager sends upward to appropriate reviewer

Manager private/self-managed work:
Manager finishes/self-certifies according to existing CEAC rules

Manager agreed work with another review owner:
route to explicit review owner.

Longer term, prefer an explicit review owner / review route where useful.

==================================================
M. EXISTING WORK SEMANTICS TO PRESERVE
==================================================

The product owner specifically approves:

- private work;
- agreed work;
- managers being able to record their own work;
- staff work submission/review loop;
- Manager Approve / Return for correction;
- attributable evidence;
- self-certification where already approved.

Do not weaken these.

==================================================
N. HEALING STREAMS / PFCC
==================================================

DEFERRED.

Healing Streams should not automatically become a new department.

Current direction:

Healing Streams remains associated with PFCC / Pastor Rebecca’s responsibilities.

Rebecca/PFCC may eventually require a somewhat specialised workspace.

Do not implement this during the first tranche.

==================================================
O. SCORING / AWARDS
==================================================

DEFERRED.

There is an annual awards concept.

Possible future factual inputs discussed include:

- task completion;
- punctuality;
- compliance;
- Manager appraisal.

Do NOT create an employee composite score yet.

Build trustworthy factual evidence first.

Do not introduce:
- league tables;
- opaque percentages;
- competitive ranking;
- automatic disciplinary scoring.

Compliance points remain a future policy discussion.

==================================================

## Canonical reconciliation

Foundation verification finding (6 October): the application redirect helper is pinned to the intended public app, but Supabase Auth currently falls back to the protected Vercel hostname for both public activation and recovery paths. This was confirmed with an invalid-token probe without creating an account or sending email. Auth Site URL/redirect configuration must be repaired and verified before release; dashboard authentication remains blocked on additional device verification. The foundation's verified code head and full passing automated gates are recorded in `CEAC_ONBOARDING_NEXT_BUILD_2026-10-06.md`. Production migration and protected merge have deliberately not occurred. This is an infrastructure configuration issue, not a reason to introduce Google SSO or widen the foundation scope.

Baseline protected main: `76cea2e457b7d624f54ca961ad14bb62ea359ebd`. PR #106 already supports inviting and assigning ordinary Staff from Units. Preserve that accepted work. CI, Migration Replay, Account Security, Quality Gate and Vercel reported success on this baseline. Live database includes migrations through 110. Existing employment changes represent primary-unit transfers; they must not be reused to add a secondary responsibility because that removes the previous primary membership.
