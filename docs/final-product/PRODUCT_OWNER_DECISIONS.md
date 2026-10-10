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
- Exact leave entitlements, accrual/grant method, carry-over and unpaid-leave Payroll treatment remain unresolved and must not be invented.
- The independent visual audit remains binding: Home/shell, Project/Task, Finance, People/Workforce, Work/BrandBook and Mobile Home require final literal reference-parity correction.
- Future visual acceptance must compare rendered output directly against the designated reference rather than accepting a generic premium/design-language match.

Canonical cross-session detail:
`docs/continuity/CEAC_OS_CANONICAL_OWNER_CONTINUITY_2026-10-03.md`


## Binding mockup-conformity decision — 5 October 2026
- The product owner explicitly requires the live Executive Overview and Executive creation forms to visually conform to the supplied CEAC mockup rather than merely share its design language.
- Executive Overview authority: compact greeting → four summary metrics → Needs your attention + Ministry direction + Organisational overview → Recent activity + Upcoming meetings.
- Give out work authority: narrow right-side composer, compact work-type control, What needs doing → Assignee / Due date / Project / Team → Why this matters → progressive Attachments / Subtasks / Instructions / Finished result → one full-width primary action.
- New ministry objective authority: compact narrow composer with Objective name → Statement → Measurement → Start/Target dates → Status; CEAC-required parent direction and attributable reason remain preserved but visually subordinate through progressive disclosure.
- New announcement authority: compact narrow composer with Title → audience pills → Message → Attachments → availability/advanced options → one full-width primary action.
- Existing RLS, capability authority, draft/publish workflow, strategy parent requirement, audit history, truthful data, Work Engine semantics and all protected security/domain rules remain binding. Visual conformity may not fabricate values or weaken workflow truth.
- Mockup-only sample values, rich-text controls or actions that do not exist in CEAC OS must not be faked merely for visual similarity.

## Binding 10 October 2026 release and Technical Support ownership decision

- **Absolute handover requirement:** the canonical `ceairportcity/ceac-os` GitHub repository **must be PRIVATE before CEAC Technical Support receives handover**; verify visibility, collaborator permissions, handover records and MFA at the final checkpoint.
- **No GitHub Pro/paid account upgrade** is approved for the branch-protection workaround. The owner considered public-then-private only as an option; this must not be executed without explicit risk-reviewed authorization. Never assume GitHub public protection survives conversion back to private.
- The accepted release is an evidence-based, security-first, lightweight app rather than a broad untested promise. Monday **12 October 2026** is a target, not a substitute for GO / LIMITED PILOT / NO-GO evaluation.
- Keep the original Vercel production project and CEAC Supabase safe and unchanged until exact-commit checks, authority/privacy, real-role smoke, product visual acceptance, tested rollback and authorized cutover. No new production project, no hidden data migration, and no fake completion claims.
- Handover must include technical ownership, narrow Technical Support permissions, private repo, backup/restore and incident runbook, known issues, staff activation and a usable in-app Guide. Support may not self-approve payroll or gain unrestricted protected HR authority.
- Canonical detail and next-session instructions: `docs/continuity/CEAC_GO_LIVE_PRIVATE_HANDOVER_LOCK_2026-10-10.md`.
