# Product Owner Decisions

## Binding owner decision — 14 October 2026: two-stage release and continuing CAC product development

**Authority:** [Two-Stage Production and Future Supabase Continuity](../continuity/CEAC_TWO_STAGE_PRODUCTION_AND_FUTURE_SUPABASE_CONTINUITY_2026-10-14.md).

1. **Stage 1** targets the existing production Supabase `efjljhftsesssumtshvp`, existing private GitHub `ceairportcity/ceac-os` and existing Vercel `ceac-os`, using proven email/password sign-in instead of requiring Google OAuth for the first release. This is a release target subject to compatibility, preserved privileged MFA, recovery, security and explicit GO, not permission to deploy unverified work.
2. **Stage 2** remains a required later move to the already-reported CE Airport City-controlled Supabase project (verify project ID/ownership) with Google-only approved identity sign-in and verified TOTP/AAL2 for every role. This is **deferred, not cancelled or completed**. Do not revive blocked ownership transfer of the old project or unnecessarily create another new project.
3. **Ongoing app improvements are expected after Stage 1.** The architecture and CAC final product discussions are not finished. Any change to Stage 1's production schema, data, policies, roles, files, Auth, UI or approved features must be recorded in a forward-migration/compatibility register and reflected in Stage 2's eventual current-state migration. The old 144-migration checkpoint is not the final target specification.
4. Historical test users being dispensable does **not** justify losing live operational data created after Stage 1 launch. Reconcile and protect all genuine production data, audited actions and private files; use a tested reversible cutover and separate owner GO for Stage 2.
5. Neither stage weakens existing privacy, RLS, payroll/HR authority, security, recoverability or accepted product/visual decisions. The owner must separately approve any substantive scope reduction and final production cutover.


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
