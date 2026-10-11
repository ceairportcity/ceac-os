# CEAC OS — live engineering handover and decision register

**Last recorded:** 11 October 2026 (UTC). **Next reader MUST refresh actual GitHub/Vercel/Supabase state before editing.**  
**Authoritative procedure:** docs/continuity/CEAC_ENGINEERING_OPERATING_PLAYBOOK.md on operations PR/branch until reviewed integration.  
**Not a production GO or approval.**

## A. Current lane ownership and last observed exact SHA

| Lane | GitHub location | Last independently observed HEAD | Activity / next operation |
| --- | --- | --- | --- |
| Production baseline | main | 827fbe7391467dd13d6e411527416402a252993c | Older production remains deployed. Do not write. Reverify before any release. |
| Frozen release candidate | PR #44, branch chatgpt/s3-support-reconcile-review-20261011 | e00f13873409e4cc16ec1493b60b71d5cde1114a | DRAFT / NO-GO. Exact-head Level B not passed. Do not modify. |
| Product workstream | PR #47 | 41718e6be6beaa9d7ea682eb507b155ffd245b27 | Live implementation of Administration, invitations, attendance, role safety, Technical Support. Refresh head and preserve concurrent product work. |
| Security/recovery workstream | PR #48 | 0bdb6103b66cac102a4fb4bf54a2c2c00a6cfbd4 | Forward-only SQL/RPC repairs + recovery/MFA plans, unexecuted isolated SQL tests; refresh head. |
| Operations/runbook | chatgpt/ops-canonical-runbook-20261011 | See latest branch HEAD / its draft PR | Documentation-only work; never alter source/release/production branches. |
| Release evidence index | GitHub Issue #46 | Issue, not a commit | Historical NO-GO evidence, changing obstacles and release gate decisions. |
| Product visual parity | GitHub Issue #45 | Issue, not a commit | Owner-approved literal Admin/role reference versus actual desktop/mobile rendering. |

**Note:** the HEADs above are time-stamped checkpoints, NOT implicit locks on product/security branches. Security PR48 adds five proposed timestamped migrations 127–131; do not rely on the older two-migration/132 total without refreshing. As of this checkpoint, frozen PR44 contains 130 candidate migration files, production 119 applied, security branch alone would add 5 to make 135 after approved integration; actual combined source must be recomputed. No pending production migration applied.

## B. Confirmed achievements / evidence class

- GitHub private CEAC connection: functioning and can manage private branches, files, reviews and PRs. No direct native Codespaces terminal.
- Product PR47: substantive source fixes and targeted Node test evidence (earlier 20/20 unit suite; 46 source inspections; 52 independent source contract checks at a **prior** head). Do not apply historical results to the current moving head.
- Security PR48: multiple report-evidence and finance tenant-boundary forward migration proposals, authored rollback-only SQL gates; static source contract checks, NOT actual PostgreSQL acceptance.
- Release PR44: Vercel exact-head preview READY recorded previously; full real-role Playwright, complete SQL replay, genuine Auth/MFA and literal visual parity NOT VERIFIED.
- Existing production Supabase had 119 migrations, 161 public RLS-enabled tables and zero verified MFA factors on earlier audits; these are historical counts, refresh immediately before actual acceptance.
- Existing project Vercel production READY was old main 827fbe7; preview READY is not production release.
- Independently inventoried 20 historical Vercel Sandbox sessions, all stopped; recorded older npm builds exited 0, older local SQL and Playwright commands executed/attempted. This proves an **existing functioning direct terminal API** existed, not current candidate release acceptance. Active CPU aggregate approx. 5.26 h historical. Billing API costs_not_found returned 404; remaining included credits/cost cannot be confirmed from this API.
- No private exact-head independent Codespaces summary/exit-0/all-status-PASS posted on PR44; prior branch launcher blobs hardcode obsolete PR27/PR29. PR44 branch has corrected scripts but an old Codespace checkout will not magically adopt them.
- Earlier GitHub Actions failed before normal test steps; metered TinyFish Codespace terminal attempts repeatedly failed to prove executed commands and wallet is exhausted; no more retries.

## C. Open acceptance gates (ALL remain mandatory, none should be silently waived)

