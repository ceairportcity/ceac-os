# CEAC Payroll Rules v1

## Salary basis
Individual monthly salary per employee. No salary grades/bands.

## Supported additions/deductions
Transport allowance; bonuses; loans/advances; penalties/deductions; reimbursements; other recurring allowances; December annual bonus.

## Authority
Administration prepares payroll. Group Pastor approves payroll. Automatic payroll approval is prohibited.

## Protected employee data
Ghana Card; SSNIT; TIN/tax identifier; bank name; account name; account number; emergency contact; residential address; date of birth; marital status.

## Protected employee documents
Contract; appointment letter; CV; ID copy; SSNIT documentation; qualifications/certificates; payslips.

Staff cannot open/download these HR documents. Administration has management access. Group Pastor may see all protected employee information.

## Employment types
Permanent; fixed-term contract; volunteer. Hybrid is a working pattern, not an employment type.

## Leave / Payroll boundary
Confirmed leave categories:
- annual;
- sick;
- maternity where relevant;
- paternity where relevant;
- study leave where CEAC uses it.

Confirmed leave authority:
Employee request → Manager approval → Administration final approval.

Leave requesting/cancellation must not depend on starting a work session. No work session recorded does not automatically mean absent.

Attendance and leave data must not automatically create Payroll deductions.

Confirmed annual-leave boundary:
- annual leave entitlement is 24 working days per leave year;
- accrual is quarterly at 6 working days per completed quarter;
- a joiner receives a pro-rated credit for the portion of the completed join quarter served;
- ordinary unused annual leave expires at year end with no routine automatic carry-forward;
- legally/contractually protected exceptions and an already-approved cross-year leave period must be preserved;
- annual leave working-day counts use attributable workforce schedule evidence rather than a guessed Monday-Friday pattern.

Still unresolved and therefore not to be invented:
- sick-leave entitlement quantity/rules beyond separation from annual leave;
- maternity/paternity entitlement quantities and detailed eligibility;
- study-leave quantity/rules;
- approved unpaid-leave salary treatment/calculation;
- any automatic Payroll consequence of leave, absence or attendance.

Payroll must therefore recognise the confirmed Annual policy while keeping unresolved secondary leave and unpaid-leave Payroll formulae manual-authoritative/unconfigured. Leave or attendance never posts a deduction automatically.

## Required protected foundations
`hr_private.*`; `capability_grants`; `platform_audit_events`; `payroll.prepare`; `payroll.approve`.

## Lifecycle
Period → Draft → Employee changes → Calculation → Flags → Human review → Group Pastor approval → Immutable approved run → Payslip/payment/export → Attributable adjustment/reversal.

Never derive payroll deductions automatically from attendance/work-session data without future explicit authority. Unconfirmed formulae remain configurable/manual authoritative inputs.

Cross-session owner continuity:
`docs/continuity/CEAC_OS_CANONICAL_OWNER_CONTINUITY_2026-10-03.md`
