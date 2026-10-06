# CEAC OS — S7 Data Classification & Access Matrix

Date: 6 October 2026
Status: SECURITY BASELINE / GO-LIVE POLICY REVIEW REQUIRED
Baseline: protected main `27b0457857f76ca29dc8c483606910fb0f8d27eb`

Purpose: define how CEAC OS data should be treated so technical visibility does not become business-data authority.

This matrix describes the intended ceiling. Existing RLS/capability rules remain authoritative where they are narrower.

## Classification levels

- **C1 — Organisational:** ordinary ministry/work information intended for appropriate CEAC users.
- **C2 — Internal personal:** contact or personal details needed for a legitimate internal purpose.
- **C3 — Sensitive operational:** attendance, location, access/security evidence or confidential work context.
- **C4 — Protected HR/finance:** salary, payment details, protected identifiers, medical/leave documents, confidential HR documents and payroll.
- **C5 — Secrets/credentials:** service-role keys, provider secrets, signing material, recovery credentials. Never browser-visible or committed to GitHub.

## Access matrix

| Data class | Classification | Staff | Manager / Unit Head | Administration & HR | Group Pastor / CEO | Technical Support |
|---|---|---|---|---|---|---|
| Name, role, unit, work identity | C1 | Relevant organisational/unit context | Relevant organisational/unit context | Organisation-wide as required | Organisation-wide as required | Only as needed for support/account context |
| Work email / internal contact | C2 | Only where CEAC approves directory purpose | Relevant team/admin purpose | Administrative purpose | Leadership purpose | Account/support purpose only |
| Phone, address, emergency contact | C2 | Self unless an approved purpose exists | No blanket access | Administrative need | Need-to-know | No content access by default |
| Birthday | C2 | Current birthday feature requires explicit go-live policy/minimisation review | Relevant approved people purpose | Administrative purpose | Need-to-know | No technical need by default |
| Employment placement/status | C2 | Own/basic relevant org context | Managed-team scope | Organisation-wide administration | Leadership scope | Account/access troubleshooting metadata only |
| Leave dates/status | C3 | Own; approved absence may be exposed only where operationally necessary | Managed-team scope | Full leave administration | Leadership/exception authority | Health/status only if needed; not private reason/medical payload |
| Leave reason/medical evidence | C4 | Own | Need-to-know only | Administration/HR | Need-to-know leadership | No content access by default |
| Attendance/work-session evidence | C3 | Own | Managed-team operational scope | Workforce/attendance authority | Leadership scope where required | System health/troubleshooting only |
| Precise location/IP/device evidence | C3 | Own factual record where surfaced | Only where attendance purpose requires it | Attendance/workforce purpose | Exception/oversight purpose | Diagnostic access must be explicit and purpose-bound |
| Salary/compensation | C4 | Own only if/when CEAC product policy permits | No | Yes, authorised HR/payroll personnel | Yes | No |
| Payment/bank details | C4 | Own only if/when approved | No | Need-to-know payroll administration | Need-to-know | No |
| Protected identifiers | C4 until each identifier class is specifically approved otherwise | No blanket access | No | Need-to-know | Need-to-know | No payload access |
| Protected HR documents | C4 | Only documents explicitly released to the subject | No blanket access | Manage according to document class | Need-to-know | No content access unless separately approved for a technical incident |
| Payroll runs/lines | C4 | No | No | Prepare/view according to capability | Approve/view according to capability | Health/status only, never amounts/content |
| Capability/authority grants | C3 | Own/relevant visibility only | Relevant scope | Administrative authority | Leadership oversight | Technical diagnostics; cannot self-grant broader business authority |
| Audit/security events | C3 | Own account activity where designed | Relevant operational events | Authorised audit scope | Leadership oversight | Technical/security events needed for operations |
| Support cases | C2/C3 depending content | Own case | Relevant case only | Escalation/oversight as needed | High-impact escalation as needed | Assigned technical support |
| Operational files | Follows owning record | Context-authorised | Context-authorised | Context-authorised | Context-authorised | Only when required to troubleshoot that specific context |
| Secrets, provider keys, service role | C5 | Never | Never | Only designated technical owner if required | Recovery/ownership governance, not routine use | Designated technical operators only; no UI exposure |

## Current enforced high-value boundaries

Verified live:

- `hr_private` contains 10 base tables and denies direct browser-role DML/SELECT.
- `ceac-hr-private` is private and its Storage policies require `hr_private.access` plus organisation path.
- `ceac-operational-private` is private and object access is tied to authorised operational-file records.
- salary/payroll/protected identifiers are not supposed to be exposed merely because a person is visible in People/Team.
- Technical Support has no approved path to become Admin/HR, Payroll or Executive by virtue of technical duties.

## Go-live minimisation review

Before broad onboarding, explicitly decide:

1. whether work email is an internal directory field and at what scope;
2. whether birthdays are shown as exact dates, month/day only, opt-in, or Administration-only;
3. whether phone is ever visible beyond self/Administration;
4. which identifier types, if any, may be treated as ordinary organisational identifiers rather than C4;
5. which employee document classes may be read/downloaded by the employee;
6. precise location evidence visibility and retention;
7. support-case attachment rules so users do not upload protected HR/payroll content into ordinary technical tickets.

Until those decisions are approved, implement new UI by least data: request only fields needed for the specific purpose.
