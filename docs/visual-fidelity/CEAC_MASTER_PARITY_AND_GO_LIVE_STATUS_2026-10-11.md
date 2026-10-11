# CEAC — Literal Mockup Parity and Production Release Gate

**Date:** 2026-10-11
**Canonical private repository:** `ceairportcity/ceac-os`
**Main target:** draft release PR #44, normal reviewed merge only.
**Production main at recording:** `827fbe7391467dd13d6e411527416402a252993c`
**Application source review candidate:** `59c5e0091d99852576995d43ce7d9488b5610886`
**Existing Vercel project:** `prj_bAv4ggX6umjp54UjjLqqGm7bBcIB`
**Existing Supabase project:** `efjljhftsesssumtshvp`

## Binding owner instruction

Production MUST visibly match the owner's actual approved CEAC mockups: layout proportions, role navigation, imagery, spacing, hierarchy, iconography, typography, semantic colours, density, contextual actions and desktop/mobile composition. Merely clean, modern, build-ready or conceptually similar is NOT acceptance. Backend authority, RLS, MFA, auditability, HR/payroll privacy, direct-source record meaning and backups cannot be weakened for appearance.

The owner wants complete functional/security/release work and literal visual alignment, not ongoing false declarations of a finished product. Track absent functionality and unresolved visual deviations separately.

## Original high-resolution references recovered from owner CEAC Library

- Original full-size CEAC premium original: `/CEAC OS/Experience V2/References/Original Quality References/CEAC_original_premium_mockup.jpeg`, **1536 × 1024**, SHA256 `87a67c5b2902e6c0b62e7d55570ec644483aa501c0584bff5c7fae70d41917cc`.
- Previous Administration desktop R7: `redesign-r7-administration-desktop(1).png`, **1440 × 2353**, SHA256 `7f4ff5c08a3a0b7cb0710c11fa94b546a41f6b7f68739cb0adf48009507799a6`.
- Executive approved user render: `CEAC OS Executive Dashboard Redesign.png`, **1536 × 1024**, SHA256 `13955fa370e65bcdfaafce91873757e1fabbca347f50c9ecab44b6057311c9e1`.
- Canonical in-repo sources: `docs/design/CEAC_OS_PREMIUM_REDESIGN_SOURCE_OF_TRUTH_2026-09-23.md`; `docs/visual-fidelity/references/CEAC_original_premium_mockup_reference.jpg` (**thumbnail**, not the full-size source); `docs/design/executive-redesign/CEAC_EXECUTIVE_PANEL_VISUAL_PRODUCT_LOCK_2026-10-07.md`; `docs/design/phase6/CEAC_PHASE6_VOLUNTEER_CALENDAR_VISUAL_PRODUCT_LOCK_2026-10-07.md`.
- IMPORTANT: the documented original master raster SHA256 `f3f867faa8f35a3be46f995ecd915743241ddd7a57632fb677205640c069febd` differs from the recovered Library JPEG above. Confirm canonical source identity before claiming exact byte-for-byte image fidelity; do not silently rewrite a locked reference.

## Measured state and required visual acceptance

| Area | Implementation | Actual rendered parity |
| --- | --- | --- |
| Administration Overview | Scenic greeting, premium next-decision focus, actual meeting-based month rail, restored navigation and responsive styling committed on PR #44; factual data, no invented metrics | **NOT VERIFIED** — screenshot compare at 1440,1366,390 is mandatory |
| Administration People & Access | Real 18-person roster in owner screenshot; legacy optional Phase 6 schema mismatch handled fail-closed | **NOT VERIFIED** — selected employee, access/lifecycle, protected-HR cross-role real tests required |
| Control Center / Organisation | Existing settings load with pending attendance code controls disabled where schema is absent | **NOT VERIFIED** — real saving/configuration and privacy tests required |
| Executive Overview and destinations | Prior owner-approved reference and repository visual/product lock exist; source components and composers present | **NOT VERIFIED** — desktop/mobile literal screenshots for overview, Work, Ministry, Portfolio, Organisation, Calendar, Finance, Payroll, Reports, Messages, My Hub and Account |
| Volunteer / Staff Calendar and Manager Volunteer | Repository's nine-surface Phase 6 lock and product implementation present; nine screens must preserve specified real calendars, personal privacy, engagement rules | **NOT VERIFIED** — desktop/mobile literal nine-surface board, cross-role RLS and working pattern tests |
| Technical Support | Draft UI/back-end proposals exist with event visibility hardening | **NOT ACCEPTED** — actual support roles/RLS, signed owner migration and visual comparison needed |

## Last exact candidate build checkpoint

Vercel PREVIEW `dpl_5AfhtcRhgVUPmBuZNzSq7g3mWXgH`: **READY**, source `59c5e0091d99852576995d43ce7d9488b5610886`, existing project, private GitHub branch. Build command is `npm run verify:source && npm run build`. Node source tests do not prove authenticated screenshots or SQL gates. Desktop 1366 and mobile 390 authenticated Playwright assertions exist in `tests/admin-premium-briefing.spec.js`, but **no runner evidence yet**. Do not mark visual accepted from source markers.

## Production NO-GO checklist

- [ ] PR #44 exact-head nonproduction local Docker/130-migration replay, SQL/RLS/HR/payroll gates, invited-account test, all Playwright browser shards PASS with logs.
- [ ] Authenticated real-user multi-role MFA/AAL2 and secure invitation delivery; **zero verified production MFA factors** at last check.
- [ ] Production complete encrypted logical backup including required Auth/Storage artefacts, protected and retained offsite, and **successful isolated restore with checksums**, verified before any DDL.
- [ ] Exact rendered side-by-side comparisons with all locked references; all deviations corrected or owner explicitly approved.
- [ ] Independent technical second reviewer approves final exact SHA, migration effects and database/privacy safety.
- [ ] Owner authorises exact merge/deploy in a controlled window with rollback/recovery evidence.
- [ ] Apply pending migrations in canonical order only after clean isolated replay and proved restore; verify exact resulting schema/RLS/roles.
- [ ] Normal non-force GitHub main merge, Vercel main production deployment in original project, post-release error/security/data monitoring and handover.

**Current release state: NO-GO.** GitHub main production and original 119-migration Supabase are intentionally untouched. Do not make repository public, purchase GitHub Pro, bypass failing checks, create replacement production infrastructure, or infer owner acceptance from a READY preview.

## Exact-head verification result invalidation on Codespace branch advance

The Codespaces postStart/postAttach launcher used to reuse `/tmp/ceac-private-autorun-summary.md` and `exit-code` **without checking which commit produced them**. A successful result on the prior head could suppress verification on later PR #44 commits. Fixed both sides: `.devcontainer/ceac-private-runner.sh` writes `/tmp/ceac-private-autorun-tested-head` from the exact fetched PR SHA; the launcher only skips when that marker equals `git rev-parse HEAD`. A stale result triggers a new attempt (subject to the existing active-worker lock). Four independent source contract callbacks passed 4/4. No actual Codespace postStart result is present on PR #44 yet. This change does not execute tests or authorise a release.

The following explicit `[vercel]` commit runs the Node source contract + Vite build on the original Vercel project once, **preview only**.
