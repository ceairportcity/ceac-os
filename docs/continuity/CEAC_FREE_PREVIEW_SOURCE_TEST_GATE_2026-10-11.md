# CEAC — existing Vercel preview Node verification gate

Date: 2026-10-11. Main-targeted integration: draft PR #44. Current pending release is not production-authorised.

## Purpose
GitHub Actions CI fails before executing test steps on this private GitHub Free repository. Do not bypass security gates, purchase GitHub Pro, publish the private repository or substitute another CI service.

The existing Vercel preview build now uses:
`npm run verify:source && npm run build`

The **real Node 22** `verify:source` script executes exactly the existing nine source/unit test files already listed in `.github/workflows/ci.yml`. Node failure blocks Vercel build instead of being reported as READY. This is a narrow executable **source-test + frontend build check**, NOT full Playwright / PostgreSQL / security release acceptance.

The source suite was examined for external service or production-DB calls. It contains local pure/static tests only. No real payroll, employee data or privileged DB changes are allowed.

Required evidence: capture the exact Git SHA, successful Node test count, Vite build result and preview deployment ID. Preserve original production `main` at `827fbe7391467dd13d6e411527416402a252993c`. All other non-main preview builds continue to be intentionally skipped unless their commit contains the exact tag `[vercel]`.

## Remaining no-go gates
Full independent authenticated role browser acceptance; 130-version PostgreSQL migration replay; tested encrypted backup/restore; real-user MFA; invitation delivery; independent reviewer and approved cutover. The Admin mockup deviation is tracked separately under GitHub issue #45 for explicit owner post-release visual iteration, without waiving any data/security gate.

This document records only one opt-in Vercel preview run. Do not publish, merge or mutate production merely because source-unit tests pass.

## PR44 exact-head Codespaces verification update (11 October 2026)

The automatic Codespaces runner previously invoked the obsolete PR #27 source SHA and posted on PR #29. It now reads the **current** private `refs/pull/44/head` and `refs/heads/main`, requires the Codespace checkout to equal the exact live PR HEAD, then calls the independently SHA-rechecking `run-independent-release-gate.sh` for PR #44. It reports only on PR #44. A mismatched source causes NOT VERIFIED, never a PASS.

The independent gate now uses `npm run verify:source`, covering the ten current source/unit test files instead of only the older four. A new three-case regression `tests/release-runner-target-contract.test.mjs` guards against reverting to PR #27, skipping immutable SHAs, inheriting live database secrets, or disabling the local-only SQL condition. Its three callbacks passed isolated exact-source V8 checks.

**This is code preparedness, not an executed Codespaces PostgreSQL/Playwright result.** A real private 2-core Codespace must be explicitly started by an authorised operator with available included quota; its automatic runner requires Docker and Supabase CLI 2.117.0. It MUST NOT receive production secrets. The separate encrypted production backup/restore cannot be certified by Codespaces' source checks.

The next `[vercel]` opt-in confirms the existing project can run its Node source-verification gate plus Vite build. It is **preview only**; keep `main` and production unchanged.

## Admin visual parity implementation continuation — preview checkpoint

The owner explicitly asked that the final live product match the approved mockups, not merely that a build work. The reviewed Admin Overview screenshot lacked the welcome briefing and contextual agenda visible in the repository master reference.

- Retained exact existing work/people/leave decision data selectors, RLS/RPC authority and callbacks.
- Reworked `AdminOverviewV2.jsx` to show time-appropriate personal greeting, decision-inbox jump, existing-authorised People/Control Center actions and an **actual recorded meetings only** agenda (zero-event state is factual).
- Reused already-committed `public/ceac-hero-landscape.svg`, sampled approved blue `#0c5df9`, off-white / navy semantics and responsive premium CSS rather than adding stock images or inventing data.
- `DataPanel` now passes the optional HTML id through to the real section, so the decision-inbox anchor works.
- Added `tests/admin-premium-briefing.spec.js` with authenticated 1366px desktop and 390px mobile screenshots, no-horizontal-overflow and real in-page action checks.
- Added `tests/admin-premium-source-contract.test.mjs`; 4/4 exact-source isolated JavaScript checks passed. Registered in existing Node/Vercel unit suite and GitHub workflow.
- **NOT YET accepted visual parity:** the tiny committed reference image is an interpretation aid, but direct rendered side-by-side owner review across all approved roles/surfaces is still mandatory. These source tests do not prove literal pixel fidelity. No production DDL, user grants or role changes.

One explicit `[vercel]` checkpoint requests an exact-candidate **preview-only** Node source-test plus Vite build. GitHub main, production domain, Supabase and protected HR remain unchanged.

## Original full-resolution mockup reconciliation — desktop Admin

