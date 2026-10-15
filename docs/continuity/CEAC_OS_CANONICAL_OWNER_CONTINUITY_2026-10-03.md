# CEAC OS Canonical Owner Continuity — 3 October 2026

This document is a binding cross-session continuity record for CEAC OS.

GitHub is canonical. A new ChatGPT, Codex or Claude session must read this file before changing CEAC OS.

## 1. Current product state

Protected main at the time this continuity record was created:
`16ec9ca1263761c8c1631107184e5ad30ec1a856`

Re-fetch main before trusting this SHA.

The Employee Roster & Payroll Completeness repair has been implemented and merged.

Canonical employee state:
- 18 source staff rows are represented by 18 employee roster records;
- 2 confirmed employee/profile links;
- 15 roster-only employees;
- 1 employee in `needs_review` identity state;
- 0 unaccounted source rows;
- no fabricated email addresses;
- no fabricated auth users;
- employee identity is independent of login/account identity;
- job title does not grant application authority.

Administration People must continue to show employees without requiring a login account.

Payroll must continue to populate from the employee roster, not from auth profiles.

## 2. Protected HR and Payroll rules

Protected HR supports employee-roster subjects, including roster-only employees.

Supported protected records:
- identifiers;
- employment terms;
- compensation history;
- payment details;
- protected employee documents;
- attributable protected-HR audit evidence.

Missing values must show as `Not recorded`. Never invent protected values.

Payroll authority:
- Administration prepares;
- Group Pastor approves;
- automatic approval is prohibited;
- preparation and approval must remain separated;
- approved Payroll is immutable;
- corrections must be attributable successor revisions.

Payroll population:
- every active employee must be included in a draft run;
- roster-only employees cannot be silently omitted;
- missing base salary or payment information becomes an explicit factual flag;
- compensation and payment details are authoritative inputs, never inferred from role, attendance or work output.

Finance remains an operational CEAC surface, not a replacement accounting system. External Excel/Google Sheets/manual accounting may remain authoritative where policy says so.

## 3. Binding leave-management decisions

These owner decisions must be preserved in Workforce, My Hub, Administration and Payroll-related work.

Confirmed leave categories:
- annual leave;
- sick leave;
- maternity leave where relevant;
- paternity leave where relevant;
- study leave where used by CEAC.

Confirmed approval flow:
Employee request -> Manager approval -> Administration final approval.

Confirmed behavior:
- employees must be able to request/cancel leave whether or not a work session has been started;
- no work session recorded does NOT automatically mean absent;
- leave, attendance and Payroll must remain separate authority domains;
- attendance/work-session data must not automatically create a salary deduction;
- unpaid-leave Payroll effects must not be calculated until CEAC confirms the rule.

The leave model must preserve:
- versioned leave types/policies;
- entitlements;
- accrual or grant method;
- carry-over;
- balances;
- Manager approval;
- Administration final approval;
- escalation where applicable;
- schedules;
- exceptions;
- corrections/reversals/history.

Superseded by the binding 7 October 2026 go-live decisions in `docs/final-product/PRODUCT_OWNER_DECISIONS.md` and `docs/final-product/LEAVE_RULES_v1.md`:
- annual leave is 24 working days per leave year;
- accrual is quarterly at 6 working days per completed quarter;
- joiners are pro-rated within the quarter;
- ordinary unused annual leave expires at the end of the applicable leave year with no routine automatic carry-forward, while legally/contractually protected exceptions and approved cross-year leave must be preserved;
- approved unpaid leave and unauthorised absence are distinct states;
- attendance evidence may trigger human review but never an automatic disciplinary or Payroll consequence;
- Manager, Compliance and Administration/HR participate as applicable, with Group Pastor/CEO final authority for disciplinary or salary-deduction consequences.

Still unresolved and MUST NOT be invented:
- exact sick-leave entitlement quantity/rules beyond its separation from annual leave;
- maternity/paternity quantities and detailed eligibility;
- study-leave quantity/rules;
- any automatic Payroll consequence of absence/leave (automatic consequences remain prohibited).

