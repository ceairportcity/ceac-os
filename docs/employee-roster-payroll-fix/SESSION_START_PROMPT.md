# Portable Session Start — Employee Roster & Payroll Completeness

Use this prompt when a new ChatGPT/Codex/Claude session must continue CEAC OS from the current canonical state.

---

Continue CEAC OS from the LIVE canonical GitHub state.

Repository:
`thestandardinst-star/ceac-os`

GitHub is canonical.

THIS IS AN IMPLEMENTATION / RELEASE-CLOSURE CONTINUATION, NOT A STATUS-REPORT REQUEST.

Before any write:

1. Fetch protected `main` HEAD.
2. Read:
   - `AGENTS.md`
   - `docs/continuity/CEAC_OS_CANONICAL_OWNER_CONTINUITY_2026-10-03.md`
   - `docs/final-product/LEAVE_RULES_v1.md`
   - `docs/employee-roster-payroll-fix/START_HERE.md`
   - `docs/employee-roster-payroll-fix/IMPLEMENTATION_SEQUENCE.md`
   - `docs/employee-roster-payroll-fix/BUILD_STATE.md`
   - this file.
3. Fetch PR #94 and PR #95 history.
4. Inspect exact-head CI, Migration Replay, Account Security and Quality Gate.
5. Confirm one active writer before changing code or docs.
6. If canonical state advanced, reconcile forward. Never reset, force-push, revert or erase newer accepted work.

## Last verified canonical state

Last verified protected main before the continuity-lock PR:
`16ec9ca1263761c8c1631107184e5ad30ec1a856`

Latest main commit at that handoff:
`ERC: portable continuation handoff (#96)`

Exact-head gates at that main:
- CI — PASS
- Migration Replay — PASS
- Account Security — PASS
- Quality Gate — PASS

PR #94:
- merged
- employee roster + Payroll completeness implementation

PR #95:
- merged
- production closure reconciliation evidence

Re-fetch before trusting these values.

## What is already complete

ERC0 through ERC7 are implemented and accepted.

The corrected employee model is now:

- `public.employee_roster` is the canonical employee representation;
- an employee does NOT require an auth account;
- `profile_id` is optional;
- identity states are `linked`, `roster_only`, and `needs_review`;
- organisational membership is separate from authority/capability grants;
- unresolved login/email identity does not erase an employee;
- no fabricated email or auth user is allowed;
- job title never grants application authority.

Production roster is verified as:

- source staff rows: 18
- employee roster records: 18
- confirmed linked profiles: 2
- roster-only employees: 15
- needs-review employees: 1
- unaccounted source rows: 0
- fabricated emails: 0
- fabricated auth users: 0
- organisational membership rows: 27
- employees with office-unit membership: 17
- one programme-only employee preserved without inventing a department

Do not change these counts unless new owner-approved source data is supplied.

## Protected HR state

Production migration `104_employee_protected_hr_subject` is applied.

Protected HR now uses employee-roster subjects and supports roster-only employees.

Supported protected records include:
- identifiers;
- employment terms;
- compensation history;
- payment details;
- protected documents;
- employee-subject audit evidence.

Missing protected values remain explicitly `Not recorded`.

Do not invent:
- salary;
- bank/payment data;
- Ghana Card;
- SSNIT;
- TIN;
- statutory deductions;
- allowance values;
- loan values;
- reimbursement values;
- bonus values.

## Payroll state

Production migration `105_payroll_employee_population` is applied.

Payroll population uses canonical employee IDs.

- `employee_id` is required on Payroll entries;
- linked `profile_id` is optional compatibility context;
- every active employee in the roster is included in a draft Payroll run;
- roster-only employees cannot be silently omitted;
- compensation/payment lookup uses employee-subject protected HR;
- missing salary/payment data creates factual review flags;
- Administration prepares;
- Group Pastor approves;
- preparation and approval remain separated;
- approved Payroll is immutable;
- corrections preserve employee identity.

