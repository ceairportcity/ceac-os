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