| Gate | Current state | Responsible lane / evidence required |
| --- | --- | --- |
| Full exact integrated clean install + Node source suite + npm production build | NOT VERIFIED at latest combined SHA | Release runner/independent reviewer: real exit codes and logs |
| Authenticated multi-role browser journeys and literal desktop/mobile screenshots | NOT VERIFIED | Release + owner visual Level C, including Admin/Exec/Staff/Manager/Volunteer/Support |
| Ordered isolated replay of all historical + un-applied + reviewed new migrations | NOT RUN at final combined SHA | Release/DB operator: isolated Postgres, roles/RLS, rollback-only SQL gates, data counts |
| Tenant/SECURITY DEFINER authority and protected HR/Payroll tests | Partially static; runtime NOT VERIFIED | Security lane + independent test executor |
| Full encrypted production export INCLUDING managed Auth/Storage needed for restore | NOT CREATED/NOT VERIFIED | Authorised private operator; keep data/keys off repo |
| Actual isolated restore, Auth/Storage verification and migration impact diff | NOT RUN | Authorised recovery operator; independent evidence |
| Real privileged-user TOTP enrolment + AAL2 + invitation email delivery | NOT VERIFIED; last factor count 0 | Authorised operator/real users in reviewed isolated environment, owner then explicitly authorises safe go-live policy |
| Independent reviewer + owner acceptance of final tested SHA | NOT RECEIVED | Release coordinator + owner |
| Normal reviewed merge, existing Vercel prod deploy and production role smoke tests | NOT RUN | Only after gates and explicit owner GO |

**Release decision:** NO-GO. NEVER report READY preview or schema RLS inventory as full acceptance.

## D. Work to execute NEXT (without tool churn)

### Chat 1 / PR47 — Product
1. Refresh PR47 head; inspect last accepted product scope and reference assets.
2. Continue only remaining approved Administration, real invitation, attendance, People & Access and Technical Support defects, with truthful offline/unavailable states.
3. Do focused executed source-level tests and record exact file/SHA; avoid repeatedly hitting Vercel Hobby build-rate limits. No production Supabase writes.
4. Report any security dependency to PR48/Issue46; do not import untested PR48 migrations directly into this product branch.
5. Keep PR47 draft until actual integrated functional/browser and visual acceptance.

### Chat 2 / PR48 — Security/recovery
1. Refresh PR48 head; inspect latest proposed five migrations and SQL gates plus current production-only READ-ONLY catalog.
2. Continue privileged RPC authority and row-level invariant review, positive/negative tenant fixture coverage, and reconcile migrations with PR47 without mutating either branch.
3. Make existing runner readiness check using **actual** private shell/runtime evidence rather than repeated TinyFish browser actions. If inaccessible, record once: missing authenticated runnable private executor, and continue all connector-supported security source work.
4. Prepare reviewed secure backup plan with explicit managed Auth/Storage inclusion, and MFA invitation acceptance without collecting private secrets. Do not call script preparation a successful backup/restore.
5. Coordinate with operations and Issue46, no merge or production changes.

### Operations / durable knowledge
1. On discovering a verified working API/script, proven failed route, production policy decision or new blocker, commit a small change to THIS live handover / playbook on an isolated operations docs branch.
2. Post exact commit + document permalink to Issue46 and relevant PR47/48; preserve both branches unchanged.
3. At handoff, mark: live SHA, completed step, actual tests run, evidence URL, open blocker, next feasible action and one indispensable owner-only step (if unavoidable).
4. On reviewed integration, ensure AGENTS.md pointer and docs are actually carried into active working branch/main through controlled normal review, not overwritten by later product merges.

## E. Verified tool selection and cost guard

- First-party connected **GitHub**: private code and durable commits, PRs, reviews. Use for all repository edits. It cannot operate Codespaces shell.
- Connected **Supabase**: production read-only schema/SQL/migrations and security-advisory inspection. No whole private logical dump+restore via connector.
- Connected **Vercel**: deployment metadata, historic Sandbox commands and statuses, direct shell calls **only into a running session**. Historic stopped sessions cannot accept commands. No claim of remaining free Sandbox time; request explicit user approval before restarting potentially billable resources, and verify private source authentication, Docker + CLI availability.
- **Codespaces**: existing native private test environment may be useful, but stale branch launcher mismatch is verified; do not make user navigate repeatedly. Need actual terminal output, correct runner commit, exact PR44/final SHA and local /tmp evidence.
- **TinyFish**: stop. Exhausted and cannot serve as reliable test executor.
- **GitHub Actions**: failed before test steps; do not rerun in a loop.
- **No paid CI, no GitLab/CircleCI swap, no public repo, no new Vercel production, no broad provider switching.**
- No private tokens/passwords, HR data, service keys, Auth factors or raw backup archives in GitHub/issues/chat.

## F. Update template — every substage must fill this into GitHub

**Date/time UTC:**  
**Lane / PR / branch / exact HEAD:**  
**Last observed main / release baseline SHA:**  
**Task/owner decision and files changed:**  
**Tool route used (exact API or runner):**  
**Command(s) genuinely executed; exit/status and evidence URL/checksum:**  
**Verified result: PASS / SOURCE-ONLY / BUILD READY / FAIL / NOT RUN / STALE:**  
**Newly working capability (if any; prerequisites and cost):**  
**Dead-end/root cause (if any; error and stop rule):**  
**Security/production impact (must be none without explicit authorisation):**  
**Remaining acceptance gates and next safe concrete action:**  
**Indispensable owner-only permission/action (or NONE):**  
**Links to PR, issue, upstream runbook change:**  

