# CEAC Leave Rules v1

Status: PARTIALLY CONFIRMED / POLICY VALUES STILL OPEN

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

## Confirmed workflow behavior
- An employee may request or cancel leave whether or not a work session has started.
- No work session recorded does not automatically mean the employee is absent.
- Leave and attendance are related operational evidence but remain separate authority domains.
- Attendance/work-session data must not automatically create a Payroll deduction.
- Payroll effects from unpaid leave must remain disabled/manual-authoritative until CEAC confirms the calculation rule.

## Required leave-domain capabilities
The data model and UI must be able to preserve:
- versioned leave types and policies;
- entitlement quantities once confirmed;
- grant/accrual method once confirmed;
- carry-over rules once confirmed;
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
- annual-leave entitlement quantity;
- sick-leave entitlement quantity;
- maternity/paternity entitlement quantities and detailed eligibility;
- study-leave quantity/rules;
- start-of-year grant versus monthly accrual;
- carry-over quantity, expiry and treatment;
- unpaid-leave classification rules;
- unpaid-leave Payroll formula;
- any automatic Payroll consequence of absence, attendance or leave.

## Truthful UI rule
Until CEAC confirms an unresolved value:
- do not display an assumed entitlement;
- do not silently reuse an old placeholder such as a fixed annual-day count;
- show the policy/value as not configured or not yet confirmed;
- preserve request/approval functionality where the unresolved value does not block the workflow.

## Payroll boundary
This file must be read together with:
`docs/final-product/PAYROLL_RULES_v1.md`

Leave or attendance must never modify salary automatically without a future explicit owner decision.

## Cross-session continuity
Also read:
`docs/continuity/CEAC_OS_CANONICAL_OWNER_CONTINUITY_2026-10-03.md`
