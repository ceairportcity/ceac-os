# CEAC Security & Technical Support — Owner Decisions Lock

Date: 6 October 2026
Status: OWNER DECISIONS RECORDED / IMPLEMENTATION PENDING
Canonical baseline: protected main `3feb68e9fa46da9888a7dfa9cef942b1f6133f7c`

This file records product-owner decisions supplied on 6 October 2026 so the security programme does not live only in chat. These decisions are binding inputs unless the owner later changes them explicitly.

## S1 — MFA and privileged access

- MFA enforcement is required for privileged accounts in the final production system.
- The current build remains in active test/development and privileged test accounts are still needed.
- Do not require final human MFA enrollment yet.
- Build all technical MFA/AAL2 enforcement, tests, privilege boundaries, recovery rules and readiness controls now.
- Final enrollment is a go-live/onboarding gate.

## S2 — Authenticated SECURITY DEFINER functions

- Proceed with the complete semantic audit and attack-surface reduction.
- Preserve intentional capability/RLS semantics.
- Do not weaken accepted authorization merely to clear advisor warnings.

## S3 — Real onboarding and Technical Support

Owner intent:
- Gabriel is intended to become Manager / Team Lead for Technical Support.
- Technical Support is presently related to / nested inside Media & Technical, but should answer directly to Administration & HR and the CEO / Group Pastor for its technical-support mandate.
- Technical Support needs organisation-wide technical authority comparable in operational reach to a unit manager, but that authority must be capability-scoped rather than granting unrelated HR, payroll or executive powers.
- Many Technical Support members are volunteers.
- Gabriel's current Media & Technical operating placement/account should not remain as a conflicting active role after the final Technical Support transition.
- Historical attribution must be preserved; no account or work history may be deleted.
- The exact data-model representation of Technical Support (independent unit vs nested service team with independent reporting/capability authority) requires architecture resolution before production mutation.
- Real HR/Admin invitation will be used to validate onboarding after that model is accepted.

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

### Governance facts supplied by owner
- CEAC is not currently registered with Ghana's Data Protection Commission.
- The Standard Institute / Standard Solution is the builder and is intended to hand over the platform completely to CEAC Technical Support after completion.
- CEAC Technical Support is intended to own technical/privacy operations after handover.
- No formal privacy notice or data-processing agreement currently exists.

### Access intent
- Salary: Administration/HR and CEO / Group Pastor only.
- Documents: visible to people for whom the document is relevant; generally read-only. Administration controls edit/download authority. Exact document-class matrix must be implemented rather than one blanket rule.
- Identifiers: owner said "everyone"; security review must distinguish ordinary organisational identifiers from protected personal identifiers before exposing data broadly.
- Medical / leave information: upload must be supported; protected detail remains need-to-know.
- Leave entitlement: 24 days per year for everyone, subject to formal policy effective-date/accrual/carry-over rules.
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

### Absence
Owner description: not showing up / no Start Work and/or End Work on an agreed working day or time.
Security/product rule: lack of session evidence alone must not automatically become misconduct or payroll consequence. The eventual absence finding must use schedule, approved leave/notices/exceptions and human decision.

### Authority
- Group Pastor can excuse/approve exceptions.
- Repeated issues can become a Compliance case.
- Group Pastor / CEO decides disciplinary outcomes.
- CEAC may eventually use salary deductions, but deductions remain disabled until legal/HR policy review and explicit approved rules.

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