**Session exit rule:** Never end with a merely verbal progress summary if a meaningful technique, decision, blocker or next action is missing from the repository record. Document first; then report to user. Do not promise unseen background execution.

## G. Source links

- Issue #46: https://github.com/ceairportcity/ceac-os/issues/46
- Frozen release PR #44: https://github.com/ceairportcity/ceac-os/pull/44
- Product PR #47: https://github.com/ceairportcity/ceac-os/pull/47
- Security PR #48: https://github.com/ceairportcity/ceac-os/pull/48
- Product decisions: docs/final-product/PRODUCT_OWNER_DECISIONS.md
- Security migration impact and recovery: docs/release-assurance/CEAC_INDEPENDENT_GATES_AND_RECOVERY_2026-10-11.md on PR48
- MFA/operator recovery details: docs/security/CEAC_RECOVERY_REAL_MFA_ACCEPTANCE_2026-10-11.md on PR48
- Independent private runner: scripts/ci/run-independent-release-gate.sh on PR44
- Codespaces runner config/scripts: .devcontainer/devcontainer.json, .devcontainer/launch-automatic-verification.sh, .devcontainer/ceac-private-runner.sh on PR44


## H. Unified Work execution checkpoint — 11 October 2026

- Isolated draft PR: #50, branch `chatgpt/unified-release-candidate-20261011`. Production branches and services remain unchanged.
- Traceable integration commit: `7d7fbfd4f3bbead6e5ee33034574178f608f2d41`, with parents PR47 `41718e6`, PR48 `0bdb610`, and PR49 `83ff03d`. Later documentation-only commits advance the PR head; always refresh the exact head before testing. PR50 remains DRAFT / NO-GO.
- Explicit overlap resolution: combined `package.json` retains PR47 product tests and PR48 security/recovery tests; migration inventory assertion expects 135 unique source migrations (119 live history + 11 earlier pending + 5 PR48 forward migrations).
- Real Work shell, Node 22.12.0: `npm ci` exit 0; PR47 source suite 140/140 exit 0; combined source suite 159/159 exit 0; combined Vite production build exit 0.
- Source provenance: authenticated GitHub recursive tree/blob reads; 519 non-document/non-binary PR47 files verified against exact Git blob SHAs with zero mismatches. Binary visual reference and PWA icons were subsequently fetched and individually Git-blob verified.
- The earlier Vite warning for `docs/visual-fidelity/references/CEAC_original_premium_mockup_reference.jpg` was a temporary reconstruction omission, not a repository defect. With the exact tracked asset present, the combined build again exited 0 and emitted no missing-reference warning. This does not constitute visual parity acceptance.
- Playwright Chromium 1.56.1 installed successfully. Direct local-browser smoke against Vite passed at desktop 1440x900 and mobile 390x844: HTTP 200, CEAC OS title, expected email/password fields, and zero horizontal overflow; command exit 0.
- Resilience Playwright: manifest/installability, service-worker/no-business-data caching, and offline-shell cases passed (3 tests). The later recovery/security cases were NOT accepted because the authenticated GitHub blob reconstruction is not a Git checkout and `git rev-parse HEAD` fails. Do not report the suite as passed.
- Authenticated role Playwright is NOT RUN: the current Work shell has no approved isolated Supabase URL/service-role fixture credentials. No production credentials were requested or exposed.
- Runtime limit: this Work shell has neither Docker nor psql and cannot acquire sudo; full isolated PostgreSQL/Supabase migration replay is NOT RUN here.
- Read-only production refresh: Supabase reports 119 applied migrations. Security advisor reports 12 RLS-enabled/no-policy tables (principally deliberately inaccessible `hr_private` and counter tables, subject to review) and 132 authenticated-callable SECURITY DEFINER functions. These are linter findings, not proof of safe or unsafe authority; every intended browser RPC requires explicit role/tenant/AAL tests.
- Static review of forward migrations 127–131 confirms bounded search paths, same-organisation checks for report/unit/project/evidence references, browser evidence-write revocation, and a report-row tenant trigger. This remains SOURCE-ONLY until ordered isolated replay and adversarial SQL tests pass.
- Vercel: PR50 automatic deployment was IGNORED, preserving the rate-limited free preview allowance; no manual preview or production deploy.
- Production: `main`, frozen PR44, Supabase production and Vercel production unchanged.
- Next safe actions: obtain a genuine Docker/PostgreSQL-capable private executor for 135-version replay and rollback-only SQL gates; then run authenticated multi-role Playwright, encrypted backup/isolated restore, real MFA/AAL2 and owner literal visual acceptance. Do not merge or deploy before all mandatory gates and explicit owner GO.
