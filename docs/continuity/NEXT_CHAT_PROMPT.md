# Next Chat Prompt — Continue CEAC OS Exactly From Current State

Paste the block below into a new ChatGPT chat.

---

Continue CEAC OS exactly from the LIVE canonical repository state.

Repository:
`thestandardinst-star/ceac-os`

GitHub is canonical.

THIS IS A CONTINUATION OF THE EXISTING BUILD AND PRODUCT-DECISION THREAD. DO NOT RESET THE PROJECT, RE-DISCOVER OLD DECISIONS, OR ASK ME TO REPEAT AGREED REQUIREMENTS THAT ARE ALREADY LOCKED IN THE REPOSITORY.

Before answering substantively or writing anything:

1. Fetch protected `main` HEAD.
2. Read, in this order:
   - `AGENTS.md`
   - `docs/continuity/CEAC_OS_CANONICAL_OWNER_CONTINUITY_2026-10-03.md`
   - `docs/employee-roster-payroll-fix/BUILD_STATE.md`
   - `docs/employee-roster-payroll-fix/SESSION_START_PROMPT.md`
   - `docs/final-product/PRODUCT_OWNER_DECISIONS.md`
   - `docs/final-product/PAYROLL_RULES_v1.md`
   - `docs/final-product/GO_LIVE_ORG_MAPPING.md`
3. Inspect recent protected-main commits and open PRs.
4. Inspect exact-head CI, Migration Replay, Account Security and Quality Gate.
5. Confirm one active writer before any implementation write.
6. If main has advanced beyond the SHAs in the docs, reconcile forward. Never reset, force-push, revert or erase newer accepted work.

Treat the canonical continuity document as binding owner context.

Key facts that must not be lost:

EMPLOYEE / HR
- 18 supplied staff rows are represented by 18 employee roster records.
- Employee identity is independent of auth/login identity.
- 2 confirmed linked profiles, 15 roster-only employees, 1 needs-review employee, 0 unaccounted source rows.
- Never fabricate emails or auth users.
- Job title does not grant authority.
- Administration People must include roster-only employees.
- Protected HR supports roster-only employees.
- Missing salary, bank, identifier or document values must remain truthful `Not recorded`.

PAYROLL
- Payroll population uses employee IDs, not auth profiles.
- Every active employee is included in a draft run.
- Administration prepares.
- Group Pastor approves.
- Automatic approval is prohibited.
- Approved Payroll is immutable.
- Corrections are attributable revisions.
- Do not invent salary, PAYE, SSNIT, allowance, loan, reimbursement or bonus values.

LEAVE
- Leave categories confirmed by the owner: annual, sick, maternity where relevant, paternity where relevant, and study leave where CEAC uses it.
- Approval flow: Employee request -> Manager approval -> Administration final approval.
- Employees can request/cancel leave whether or not a work session has started.
- No work session recorded does NOT mean absent.
- Leave/attendance must not automatically create Payroll deductions.
- Exact entitlement quantities, accrual/grant method, carry-over and unpaid-leave Payroll treatment remain unresolved and MUST NOT be invented.
- Preserve versioned policies/types, balances, approvals, escalation, exceptions, corrections and history.

VISUAL PARITY
The owner's screenshots/mockups are literal visible authorities, not inspiration.
Known remaining correction areas from independent screenshot inspection:
1. Home / shell.
2. Project / Task, especially selected-task/detail drawer richness and density.
3. Finance, which is still too sparse/generic compared with FINANCE-A.
4. People / Workforce, including unused space, geometry and employee treatment.
5. Work / BrandBook, the largest miss: weekly schedule, working-hours visualisation, notes/audio surface, task checklist and progress treatment.
6. Mobile Home, which is too long/stacked versus the approved compact reference.

Do not accept "premium", "same feel" or "same design language" as reference parity.

Required visual acceptance wording:
FUNCTIONAL CONTRACT PRESERVED: YES / NO
SECURITY/AUTHORITY PRESERVED: YES / NO
REFERENCE COMPONENT PARITY: YES / NO
RESPONSIVE ACCEPTANCE: YES / NO

CURRENT PRIORITY
Unless I explicitly change priority:
1. close any remaining authenticated ERC live-smoke evidence if still open;
2. inspect the current Leave implementation against the binding owner rules and correct gaps without inventing unresolved policy values;
3. execute the final literal visual-parity correction corridor screen-by-screen:
   Home/shell -> Project/Task -> Finance -> People/Workforce -> Work/BrandBook -> Mobile Home;
4. preserve all accepted RLS, security, capability, employee-roster, protected-HR, Payroll, Work, Finance, audit and integration foundations;
5. run exact-head technical gates and explicit side-by-side visual acceptance before declaring completion.

CONTINUOUS EXECUTION
Do not stop merely because a commit was pushed, a gate started/passed, a screenshot was captured, or a substage completed. Continue to the next safe step.

Valid stop conditions only:
- active writer conflict;
- genuine security ambiguity;
- destructive owner decision;
- indispensable missing credential/access;
- required owner policy input blocks the current task and no safe independent work remains.

Start by telling me the LIVE canonical HEAD, the exact current stage/state, and the next concrete action. Then continue the work rather than returning only a status report.

--- END PROMPT
