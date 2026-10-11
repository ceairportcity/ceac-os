# CEAC OS — canonical engineering operating playbook

**Version:** 1.0 (11 October 2026)  
**Scope:** all CEAC product, security, testing, recovery, release and ChatGPT handoffs.  
**Status:** documentation-only proposal on a separate operations branch; it does NOT approve or alter production.

## 0. Read this first — no more restarting in every chat

This document is the **working-method source of truth**, not a substitute for product-owner decisions or security policy. Every new CEAC engineering session MUST:
1. Identify canonical private GitHub repository ceairportcity/ceac-os. Verify visibility, its current main SHA, open PRs, bases and *live* HEAD SHAs via authenticated GitHub tools. Never rely on a previous chat's SHA.
2. Read AGENTS.md, this playbook, docs/continuity/CEAC_LIVE_HANDOVER.md, docs/final-product/PRODUCT_OWNER_DECISIONS.md, the current phase source-of-truth/acceptance contract, and affected code/security contracts. Resolve conflicts by current documented owner decision, actual Git ancestry and scoped accepted contract; do not resurrect superseded older phase headings.
3. Choose ONE lane and ONE isolated branch. Reconcile any other writer's commits BEFORE writing. Never modify another active lane's branch or frozen release branch.
4. Identify the smallest remaining approved work item. Execute it; record exact source SHA, actual tests, failures, next action and evidence in that lane's PR and update the handover. Progress through independent tasks rather than stopping at each substage.
5. When a newly working tool, workaround, root cause, blocker or decision is discovered, **update this playbook or the live handover IN GITHUB immediately as a reviewed isolated commit**, link it in the active PR/issue, and reconcile it into the normal reading path. Do not leave the knowledge only in chat.
6. Never report a PASS because a command was attempted, an automation was configured, a build was READY, a script exists, or a regex matched code. Preserve PASS / FAIL / NOT RUN / STALE / BLOCKED with exact source SHA and executable evidence.

This document is the stable process. The accompanying live handover is the changing snapshot; never treat its dated state as newer than GitHub.

## 1. Environment and lane ownership (verified 11 October 2026)

- Canonical repository: ceairportcity/ceac-os, PRIVATE. Historical thestandardinst-star origin is NOT the new source of truth.
- Existing Vercel project: prj_bAv4ggX6umjp54UjjLqqGm7bBcIB. Do not create another production project.
- Existing production Supabase: efjljhftsesssumtshvp. Never perform tests, restores or migration rehearsals on production.
- Production main previously confirmed at 827fbe7391467dd13d6e411527416402a252993c; validate again at each session start.
- Frozen release baseline: draft PR #44, e00f13873409e4cc16ec1493b60b71d5cde1114a, base main. Freeze until a deliberate, approved candidate integration.
- Product lane: draft PR #47; implements Administration, attendance, invitations, role/access, Technical Support and visible parity. Its HEAD changes frequently. Source-only tests are useful, not final acceptance.
- Independent security/recovery lane: draft PR #48; source repairs, adversarial SQL gates, threat analysis, recovery and MFA readiness. Its HEAD changes frequently. These repairs are NOT in live production.
- Release evidence index: Issue #46; approved references/visual parity issue #45.
- Operations/documentation lane: only this dedicated operations PR/branch; should not edit code, migrations, Vercel/Supabase production or any product/security PR heads.

**Ownership / no collisions:** Product writes only PR47 branch; security writes only PR48 branch; operations updates this documentation branch; release coordinator owns integration review and final combined candidate **only after readiness and explicit authorisation**. All lanes may READ each other. If a file overlaps (e.g., package.json verify:source), explicitly retain both verified test registrations when integrating, never allow last writer to win silently. Re-run affected gates after any integration SHA change.

## 2. Actual functioning tools — evidence-graded capability matrix

