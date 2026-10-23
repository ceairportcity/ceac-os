> **20 OCT 2026, 17:50 UTC — FIRST READ UNTIL STAGE 2 IS RELEASED:** Revisit the [binding owner correction-to-release decision](docs/final-product/PRODUCT_OWNER_DECISIONS.md#20-october-2026-1750-utc--binding-stage-2-correction-to-release-sequence-read-first-until-release) before choosing work, making changes or running tests. Locked order: **(1) approved Work/Projects/role visual comparison and corrections → (2) precise outstanding agreed functionality → (3) connected workflows/permissions, database reconciliation and safe production release → (4) actual production URL, existing-user and workflow checks.** Continue PR #124 and preserve completed/newer work. No new programme, branch, scope expansion, reopening accepted work without a concrete defect, or repetitive full-suite loops. The existing 20 October change-impact testing policy below remains binding; full qualification belongs to the frozen final release candidate. Existing security/data/recovery safeguards remain. This latest owner sequence supersedes conflicting historical process instructions below. The goal is the requested Stage 2 application released and verified, not another planning cycle.

> **20 OCT 2026 — BINDING OWNER-WIDE TESTING POLICY FOR ALL CEAC OS BUILDS (CURRENT AND FUTURE):** Use **progressive, evidence-backed, change-impact testing**; stop reflexively repeating the entire source/SQL/browser suite after each small development or stage checkpoint. At each change: (1) record exact tested commit SHA, commands, suite/environment, timestamp, result/exit code, artifact/log pointer and coverage in a cumulative verification ledger; (2) compare changed files, shared dependencies, database contracts, roles/permissions and affected interactions to that coverage; (3) reuse valid prior evidence for unchanged/unaffected areas **as historical stage evidence**, and run the changed-area tests plus necessary cross-feature regressions; (4) mark stale, unproven, skipped, failed or impact-uncertain coverage **PENDING** rather than PASS; (5) only at a **frozen final integration/release candidate** run full mandated source, migrations, security/RLS, cross-role, real-browser and approved-mockup visual acceptance against the actual release SHA, plus recheck whenever a later code change invalidates it. A required exact-head GitHub check is **never** satisfied by a historical SHA; don't publish misleading external success, skip mandatory protection, or weaken guards. Keep existing `scripts/ci/classify-verification.mjs` and narrowly-scoped Stage 2 classifiers as the starting mechanism; improve coverage mapping/ledger rather than invent a parallel harness or overriding required Level B release checks. For the current GitHub Actions billing block, use the [external-status and Codespace evidence handoff](docs/continuity/CEAC_CODESPACE_EVIDENCE_GITHUB_CHECKS_2026-10-20.md); do not assume external statuses can replace source-bound Actions checks. This is a standing instruction for all agents/Work sessions across CEAC OS. **Do not stop feature delivery or redo past suites merely to adopt this policy.**

> **19 OCT 21:05 UTC — OWNER TAKEOVER / PRODUCT CORRECTION:** Continue the actual existing PR #124 (`chatgpt/stage2-owner-contract-repair-20261019`), preserving all work from `0927766b`. Earlier blanket P0–P7 acceptance does NOT close the owner-rejected gaps. Binding scope: original approved Work desktop/mobile, revised Projects, whole contribution/reporting workflows, and Administration/HR Control Center navigation, repeated/confusing messages and disconnected actions. The rejected current Team screenshot is not a mockup. No new branch or restart. See [current repair state](docs/continuity/CEAC_STAGE2_OWNER_REPAIR_2026-10-19.md). Keep production safe while completing real build, database/role, visual and workflow validation. Existing email/password remains; Google OAuth and mandatory MFA are deferred.

> **19 OCT — LATEST OWNER AUTHENTICATION RELEASE DECISION (OVERRIDES OLDER P2/P8/GOOGLE/MFA DIRECTIONS BELOW):** Complete and release Stage 2 using the **existing CEAC invitation-controlled email/password sign-in**, not Google-only and **without mandatory MFA/TOTP/AAL2**. The owner has explicitly **DEFERRED BOTH Google-only login AND MFA TOGETHER to a later, separate release**; neither is a Stage 2 release dependency. Do NOT restart P0–P7, block current delivery on Google/MFA hosting tests, send the owner back into Codespaces/keys, or interpret this as permission to switch providers. Leave `VITE_STAGE2_UNIVERSAL_AAL2` disabled and `organisations.privileged_mfa_required` unchanged/off for this release; keep dormant implementation secured for future review rather than deleting it, altering historical migrations, or silently disabling unrelated RLS/permissions. **Still mandatory now:** genuinely test existing email/password activation/sign-in/recovery and role/tenant isolation, SQL/RLS/RPC/Storage/Edge negative authorisation, functionality, owner-approved visual/reporting contract, migration integrity, reliable backup/rollback and release readiness. The isolated staging project's zero users are not proof that an existing CEAC account was migrated or authenticated. Preserve 11 live users/profiles and all production data until separately explicit P9 deployment GO. Earlier P8 instructions requiring **Google/TOTP/AAL2 provider proof before Stage 2** are SUPERSEDED; that specific acceptance is moved to the later Google+MFA release, not marked PASSED. One branch/PR #118, focused execution, no production/provider/config/repo-visibility changes and no waiver of other security boundaries.

> **Current release-execution details:** [Stage 2 email/password P8/P9 cutover gates](docs/continuity/CEAC_STAGE2_P8_P9_EMAIL_PASSWORD_RELEASE_2026-10-19.md). Owner said GO AHEAD, but do not mutate production or merge until ordered schema/historical Google-hook reconciliation, verified backup, real existing email/password/role smoke test, and authorised Vercel deployment+rollback mechanism. The connected Vercel account does not currently expose CEAC project. No Google or MFA now. Existing P0–P7 accepted; NO new branch.

> **19 OCT — P8 FULL FROZEN BUILD CANDIDATE:** P3–P7 individually closed in isolated tested scopes; do not reopen. This [P8 plan](docs/continuity/CEAC_STAGE2_P8_FROZEN_CANDIDATE_2026-10-19.md) deliberately triggers full **[level-b]** QA on exactly one frozen PR #118 SHA; never claim P8 GO based on Level A docs only or earlier full baseline. Preserve real standalone CEAC-owned staging Auth/TOTP/AAL2 and Storage/Edge/RPC/recovery HOSTED proof as unresolved mandatory release blocker. Do not reuse Stage1 production or unrelated project. No P9 production or GitHub privacy change until a separately explicit owner GO.

> **19 OCT — P7 ISOLATED BUILD ACCEPTED:** All Stage 2 P3–P7 isolated engineering gates individually CLOSED, newest [P7 visual evidence](docs/continuity/CEAC_STAGE2_P7_VISUAL_ACCEPTANCE_2026-10-19.md). Exact Stage 2 Staff/Executive visual owner references are already approved and tested RGB<=6; whole 779 browser suite and 631808 CSS passed. Confidential revised Projects mockup (1536x1024) inspected against real synthetic 1440x1212 screenshot; structural parity is accepted, **not a false claim of byte/pixel-identical originals**. P8 MUST retain any owner-demanded literal source-vs-render comparison, CEAC-owned hosted Auth/TOTP/RLS/RPC/Storage/Edge/recovery, single exact frozen SHA and negative browser/report/export. P9 production needs separate owner GO; no branch proliferation, no production change, no re-testing stages without specific regression.

> **19 OCT — P6 STAGE CLOSED AFTER P3→P4→P5:** P6 reporting, human appraisal, independent HR release, personal print/PDF and issued Executive facts have been **ACCEPTED in isolated Stage 2 source/SQL/browser scope** with [specific evidence](docs/continuity/CEAC_STAGE2_P6_FINAL_ACCEPTANCE_2026-10-19.md), backed by real complete Level B at `ce23d43`; no P6 runtime changed since then. Do not reopen P3–P6 without a concrete new failed requirement. **Next P7 whole-app V4 and exact private Projects reference**, then frozen hosted single-SHA P8, separate P9 owner GO. No branch proliferation, no production changes, no bypasses.

> **19 OCT — STRICT SEQUENTIAL P5 CLOSURE:** P3 accepted and CLOSED [4ee6f720](https://github.com/ceairportcity/ceac-os/commit/4ee6f7200bce4f5554c4b36a79c69164a0fcec7c); P4 CLOSED [ae3e934](https://github.com/ceairportcity/ceac-os/commit/ae3e9344e8c599a2923f9f115000069876e4d963); P5 Projects/contributions separately **CLOSED** with [dedicated evidence](docs/continuity/CEAC_STAGE2_P5_FINAL_ACCEPTANCE_2026-10-19.md) and unchanged P5 source between two full green browser/SQL gates and the documentation-only P4 close. No P6/P7/P8 implementation is authorised by THIS P5 acceptance. Do not revisit P3–P5 absent a verified new regression. Distinct Projects private exact screenshot fidelity remains P7, hosted security/final frozen SHA remains P8; separate P9 production GO mandatory. Preserve single PR #118, Stage 1 main/live database and repo visibility.

> **19 OCT — OWNER ORDER P4 CLOSURE:** P3 was separately CLOSED (4ee6f720). P4 Work execution/private and assigned recurrence is now **CLOSED** with [dedicated P4 evidence](docs/continuity/CEAC_STAGE2_P4_FINAL_ACCEPTANCE_2026-10-19.md); do not relitigate these accepted features without a new actual failing regression. Stage next is P5; this P4 commit does NOT implement or accept it. Preserve security, frozen P8 and separate production P9 GO; no branch proliferation or Stage 1 changes.

> **19 OCT — STRICT OWNER ORDER: P3 FIRST:** P3 personal attendance is individually **CLOSED** once [stage-specific P3 acceptance](docs/continuity/CEAC_STAGE2_P3_FINAL_ACCEPTANCE_2026-10-19.md) is published on PR #118; only then work on P4. Do NOT start or edit P5/P6/P7 in a P3/P4 acceptance batch; do not reopen P3 without a new verified P3 regression. P2 owner accepted, P8/P9 retained. Use one existing branch and preserve CI and Stage 1 live.

> **19 OCT 2026 — CURRENT OWNER STAGE-CLOSURE OVERRIDE (READ FIRST):** Owner has accepted **P2 product/security implementation** and directed **close P3, P4, P5 and P7 using completed acceptance evidence**, not incremental unrelated P6 fixes or repetitive test loops. [Owner directive](https://github.com/ceairportcity/ceac-os/pull/118#issuecomment-6260295647); [single stage evidence/ledger](docs/continuity/CEAC_STAGE2_P2_P3_P4_P5_P7_STAGE_ACCEPTANCE_2026-10-19.md). P3/P4/P5 isolated functional stage engineering acceptance and P7 automated/owner-rendered reference acceptance rest on [full 779/779 browser+SQL QA](https://github.com/ceairportcity/ceac-os/actions/runs/39184315800) at `bfe56e2` and source-unchanged P3/P4/P5/P7 diff to `882b497`. The full gate at [39203475341](https://github.com/ceairportcity/ceac-os/actions/runs/39203475341) must reach terminal before publishing the stage closeout. **Scope caveats remain explicit:** independent CEAC-owned hosted Auth/TOTP/RPC/Edge/Storage/recovery is *not* proven and remains mandatory P8 release verification; private original Projects screenshot is not automatically pixel parity certified by route/geometry browser sweeps. P6 cross-role acceptance, P8 single exact-SHA certification and separate P9 production GO are still open. Do not regress Stage 1 or use the unrelated Supabase project. **NO unrelated new feature work, no P2/P3/P4/P5/P7 stage reopening without a concrete failing gate.**

> **19 OCT 2026 — BINDING OWNER-APPROVED EXACT STAFF/EXECUTIVE RENDERS:** The owner said **yes** to the *exact rendered* Stage 2 Staff and Executive Overviews. Use their pinned synthetic screenshot identities and 1440x960 whole role-content RGB fingerprints at `docs/design/CEAC_STAGE2_OWNER_APPROVED_RENDERED_OVERVIEWS_2026-10-19.md`. Retire old Staff/R4 Executive screenshot references; preserve Manager/Admin unchanged and compare scenic/photo content itself under RGB <=6 (do not mask out hero). Keep genuine Work session controls, 10 licensed daily rotating photos, 631808-byte emitted CSS budget and full P7/P8/P9 gates. This is NOT production GO. Keep Stage 1 safe, one active PR #118 and no forced push.

> **18 OCT 2026 — FOCUSED CI SPEED RULE:** During active nonrelease P3 and P6 source work, only specifically tagged [p3-attendance] / [p6-reports] single-tip commits restricted to the exact `scripts/ci/stage2-focused-scope.mjs` path allowlist use relevant exact-head Playwright + full source/build instead of rerunning all four browser shards. A mixed, unmarked, SQL, Auth, cross-domain, CI, visual, or test-only edit remains full. [level-b] stage closure and P8 still require full SQL/security, browser shards, visual and release evidence. No waiving known failures. This efficiency correction itself is [level-b] and must be fully verified.

> **18 OCT 2026 — BINDING OWNER AUTHORITY:** Owner has approved CEAC Stage 2 separate staging; do not ask again for staging design approval. The ONLY ordinary in-app MFA lost-device recovery/permission authority is existing **Administration/HR**, not Technical Support, Compliance, Executive or another hypothetical administrator. Identity-verify, audit and require verified admin AAL2/TOTP at the server; no self-approved recovery. The sole Admin/HR's own total-factor-loss uses a separately authorised out-of-band Supabase project owner/provider break-glass path, never a password-only bypass. Do not reuse current live Stage 1 or unrelated Supabase projects and do not incur unquoted charges. 12-hour owner delivery window: execute continuously in the sole PR #118, with proportionate focused source tests and full stage/P8 gates, preserving in-flight runs. **P9 still needs separate owner production GO.**

> **17 OCT 2026 — OWNER CI EFFICIENCY CORRECTION:** On the single active Stage 2 PR #118 only, a [p2-security] / [p2-edge] tagged single tip touching exclusively the Edge integration handler/helper and/or its native test may run focused source/build, Account Security, SQL/authority and real isolated provider/Edge tests rather than four full browser shards. Other changes remain conservative. Full [level-b] stage-end and P8 exact-SHA browser/SQL/security acceptance remain mandatory; focused green is NOT P2/P8 acceptance. Do not interrupt useful in-flight CI, do not modify main or production.

> **LATEST BINDING OWNER STAGE GATE — 17 OCT 2026: P1 ACCEPTED, P2 ACTIVE.** The owner explicitly responded **“I approve, go ahead”** to the [one consolidated seven-group material-exception review on PR #118](https://github.com/ceairportcity/ceac-os/pull/118#issuecomment-6235307208). This is explicit approval of the existing Stage 2 ten-family visual directions and material exception DESIGN/INTERACTION architecture: multi-unit Manager Work and Projects; Manager appraisal / separate HR issuance / employee response; Support versus independent Compliance; protected Payroll versus Finance; Executive evidence; private Calendar/meetings; invite-only Auth, TOTP/AAL2 and recovery designs. The exact owner-reviewed P1 source is PR #118 SHA `a7536247152c561237b697e454ec4f1e9413a2d4` with [CI](https://github.com/ceairportcity/ceac-os/actions/runs/39041919804), [Account Security](https://github.com/ceairportcity/ceac-os/actions/runs/39041919683), [Migration Replay](https://github.com/ceairportcity/ceac-os/actions/runs/39041919663), [classified Quality Gate](https://github.com/ceairportcity/ceac-os/actions/runs/39041919718) all **SUCCESS** in their applicable P1 scopes. The 47 tab routes, `me` fallback, eight overlays and ten families are mapped; Work original desktop/mobile and scenic Overview identities are owner-confirmed; newer Projects exact original SHA256 `66918f3e3d35fe7a6adf36a85eb90b14c0f719fc8f88fed378d538a47518a559` is independently verified in the PRIVATE visual library. The old plain Overview and superseded Projects references remain rejected. **P1 ACCEPTED — design/architecture only; stop prototype additions. P2 ACTIVE immediately**: verify real Auth/TOTP/AAL2, backend/Storage/Edge/RLS authority and safe recovery in isolation. Old contrary P1-IN-PROGRESS or image-missing statements below are historical, overridden by this signed acceptance. This owner approval is **NOT** runtime functionality certification, P7 visual implementation parity, P8 full release QA, P9 production GO, nor permission to alter Stage 1 production, protected main, live Supabase/Auth/Storage/Vercel or repo visibility.

> **LATEST 17 OCT — EXACT REVISED PROJECTS IMAGE RECOVERED AND PRIVATELY VERIFIED:** Original 1536×1024 PNG recovered under its former name `CEAC OS Sunday Service Dashboard.png`; SHA256 `66918f3e3d35fe7a6adf36a85eb90b14c0f719fc8f88fed378d538a47518a559` matches the 16 October owner-selected new Projects design EXACTLY. Its unchanged bytes are also archived at private ChatGPT Library path `/CEAC OS/Stage 2 Approved Visual References/Projects_Revised_Exact_Owner_Approved_2026-10-16.png`, with the same SHA verified after copy. **Do NOT ask owner to resend this image.** Original contains named portrait mockups: DO NOT commit the private original to temporarily PUBLIC GitHub, paste it into public issue comments, or replace it with the old deleted Projects. `docs/design/stage2-v4/CEAC_STAGE2_OWNER_SELECTED_SCREEN_PROVENANCE_2026-10-17.json` is the public-safe identity record. Exact approved original source is AVAILABLE privately; separately still required: safe public CI fixture/redaction strategy, actual browser screenshot parity, material role exception acceptance, and P1 sign-off. P1 NOT accepted, no production GO.

> **LATEST BINDING OWNER VISUAL DECISION — 17 OCT 2026, EXACT SOURCE RECONCILED:** The owner reconfirmed the 16 October **desktop Work** screenshot (SHA256 `c84f9ab01a43be444ac7e2364555a0bfe3cbf63dd3117c6d9001fda94192406b`, 1536x1105) and **phone Work** screenshot (SHA256 `e53d92014cf2f4852402730db95f6dcf2772c095bdd9917ffc72f861d1408555`, 390x1971) as the approved Work design direction. The owner explicitly confirmed the **richer scenic/photo-backed Overview** submitted in the 17 October conversation (SHA256 `315c6260aa7994e339841b4ca26e78004b041a294209b197c016b9f55c13324e`) as the approved Overview direction. The rejected plain Overview and superseded Projects screenshots are RETIRED and may not be shown or used as approval references; old V4 HTML is a mixed historical candidate, NOT the universal visual master. Projects retains the 16 October newer owner decision, and the exact binary is SHA-verified in the private approved-reference Library; no original is published in GitHub. Read [the binding provenance register](docs/design/CEAC_STAGE2_VISUAL_REFERENCE_CORRECTION_2026-10-17.md). This updates the **visual references only**, not the approved 10-family method, application functionality, security, P1 acceptance or production. No repeated blanket owner approval request.

> **17 OCT 2026 OWNER CORRECTION — VISUAL REFERENCES DISPUTED; P1 NOT ACCEPTED.** See [exact rejected/superseded source register](docs/design/CEAC_STAGE2_VISUAL_REFERENCE_CORRECTION_2026-10-17.md). The original plain Overview PNG and superseded Projects PNG have been removed from the active PR tree; historical HTML Overview is visibly withdrawn. Work/Mobile candidates remain pending individual provenance verification. The owner explicitly rejected the images recently presented as the approved Stage 2 V4 redesign, including the displayed `CEAC_Stage2_Workspace_V4_Overview.png` and Work preview. **Do not describe those images, the 10-family legacy-image gallery, or related mockup screenshots as the owner's accepted *final* Overview/Work design.** The white/light-blue V4 direction and previously authorised reusable-family *method* remain constraints, but final exact screen provenance must be reconciled from the owner-approved 16 October Work desktop/mobile, newer image-led Overview (scenic photography rotated daily), and latest collaborative Projects design. A candidate image-led Overview original in owner-provided materials has SHA-256 `315c6260aa7994e339841b4ca26e78004b041a294209b197c016b9f55c13324e`; its identity and relationship to the full approved screen set must be reviewed before it is substituted as binding. Older screenshot SHA statements are historical provenance, not final visual approval. **No 47 bespoke mockups; no reversion to legacy look; no implicit P1 sign-off or P2 advance.** Preserve current branch and production.

> **OWNER-APPROVED P1 METHOD, 17 OCT 2026 (SUPERSEDES PRIOR BESPOKE-PER-ROUTE MOCKUP QUOTA):** The product owner explicitly approved family-and-material-exception sign-off. See [formal decision](docs/design/CEAC_STAGE2_P1_OWNER_APPROVED_FAMILY_METHOD_2026-10-17.md) and the finite ten-family review. Complete coverage of 47 routes, default `me`, eight overlays and all role/mobile/permission states remains required, but individually duplicated desktop/phone mockups for a route *inheriting a verified approved pattern* are no longer required. **Material exceptions still require explicit owner visual approval; P1 is NOT accepted.** P2–P9 security, product and release gates remain unchanged.

# 17 OCT 2026 — OWNER STAGE 2 DELIVERY-EFFICIENCY OVERRIDE (CURRENT FIRST READ)

**Owner-directed operating correction, executable now:** Stage 2 stays on the sole PR #118, **P0 accepted; P1 active**. No new branch, reset, parallel redesign or speculative screen-per-route prototype programme. Preserve the latest in-flight batch and existing connected V4 candidate. Treat [P1 finite ten-family design/exception review](docs/design/CEAC_STAGE2_P1_FINITE_FAMILY_REVIEW_2026-10-17.md) as the SINGLE next owner-review package; map all 47 routes/8 overlays to V4 patterns, but create a distinct screen only for a material interaction, hierarchy, role or privacy exception. Reuse all prior approved references and P2–P7 source. **The product owner has APPROVED the family-and-material-exception acceptance method** in `docs/design/CEAC_STAGE2_P1_OWNER_APPROVED_FAMILY_METHOD_2026-10-17.md`. P1 itself remains IN PROGRESS; the material designs, exact revised Projects asset and required verification still need real acceptance. Do not request method approval again or open P2 prematurely.

**Verification efficiency implementation:** A narrowly allowlisted, explicitly marked `[p1-design]` batch of standalone synthetic P1 design HTML + its own tests may run focused Level A browser/source verification. It is not P1 acceptance, Auth/SQL clearance, or a release test. Changed product code, App/routes, security/Auth, migrations, CI harness, styles, baselines, or nonallowlisted Playwright acceptance tests retain their original comprehensive gates. Full exact-SHA P1 acceptance, P7 and P8 suites remain mandatory, no visual threshold/budget reductions. Check CI classification output and actual job results; skipped tests are SKIPPED, not PASS. GitHub Actions `cancel-in-progress` is true for PR workflows: finish current valuable run before pushing next batch, and avoid repeated one-file commits. No production Auth/SQL/Storage/main/Vercel/visibility changes.

---

# 17 OCT 2026 — OWNER EXECUTION OVERRIDE: STAGE 2 STRICT P0–P9 SEQUENTIAL ACCEPTANCE (FIRST READ)

**This is the newest binding engineering execution policy; it supersedes any older recommendation for parallel phase development, one-PR-per-stage branches, scattered P2–P7 changes or premature release claims.** Read the [Stage 2 sequential execution and acceptance ledger](docs/continuity/CEAC_STAGE2_SEQUENTIAL_EXECUTION_LEDGER_2026-10-17.md) FIRST, then this file's existing single-branch owner handover and latest product/security/design contracts.

**Finish the bounded in-flight unit before changing stages.** The prior P2 forward-only universal-TOTP migration-156 correction at `63f877e5c4a4ef748e71e4e8f84427a4d053786c` has been safely checked: [CI](https://github.com/ceairportcity/ceac-os/actions/runs/39008265159), [Account Security](https://github.com/ceairportcity/ceac-os/actions/runs/39008265143), [Migration Replay](https://github.com/ceairportcity/ceac-os/actions/runs/39008265173) and Quality Gate SQL/authority PASS; completed [Quality Gate 39008265171](https://github.com/ceairportcity/ceac-os/actions/runs/39008265171) has browser shards 1/2 PASS, shard 3 FAIL (Manager Reports fail-closed UI), shard 4 FAIL (CSS budget and Staff/Executive RGB), aggregate gate FAIL. Preserve these failures for P6/P7/P8, not as evidence of accepted P2 or P8. Do not repeat or overwrite this correction unnecessarily.

**Now execute P0 -> P1 -> P2 -> P3 -> P4 -> P5 -> P6 -> P7 -> P8 -> P9 in that strict order on ONE existing integration branch/PR #118.** One **active** stage only; do not advance until the current stage has exact-SHA functional, negative-access, design/owner and security acceptance evidence recorded in the ledger. P0 is IN PROGRESS, P1 NOT ACCEPTED. Existing P2–P7 code MUST be preserved and mapped to its stage, not discarded or rebuilt. Review and complete it only when that stage becomes active. Urgent independently verified security/data-loss risks may be contained out of order in a narrowly documented scope; no unrelated feature expansion. No extra implementation branches, speculative merges, overlapping writers or force pushes.

**Release boundaries remain intact:** production `main`, original Supabase Auth/SQL/Storage/tenants, Vercel live deployment, and temporary public-repository visibility must remain unchanged until applicable explicit owner approval. **P9 requires a separate owner production GO after P8 is genuinely accepted.** Passing source/SQL tests, cancelled Vercel preview, skipped browser jobs and historical accepted visuals do NOT constitute complete Stage 2 acceptance.

---

# 16 OCT 2026 — STAGE 2 SINGLE IMPLEMENTATION BRANCH / STOP FRAGMENTATION

**FIRST READ — current owner correction, superseding conflicting branch/workflow advice:** The owner requires that the ongoing integrated Stage 2 build be tied together into ONE implementation candidate. **Draft PR #118 (`chatgpt/stage2-unified-integration-20261016`) is the sole active Stage 2 integration branch and implementation source of truth.** Read `docs/continuity/CEAC_STAGE2_SINGLE_INTEGRATION_HANDOVER_2026-10-16.md` and all latest owner contracts before writing. PR #115 remains the locked owner-requirements parent; PR #116/#117 and isolated P6/TOTP/rubric branches are preserved read-only historical work, NOT independent parallel release candidates. Do not delete, reset or bulk-merge them. In particular, do not build a second achievement, reporting, human appraisal or authentication engine.

**ONE WRITER / EXACT-HEAD rule:** Inspect latest HEAD and PR #118 check results before each bounded implementation batch. Avoid simultaneous writers and overlapping files, speculative branches, milestone-by-milestone commits and CI retries. Commit an integrated reviewed batch, freeze its SHA, complete native source/build, isolated migration replay/SQL negative RLS, all-role auth/browser/visual checks at that exact SHA and fix only confirmed gaps. GitHub cancels superseded checks on repeated pushes; a cancelled run is NOT evidence of pass/fail. Vercel preview rate limiting is NOT a reason to retry repeatedly or to modify production.

**Current security reconciliation:** The frozen Stage 1 authenticated SECURITY DEFINER allowlist has 145 approved entries. Stage 2 introduces ONE separately reviewed universal-TOTP/AAL2 helper, so the complete Stage 2 allowlist has exactly 146. Do not loosen the count or replace exact allowlists with a generic ceiling. `supabase/tests/platform_kernel_gate.sql` was reconciled on PR #118 in commit `a0e03a4bd7591646f50a174e1187ab9cafb3d8b9`; subsequent full exact-SHA gate results are required before declaring SQL acceptance.

**Boundaries:** The owner-approved new Projects PNG has been independently recovered and SHA-verified in a private Library reference folder; public-safe test-fixture and literal screenshot parity are NOT yet accepted. Source build passes are not live TOTP/AAL2, true browser-session/recovery, HR disclosure or whole-route V4 approval. No production `main` merge, original Supabase live migration/Auth switch, Vercel deployment, repo privacy change or P9 GO without explicit separate owner authorisation.

---

# 16 OCT 2026 LATEST OWNER LOCK — STAGE 2 MONTHLY/QUARTERLY REPORTING, COMPLIANCE & HUMAN APPRAISAL
**MANDATORY FIRST READ:** Added approved Stage 2 reporting/application-wide performance requirements in [docs/product/CEAC_STAGE2_PERFORMANCE_REPORTING_APPRAISAL_LOCK_2026-10-16.md](docs/product/CEAC_STAGE2_PERFORMANCE_REPORTING_APPRAISAL_LOCK_2026-10-16.md). **Quarterly structured Manager-entered 1–5/N/O ratings with reasons REQUIRED for formal reviews; monthly ratings OPTIONAL.** System-calculated indicators are factual only and must not auto-generate scores/rankings, punishment or salary. Employee/Manager individual contribution reports, project/unit achievements, source-linked PDF, compliant attendance/Compliance observations, protected HR release, authorised Executive/Admin-initiated quarterly event, presentation-ready Executive reporting and same-result-no-double-count are all **Stage 2 P0–P9** requirements. Preserve exact approved V4 light/blue visual standard, distinct Executive identity and current project gold references; extend to actual HR/Exec report screens and print designs. Group Pastor excluded from employee appraisals only. This LOCK is docs-only and does not authorise merge, Auth/SQL cutover, production or change already accepted privacy boundaries. **Check live open PR #115→#116→#117 and later continuation before editing implementation branches; never reset concurrent work.**

---

# 16 OCT 2026 LATEST DESIGN OWNER OVERRIDE — STAGE 2 V4 WHITE WORKSPACE, ENTIRE CEAC OS

**MANDATORY FIRST READ (updated 17 October):** The selected Work desktop/phone screenshot fingerprints and image-led Overview direction above are the current owner visual authority. `docs/design/stage2-v4/CEAC_STAGE2_V4_CANONICAL_INTERACTIVE.html` is **historical/mixed** and contains owner-rejected or superseded screens; never copy its Overview or Projects. Use it only for separately verified reusable candidate behavior. Maintain role-specific coherent experience across every applicable panel, protect calendar/Executive identities, exact role/data permissions, AAL2, all 47 routes and eight overlays. No Stage 2 release without later owner GO.

---

# 16 OCTOBER 2026 LATEST OWNER DECISION — ONE INTEGRATED STAGE 2 (WHOLE-APP DESIGN/WORK + UNIVERSAL TOTP; **NO GOOGLE-ONLY**)

**CURRENT FIRST READ — supersedes any prior first-release/Stage 2 Google-only, Google Workspace requirement and separate future redesign sequencing.** Stage 2 is ONE full CEAC OS product and security release: the already locked complete Staff/Manager/Technical Support/HR/Admin/Executive/Volunteer Work/Projects/Attendance/HR/Executive read experience and premium design overhaul **PLUS** secure invitation-based email/password sign-in with verified authenticator-app TOTP and real Supabase AAL2 for every enabled user. Existing authorised email/password sign-in is allowed; Google may be optional later but is NOT mandatory. Prevent accidental 5-minute logout and persist the same verified AAL2 work session through page refresh/token refresh; every genuinely new login requires TOTP. Do NOT weaken AAL2 or implement client-only 'skip MFA' grace. See [Stage 2 unified contract](docs/continuity/CEAC_STAGE2_UNIFIED_EXECUTION_CONTRACT_2026-10-16.md), [auth/session policy](docs/security/CEAC_STAGE2_AUTH_SESSION_POLICY_2026-10-16.md), [full UX/Work scope](docs/product/CEAC_OS_GLOBAL_WORK_EXECUTION_AND_EXPERIENCE_CONTRACT_2026-10-16.md), [coverage matrix](docs/design/CEAC_GLOBAL_EXPERIENCE_ROUTE_MATRIX_2026-10-16.md), and [next-chat execution prompt](docs/continuity/CEAC_GLOBAL_WORK_REDESIGN_NEXT_CHAT_2026-10-16.md). This is documentation approval and scope authority only, **NOT** signed-off exact visual mockup, Auth configuration change, applied SQL, `main` merge or production release GO. Retain all non-conflicting protections, owner visual review, real-data privacy, role RLS, existing Supabase/Vercel, one writer, and temporary PUBLIC repo policy. Current owner asks Chat-only execution until Work returns; minimise TinyFish/payments/CI churn; never claim unsupported browser capabilities.

---

# 16 OCT 2026 OWNER OVERRIDE — COMPLETE WHOLE-APP WORK, ATTENDANCE, CONTRIBUTION & EXPERIENCE REDESIGN (DOCUMENTATION CONTRACT; NO RELEASE GO)

**FIRST READ FOR NEW PRODUCT/UX WORK:** The owner has LOCKED a **complete application-wide** programme covering every Staff, Manager, Technical Support, Administration/HR, Executive and appropriate Volunteer panel, every linked form/drawer/report and the cross-role employee → Manager → HR → Executive data flow. The authoritative detailed scope, stage gates and negative/security acceptance are in [docs/product/CEAC_OS_GLOBAL_WORK_EXECUTION_AND_EXPERIENCE_CONTRACT_2026-10-16.md](docs/product/CEAC_OS_GLOBAL_WORK_EXECUTION_AND_EXPERIENCE_CONTRACT_2026-10-16.md), [docs/design/CEAC_GLOBAL_EXPERIENCE_ROUTE_MATRIX_2026-10-16.md](docs/design/CEAC_GLOBAL_EXPERIENCE_ROUTE_MATRIX_2026-10-16.md) and [docs/continuity/CEAC_GLOBAL_WORK_REDESIGN_NEXT_CHAT_2026-10-16.md](docs/continuity/CEAC_GLOBAL_WORK_REDESIGN_NEXT_CHAT_2026-10-16.md). FIRST executor deliverables are live S0 whole-role inventory and S1 interconnected visual proposal for **owner approval**; prior chat HTML V1/V2 is NOT an approved visual baseline. All-role Start/End Work stays on Overview; self-work can link to projects; participant contributions, optional manager assessment and HR/Executive READ experience are in-scope. Strongest Project gold layout is a reference, Executive identity stays distinct, no universally copied dashboard. **NO automatic main/SQL/production/deploy permission**. Existing Stage 2 Auth work remains separately deferred; preserve current security/RLS, HR and Payroll, approved gold references and original production. The October 15 temporary PUBLIC visibility instruction remains authoritative.

---

# 15 OCT 2026 OWNER OVERRIDE — R3/R4 VISUAL TARGETS APPROVED; TEMPORARILY KEEP REPOSITORY PUBLIC

**FIRST READ, newer than the 14 Oct header below:** The owner expressly approved updating only Administration and Executive visual RGB fingerprints to the newer approved R3/R4 role-home screenshots, retaining the strict mean RGB threshold of 6. Decision and exact evidence are recorded in [docs/final-product/PRODUCT_OWNER_DECISIONS.md](docs/final-product/PRODUCT_OWNER_DECISIONS.md). Do not alter Staff/Manager targets, weaken the Quality Gate or treat a visual rebaseline as automatic product acceptance. The owner separately instructed **leave `ceairportcity/ceac-os` PUBLIC for now**; this specifically supersedes the older immediate-return-to-PRIVATE timing, but is not a permanent public-source policy. Preserve confidentiality, source/data/security controls and the obligation to return PRIVATE when the owner next directs. All production migrations, main integration, Vercel deployment and Supabase transfer still require separate release GO. Continue safe exact-head verification on the current candidate.

---

# 14 OCT 2026 OWNER OVERRIDE — TEMPORARY PUBLIC CI; RESTORE PRIVATE IMMEDIATELY AFTER USE

**FIRST READ:** [docs/continuity/CEAC_TEMPORARY_PUBLIC_CI_OWNER_DECISION_2026-10-14.md](docs/continuity/CEAC_TEMPORARY_PUBLIC_CI_OWNER_DECISION_2026-10-14.md). The owner temporarily authorised PUBLIC visibility for `ceairportcity/ceac-os` to allow free GitHub-hosted CI. This is a **strictly expiring exception** to prior private-only/no-public-runner language, not a permanent change. **The instant final necessary CI evidence is captured—or public runners prove unusable—restore the repository to PRIVATE and verify its visibility. Do not wait for payment, production release or deferred Stage 2.** While public, do not commit secrets, production dumps, employee/HR data or private artefacts. Retain all RLS/privacy/security and release-GO controls. CE Airport City stays canonical; the owner prioritises transfer of the **existing** Supabase project's ownership to CE Airport City, while Google OAuth/universal MFA and other Stage 2 work remain deferred. One writer per branch; preserve live production and uncommitted work.

---

# 14 OCT 2026 OWNER-LOCKED NEXT BUNDLE — FIRST READ OVERRIDE

**Read [docs/continuity/CEAC_LOCKED_NEXT_RELEASE_EXECUTION_2026-10-14.md](docs/continuity/CEAC_LOCKED_NEXT_RELEASE_EXECUTION_2026-10-14.md) immediately after this header.** Owner approved the next **one-bundle** Volunteer + Technical Support + attendance-integrity + HR/workforce/Payroll/work-acceptance completion and a four-stage S0–S3 execution. Stage 1 is **already deployed live** from PR #63 SHA `1b0a4fbb3acb2db5efb407d8c39b6a8e909dfe38` on original 119-migration Supabase. Google OAuth, universal MFA/AAL2, and comprehensive Auth/Storage recovery move to separate Stage 2 (provisional November), without waiving interim RLS/privacy and migration safety. Earlier Google-first/no-production-before-MFA wording and old production-status snapshots **are superseded on scope/sequence/status**. Preserve all accepted security, protected HR/payroll, source code and real data. One build integration branch, no premature SQL/merge/deploy; final owner GO for a migration-bearing production release. Read current canonical state and avoid overwriting uncommitted Codespace changes.

---

# 13 OCT 2026 OWNER UPDATE — TINYFISH RECOVERY ONLY; FIRST READ

**Latest owner override to the 12 October "TinyFish unavailable" rule:** TinyFish has been replenished and its connected wallet verified as positive on 13 October. One **bounded** browser-assisted recovery of Work's existing CEAC Codespace is now permitted **after the owner signs into the GitHub account that owns that Codespace using a secure TinyFish profile setup**. No browser profile currently records a GitHub sign-in, so do not run metered authenticated automation until sign-in is confirmed. Never ask for a password/OTP in chat or copy credentials into PRs.

**Sequence:** inspect Codespaces listing and verify original workspace/repository/branch/HEAD and exact uncommitted Google OAuth/identity/TOTP files **read-only**; do not reset, checkout, discard, stash, overwrite or expose credentials/employee data. Once verified, preserve unpublished work through a reviewable, privacy-safe recovery branch/snapshot, avoiding secrets, without changing existing working files. Recover first, then determine what Work already completed and which release gates remain. Never use this tool for a blind production deployment or run unrestricted QA.

**Credit protection:** Check wallet before each automation. Cap initial run at ≤35 agent steps and ≤10 minutes; stop on authentication, workspace ownership, spend or Codespace access failures rather than retry. No top-ups or auto-reload. Monitor wallet after each run and cap the recovery effort at $1 without fresh owner approval. Existing production and PR #50 application source remain untouched; this exception does not constitute owner release GO. The full [dual-mode execution contract](docs/continuity/CEAC_MIGRATION_FINISH_DUAL_MODE_EXECUTION_2026-10-12.md) remains mandatory.

---

# BINDING FIRST READ — FINISH CEAC MIGRATION WITH DUAL CHAT/WORK EXECUTION (12 OCT 2026)

**Before interpreting any older "active phase", running tools, editing source, or asking the owner for another plan, read [CEAC_MIGRATION_FINISH_DUAL_MODE_EXECUTION_2026-10-12.md](docs/continuity/CEAC_MIGRATION_FINISH_DUAL_MODE_EXECUTION_2026-10-12.md).** This is the latest owner-approved operating objective and division of labour. The outcome is the fully **improved** CEAC application migrated from the old GitHub account to private `ceairportcity/ceac-os`, with existing Vercel/Supabase production preserved, functioning real HR and other role access, and Google-only HR-approved identities with universal TOTP/AAL2 in the same release. Preserve all approved design, features, data and security. No rollback to the unimproved old app.

**When Work is unavailable:** Chat uses only actually connected GitHub, read-only Supabase, permissioned read-only Vercel and genuinely available local analysis/test tools for separate, bounded, verifiable work. **TinyFish credits are exhausted: DO NOT USE TinyFish or substitute paid providers.** Do not edit Work-owned authentication/MFA/identity files, overwrite unpushed Work state, commit directly into its source branch, change `main`/production, or start repeated CI/Codespace/provider loops. Document proof and leave reviewable results for Work to integrate. When Work returns, it must recover uncommitted work first and continue from the latest actual state.

**Authority:** This first-read operating objective overrides stale *process/sequence* text further down, but does not waive owner product contracts, RLS/privacy, data recoverability, reviewed releases or explicit production GO. The linked contract defines exact responsibilities, available tools, start/stop conditions, evidence and existing live checkpoint facts.

---

# CEAC CURRENT ENGINEERING WORKFLOW — READ THIS BEFORE LEGACY PHASE HEADINGS

**Process authority (proposed, documentation-only, 11 October 2026):** Read [docs/continuity/CEAC_ENGINEERING_OPERATING_PLAYBOOK.md](docs/continuity/CEAC_ENGINEERING_OPERATING_PLAYBOOK.md) and [docs/continuity/CEAC_LIVE_HANDOVER.md](docs/continuity/CEAC_LIVE_HANDOVER.md) FIRST in every new CEAC engineering chat/session. Revalidate actual GitHub PR/branch HEADs before using the handover's dated values. Those files govern **working methods, proven tools, coordination, evidence, and handoff**; binding product scope still comes from the latest documented owner decisions and accepted contracts. The process notes override this file's superseded *workflow/active phase* statements where they conflict, but NEVER waive privacy, RLS, MFA, payroll/HR, testing or visual acceptance requirements.

**Persistence is mandatory:** when a tool works, fails, or a procedure is improved, commit the reproducible method, real evidence, cost/credential constraints, branch SHA, blocker, next action and lessons to the playbook/live handover on a safe operations/docs branch before ending. Keep product PR #47, security PR #48 and frozen release PR #44 isolated; no production changes or unverified GO.

---

# POST-ONBOARDING OPERATIONAL REFINEMENT IS ACTIVE

The product owner authorised the 6 October 2026 post-onboarding programme. Read `docs/continuity/CEAC_POST_ONBOARDING_MASTER_IMPROVEMENT_REGISTER_2026-10-06.md`, `docs/continuity/CEAC_OPERATIONAL_REFINEMENT_SEQUENCE_2026-10-06.md` and the current phase acceptance/contract before writes. Phase 2 Attendance, Working Patterns & Permissions is complete at protected main `a482ab602bacb511c18436e256dd932526f14fdd`; its final documentation closure is `97d2b4a7a3220a7764f5eaa3e43c8d31672374b0`. Phase 3 Compliance Operating Surface is complete at protected main `4179b71ed8757ece726c4282363edaacc8b158b6`, production migration `20261006121001_113_compliance_operating_surface`, under `docs/continuity/CEAC_COMPLIANCE_PHASE3_ACCEPTANCE_2026-10-06.md`. Phase 4 Notification & Work-State Communication is NEXT and has not started. Do not reopen accepted Phase 2/3 work or silently broaden Compliance authority. Existing accepted domain, security, privacy, audit and visual contracts below remain binding. Unexplained absence, disciplinary cases, Pastor override, financial consequences, employee scoring, automated dress monitoring and background surveillance remain outside accepted scope. GitHub is canonical; one writer; reconcile forward.

---

# FINAL PRODUCT PARITY & GO-LIVE IS THE ACTIVE PRODUCT PROGRAMME

Programme: CEAC OS — Final Product Parity & Go-Live (FPG)
Active branch: `chatgpt/final-product-parity-go-live-2026-10-02`
Canonical source: GitHub.

This block supersedes conflicting older VF/V2 visual sequencing. Older Experience V2 / VF technical, security, RLS, data-integrity, audit, protected-HR, capability-authority, finance-authority, Work Engine, integration, accessibility and truthful-data contracts remain protected foundations.

Mandatory rules:
- Approved visual references are literal implementation authorities. Do not reinterpret them into abstract principles, “same feel”, or generic SaaS equivalents.
- Any deliberate material visible deviation from a designated reference requires explicit product-owner approval recorded in `docs/final-product/PRODUCT_OWNER_DECISIONS.md` before implementation.
- Build exact gold-standard screens before extracting reusable components.
- One active writer only. If another writer advances this branch, stop writes, fetch canonical state, reconcile forward, and never erase newer work.
- Never reset, force-push, revert, or overwrite newer canonical work.
- Do not invent data, charts, departments, payroll formulae, employee scores, accounting scope, or permission boundaries to imitate a reference.
- Protected HR/payroll information remains in protected architecture and may never be placed in ordinary public profiles.
- Multi-currency amounts remain separate by currency. Never convert or sum currencies without explicit authoritative policy.
- FPG sequence and live state are governed by `docs/final-product/START_HERE.md` and `docs/final-product/BUILD_STATE.md`.

---

# VISUAL FIDELITY & INTERACTION CLOSURE IS THE ACTIVE UI PROGRAMME

Stage 17 is merged to `main` at `3a287ea4d7be1305970c0224abc3d28800f73d45`.

For ANY visible UI/product-experience work, the active programme is the VF sequence on branch `chatgpt/visual-fidelity-implementation-2026-10-01`.

Before any UI write, read in this order:
1. `docs/visual-fidelity/START_HERE.md`
2. `docs/visual-fidelity/BUILD_STATE.md`
3. `docs/visual-fidelity/VISUAL_FIDELITY_CONTRACT.md`
4. `docs/visual-fidelity/VISUAL_ACCEPTANCE_PROTOCOL.md`
5. `docs/visual-fidelity/IMPLEMENTATION_SEQUENCE.md`
6. `docs/visual-fidelity/REFERENCE_MANIFEST.md`
7. `docs/visual-fidelity/SESSION_START_PROMPT.md`
8. existing Experience V2 and domain/security contracts.

This block supersedes older conflicting visual/redesign sequencing. It does NOT supersede security, RLS, data integrity, privacy, audit, work, finance, HR or integration authority.

A green Level B gate is not visual acceptance. Every VF substage also requires Level C Product Fidelity acceptance. “Technically correct but generic enterprise dashboard” is a failure.

The CEAC premium target is repository-addressable under `docs/visual-fidelity/references/` and `docs/visual-fidelity/targets/`. Do not substitute memory or generic SaaS defaults.

Continue through VF0–VF10 and their recorded substages until VF10E is accepted, unless a genuine stop condition in `docs/visual-fidelity/START_HERE.md` occurs.

Vercel preview control for VF:
- `main` always deploys;
- routine non-main VF commits are intentionally ignored by Vercel via `scripts/vercel/ignore-build.mjs`;
- use `[vercel]` only for deliberate acceptance/deployed-product checkpoints after the application SHA is technically green;
- an ignored build is not a deployment PASS and does not waive Level B/Level C deployment evidence where required.

---

# EXPERIENCE V2 IS MERGED — STAGE 17 ENTERPRISE RECONCILIATION IS ACTIVE

Canonical V2 main after PR #72: `1b3d6b4f62c93f9de41462fe0dbcef920077b3bd`. Active reconciliation branch: `chatgpt/enterprise-expansion-stage-12-integrations-2026-09-26`.

This section supersedes conflicting older UI/redesign sequencing text below. Security, RLS, data-integrity, audit, protected-HR, work-behaviour and enterprise authority contracts remain binding.

Before ANY UI/product-experience change, read in this order:

1. docs/experience-v2/START_HERE.md
2. docs/experience-v2/BUILD_STATE.md
3. docs/experience-v2/CEAC_OS_EXPERIENCE_V2_SOURCE_OF_TRUTH.md
4. docs/experience-v2/IMPLEMENTATION_SEQUENCE.md
5. docs/experience-v2/REFERENCE_INDEX.md
6. docs/experience-v2/ACCEPTANCE_AND_HANDOFF.md
7. docs/experience-v2/DECISION_LOG.md
8. this AGENTS.md file in full
9. the current domain/security contract for the capability being touched.

Before ANY Experience V2 implementation or acceptance commit, also read:

- `docs/experience-v2/VERIFICATION_PROTOCOL.md`

Experience V2 uses a permanent two-level verification model:
- Level A is the fast, affected-scope development gate and cannot accept a substage;
- Level B is the complete engineering, security, migration, browser and evidence gate required at every acceptance boundary;
- final application commits for an acceptance boundary use `[level-b]` in the commit subject unless the complete gate is manually dispatched;
- documentation-only checkpoints use the documented integrity fast path only after the cited application SHA passed Level B;
- while Level B runs, the sole writer may prepare the next substage read-only but must not commit it before current acceptance.

Mandatory continuation rule:
- GitHub is the build source of truth, not Chat/Work memory.
- Chat and Work may alternate, but only ONE active writer may mutate the Experience V2 branch at a time.
- An incoming session MUST inspect the current branch HEAD and BUILD_STATE.md before editing.
- If Work stops with unpushed changes, Chat MUST NOT overwrite/recreate them; recover and push that state first.
- Every meaningful substage ends in a pushed commit, relevant tests, and an updated BUILD_STATE.md.
- No important design decision, reference, defect, blocker or TODO may live only in a conversation.
- Follow `docs/experience-v2/VERIFICATION_PROTOCOL.md`; a green Level A result is never sufficient evidence for acceptance.

Active Experience V2 branch:
chatgpt/experience-v2-2026-09-26

Experience V2 baseline:
1a0fb33d3fff18ddae63e6523547b4f4d5d5c883

PR #71 is now the sole active enterprise reconciliation lane. Preserve the accepted V2 product layer while reconciling the secure Stage 12 integrations contract. Do not weaken provider-secret, service-role, capability, RLS, outbox, idempotency or audit boundaries.

The Experience V2 implementation sequence is a gate sequence. Do not propagate redesign work past the current stage recorded in BUILD_STATE.md.

The user-supplied visual and motion references are persisted outside chat and mapped by REFERENCE_INDEX.md. Do not substitute from memory if they are unavailable.

---

# CEAC OS — instructions for coding agents

## PREMIUM REDESIGN PROGRAMME — READ THIS BEFORE ANY UI WORK

The product owner has explicitly replaced the current visible product direction with the premium redesign programme on this branch.

Before changing any route, role shell, navigation, page composition, styling, iconography, messaging surface or interaction pattern, read in this order:

1. `docs/design/CEAC_OS_PREMIUM_REDESIGN_SOURCE_OF_TRUTH_2026-09-23.md`
2. `docs/handoff/CEAC_OS_PREMIUM_REDESIGN_HANDOFF_2026-09-23.md`
3. this file in full;
4. the existing security/data/domain contract for the capability being surfaced.

The premium redesign contract supersedes conflicting older **UX/navigation/visual** decisions on this redesign branch. It does **not** supersede security, RLS, data-integrity, audit, protected-HR, work-behaviour or capability-authority contracts.

The approved master mockup and the source-of-truth document are binding. Do not substitute icons, palette, information architecture, role composition or generic admin-template UI because it is easier to implement. Any deliberate visual/product deviation requires explicit product-owner approval and a contract update first.

The redesign sequence is R0 shell/design foundation → R1 Staff → R2 Manager → R3 Administration/HR → R4 Group Pastor/CEO → R5 communication consolidation → R6 whole-system visual consistency → R7 closure. Do not run multiple redesign tranches in parallel.

**Stage 12 remains paused while the redesign programme is active unless the product owner explicitly resumes enterprise expansion.**


A staff operating system for CEAC, a church in Accra. Four surfaces:
staff, unit manager, Administration & HR, Group Pastor.

Stack: React + Vite (plain JavaScript, no TypeScript) → GitHub → Vercel
(auto-deploys `main`) → Supabase `efjljhftsesssumtshvp`.


## Enterprise expansion programme — read this first

The current whole-system expansion programme is governed by:

1. `docs/handoff/CEAC_OS_ENTERPRISE_EXPANSION_HANDOFF_2026-09-22.md`
2. `docs/architecture/CEAC_OS_Enterprise_Expansion_Architecture_2026-09-22.md`
3. the current domain-specific architecture/security document for the work being changed.

The enterprise expansion architecture is the newest approved whole-system sequencing contract. Its stages are gates. Do not start Stage 1 or later work while Stage 0 is open, and do not build a later enterprise stage in parallel with an unfinished earlier stage.

For every consequential feature use this order: purpose → authority → data → sensitive-data classification → lifecycle → audit → reversal → migration/RLS/RPC → tests → UI → acceptance → handoff. A screen is not proof that a feature exists securely.


### Locked continuation sequence — do not skip or parallelise

From the current programme state onward, the only approved enterprise build sequence is:

`Stage 5 Work Management 2.0 → merge to main → Stage 6 Resource & Workload → merge → Stage 7 Performance & Development → merge → Stage 8 Learning → merge → Stage 9 Workforce Management 2.0 → merge → Stage 10 Assets & Devices → merge → Stage 11 Compliance & Policy → merge → Stage 12 Integrations → merge → Stage 13 Payroll only after CEAC payroll rules are formally confirmed → merge → Stage 14 Search & Intelligence → merge → Stage 15 Assistive AI → merge → whole-system inspection → production closure.`

Rules for every future agent:
- inspect GitHub before editing; `main` is the source of truth;
- never start stage N+1 until stage N is fully green and merged into `main`;
- branch the next stage from the latest merged `main`, never from an older stage branch;
- do not carry forward failed, stale or stacked PR history;
- each stage must pass CI, clean migration replay, Account Security, all cumulative SQL/security gates, browser/role acceptance, persistence/responsive checks and deployment validation before merge;
- update the enterprise handoff after each merge with exact main SHA, latest migration and next stage;
- if a stage depends on unconfirmed CEAC policy, stop at that gate instead of inventing rules;
- Stage 13 Payroll is explicitly blocked until CEAC confirms the payroll rule set listed in the architecture;
- after Stage 15, do not declare the product complete until the whole-system inspection and production-closure checklist pass.

This sequence is binding unless the product owner explicitly changes it.

## Read the specification before building a screen

`docs/architecture/` holds the real specifications. **Read
`docs/architecture/CEAC_OS_Architecture_Approved_Amendment_2026-09-20.md`
first for any work touching work types, templates, people/profile, reports,
Manager Home, Team, or Admin & HR People.** It is a binding approved
architecture amendment and supersedes conflicting older text. Then read
the panel spec for the surface you are touching **before** writing code,
not after.

**For the current redesign phase, read these before changing any role surface:**
1. `docs/handoff/CEAC_OS_PRODUCT_INTELLIGENCE_REDESIGN_HANDOFF_2026-09-21.md`
2. `docs/architecture/CEAC_OS_Product_Intelligence_Experience_Amendment_2026-09-21.md`
3. `docs/security/CEAC_OS_Product_Intelligence_Security_Handoff_2026-09-21.md`
4. the relevant panel spec;
5. `docs/architecture/CEAC_OS_Design_System_v1.md`.

For Staff/Manager responsive/PWA/Rooms work also read `docs/architecture/CEAC_OS_Product_Experience_Collaboration_PWA_Amendment_2026-09-21.md`. For voice, assistive AI, Rooms 2.0, sub-team communication, meeting audiences or Calendar interaction, also read `docs/architecture/CEAC_OS_Assistive_Input_Collaboration_Amendment_2026-09-21.md`.

The Product Intelligence & Experience amendment is the newest approved product-experience decision and supersedes conflicting older product/meeting UX text. It does not weaken older security/database contracts.**

Both previous agents skipped this and built from memory. The result was a
screen asking a church administrator to paste GPS coordinates, and a
manager panel missing most of its function. Every hour spent rebuilding
those came from not reading a file that was already there.

## Rules

1. **Read the approved 20 September architecture amendment and the spec
   for the panel you are changing first.** See above.

2. **Never invent data.** If a table does not exist, say the feature is
   not yet in the system. Do not render an empty shell that looks
   built, and do not compute a number from nothing. A church will make
   real decisions about real people from these screens.

3. **No score, rating, ranking, or league table attached to a person.**
   The brief calls an invented weighted number the most damaging thing
   this system could produce. There is deliberately no column to store
   one. Show components; leave judgement to humans.

4. **Plain English on every screen.** The users are church
   administrators, not developers. No "threshold", "heartbeat", "job
   run", "sync", "payload", or coordinates. If a ten-year-old would not
   understand the sentence, rewrite it.

5. **Database migrations must have one active owner at a time.** Read the
   current redesign handoff and latest migration list before creating another
   migration. Never number migrations independently, create a parallel migration
   sequence, or recreate an applied migration.

6. **`npm ci && npm run build` must pass before you push.** Vercel
   deploys `main` automatically, so a broken push is a broken live site
   that a real church is using.

7. **Pull before you push, and never write back a file you only partly
   read.** A known connector bug silently truncates long files and
   commits the damage.

8. **AI is assistive only.** The approved 21 September Assistive Input &
   Collaboration amendment supersedes the earlier blanket no-AI rule.
   Server-side inference may be used for transcription, structured extraction
   and user-reviewed drafting. It may not score/rank people, make HR/finance/
   access decisions, approve work, or silently write consequential records.
   Never expose provider credentials in the browser. Core operation must still
   work when inference is unavailable.

9. **The seven work kinds are behaviours, not labels.** Keep one shared
   Work Engine, but implement the type-specific contracts in the approved
   20 September amendment. Do not collapse everything into Task.

10. **Security migrations 034–039 are live. Do not recreate or weaken
    them.** Profile privilege fields are protected, client writes to
    `activity_events` are blocked, routine occurrences are append-only,
    project reports stay at the manager's unit altitude, background jobs
    are service-only, and reference RPCs validate caller scope. Read
    `docs/security/CEAC_OS_Security_Hardening_2026-09-20.md` before
    changing any of those contracts.

## Current implementation ownership

The historical Claude-vs-Codex file split is retired for the Product Intelligence & Experience phase.

**One active implementation owner at a time** may change a tranche. The current handoff document records the active branch and sequence. A new agent must inspect the branch/PR state before editing and must not start a parallel redesign branch from stale main.

Shared shell files such as `src/App.jsx`, `src/components/bits.jsx`, shared styles, navigation, routing and schema contracts require whole-system review because they affect all four roles.

Before touching database migrations, confirm the latest applied migration and current migration owner. Before touching a role surface, read that role's panel spec plus the current Product Intelligence amendment.

## Work references

Use the database function. Never calculate the next number in the client
with `count + 1` — concurrent managers get the same reference, and
cancelled work reuses numbers.

```js
const { data: ref, error } = await supabase
  .rpc("next_work_ref", { p_unit_id: unitId, p_sub_team_id: subTeamId || null });
```

Returns `MED-014`, or `MED-GFX-014` with a sub-team. `units.code` is
canonical — never derive a code from the initials of a unit name.

## Things that are true about this codebase

- Work kinds: task, routine, case, request, decision, meeting_outcome,
  deliverable. They have different approved behaviours. **Only `task`
  uses the existing completion checklist today**; do not silently give
  another type Task semantics. Routine means recurrence and must build on
  `recurring_operations` / `operation_occurrences` rather than a duplicate
  recurrence engine.
- `blockers.state` is claimed | acknowledged | disputed | resolved.
  There is no `open`.
- Money records carry `currency` + `amount_minor`. Never assume GHS,
  never combine different currencies into one total, and do not perform
  currency conversion in the client.
- Waiting-on is two-sided: the person waiting and the unit being waited
  on both see it.
- Sub-teams are work lanes, not rigid people silos. A sub-team can hold
  work with nobody in it and a person can work across units/sub-teams.
  Team and Admin People still group people by their actual sub-team
  memberships for understandable presentation; that grouping does not
  create a new permission boundary.
- Media is the pilot unit, not the template. Nothing may be hard-coded
  to Media.
- Do not add Ghana Card, SSNIT, tax, banking or other protected HR data
  to `profiles`. The approved HR architecture requires a separate
  protected contract. New `profiles` columns are not automatically
  protected by the current self-update guard.
- `activity_events` is authoritative history. Application clients read
  permitted events but do not insert them directly; use an authorised
  server-side RPC/trigger when a new event type is implemented.
- `operation_occurrences` is append-only to application users until an
  attributable correction path is built.

## Blocked, awaiting answers from CEAC — do not guess

- **Payroll**: which allowances and deductions beyond SSNIT and PAYE.

Annual-leave entitlement/accrual is no longer blocked: the 7 October 2026 owner lock confirms 24 working days per leave year, accruing quarterly at 6 working days per completed quarter with joiner pro-rating and the year-end rules in `docs/final-product/LEAVE_RULES_v1.md`.

## Continuing without Claude

Everything needed is in the repository. No step requires asking Claude.

1. `docs/architecture/CEAC_OS_Experience_Data_Architecture_v2.md` — every
   design and product decision, in build sequence, with the reasoning.
2. `docs/reference/manager-overview.html` — the approved visual target.
   Open it in a browser and match it.
3. `src/components/primitives/` — the six built primitives. `System →
   Primitives` in the app demonstrates each against live data.
4. `docs/QUESTIONS_FOR_CEAC.md` — the remaining open questions. They are
   not gates for the redesign; build with the documented defaults and keep
   the switches reversible.

Before adding a migration, inspect the repository and production migration
history, use the next available version, and keep the schema change inside
the staged PR that requires it. Never invent CEAC policy to justify a migration.
## Before designing or rebuilding any screen

Read `docs/architecture/CEAC_OS_Experience_Data_Architecture_v2.md`.

It records a page-by-page review of all 58 screens and every design and
product decision taken since. Two findings drive it: only 1 screen
contains a chart, none contains a table, and 12 primitives are used over
2,000 times — so every screen renders as cards of form fields whatever
its job.

Build the missing primitives first (table, chart with a mandatory
chart/table toggle, linked stat, dense queue row, icon set, map). Until
they exist, any redesign becomes cards again.

Part 11 lists two open questions that do not block the redesign. Use the documented defaults; do not invent additional CEAC policy.