## 4. Literal visual-reference rules

The product owner's supplied mockups and screenshots are literal visible authorities for their designated surfaces. They are not merely inspiration or design principles.

Surface authority:
- original CEAC premium mockup -> Home and shell;
- Project/Task references -> Project, Work and selected-task/detail treatment;
- FINANCE-A -> Finance and suitable Payroll financial surfaces;
- PEOPLE-A -> People, HR and Workforce;
- BrandBook reference -> Work/weekly schedule/working-hours/note/task/progress treatment.

A screen does not pass visual parity simply because it is clean, modern, functional or premium.

Required acceptance language:
- FUNCTIONAL CONTRACT PRESERVED: YES / NO
- SECURITY/AUTHORITY PRESERVED: YES / NO
- REFERENCE COMPONENT PARITY: YES / NO
- RESPONSIVE ACCEPTANCE: YES / NO

## 5. Independent visual-audit findings still requiring correction

After inspecting final rendered Quality Gate screenshots against the owner's actual references, the following remains open:

1. Home / shell
   - strongest current match;
   - still not fully literal;
   - richer quick-create treatment and lower-page composition require correction.

2. Project / Task
   - good structure;
   - selected-task drawer, metadata richness, controls and density still need closer literal parity.

3. Finance
   - only partial parity;
   - current composition is too sparse/generic relative to FINANCE-A;
   - KPI hierarchy, cards, charts, tables, controls and dashboard density require correction.

4. People / Workforce
   - partial parity;
   - unused space, grid/card geometry, controls and employee treatment require correction.

5. Work / BrandBook
   - largest remaining visual miss;
   - weekly schedule;
   - working-hours visualisation;
   - notes/audio surface;
   - task checklist;
   - progress treatment;
   must be recreated much more literally where CEAC has truthful supporting data.

6. Mobile Home
   - technically responsive but too long/stacked;
   - should match the compact approved mobile reference more closely.

The next visual correction must NOT redesign architecture, RLS, authority, Payroll, employee roster, Work Engine or audit foundations.

## 6. Acceptance weakness that must not recur

The existing Quality Gate captures screenshots and validates browser behavior, roles, security and workflows, but visual acceptance previously became too permissive.

Do not accept future visual work merely because screenshots were captured or because a screen uses the same design language.

Future visual closure must perform an explicit side-by-side human inspection against the designated reference and record material differences.

## 7. Current release/closure item

The ERC implementation, production roster, protected-HR subject model, Payroll employee population and Payroll readiness are merged and technically verified.

The remaining ERC evidence item recorded in the existing build state is an authenticated live Administration People + Payroll smoke against the protected Vercel product.

Do not treat lack of Vercel connector authorization as an application defect.

## 8. Execution rules

- GitHub is canonical.
- One active writer at a time on a branch.
- Re-fetch before every new implementation session.
- If canonical state advanced, reconcile forward.
- Never reset, force-push, revert or erase newer accepted work.
- Do not fabricate data to satisfy screenshots.
- Do not infer authority from job titles.
- Do not create duplicate permission, audit or workflow frameworks.
- Preserve accepted RLS, capability, protected-HR, employee-roster, Work, Finance, audit and integration foundations.

## 9. Priority for the next implementation session

Unless the owner explicitly changes priority:

1. Re-fetch current main and read the canonical continuity files.
2. Close the remaining authenticated ERC live-smoke evidence if access is available.
3. Audit the current leave UI/data implementation against the binding leave decisions above and correct only gaps that can be implemented without inventing unresolved policy values.
4. Execute the final literal visual-parity correction corridor screen-by-screen:
   Home/shell -> Project/Task -> Finance -> People/Workforce -> Work/BrandBook -> Mobile Home.
5. Run exact-head technical and visual acceptance.
6. Do not call the visual programme closed until the rendered product is compared directly against the owner's actual references.

This file supersedes any older session memory that conflicts with these owner decisions.
