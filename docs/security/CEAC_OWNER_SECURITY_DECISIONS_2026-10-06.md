# CEAC Security & Technical Support — Owner Decisions Lock

Date: 6 October 2026
Updated: 7 October 2026 — go-live leave, consequence and handover decisions
Status: OWNER DECISIONS RECORDED / IMPLEMENTATION AND ACCEPTANCE PENDING
Canonical baseline at original lock: protected main `3feb68e9fa46da9888a7dfa9cef942b1f6133f7c`

This file records product-owner decisions so the security programme does not live only in chat. These decisions are binding inputs unless the owner later changes them explicitly.

## S1 — MFA and privileged access
- MFA enforcement is required for privileged accounts in the final production system.
- The current build remains in active test/development and privileged test accounts are still needed.
- Build all technical MFA/AAL2 enforcement, tests, privilege boundaries, recovery rules and readiness controls now.
- Final privileged-account MFA enrollment is a go-live/onboarding gate.
- Ordinary staff are not made privileged merely by job title.

## S2 — Authenticated SECURITY DEFINER functions
- Proceed with the complete semantic audit and attack-surface reduction.
- Preserve intentional capability/RLS semantics.
- Do not weaken accepted authorization merely to clear advisor warnings.

## S3 — Real onboarding and Technical Support
Owner intent:
- Gabriel is intended to become Manager / Team Lead for Technical Support.
- Technical Support remains organisationally associated with Media & Technical, but operates as an autonomous service team reporting directly to Administration & HR and the Group Pastor for its technical-support mandate. It is not a separate normal department like Finance or Welfare.
- Technical Support needs organisation-wide technical reach only through explicit support capabilities; it must not acquire unrelated HR, payroll, compliance or executive powers.
- Many Technical Support members are volunteers.
- Gabriel's current Media & Technical operating placement/account must not remain as a conflicting active authority after the final Technical Support transition.
- Historical attribution must be preserved; no account or work history may be deleted.
- Technical Support must never become a hidden super-admin.
- Real HR/Admin invitation will be used to validate onboarding after the model is implemented and accepted.
- Only confirmed real email addresses may be used for account activation/invitation. Employees without a confirmed email remain roster records; CEAC must not fabricate an email or Auth identity.

## S4 — GitHub / supply chain
- Owner decision: the CEAC OS GitHub repository should be private.
- Preserve protected-main gates, Dependabot review, secret scanning and least-privilege integrations.
- Do not blindly merge major dependency upgrades.

## S5 — Password and account security
- CEAC expects to move to a paid Supabase plan after completion and testing.
- Prepare leaked-password protection and other paid-plan security controls now, but do not make plan-dependent claims until the plan is upgraded.
- No shared production passwords.

## S6 — Database / RLS / performance
- Proceed with RLS, query-plan and index hardening.
- Prioritise security-sensitive/high-traffic paths rather than adding every advisor-suggested index mechanically.
- Preserve deliberate deny-direct-access tables and protected-HR RPC boundaries.

## S7 — Backup, privacy, data protection and access

### Governance and handover facts supplied by owner
- CEAC is not currently registered with Ghana's Data Protection Commission.
- CEAC controls its organisational and staff data.
- The Standard Institute / Standard Solution is the implementation technology provider during build, testing and handover.
- Current technical hosting in the builder's Supabase project does not transfer ownership/control of CEAC staff data to the builder.
- After completion and tested handover, the intended production state is migration to a CEAC-owned Supabase account/project.
- CEAC Technical Support becomes the day-to-day technical custodian after handover, subject to CEAC authority and least privilege.
- The Standard Institute must not retain standing production access after handover unless CEAC explicitly authorises support access.
- Staff onboarding must include a plain-language privacy notice describing relevant processing, access and protection.
- DPC registration/compliance remains an organisational governance action and must not be represented as complete merely because the platform is technically deployed.

