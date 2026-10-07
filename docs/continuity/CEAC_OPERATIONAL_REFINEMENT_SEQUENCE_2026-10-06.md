# CEAC Operational Refinement sequence

Date: 6 October 2026
Programme is OPEN; Phase 3 is complete and later phases remain separately gated.
Phase 2 application baseline: protected main `a482ab602bacb511c18436e256dd932526f14fdd`; production migration `20261006062907_112_attendance_patterns_permissions`.
Accepted implementation branch/head: `chatgpt/attendance-working-patterns-permissions-2026-10-06` at `ea9a55a29e6df5aef8ec2af3d81f42cb01c6deba`; protected squash PR #113.
Phase 3 application baseline: protected main `4179b71ed8757ece726c4282363edaacc8b158b6`; production migration `20261006121001_113_compliance_operating_surface`; protected squash PR #115.

The adjacent `CEAC_POST_ONBOARDING_MASTER_IMPROVEMENT_REGISTER_2026-10-06.md` is the complete 50-item checklist. This sequence supersedes older conflicting phase directions only for this authorised post-onboarding refinement. Accepted domain/security/design contracts remain protected.

## Phase dependencies

| Phase | Scope | Dependency / entry gate | Current state |
|---|---|---|---|
| 1 | Foundation: onboarding, People & Access, multiple units, scoped invitations, review/action visibility, start/end evidence, last activity | Preserve accepted PRs #106/#111/#112 and migration 111 | Implemented and technical/deployment checks pass; authenticated live role inspection and actual email/password setup remain unverified |
| 2 | Attendance, Working Patterns & Permissions | Commit this lock first; reuse Stage 9 and Work Engine; secure privacy/authority boundaries | COMPLETE — PR #113, migration 112 and exact-main production evidence recorded below |
| 3 | Compliance Operating Surface | Phase 2 accepted/merged/deployed; operational data and compliance visibility secure | COMPLETE — PR #115, migration 113, exact-main gates and production evidence recorded below |
| 4 | Notification & Work-State Communication | Phase 3 acceptance; preserve independent unread and action states | COMPLETE — PR #121 merged; later migration-history reconciliation merged in #133 |
| 5 | Admin Product Redesign | Phase 4 acceptance; literal approved design/reference and functioning controls | STARTED / OWNER-AUTHORISED — reconcile live implementation state before writes |
| 6 | Volunteer Operating Model + Shared Personal Planning + Attendance Integrity | Phase 5 acceptance; preserve Staff experience, Manager/HR authority split, private personal planning and factual attendance boundaries | NEXT — owner decisions and mandatory nine-surface visual reference locked 7 Oct 2026 |
| 7 | Healing Streams/PFCC Special Workspace + Compliance Cases, Pastor Override & Disciplinary Governance | Phase 6 acceptance; preserve programme classification; final authority/lifecycle/history confirmed; legal policy review for consequences | PFCC/Healing Streams moved here; governance items remain DISCUSS BEFORE BUILD; financial consequences LEGAL / POLICY REVIEW |
| 8 | Scoring / Awards / Compliance Points | Phase 7 acceptance and explicitly approved transparent policy; no composite score inferred | DISCUSS BEFORE BUILD |

## Verification and continuation

One active writer. Fetch canonical main/branch before writes; reconcile forward without reset/force-push/revert. Do not recreate accepted work or weaken tests. Commit implementation, replay migrations, run capability/RLS/SQL/security gates and authenticated browser/responsive/persistence acceptance, pass full Quality Gate, normal protected merge, exact-main verification and deployment evidence. Never fabricate production records or claim real email/password setup from fixtures. Document genuine blocked evidence distinctly from technical PASS.

Use factual attendance context; no misconduct finding or automatic Payroll linkage. Manager first-line workflow uses existing explicit Work Engine authority; final disciplinary route remains a future discussion. Medical operational notices must not collect detailed medical information. Per-person schedule differences remain possible. Draft office hours are an opt-in configuration template, never silent production data.

## Phase 3 entry lock

Phase 3 was explicitly started by the product owner on 6 October 2026 from protected main `97d2b4a7a3220a7764f5eaa3e43c8d31672374b0`. The only active writer branch is `chatgpt/compliance-operating-surface-2026-10-06`.

The phase must reuse the Stage 11 policy/version/applicability/requirement/acknowledgement/evidence/exception engine and the Phase 2 sanitised `attendance_day_evidence(date)` read. `compliance.manage` is organisation-wide compliance authority; it is not announcement authority, attendance decision authority, protected-HR access, disciplinary authority or executive authority. Office-wide policy instructions require the separate explicit `post_announcement` capability and must retain the real author.

