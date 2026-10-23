> **23 October 2026 owner correction — current authority:** The yearly 24-day allowance consists of **15 annual-leave days plus ONE shared nine-day allowance**. The owner confirmed the shared allowance is earned gradually. Retain completed-quarter accrual and joiner pro-rating: **3.75 annual + 2.25 shared per full completed quarter**. Sick and study share the nine days; do not give each category its own nine days. Other category membership requires an explicit policy decision; maternity/paternity and protected entitlements are not silently capped. This correction supersedes the older 24-annual / 6-annual-quarter wording below. Runtime activation and release evidence are recorded separately, not implied by this contract.

# CEAC Leave Rules v1

Status: GO-LIVE ANNUAL-LEAVE POLICY CONFIRMED / SECONDARY LEAVE POLICIES PARTIALLY OPEN

This file contains binding owner decisions for CEAC leave management. Unresolved quantities and formulas must remain configurable/unset rather than invented.

## Confirmed leave categories
- Annual leave.
- Sick leave.
- Maternity leave where relevant.
- Paternity leave where relevant.
- Study leave where CEAC uses it.

## Confirmed approval flow
Employee request → Manager approval → Administration final approval.

Manager approval is not final approval. Administration owns the final leave decision.

## Confirmed annual-leave entitlement and accrual
- Annual-leave entitlement is 15 working days per leave year for eligible CEAC staff under the confirmed organisation-wide rule.
- Annual leave accrues quarterly at 3.75 working days per completed quarter.
- A person joining during a quarter receives a pro-rated entitlement appropriate to the portion of the quarter served; CEAC must not award a full completed-quarter credit to a person who did not serve the full quarter.
- Accrued unused days remain available during the same leave year.
- Ordinary unused annual leave expires at the end of the applicable leave year. There is no routine automatic carry-forward.
- Expiry must preserve any legally or contractually protected exception and must not destroy an approved leave period merely because that approved period crosses a year boundary.
- Sick leave is separate from annual leave.

## Confirmed workflow behavior
- An employee may request or cancel leave whether or not a work session has started.
- No work session recorded does not automatically mean the employee is absent.
- Leave and attendance are related operational evidence but remain separate authority domains.
- Attendance/work-session data must not automatically create a Payroll deduction.
- Approved unpaid leave and unauthorised absence are distinct states.

## Unauthorised absence and consequence review
- Missing Start Work, End Work or other attendance evidence may create a factual review flag; it does not automatically establish misconduct, unpaid leave, discipline or a salary deduction.
- The eventual finding must consider the person's effective schedule, approved leave, notices/exceptions, corrections and relevant evidence.
- For a staff member, the relevant Manager is kept in the review loop; Compliance and Administration/HR review; the Group Pastor/CEO is final authority for disciplinary or salary-deduction consequences.
- If the person under review is the Manager, the process must not require that Manager to approve their own case; escalation proceeds to the appropriate higher authority, with Group Pastor/CEO final authority.
- If an authorised human decision establishes that a salary deduction applies, CEAC may calculate the proposed consequence for Payroll review. Attendance evidence itself must never post or approve a Payroll deduction automatically.

## Required leave-domain capabilities
The data model and UI must preserve:
- versioned leave types and policies;
- the confirmed 15-day annual entitlement and shared nine-day sick/study allowance;
- quarterly 3.75 annual-day and 2.25 shared-day accrual and joiner pro-rating;
- year-end expiry and exception handling;
- balances;
- request history;
- Manager approval;
- Administration final approval;
- escalation where applicable;
- schedule/calendar effect;
- exceptions;
- corrections/reversals;
- attributable decision history.

## Still unresolved — do not invent
- additional categories beyond sick/study to include in the shared allowance;
- maternity/paternity entitlement quantities and detailed eligibility;
- detailed study-leave eligibility beyond participation in the shared allowance;
- any organisation-wide formula for approved unpaid-leave salary treatment that has not passed the required human decision;
- any automatic Payroll consequence of absence, attendance or leave.

## Truthful UI rule
- Display the confirmed annual entitlement/accrual only where the employee is covered by the confirmed CEAC policy.
- Do not silently invent secondary leave quantities.
- Show unresolved secondary policy values as not configured/not yet confirmed where they are required.
- Preserve request/approval functionality where an unresolved secondary value does not block the workflow.

## Payroll boundary
This file must be read together with:
`docs/final-product/PAYROLL_RULES_v1.md`

Leave or attendance must never modify salary automatically. A salary consequence requires an attributable authorised human decision before Payroll calculation/review.

## Cross-session continuity
Also read:
`docs/continuity/CEAC_OS_CANONICAL_OWNER_CONTINUITY_2026-10-03.md`
