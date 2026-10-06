# CEAC OS — Next Chat Prompt

Continue CEAC OS from the LIVE canonical repository state.

Active programme: Onboarding, Access & Presence Foundation. Read the three 6 October continuity files before coding:
- `docs/continuity/CEAC_ONBOARDING_COMPLIANCE_DISCOVERY_2026-10-06.md`
- `docs/continuity/CEAC_ONBOARDING_DECISIONS_LOCKED_2026-10-06.md`
- `docs/continuity/CEAC_ONBOARDING_NEXT_BUILD_2026-10-06.md`

These preserve the wider discovery and deferred policy questions. Never infer that this foundation completes the broader Compliance programme. Reconcile the current protected-main and exact-head gates before continuing.

Current foundation checkpoint: PR #111 is OPEN, with verified implementation head `7e8ce725eb049b3bc95c6b18b5d1fcdfff7a6d46`. CI, Migration Replay, Account Security, full SQL authority gates and all 677 browser tests pass on that code head. Subsequent documentation-only checkpoints do not change the verified implementation. Protected main remains `76cea2e457b7d624f54ca961ad14bb62ea359ebd`; production ends at migration 110.

Release blocker: Supabase Auth rejects the intended public activation/recovery redirects and falls back to the Vercel-protected hostname. Dashboard authentication remains unverified and the secure credential request was declined. Respect the decline; resume secure sign-in only when the owner asks, then repair and verify the public Site URL/redirect settings, then apply migration 111, perform protected merge and exact-main/deployed-role acceptance. Do not claim completion or merge merely because automated checks are green. Read the next-build completion record for exact run IDs and remaining steps; never put credentials into chat, repository files or browser automation.

Repository:
`thestandardinst-star/ceac-os`

GITHUB IS CANONICAL.

The Operational Clarity & Collaboration Refinement programme is COMPLETE. Do not restart OCR1–OCR6 and do not ask me to repeat requirements already locked into the repository.

Last accepted product closure:
- PR #103 — Operational Clarity & Collaboration Refinement — merged.
- Accepted implementation head: `674efe5fd2ae92ebaa4689ebe39e59e33cb8f3ae`
- Protected-main product merge: `bfb5aa9e5942d44dd0a8fcfa7a3be350cace129e`
- Pre-merge Quality Gate #1878: PASS.
- Post-merge CI #2078: PASS.
- Post-merge Migration Replay #1681: PASS.
- Post-merge Account Security #1853: PASS.
- Post-merge Quality Gate #1879: PASS.
- Post-merge Vercel commit status: SUCCESS.

Before answering substantively or making any write:

1. Fetch protected `main` HEAD. The SHA above is a historical closure checkpoint only; reconcile forward if main has advanced.
2. Read:
   - `AGENTS.md`
   - `docs/continuity/CEAC_OS_CANONICAL_OWNER_CONTINUITY_2026-10-03.md`
   - `docs/operational-clarity/BUILD_STATE.md`
   - `docs/operational-clarity/FINAL_CLOSURE_2026-10-04.md`
   - `docs/final-product/PRODUCT_OWNER_DECISIONS.md`
   - `docs/final-product/PAYROLL_RULES_v1.md`
   - `docs/final-product/LEAVE_RULES_v1.md`
   - `docs/final-product/GO_LIVE_ORG_MAPPING.md`
3. Inspect recent protected-main commits and open PRs.
4. Inspect exact-head CI, Migration Replay, Account Security, Quality Gate and deployment status where relevant.
5. Confirm one active implementation writer before writing.
6. Never reset, force-push, revert or erase newer accepted work. Reconcile forward.

Binding domain rules that remain unchanged:

EMPLOYEE / HR
- 18 supplied staff rows are represented by 18 employee records.
- Employee identity is independent of auth/login identity.
- 2 confirmed linked profiles, 15 roster-only employees, 1 needs-review employee, 0 unaccounted source rows.
- Never fabricate emails or auth users.
- Job title does not grant authority.
- Missing salary, bank, identifier or document values remain truthful `Not recorded`.

PAYROLL
- Payroll population uses employee IDs, not auth profiles.
- Administration PREPARES.
- Group Pastor/CEO APPROVES.
- Automatic approval is prohibited.
- Approved Payroll is immutable.
- Corrections use attributable successor revisions.
- Never invent salary, PAYE, SSNIT, allowance, loan, reimbursement or bonus values.

LEAVE
- Categories: Annual, Sick, Maternity, Paternity, Study.
- Approval: Employee request → Manager approval → Administration FINAL approval.
- Employees may request/cancel leave regardless of work-session state.
- No work session recorded does NOT mean absent.
- Leave/attendance must not automatically create Payroll deductions.
- Exact entitlement quantities, accrual/grant method, carry-over and unpaid-leave Payroll treatment remain unresolved and must not be invented.

DATA / SECURITY
- Preserve RLS, capability authority, Work Engine, project authority, Finance authority, audit/history, secure integrations and protected HR.
- Keep `currency + amount_minor`; never combine currencies without explicit policy.
- Never invent KPIs, percentages, productivity scores, project health, priorities, financial values, ministry performance or people data.

OPERATIONAL CLARITY
- OCR0–OCR6 are accepted baseline.
- Shared Composer, Executive clarity, Files/Media, Search CEAC, People/Control Center transformation and cross-role harmonisation must not be downgraded.
- Use `docs/operational-clarity/reference/APPROVED_REFERENCE.html` and accepted visual contracts for any later work that touches these surfaces.

Start by reporting the LIVE protected-main HEAD, any open implementation PRs, the current requested programme/defect (if one exists), and the next safe action. If there is no new requested work, do not invent a new build phase.