| Interface | Verified actual capability | Correct use and hard limits |
| --- | --- | --- |
| Connected GitHub CEAC account | Read private source, issues, PR heads, file blobs/diffs, commits; create isolated branches/files/PRs and post reviewed evidence. | PRIMARY engineering coordination + durable decisions. No direct Codespaces shell or /tmp runtime evidence from the GitHub connector. |
| Connected Supabase | Read project health, SQL catalog, migration list, functions, grants, MFA factor counts, advisories. | Read-only audits by default. Metadata/RLS inventory is not authenticated cross-tenant behavior. No full private encrypted production dump/restore through connected SQL API; never emulate an export by querying secret fields. |
| Connected Vercel | Inspect existing project and deployment SHA; inspect Sandbox sessions and prior command history; on a genuinely RUNNING authorised Sandbox, run commands and fetch exit codes/logs. | This is a REAL command-execution API, not browser typing. Existing CEAC Sandbox sessions inspected on 11 Oct were STOPPED. A stop requires resumption/new runtime with capacity approval; Vercel has usage/metering and private-source auth needs to be validated. No automatic new sandbox. |
| Existing GitHub Codespaces | Real developer terminal and repository auto-run configuration exist. PR44 has corrected .devcontainer exact-head runner. | Current tool connection CANNOT directly operate existing Codespaces terminal. Older Codespace checkout has stale launcher hardcoded to older PR; merely reopening does not make old code current. Need native operator shell or supported execution/read channel; prove SHA, exit code and statuses. |
| Local available isolated container / trusted private runner | Node/source tests may execute if actual files are present; some previous isolated tests were run. | A connector cannot turn GitHub repository text into a valid authenticated full private clone and Docker environment by assertion. Full SQL+browser gate requires all tools, private checkout, disposable local database and genuine runtime proof. |
| Vercel preview builds | READY previews from canonical private repo have been confirmed at specific SHAs; existing vercel.json runs source check plus build. | READY is not completed Playwright/SQL/MFA/visual acceptance; rate limits blocked some newer previews. Trigger only deliberate reviewed checkpoints and verify matching SHA. |
| TinyFish | Historically opened GitHub browser/Codespace screens. | **DO NOT USE**: exhausted wallet; terminal input was unreliable and did not produce actual accepted gate output. Repeating attempts is a known failed path. |
| GitHub Actions (current account restriction) | Workflows visible, but relevant PR44 runs failed before executing normal steps. | Do not count as test failure or PASS. Do not rerun repeatedly without a changed cause. |
| CircleCI/GitLab/additional CI, GitHub Pro, public repo, replacement Vercel | No accepted working improvement to this private project; earlier attempts consumed time. | Do not introduce or request upgrade merely to bypass native checks or account settings. Need owner approval and demonstrably necessary new capability. |
| ChatGPT Work/cloud browser | May navigate web interfaces with available entitlement. | Usage limits and browser-to-terminal reliability are independent. Not a guaranteed shell. No substitute for actual test evidence. |

### Previously demonstrated Vercel capability and why it was missed

Vercel project has **20 historical CEAC Sandbox sessions** returned by the connector, all stopped at the 11 October inspection. The Vercel command history on older sessions includes npm run build with exit code 0, local psql/Supabase CLI and Playwright invocation attempts, demonstrating **real command execution existed there before**. Those executions were on older branches and are NOT exact-current-HEAD release acceptance. Aggregate recorded active CPU time from the 20 sessions was approximately 5.26 hours; do NOT infer a current free balance, charge, or eligibility from this number. Vercel billing charges API returned 404 costs_not_found and did not confirm available allowance. Never resume/create a billable Sandbox until free remaining allowance/overage exposure is independently established and authorised; do not claim this path solves private-source auth, Docker-in-Sandbox or recovery until proved.

### Diagnostic decision tree — follow this order, don't vendor-hop

A. Need to read/write private source, commit, check PR, update documentation? -> connected GitHub FIRST.  
B. Need production schema/privileges/history count? -> connected Supabase **READ ONLY**; avoid protected row data in logs.  
C. Need deployment build SHA or previous runner evidence? -> connected Vercel, including historical Sandbox command statuses, FIRST.  
D. Need full Node application build/Playwright/local SQL replay? -> find an **existing authenticated, currently runnable** private executor. Check capability, remaining cost allowance, correct private source checkout, Node22, Docker, pinned Supabase CLI 2.117.0, psql and Chromium BEFORE attempting complete suite. Prioritise existing native runner, but do not ask user to navigate screens repeatedly or assume automation proves execution.  
E. If none qualifies, record **one indispensable access/capacity step**. Continue independent source, migration, vulnerability and user-experience work in parallel. Do not create substitute services, invent results or have user make several blind configuration changes.  
F. Real production backup+isolated restore and genuine MFA enrollment each have their own secure authorised operator steps and cannot be cleared by source tests.

## 3. Repeatable work sequence — no lost context

**READ → SCOPE → IMPLEMENT → VERIFY → REVIEW → HANDOFF → INTEGRATE (LATER).**