The reference JPEG committed in `docs/visual-fidelity/references` is a small preview, NOT enough for literal screen comparison. A previously approved full 1536 × 1024 image was located in the owner's private ChatGPT Library at `/CEAC OS/Experience V2/References/Original Quality References/CEAC_original_premium_mockup.jpeg` (binary SHA-256 `87a67c5b2902e6c0b62e7d55570ec644483aa501c0584bff5c7fae70d41917cc`). The earlier Administration desktop screenshot reference `redesign-r7-administration-desktop(1).png` is 1440 × 2353, SHA-256 `7f4ff5c08a3a0b7cb0710c11fa94b546a41f6b7f68739cb0adf48009507799a6`. Repository contract claims a DIFFERENT master SHA `f3f867faa8f35a3be46f995ecd915743241ddd7a57632fb677205640c069febd`; do not pretend they are binary-identical or silently replace the owner's canonical master.

These richer source visuals revealed the missing **monthly calendar rail, dominant next action and broad landscaped welcome**. This PR now implements these against existing authorised CEAC records. The calendar is interactive but only has a 14-day meeting data horizon: dates outside that horizon explicitly state the limitation; there are no invented appointments.

Actual screenshots at 1366px and 390px and side-by-side visual comparison remain pending. The original Executive/Volunteer/Technical Support locks remain binding separately, regardless of this Admin improvement. No change in SQL grants/HR privacy.

A single `[vercel]` opt-in verifies the current JS source tests + actual Vite build on the existing nonproduction preview. **Do not merge PR44** or deploy production from build success alone.

## 11 October: exact-head Codespaces runner hardening

The previous runner required the existing Codespace checkout to equal the latest PR HEAD. This incorrectly rejected a legitimate long-lived Codespace whenever the review branch advanced; it could also retain stale result-cache markers. The corrected implementation:

- Resolves the exact live PR #44 and `main` SHA over authenticated Git.
- Fetches the live PR ref and adds it as an isolated **detached worktree**, without rewriting the user's Codespace checkout or touching production.
- Executes `scripts/ci/run-independent-release-gate.sh` **from that fetched, verified commit**, not from stale local script content.
- Checks both PR/main SHAs at the end of the long local test run before reporting technical PASS; a changed head is recorded STALE and requires retest.
- Compares the launcher result-cache marker with the **remote PR HEAD**, not the local checkout, preventing stale summary reuse.
- Four dedicated source-contract test callbacks passed 4/4 against exact GitHub source content. This is static/JavaScript verification only; actual PostgreSQL/Playwright/Codespaces execution remains **NOT VERIFIED** until evidence is posted.

This commit intentionally includes `[vercel]` to run an isolated preview with the complete existing Node source-suite and Vite build, not a production release. NO database writes or Vercel production promotion are authorised.

## Executive objective measurement integrity — 11 October

The previous Executive overview `strategyProgress()` coerced `null` current values to numeric 0 via `Number(null)`, displaying fabricated 0% progress when no measured observation had been recorded. A pure helper `src/experience-v2/executive-overview/strategyProgress.js` now preserves missing measurements as `null`, while retaining real measured zero, fractional values and maximum-100% visual clipping. The dashboard imports the helper. Four exact-GitHub-source regression callbacks passed 4/4; `tests/executive-progress-contract.test.mjs` is in both existing CI and Vercel `verify:source` command.

This `[vercel]` commit exercises all current Node source/unit tests and Vite build for one private preview. **No owner/mockup parity, PostgreSQL migration acceptance, Codespace full test evidence, Auth/MFA, backup/recovery, production merge or deployment approval is implied.**

## Executive cross-organisation read scoping

Confirmed directly (read-only) that `meeting_sessions`, `report_periods`, `units` and `reports` in production all have an `org_id` column. The Executive overview now explicitly adds the signed-in `me.org_id` to those formerly unscoped REST reads, in addition to their existing database RLS. This is defence in depth, not a grant or change to RLS. The Executive source regression was extended with that invariant; **5/5** targeted pure/source test callbacks passed. Production remains unchanged.

The `[vercel]` tagged commit is a one-off verification of current candidate Node source tests plus Vite frontend build. It does not claim cross-tenant role-runtime testing, Executive rendered mockup parity or production go-live readiness.

## Executive master reference composition — scenic hero parity checkpoint

The Executive R7/master reference uses a scenic landscape header. The candidate had a generated pastel gradient and polygon clip-path placeholder, despite having the existing, self-hosted CEAC `/ceac-hero-landscape.svg` used in the premium Administration header. The Executive now uses that local SVG under a light foreground readability overlay for desktop, without adding a network dependency, duplicate asset or modifying application data. Its previous clean white mobile header remains. Source regression `tests/executive-progress-contract.test.mjs` now asserts the local artwork exists and checks the mobile reset; all 6/6 focused source/pure-JS callbacks PASS. Pixel-level and authenticated device testing remain outstanding.

TinyFish authenticated browser inspection found the owner's existing Codespace checked out 39 commits behind current PR44. The VS Code web editor repeatedly failed to accept keyboard input and its terminal only exposed a stale cached result; **no exact-head full SQL/Playwright verification was obtained or claimed**. Avoid creating another paid runner or forcing branch resets. The latest exact-head sandbox workflow remains available in repository files.

This `[vercel]` opt-in is one nonproduction build/test smoke-check of the current PR44 source. Live `main`, production Supabase and the existing Vercel production deployment remain untouched.
