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