### Access intent
- Salary: Administration/HR and CEO / Group Pastor only.
- Documents: visible to people for whom the document is relevant; generally read-only. Administration controls edit/download authority. Exact document-class matrix must be implemented rather than one blanket rule.
- Identifiers: security review must distinguish ordinary organisational identifiers from protected personal identifiers before broad exposure.
- Medical / leave information: upload must be supported; protected detail remains need-to-know.
- Annual leave: 24 working days per leave year under the confirmed organisation-wide rule, accruing quarterly at 6 working days per completed quarter, with joiner pro-rating.
- Ordinary unused annual leave expires at the end of the applicable leave year with no routine automatic carry-forward, while legally/contractually protected exceptions and approved cross-year leave must not be destroyed.
- Location evidence: technical and compliance access must be explicit and purpose-bound.

### Retention
- Draft a proposed retention schedule for owner/legal/policy approval.
- Do not invent statutory retention periods.

## S8 — Attendance, discipline and payroll consequences

### General work pattern
- Monday: 12:00–17:00.
- Tuesday–Friday: 10:00–17:00.
- Some teams/contracts differ; those exceptions will be provided later.
- Schedule must remain data-driven by person/unit/contract and effective date.

### Forgotten End Work
- System may close the session and alert the person when they return.
- Implementation must preserve factual audit evidence and a correction/reconciliation path.

### Grace / lateness
- 30-minute grace after commencement.
- Grace may be used twice per month; more than that should surface as a pattern.
- Formal "late": 45 minutes after commencement.
- The relationship between the 30-minute grace and 45-minute late threshold must be represented explicitly; no punitive inference is automatic.

### Absence and unpaid leave
- Approved unpaid leave and unauthorised absence are distinct states.
- Missing Start Work, End Work or other attendance evidence may create a factual review flag but does not automatically establish absence, misconduct, unpaid leave, discipline or a salary deduction.
- The eventual finding must consider effective schedule, approved leave, notices/exceptions, corrections and relevant evidence.

### Consequence authority
- For a staff member, the relevant Manager is kept in the review loop; Compliance and Administration/HR review; the Group Pastor/CEO is final authority for disciplinary or salary-deduction consequences.
- If the person under review is the Manager, the process must not require that Manager to approve their own case; escalation proceeds upward with Group Pastor/CEO final authority.
- Repeated issues can become a Compliance case.
- CEAC may calculate a proposed salary deduction only after an authorised human decision establishes that a deduction applies.
- Attendance evidence itself must never post or approve a Payroll deduction automatically.

## Account lifecycle
Accepted direction:
new employee → additional responsibility → transfer → manager change → temporary delegation → access deactivation → departure.

Former employees retain immutable historical attribution but lose active authentication/operational access promptly.

## Production observability
Accepted direction:
Technical Support should receive visible operational/security health for:
- unusual authentication failures;
- repeated rejected privileged RPC calls;
- failed scheduled jobs;
- invitation failures;
- migration drift;
- backup/restore failures;
- integration failures;
- privilege changes;
- department-specific technical defects where attribution is safe and useful.

Technical Support visibility must not become unrestricted access to HR/payroll/content. Default to metadata/health/status; content access remains governed separately.

## Technical Support product-fit lock
Owner direction:
- Value and operational usefulness precede sophistication or aesthetics.
- The Technical Support surface must be extremely plain-language and usable by a capable non-specialist.
- Technical concepts may exist underneath, but the default interface must explain each issue as:
  1. What happened?
  2. Who/what is affected?
  3. What should I do next?
  4. Do I need approval from anyone?
- Raw jargon such as RPC, RLS, migration drift, AAL2 or SECURITY DEFINER must not be required knowledge for ordinary Technical Support use. Deeper technical details may sit behind an optional "Technical details" disclosure.
- Do not build a large enterprise ITSM clone. Build only the operating controls CEAC actually needs at its current scale.
