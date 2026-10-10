# CEAC OS — Monday go-live and private technical-support handover lock

**Owner direction recorded 10 October 2026.** Launch target: **Monday, 12 October 2026** (target, **not** an assertion of readiness). The goal is an efficient, lightweight, secure and supportable CEAC operating system for the coming weeks, without unnecessary infrastructure or features. This file is an active owner-level release/handover constraint and a source-of-truth pointer for every subsequent ChatGPT Work, ChatGPT, Codex, Claude, or human engineering session.

## 1. Mandatory final visibility and ownership

**HARD HANDOVER INVARIANT: `ceairportcity/ceac-os` MUST BE PRIVATE before the CEAC/CAC Technical Support team receives operational ownership or access.** Recheck the GitHub API/UI at the moment of handover; save non-sensitive evidence (timestamp, repository, `private=true`, named reviewer, technical-support recipient, current accepted SHA). If private visibility, collaborator permissions or other data-access boundaries cannot be verified, **do not hand over**. Technical Support should receive documented least-privilege operating access, not an unrestricted business super-admin role.

The product owner explicitly refuses GitHub Pro / another paid GitHub upgrade merely to achieve this migration. **Do not push an upgrade or start paid subscriptions.** Keep the current destination private by default. No GitLab/CircleCI detour is authorized as a substitute for a functioning GitHub source + GitHub Actions verification process.

The owner discussed **temporary public visibility followed by mandatory restoration to private before handover** as a possible cost-free workaround. This is a **conditional proposal, not permission to publish right now**. A private-to-public transition exposes *all reachable branches and past Git objects*, not only `main`; Git history, private migration metadata, PR comments, captured artifacts and cached copies may remain obtainable even after switching back. Before *any* public transition, require a documented full-history/branch/artifact/secret/PII/privacy review, an explicit informed owner decision on residual irreversibility and any necessary isolation/cleanup. If exposure cannot be proven safe, **remain private**. Never assume that GitHub Free public-branch protection will stay enforceable after returning the repository to private; verify rulesets/required checks again and explicitly record any remaining lack of enforcement. Never represent manual approvals as enforced GitHub branch protection.

Release fallback on a private Free repository: keep `main` unchanged until independent **exact-HEAD** CI, migration replay, account security, SQL/RLS and browser/product acceptance evidence has passed; conduct a second reviewer/manual SHA match before an authorized merge; do not force-push, bypass failure, silently use stale checks or self-certify a missing check as passed. This compensating process is **not equivalent** to branch protection and the residual risk must be accepted explicitly by the owner. Stop if the stated security boundary cannot be met.

## 2. Current truth and destination

- **Canonical application source:** private `https://github.com/ceairportcity/ceac-os`; **historical source:** `thestandardinst-star/ceac-os`. Do not restart CEAC or delete/overwrite either repository.
- Source Git history and 146 original branch refs were migrated with matching SHA. Historical Git bundle/PR metadata and selected artifacts live on the private `archive/original-github-history-and-metadata-2026-10-10` branch. **Never merge this archive into application `main`.** Its contents are a strong reason not to publish the repository casually.
- At preparation, application `main` was `827fbe7391467dd13d6e411527416402a252993c`; it did **not** contain all outstanding product/go-live branches. This is a historical checkpoint; re-fetch the current heads, merges, review state and checks before every write or status statement.
- Existing Vercel `ceac-os` project `prj_bAv4ggX6umjp54UjjLqqGm7bBcIB` remained connected to the historical GitHub account; Vercel Git installation for `ceairportcity` was **not yet observed**. Reuse the **existing project** only after official GitHub App access is verified. Do not create a second CEAC production project or change domains/redeploy production as a shortcut.
- Existing Supabase project `efjljhftsesssumtshvp` is production; do not reset, mutate, or replay the pending branch migrations there during a documentation handoff. Historical applied migration versions were checked read-only against security-parity PR #22 on 10 October; this does **not** authorize later migrations.
- The destination private `main` had no enforceable GitHub branch protection under the current plan. Do not claim otherwise, and do not trade away final repository privacy to hide that limitation.

## 3. Work preserved but NOT automatically production-accepted

