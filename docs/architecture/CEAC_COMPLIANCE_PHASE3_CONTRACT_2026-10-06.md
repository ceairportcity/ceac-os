# CEAC Compliance Operating Surface — Phase 3 contract

Date: 6 October 2026  
State: ACTIVE  
Branch: `chatgpt/compliance-operating-surface-2026-10-06`  
Entry baseline: protected main `97d2b4a7a3220a7764f5eaa3e43c8d31672374b0`

## Purpose

Phase 3 turns the accepted Stage 11 Compliance engine and Phase 2 attendance evidence into one trustworthy operating surface. It presents recorded facts, human policy decisions and attributable evidence without scoring a person or converting operational signals into misconduct.

## Authority

- `compliance.manage` may publish/version/retire compliance policies, define applicability and requirements, review submitted evidence and decide or resolve policy exceptions.
- The capability is organisation-wide only when granted without a unit scope. Job title, unit name and selected unit do not grant it.
- A Compliance employee remains an ordinary member of their recorded unit, with their recorded manager, work, projects and team. Phase 3 must not manufacture a Compliance unit or move anyone into it.
- `compliance.manage` does not grant attendance response/correction authority, protected-HR access, announcement publishing, disciplinary authority, Payroll authority, Administration impersonation or executive override.
- An office-wide compliance or policy instruction requires a separate explicit `post_announcement` capability. The recorded author is always `auth.uid()`.
- Managers retain read-only compliance visibility for their managed scope unless a separate capability grants a decision action.
- Staff acknowledge applicable policies, submit their own evidence and request their own exceptions.

## Authoritative data

- Policies, applicability, requirements, acknowledgements, evidence versions and exception versions: existing Stage 11 tables and six reviewed Compliance RPCs.
- Attendance facts: existing sanitised `attendance_day_evidence(date)` RPC. No direct Compliance access to raw attendance narratives is added.
- Work and project context: existing Work/Project RLS and normal unit membership. Phase 3 adds no organisation-wide work bypass.
- Announcements: existing announcement records and receipt lifecycle, corrected to recognise the current capability-grant model.

## Overview facts

The Compliance overview may show:

- expected today / schedule not configured;
- first recorded and verified-office starts;
- open or ended recorded sessions;
- verified lateness against the recorded effective working pattern;
- approved current and upcoming leave dates/status only;
- temporary permission and attendance-notice operational state;
- last CEAC activity and discrete foreground location evidence already approved in Phase 2;
- policy acknowledgement attention;
- submitted, rejected or expired evidence attention;
- requested or time-bounded exception attention;
- links to ordinary authorised Work/Project context and attributable policy instructions.

The overview must say “No session recorded” where that is the fact. It must not infer unexplained absence, misconduct, productivity or a disciplinary outcome.

## Sensitive-data boundary

- Medical notices expose operational state and dates only. Detailed medical information remains Protected HR.
- Compliance receives no new raw leave reason, attendance reason/note, protected-HR, Payroll or private employee-document access.
- The overview must not copy or persist the sanitised attendance response into a new broad table.
- Exact location remains discrete recorded evidence, not live tracking; no background collection is added.

## Lifecycle, audit and reversal

- Policy, evidence and exception changes remain append-only version histories through existing reviewed RPCs.
- Acknowledgements are self-bound and immutable for the policy version.
- Announcement drafts are explicitly published or closed; the real author and receipt history remain recorded.
- Reversal uses a successor policy/evidence/exception version or announcement closure. No silent overwrite.
- Existing platform events and audit triggers remain the evidence trail.

## Dress code and professional conduct

Approved conduct content is represented as a normal versioned policy. Manual references or approved records may be submitted through the existing evidence workflow when the policy requires them. Phase 3 adds no camera feed, automated dress detection, biometric classification, AI judgement or misconduct inference.

## User experience

- An authorised Compliance operator gets an Overview plus Policies, Requirements, Evidence and Exceptions.
- The Overview separates attendance facts from policy-attention queues and uses plain factual labels.
- A policy-instruction action appears only when the operator also has `post_announcement`; it opens the existing announcement lifecycle and never pretends the author is Administration.
- Managers keep scoped read-only policy/evidence/exception views.
- Staff keep the accepted personal policy, acknowledgement, evidence and exception experience.
- Empty production data remains visibly empty. No demo policy, person, attendance, chart or score is inserted.

## Explicit stop boundary

Do not implement in Phase 3:

- an “unexplained absence” conclusion or final absence policy;
- compliance reports/cases, disciplinary findings or escalation workflow;
- Manager/Compliance/Admin/Pastor disciplinary routing;
- Pastor override;
- salary deductions, Payroll consequences or automatic penalties;
- points, awards, rankings, compliance scores or composite people metrics;
- automatic work-delay judgements or organisation-wide Work access;
- automated dress/camera surveillance;
- continuous/background GPS;
- volunteer/PFCC special operating models;
- final automatic session close or grace policy.

## Acceptance

Phase 3 is accepted only when:

1. the current policy/evidence/exception lifecycle remains green;
2. the overview reads only the approved sanitised attendance and Compliance data;
3. SQL gates prove `compliance.manage` cannot read raw narratives or decide attendance requests;
4. announcement publishing uses current explicit capability grants and retains the actual author;
5. staff, manager, Compliance, Admin and executive route boundaries pass browser acceptance;
6. mobile and desktop layouts do not overflow and empty states are truthful;
7. migration replay, cumulative security gates, build, CI, full Quality Gate and exact-main deployment pass;
8. production inspection records real counts without creating records.
