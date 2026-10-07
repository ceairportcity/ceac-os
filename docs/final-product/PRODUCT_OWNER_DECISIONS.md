# Product Owner Decisions

## Binding decisions — 2 October 2026
- FPG supersedes conflicting older visual/VF sequencing.
- Approved references are literal visible authorities, not inspiration.
- Material visible deviations require owner approval before implementation.
- Exact gold-standard Project/Task and Finance screens precede component extraction.
- Finance remains an operational CEAC surface, not a replacement accounting system.
- Administration prepares payroll; Group Pastor approves; automatic approval is prohibited.
- Staff cannot open/download protected HR documents; Administration manages them; Group Pastor may see all protected employee information.
- Employment types: permanent, fixed-term contract, volunteer. Hybrid is a work pattern, not an employment type.
- Leave approval: Employee → Manager → Administration final approval.
- Organisational classifications follow GO_LIVE_ORG_MAPPING.md.

## Binding continuity decisions — 3 October 2026
- Employee identity is independent of login/account identity.
- The production employee roster must continue to represent all 18 supplied staff rows; unresolved login/email state must not remove an employee.
- No fabricated email, auth user, salary, bank/payment value, statutory value or protected identifier is allowed.
- Payroll population must use the employee roster, not auth profiles.
- Roster-only employees must remain eligible for protected-HR and Payroll representation.
- Job-title wording never grants application authority.
- Leave categories confirmed by the owner: annual, sick, maternity where relevant, paternity where relevant, and study leave where CEAC uses it.
- Leave requests must be possible whether or not a work session has started.
- No work session recorded does not equal absence.
- Leave/attendance must not automatically create a Payroll deduction.
- The independent visual audit remains binding: Home/shell, Project/Task, Finance, People/Workforce, Work/BrandBook and Mobile Home require final literal reference-parity correction.
- Future visual acceptance must compare rendered output directly against the designated reference rather than accepting a generic premium/design-language match.

Canonical cross-session detail:
`docs/continuity/CEAC_OS_CANONICAL_OWNER_CONTINUITY_2026-10-03.md`

## Binding go-live owner decisions — 7 October 2026

### Identity, authority and onboarding
- Privileged accounts must use MFA at production go-live. Privilege is capability/authority based, not title based.
- Only confirmed real email addresses may be used for account activation/invitation. Employees without a confirmed email remain represented in the employee roster and must not receive fabricated accounts.
- Job title never grants CEAC authority.
- Technical Support remains organisationally associated with Media & Technical but operates as an autonomous service team for its technical-support mandate, reporting directly to Administration & HR and the Group Pastor. Technical Support is capability-scoped and is not a hidden super-admin.

### Annual leave
- Organisation-wide annual-leave entitlement is 24 working days per leave year.
- Annual leave accrues quarterly at 6 working days per completed quarter.
- Joiners during a quarter receive an appropriately pro-rated entitlement; the implementation must not award a full completed-quarter credit to a person who did not serve the full quarter.
- Accrued unused annual leave remains available during the same leave year.
- Ordinary unused annual leave expires at the end of the applicable leave year; there is no routine automatic carry-forward.
- Expiry logic must preserve any exception that CEAC is legally or contractually required to preserve and must not destroy an approved leave period merely because it crosses a year boundary.
- Sick leave remains separate from annual leave. Maternity, paternity and study-leave quantities/eligibility remain governed by their applicable policy and must not be invented.

### Unpaid leave, unauthorised absence and consequences
- Approved unpaid leave and unauthorised absence are distinct states.
- Missing attendance evidence alone does not create unpaid leave, misconduct, discipline or a salary deduction.
- Potential unauthorised absence is factual evidence for human review.
- For a staff member, the relevant Manager must be kept in the review loop; Compliance and Administration/HR review the matter; the Group Pastor/CEO is the final authority for disciplinary or salary-deduction consequences.
- Where the person under review is the Manager, escalation must not depend on that Manager approving their own case; the Group Pastor/CEO remains the final authority.
- CEAC may calculate a proposed deduction only after an authorised human decision establishes that a deduction applies. Attendance evidence itself must never post a Payroll deduction automatically.

### Data ownership and handover
- CEAC controls its organisational and staff data.
- The Standard Institute / Standard Solution is the implementation technology provider during build, testing and handover; hosting data in the builder's current Supabase project does not transfer ownership/control of CEAC staff data to the builder.
- After completion and tested handover, the intended production state is migration to a CEAC-owned Supabase account/project.
- CEAC Technical Support becomes the day-to-day technical custodian after handover, subject to CEAC authority and least privilege.
- The Standard Institute must not retain standing production access after handover unless CEAC explicitly authorises support access.
- Staff onboarding must include a plain-language privacy notice describing relevant processing, access and protection. DPC registration/compliance remains an organisational governance action and must not be falsely represented as complete merely because the technical platform is deployed.

## Binding mockup-conformity decision — 5 October 2026
- The product owner explicitly requires the live Executive Overview and Executive creation forms to visually conform to the supplied CEAC mockup rather than merely share its design language.
- Executive Overview authority: compact greeting → four summary metrics → Needs your attention + Ministry direction + Organisational overview → Recent activity + Upcoming meetings.
- Give out work authority: narrow right-side composer, compact work-type control, What needs doing → Assignee / Due date / Project / Team → Why this matters → progressive Attachments / Subtasks / Instructions / Finished result → one full-width primary action.
- New ministry objective authority: compact narrow composer with Objective name → Statement → Measurement → Start/Target dates → Status; CEAC-required parent direction and attributable reason remain preserved but visually subordinate through progressive disclosure.
- New announcement authority: compact narrow composer with Title → audience pills → Message → Attachments → availability/advanced options → one full-width primary action.
- Existing RLS, capability authority, draft/publish workflow, strategy parent requirement, audit history, truthful data, Work Engine semantics and all protected security/domain rules remain binding. Visual conformity may not fabricate values or weaken workflow truth.
- Mockup-only sample values, rich-text controls or actions that do not exist in CEAC OS must not be faked merely for visual similarity.