Use **destination PR numbers** and preserve base/head dependency order:
- [#19](https://github.com/ceairportcity/ceac-os/pull/19) — Phase 5 Administration redesign, base `main`.
- [#15](https://github.com/ceairportcity/ceac-os/pull/15) — Phase 6 volunteers/personal planning/calendar/attendance, stacked on Phase 5.
- [#21](https://github.com/ceairportcity/ceac-os/pull/21) — Executive redesign, stacked on Phase 6.
- [#23](https://github.com/ceairportcity/ceac-os/pull/23) — installable PWA/offline and recovery release, stacked on Executive.
- [#24](https://github.com/ceairportcity/ceac-os/pull/24) — owner go-live/leave/handover decisions, stacked on resilience.
- [#25](https://github.com/ceairportcity/ceac-os/pull/25) — 24-working-day annual leave implementation and permanent CEAC Guide, stacked on owner decisions.
- [#22](https://github.com/ceairportcity/ceac-os/pull/22) — historical migration parity, independent security PR into `main`. Other open security branches require separate dependency, privilege, overlap and migration review. The source original PR IDs and approvals are historical, **not** destination approvals.

Latest branches advanced repeatedly during 10 October repair work. Re-fetch **live SHAs**. Do **not** reuse old reported green statuses after a head advances. Previously repaired items include migration-119 PL/pgSQL delimiters; recovery Actions SHA pins; changed-line trailing whitespace in handoff docs; Phase 6 MFA/SECURITY DEFINER strict reviewed inventory (audited 136, with exact allowlist and no anonymous execution, not a universal permission exception); and realistic geofenced office-location fixtures in attendance SQL tests. Confirm their current versions rather than redo or weaken them.

Observed acceptance facts, not global acceptance:
- Exact-head CI/Migration Replay/Account Security/Quality Gate were running and sometimes failing on specific prior heads. The Phase 5 Unit Room image browser check failed once but a **separate focused unchanged run passed**; that does not conclusively close intermittent behaviour. Browser fidelity and actual authorized-role production smoke remain separately required.
- Source requirements demand literal owner-approved mockup fidelity, including the Phase 6 **nine-surface** reference, rather than generic polished UI. Green build/CI cannot waive rendered-device visual acceptance.
- Security parity #22 had four reported passing workflows and the read-only production migration-version comparison matched, but it was not automatically merged by that fact alone.
- User will not accept merged unfinished work, relaxed RLS/authority, invented payroll/leave values, or claims that source tests equal working live production.

## 4. Monday 12 October — realistic staged operational readiness

**Ship the verified minimum operational surface**, not an uncontrolled scope expansion. Do not call the entire 50-item improvement register completed because a subset is ready. The designated CEAC decision-maker must give a recorded GO / LIMITED PILOT / NO-GO decision after a short checklist:
1. **Access:** real invitation delivered; user independently sets password; sign-in/confirmation/reset/logout/revocation work; MFA/AAL2 on privileged functions; no Vercel-protection/login leakage to staff; permitted role navigation for Staff, Manager, Administration and Executive.
2. **Security:** exact-head tests pass; RLS and protected-HR/payroll/finance authority boundaries remain correct; no unrestricted Technical Support access; no anonymous SECURITY DEFINER exposure; private Storage; no secrets or operational data in Git, screenshots, caches, service worker, logs, backups or browser bundles.
3. **Core operational flows:** People/department assignment, Work/task review, Rooms/files/media, Calendar, personal schedules, attendance/location/code factual evidence, Leave request and approval, announcements/notifications, Finance/Payroll permitted views and separation of duties; verify truly implemented paths with genuine role accounts, not fixture-only UI.
4. **Performance and reliability:** phone/desktop smoke, normal network/offline/return behavior, clean error recovery, key pages functional, no avoidable heavy dependencies; PWA caches only non-sensitive shell assets, not HR/business/API responses. Check screen accuracy against approved references for the release's actual scope.
5. **Deployment/recovery:** restore security gating first; accepted SHA traced from PR through exact-main checks and isolated preview into the existing Vercel deployment; do not switch source, DNS or database blindly; verify Vercel and Supabase project control, secrets/redirects, backup restore exercise, rollback SHA/runbook and emergency rollback owner. Avoid fake production test records.
6. **Support:** readable lightweight CEAC Guide, onboarding brief, support contact/escalation, system ownership, restricted technical roles, runbook, clear evidence of what is pending, known issues/limitations and staffed early-life monitoring.

If any **critical** check is unresolved by Monday, choose LIMITED PILOT with controlled accounts/features or NO-GO rather than weakening access/privacy or fabricating tests. The owner makes that decision; engineering must report factual readiness, blocker impact and mitigations.

## 5. Handover gates — do not declare Technical Support handoff complete otherwise

Record (with non-sensitive evidence) each item:
- repository private at the *final* handover checkpoint, with correct owner, branch/backup snapshot, least-privilege collaborators and MFA/2FA; any temporary public exposure and its irreversible risks disclosed;
- repo GH Actions workflow access, acceptance SHA, and whether branch protection is **really enforceable after private reversion**;
- Vercel project ownership, existing production URL and accepted source SHA, preview/prod env names, sanitized env-key inventory (never values), redirect/origin settings, deployment and rollback procedure;
- CEAC-controlled Supabase project and least-privilege access, tested RLS, migrations-in-production inventory and verifiable backup/restore path; never paste keys to documentation;
- open defects, incomplete/blocked PRs, actual role smoke evidence, staff invitation/activation evidence, support/escalation matrix, incident/runbooks and 1–2 week postlaunch checks;
- Technical Support mandate from `docs/security/CEAC_TECHNICAL_SUPPORT_PANEL_SPEC_v1.md`: accountable to Administration & HR and Group Pastor; technical reach with narrow business authority, no salary/medical/protected-HR/disciplinary/payroll self-approval.
- product-owner written handover acceptance **only after all mandatory private and access conditions pass**. CEAC remains free to defer acceptance. Do not present GitHub account transfer, production deploy, or support training as completed without evidence.

## 6. Cross-session execution rules

Read **this file first**, then `AGENTS.md`, `docs/continuity/NEXT_CHAT_PROMPT.md`, `docs/continuity/CEAC_OPERATIONAL_REFINEMENT_SEQUENCE_2026-10-06.md`, `docs/continuity/CEAC_POST_ONBOARDING_MASTER_IMPROVEMENT_REGISTER_2026-10-06.md`, current PR bodies, exact-head workflow logs, and `docs/continuity/CEAC_PRE_RESTORATION_GO_LIVE_HANDOFF_2026-10-07.md` on the final product branch. Resolve contradictions by newer explicit owner lock **without** overruling foundational security, legal obligations or verified source truth.

Use one implementation writer per branch, reconcile concurrent heads/CI before modifications; no force-push, destructive reset, GitLab/CircleCI detour, unnecessary Vercel project, paid GitHub subscription, invented policies or hidden production changes. Commit and verify the work; do not stop at investigation. For substantial tasks, send factual, compact completion/blocker updates only where necessary, not repeated progress narration. Preserve pending work as pending, move sequentially by acceptance, and leave a reproducible next-chat handoff.