Production migration `106_payroll_readiness_summary` is applied.

Last verified Payroll readiness:
- active employees: 18
- Payroll employee population: 18
- compensation recorded: 0
- compensation missing: 18
- payment details recorded: 0
- payment details missing: 18
- identity-review employees: 1

These are truthful missing-data states, not missing employees.

## Leave rules that must persist

The canonical Leave rules are now stored in `docs/final-product/LEAVE_RULES_v1.md`.

Confirmed:
- annual, sick, maternity where relevant, paternity where relevant, and study leave where used;
- Employee request → Manager approval → Administration final approval;
- leave request/cancel is not gated by starting a work session;
- no session recorded does not equal absence;
- leave/attendance cannot automatically create a Payroll deduction.

Unresolved and not to be invented:
- entitlement quantities;
- accrual/start-year grant method;
- carry-over;
- unpaid-leave treatment and Payroll calculation.

## Current remaining ERC closure item

Only one ERC closure item remains:

AUTHENTICATED LIVE PRODUCT SMOKE against the protected deployed Vercel product.

The previous session could not independently perform this because its Vercel connector did not have authorization to the project/team.

Do NOT reinterpret this as a code defect.

The next execution-enabled session must:

1. Re-fetch canonical main.
2. Verify the production deployment corresponds to current accepted main or identify the exact deployed SHA.
3. Authenticate into the deployed CEAC product with approved test/admin access.
4. Inspect Administration -> People.
5. Confirm the live UI shows all 18 employees.
6. Confirm linked, roster-only, and needs-review identity states are visible truthfully.
7. Open roster-only employee records and confirm they do not require a login account.
8. Confirm protected HR controls are present for authorised Administration.
9. Inspect Administration -> Payroll.
10. Confirm Payroll readiness reports 18 active employees.
11. Confirm compensation missing = 18 and payment details missing = 18 until authoritative values are entered.
12. Confirm the first-run workflow is present and does not omit roster-only employees.
13. Confirm no salary/bank/protected value is invented.
14. Capture desktop and relevant mobile/responsive evidence.
15. Record the exact deployed SHA, test identity/role, observations and evidence.
16. If all checks pass, update `docs/employee-roster-payroll-fix/BUILD_STATE.md` to ERC CLOSED and commit through protected-main rules.

Do not reopen ERC architecture unless the live smoke exposes a real defect.

## Valid stop conditions

Do not stop because:
- a commit was pushed;
- a gate started;
- a gate passed;
- documentation was updated;
- a screenshot was captured.

Stop only for:
- active writer conflict;
- genuine security ambiguity;
- destructive owner decision;
- indispensable missing access/credential;
- live product evidence showing a real defect that requires correction.

## Next unresolved product work after ERC closes

After ERC is genuinely closed, the next known work is the final literal visual-parity correction identified by independent screenshot inspection.

Do NOT start that visual work until ERC live smoke is closed unless the owner explicitly changes priority.

The known visual correction areas are:

1. Home / shell — strongest current match, but not fully literal.
2. Project / Task — structurally good, selected-task drawer and component richness still need closer literal parity.
3. Finance — composition is still too sparse/generic compared with FINANCE-A.
4. People / Workforce — partial match; density, geometry and unused space need correction.
5. Work / BrandBook — largest visual miss; weekly schedule, working-hours visualisation, note/audio surface, task checklist and progress treatment were not reproduced literally enough.
6. Mobile Home — too long and operationally stacked compared with the approved compact reference.

For that later visual pass:
- preserve all accepted security, RLS, Payroll, employee-roster, Work, Finance and audit foundations;
- make no architecture changes merely for styling;
- use the actual reference images as literal component authorities;
- do not accept “same feel”, “premium”, or “same principles” as visual parity;
- compare rendered output side-by-side against the references;
- preserve truthful CEAC data and empty states.

END OF HANDOFF.