The accepted Phase 3 boundary is defined in `docs/architecture/CEAC_COMPLIANCE_PHASE3_CONTRACT_2026-10-06.md`. Items 24 and 28–32 remain outside this phase. Item 27 remains unresolved: “no session recorded” must never be relabelled “unexplained absence”.

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

## Phase 2 — implementation scope

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

## Explicit Phase 2 stop boundary

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

Phase 2 — Attendance, Working Patterns & Permissions is COMPLETE. The overall CEAC Operational Refinement programme remains OPEN.

### Accepted repository and deployment

- Continuity prerequisite: `7b2195625ed91cb77090fcf695d93bd7abf0bc41`, committed before application writes.
- Accepted application head: `ea9a55a29e6df5aef8ec2af3d81f42cb01c6deba`.
- Protected merge: PR #113, protected main `a482ab602bacb511c18436e256dd932526f14fdd`.
- Repository migration: `20261006041453_112_attendance_patterns_permissions.sql`; applied production migration: `20261006062907_112_attendance_patterns_permissions`.
- Production deployment: Vercel `dpl_9BNxXkXRKVjwxiXhptxordRVV7DH`, READY from exact protected main at `https://ceac-os-git.vercel.app`.

### Completed A–L scope

- **A:** effective, attributable per-person daily clock patterns; legacy schedule interpretation preserved; draft office hours remain unapplied.
- **B:** expected hours, first recorded start, verified office start and factual late/no-session states remain separate from authorised context.
- **C–F:** late-arrival, temporary-permission, emergency and medical notices extend the existing Request engine; response/return history is attributable and immutable; medical narratives are rejected.
- **G:** approved current/upcoming leave and notice context are visible through a sanitised authorised roster read.
- **H–I:** discrete hourly foreground and pattern-derived pre-close attempts, including an older open session; unavailable location is recorded truthfully and never blocks work.
- **J:** checkpoint schedule-version/expected-close context only; no automatic close, final grace rule or Payroll consequence.
- **K:** roster-based factual evidence, a discrete latest-location plot, activity and unverified endpoints; no final Compliance dashboard.
- **L:** self/managed-unit/explicit-capability boundaries, authenticated-only RPCs, append-only evidence and prior-state audit history; Protected HR remains protected.

### Verification

- Candidate CI, Migration Replay and Account Security: PASS at exact application head.
- Candidate complete Level B Quality Gate `37416625509`: PASS. Six SQL/authority contracts plus every cumulative gate passed; 681 Playwright tests passed across four isolated shards (189 + 162 + 171 + 159), including phone/desktop persistence and foreground pre-close evidence.
- Direct exact-head product inspection: Staff phone and Manager desktop evidence passed without horizontal overflow; notice, return and decision history remained readable in the accepted Workforce grammar.
- Exact-main CI `37424038155`: PASS.
- Exact-main Migration Replay `37424038356`: PASS.
- Exact-main Account Security `37424038167`: PASS.
- Exact-main Quality Gate `37424038201`: PASS, including all four browser shards, merged exact-head evidence and the `role-and-rls` coordinator.
- Exact-main production deployment: READY; production migration verification found 18 employees and the prior 8 work sessions unchanged, with zero seeded schedule versions, notices, returns or checkpoints. All three new tables enforce RLS and reject direct signed-in mutation; all six RPCs reject anonymous execution and use fixed `search_path=public`.

### Unresolved decisions and architectural findings

- Actual invited-user email delivery, password activation and authenticated live role inspection remain unverified; fixture accounts are not proof of real-user activation.
- Monday 12:00, Tuesday–Friday 10:00 and 17:00 close remain a policy draft. Production has no assigned working pattern and CEAC must record approved per-person/contract patterns before expected hours appear.
- Final scheduled-close/grace behaviour, idle reconciliation, unexplained-absence definition, disciplinary routing, Payroll consequences, Pastor override, scoring/awards, volunteer/PFCC policy and any anti-gaming reserve remain deferred to their recorded gates.
- Browser/PWA checks are foreground, best-effort discrete evidence. They are not background surveillance and cannot guarantee collection while suspended/offline or prevent device location spoofing.
- Roster-only employees remain visible to authorised roles with unconfigured expectations; CEAC must link a real identity before recording a person pattern or self-service notice, rather than fabricating accounts.

### Phase 3 entry point

Begin the Compliance Operating Surface from existing `compliance.manage`, `attendance_day_evidence(date)` and Stage 11 policy/evidence contracts. Design a factual operating surface for sanitised attendance, requirements, acknowledgements, exceptions and escalation; preserve Manager decision authority, Protected HR, immutable evidence and the no-scoring/no-punishment boundary. Do not grant Compliance workforce configuration or notice-decision authority and do not add cases, Pastor override or consequences until their later policy gates are confirmed.