1. Reconcile GitHub live exact SHA and current accepted requirements.
2. Make a small approved-change plan, name lane, affected files, data/role authority, rollback and acceptance criteria. Avoid broad architecture rewrites.
3. Implement on branch owned by lane, preserve older approved work. No force push, no reset/revert without specific authorised reason. No paid/new infra.
4. Test affected pure/unit/source contracts with recorded real execution. When runtime genuinely available: clean npm ci, npm run verify:source, npm run build; authenticated user journeys; visual screenshots against literal locked mockups; local 130+ ordered migration replay and adversarial SQL/RLS tests. Run full final-head Level B only once integration is stable; source-only tests are not Level B.
5. Commit exact source SHA and limited evidence into the lane PR: test command, environment, pass/fail/exit code, SHA, known coverage limits, build/deployment commit, dates. Protect secrets, staff identities and private traces.
6. Update docs/continuity/CEAC_LIVE_HANDOVER.md for durable decisions + next work (on ops branch or as a reviewed docs-only cross-lane proposal) and revise this file whenever an approach proves effective/ineffective.
7. Hand off defects via GitHub issue/PR comment, link the affected path, owner, exact SHA and acceptance tests. No cross-lane code changes.
8. Only after both feature and security PRs are review-ready, create a separately reviewed combined release candidate; resolve conflicts explicitly and retain every test entry. Frozen PR44 stays a baseline; don't append source changes just to test them. Record new SHA, re-run complete final-head acceptance, then get independent review and owner GO.
9. Prepare verified encrypted backup and actual isolated restore including managed Auth/Storage and object bytes where relevant; rehearse ordered migrations and data effects on restored isolated copy; enroll/verify real privileged TOTP/AAL2 and real invitation delivery; obtain literal visual Level C. These are mandatory distinct gates.
10. After actual PASS and explicit production approval, merge using expected SHA without rewriting history and verify existing Vercel production, database, role smoke tests, recovery plan and final handover.

**Do not create one automation per problem:** keep exactly the working runner, existing GitHub PRs and checkpoint discipline; add tools only when evidence proves new needed capability.

## 4. Exact verification classifications

- **PASS (executed):** source SHA, executed command/test ID, exit 0, expected assertions actually reached, log/checksum or independently inspectable results.
- **SOURCE PASS ONLY:** verified source hash + actual pure/helper tests, structure or regex; NOT component build, SQL, browser, real-user permissions or visual fidelity.
- **BUILD READY:** exact commit deployed preview with actual Vercel READY; NOT authenticated system pass.
- **FAILED:** actual executed assertion failed; report command, exit/error and scope.
- **NOT RUN / NOT VERIFIED:** installed scripts, configuration, a submitted terminal command, a timed-out tool or unavailable runtime; never promote to PASS.
- **STALE:** different SHA or changed schema since test; rerun impacted tests on final source.
- **BLOCKED:** exact unavailable capability, evidence, attempted path once, supported alternative, and safe continuing tasks.
- **ACCEPTED:** owner-approved Level C visual + full Level B/security+SQL/browser+recovery/MFA and independent reviewer signoff; not just Node PASS.
- **PRODUCTION LIVE:** verify actual main merge SHA, deployment target production, production git origin and correct release commit, smoke passes. Live old production can be READY while new candidate is NOT LIVE.

## 5. Dated constraints and current technical risks (refresh live)

At 11 October 2026, frozen PR44 had 119 historically applied production migrations and 11 additional candidate scripts = 130 source versions, unexecuted on production. Security PR48 has subsequently proposed five more forward migrations 127–131 (conditional combined inventory 135 before any new product migrations); **the actual latest PR48 and PR47 HEADs must be reread and migration inventory recalculated**. Existing production has reported zero verified real MFA factors and privileged MFA not enforced. Technical Support backend proposals were not applied; UI alone is not operational backend. Cross-tenant report and finance protections in PR48 require transactional and real-role tests. There is **NO recorded accepted full exact-head Playwright/SQL suite, encrypted complete production backup/isolated restore, real-user AAL2 verification or owner-approved visual parity**. Release remains NO-GO. See Issue #46 and docs/release-assurance/CEAC_INDEPENDENT_GATES_AND_RECOVERY_2026-10-11.md on PR48.

Secure backup reminder: a default Supabase CLI db dump does NOT include managed Auth/Storage by default, and Storage object bytes require separate protected coverage. Existing scripts/ops/prepare-ceac-db-backup.sh is preparation/possibly partial export, not restored-data proof. No live secrets ever in GitHub or chat.

## 6. Known dead ends — don't re-discover them