## Phase 3 completion record

Phase 3 — Compliance Operating Surface is COMPLETE. The overall CEAC Operational Refinement programme remains OPEN.

### Accepted repository, database and deployment

- Accepted candidate head: `328941116432099dd47984049f7c3f331cbed61c`.
- Protected merge: PR #115, protected main `4179b71ed8757ece726c4282363edaacc8b158b6`.
- Repository migration: `20261006070840_113_compliance_operating_surface.sql`; applied production migration: `20261006121001_113_compliance_operating_surface`.
- Exact-main Production deployment: GitHub deployment `6883512877`, successful; public application `https://ceac-os-git.vercel.app` returned HTTP 200.

### Completed scope

- Organisation-wide `compliance.manage` receives a factual Overview from the existing sanitised attendance RPC and Stage 11 Compliance records.
- Expected hours, recorded and verified starts, presence, lateness, approved leave, notices and policy attention remain separate facts. Missing evidence remains “No session recorded”.
- Existing policy, applicability, requirement, acknowledgement, evidence and exception histories remain the decision system; Phase 3 adds no duplicate store or score.
- Policy instructions use a separate canonical organisation-wide `post_announcement` grant and preserve the real announcement author and lifecycle.
- Conduct and dress requirements remain ordinary versioned policies with manual evidence only; no camera or automated judgement was added.
- Compliance employees retain their recorded unit, Manager, work and project memberships. The phase adds no Compliance-specific Work bypass.

### Verification

- Candidate CI `37459882464`, Migration Replay `37459882456` and Account Security `37459882462`: PASS.
- Candidate Level B Quality Gate `37459882570`: PASS. The complete SQL/authority suite and 682 Playwright tests passed across four isolated shards (190 + 162 + 171 + 159), followed by the role/RLS coordinator and merged exact-head evidence.
- Exact-main CI `37461255542`, Migration Replay `37461255582`, Account Security `37461255588` and Level B Quality Gate `37461255543`: PASS. Exact-main repeated all 682 browser tests and the complete SQL/authority suite.
- Production remained factual: 18 employee-roster rows and 8 work sessions were unchanged; existing Compliance data was 2 policy versions, 2 applicability rows, 0 requirements, 3 acknowledgements, 0 evidence versions and 0 exception versions; existing announcements remained 4.
- The two explicit legacy announcement publishers became two active canonical organisation-wide grants. The new sensitive capability definition exists once. The authority helper uses `post_announcement`, never `compliance.manage`, and is not executable by `anon` or `authenticated`.
- No production policy, acknowledgement, evidence, exception, attendance, work-session or announcement record was created for acceptance.

### Deferred boundary and Phase 4 entry point

Actual invited-user email/password activation and authenticated live-role inspection remain unverified; isolated authenticated fixtures are not proof of a real account. Unexplained absence, Compliance reports/cases, disciplinary routing, Pastor override, Payroll consequences, scoring, automated monitoring and background location remain deferred exactly as recorded.

Phase 4 is Notification & Work-State Communication. Begin only from protected main after reading the acceptance record. Preserve independent unread/information state and actionable work/review state; do not make “read” mean “done” and do not reopen Phase 3 authority.


## Phase 5 / Phase 6 continuity lock — 7 October 2026

The product owner has declared Phase 5 Admin Product Redesign started. At the time this lock was written, no dedicated Phase 5 implementation branch was visible on GitHub, so this documentation branch does not claim ownership of Phase 5 application files and must be reconciled forward by the active Phase 5 writer.

Immediately after accepted Phase 5 closure, Phase 6 continues with the decisions in:

- `docs/design/phase6/CEAC_PHASE6_VOLUNTEER_CALENDAR_VISUAL_PRODUCT_LOCK_2026-10-07.md`
- canonical visual reference `docs/design/phase6/CEAC_PHASE6_APPROVED_NINE_SURFACE_REFERENCE.webp`

Phase 6 is now:

- **6A Volunteer Operating Model**
- **6B Shared Personal Planning / Calendar Day Workspace**
- **6C Attendance Integrity / Anti-gaming**

The specialised Healing Streams / PFCC workspace is moved to Phase 7. NFC remains reserve-only; network corroboration and optional rotating-code verification belong to Phase 6 subject to the locked factual/no-automatic-consequence boundary.

The nine-surface visual reference is a literal acceptance authority. Green automated tests do not waive visual non-conformity.