| Attempt | Observed outcome | Stop/retry condition |
| --- | --- | --- |
| TinyFish controlling Codespaces browser xterm | Terminal keystrokes unreliable, credit exhausted; launch claim not reliable exit proof. | STOP. Retry only with fresh owner authorisation, credits and demonstrated stable terminal — not the preferred strategy. |
| GitHub Actions at PR44 | Failed prior to normal test steps. | Do not retry until account execution failure cause actually changes. |
| GitLab/CircleCI | Historical setup/verification loops failed or were unavailable. | No new providers / paid plan to bypass current blockers. |
| Reopening an old Codespace and assuming postAttach PASS | Old branch runner targets obsolete PR27 and can cache stale result. | Inspect actual checked-out blob, SHA-aware corrected runner, /tmp exact-SHA status and exit. |
| Treating Vercel Sandbox as nonexistent | WRONG: Vercel connector can run commands; previous CEAC sessions show execution. | Always inspect existing sessions and usage BEFORE considering manual navigation. |
| Treating Sandbox as guaranteed free/full runner | Wrong: stopped sessions, unconfirmed allowance, private checkout and Docker requirements. | Verify resources, authentication, billing guard and runtime prerequisites; only authorised bounded run. |
| Vercel preview READY = app acceptance | Wrong: does not execute SQL/Playwright/production Auth checks. | Insist on separate role/browser/SQL evidence. |
| Automatic new preview per development commit | Hobby build-rate cancellations and noise. | Only milestone builds for exact reviewed SHA; no repeat when rate-limited. |
| Repeatedly asking owner to reconnect account, create Codespace or screenshot navigation | Already connected or irrelevant; caused time loss. | Verify connector state first; request one precise owner-only action if absolutely indispensable. |
| Relying on an old PR/readme as "active phase" | AGENTS.md contains legacy overlapping active-phase proclamations. | This playbook governs workflow; source-of-truth and latest owner decisions govern product scope. Read current GitHub. |

## 7. Mandatory update protocol for every future session

**A method discovered that WORKS:** before switching phases, put tool name/action, prerequisites, exact command or connector route, observed output with SHA/exit, scope, risks, cost, secrets handling and reproducible next step in this playbook or linked task runbook.  
**A method that FAILED:** document precise error, why it failed if known, retries already attempted, safe stop condition and fallback.  
**A decision/change:** update live handover with branch HEAD, PR number, new milestones, accepted/deferred scope, unresolved issues, owner action and next executable step.  
**Every milestone:** commit and link GitHub evidence to PR/Issue; no important technical detail exclusively in chat.  
**Before declaring blocked:** search existing playbook and historical verified Vercel/GitHub/Supabase evidence. Try no tool twice without new reason/evidence.  
**Before updating these docs:** fetch current blob/HEAD, reconcile other editors, make separate reviewed change. Do NOT overwrite newer checkpoint text.  
**When operations PR is reviewed:** incorporate the two documents and AGENTS pointer into the current working base by normal reviewed integration, preserving all other changes. Until integrated, every active PR/Issue must link directly to this operations branch; docs on a draft branch are not automatically visible to checkouts of main or PR47/48.

### Reusable startup statement (for any new ChatGPT thread)

"Continue CEAC OS on the CANONICAL private ceairportcity/ceac-os repository. First read AGENTS.md, docs/continuity/CEAC_ENGINEERING_OPERATING_PLAYBOOK.md and docs/continuity/CEAC_LIVE_HANDOVER.md from the newest reviewed operations PR (if not yet integrated), then current live PR47 product/PR48 security/PR44 frozen baseline and Issue46. Reconcile live SHAs and owner decisions. Own ONE isolated lane; use functioning connected GitHub/Supabase/Vercel tools, no TinyFish and no paid/public workaround. Execute safe work without arbitrary pauses; record working tools, actual tests, failures and updated handoff back into the repository before completion. Never modify production or count unexecuted gates as PASS." 


## 8. Work native-shell exact-source reconstruction (verified 11 October 2026)

When Work has a real shell but its GitHub OAuth connector cannot expose a clone credential, a private exact-source application runner can still be constructed without publishing the repository or disclosing a token:

1. Use the authenticated GitHub connector to fetch the target commit's recursive Git tree and each required UTF-8 blob by exact blob SHA.
2. Materialise those blobs into an isolated Work directory; preserve byte endings and verify every file with Git's blob hash formula (`git hash-object <path>`) against the authenticated tree. Do not claim exact source until mismatch count is zero.
3. Run the repository's pinned Node version. On 11 October 2026 the Work shell had Node 24 by default, so `npx -y -p node@22.12.0 -c '...'` provided the repository-required Node 22.12 runtime.
4. Execute `npm ci`, the registered source suite and production build, recording actual exit codes and test totals. Missing documentation files referenced by tests must be fetched and hash-verified too; do not delete those assertions.
5. For an integration candidate, reconcile overlapping files explicitly. PR47 and PR48 both modified `package.json`; the correct combined form retains every product test and every security/recovery test. The five PR48 migrations increase the combined source inventory from 130 to 135, so the frozen 130-file assertion must advance only on the unified branch.
6. This route proves source and build execution only. It does not provide Docker/PostgreSQL, authenticated browser users, production backup/restore, or real MFA. The observed Work shell had no Docker or psql and no usable sudo, so those gates remain separate.

Verified example: unified PR #50 initial integration commit `7d7fbfd4f3bbead6e5ee33034574178f608f2d41`; zero mismatches across 519 non-document/non-binary PR47 blobs, `npm ci` exit 0, PR47 140/140 source tests exit 0, combined 159/159 source tests exit 0, and production build exit 0. Vite reported one non-fatal unresolved visual-reference path; visual acceptance remains open.
