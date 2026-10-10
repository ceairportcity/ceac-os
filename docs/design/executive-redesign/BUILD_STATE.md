# CEAC OS — Executive Product Redesign Build State

Date: 7 October 2026
Canonical implementation: PR #147
Branch: `chatgpt/executive-product-redesign-2026-10-07`
Stack base: Phase 6 head `80d651b12ad0b9a52744188ef2f2d94025e2372c`
Status: **IMPLEMENTED / SOURCE-VERIFIED / RENDERED ACCEPTANCE PENDING**

Always re-fetch the live PR #147 head before writing. GitHub is canonical. Do not reset, rebase, force-push, overwrite newer work, or move this redesign directly to protected `main`.

## Literal owner authority

The product owner requires the exact approved Executive design, not a similar design.

Binding files:

- `CEAC_EXECUTIVE_PANEL_APPROVED_REFERENCE.webp`
- `CEAC_EXECUTIVE_PANEL_VISUAL_PRODUCT_LOCK_2026-10-07.md`

Approved reference Git blob:

`7a238716aa759ee0f55f7bc6f7d68019e6ab1ad8`

Recorded reference SHA-256:

`435c5efaa88a78ffbadc8ac1f481eeef49a792e0ff5b6d8c3a935e2e640be737`

Mockup sample names/numbers are examples only. Never fabricate them. Exact layout, hierarchy, density, semantic colours, navigation family, card treatment and responsive composition are binding while real CEAC records remain truthful.

## Implemented product family

- Executive desktop navigation is locked to Overview, Work, Ministry, Portfolio, Organisation, Calendar, Finance, Payroll, Reports, Messages, My Hub, Account.
- Mobile primary navigation is locked to Overview, Work, Ministry, More.
- Executive shell uses the approved dark rail, purple active state, compact top search, notification control and avatar-only top action.
- Legacy Executive Quick Create, topbar Create and Accra clock are hidden from the Executive presentation; underlying creation capabilities remain available in their destination workflows.
- Executive search wording is `Search across CEAC OS...`.
- Overview uses the approved hero + 4 semantic KPI cards + 3-card middle grid + 2-card lower grid.
- Ministry direction on Overview reads the same authoritative `strategy_nodes` source as the Ministry workspace. Numeric progress is rendered only when current/target data exists.
- Recent activity reads authorised append-only `activity_events` and falls back to recorded ministry activity when no general event is visible.
- Work uses semantic status colours without changing Work Engine semantics.
- Portfolio uses recorded health for green/amber/red semantic treatment without creating a score.
- Organisation uses Departments / Teams / People composition.
- Calendar keeps the Phase 6 Calendar/Day Workspace and Executive My calendar / Church calendar distinction.
- Finance now includes reversal-aware `income_lines`, actual spend, recorded budget and submitted request context separated by currency.
- Payroll retains the existing Group Pastor approval authority and recomposes table rows into phone cards on narrow screens.
- Reports uses compact filing-state filters and factual rows without performance/ranking inference.
- Messages, My Hub and Account retain shared functionality under Executive-specific header/container/mobile styling.
- Existing compact Executive Give out work / Ministry Objective / Announcement composers remain protected.

## Performance/cascade closure

`executive-redesign.css` is no longer imported globally from `main.jsx`.

It is loaded only for Executive users through:

`ExecutiveRedesignStyles.jsx`

Protected core CSS budget remains unchanged at 534 KiB. The redesign has a dedicated 28 KiB source ceiling and bounded aggregate CSS allowance. It is included in the route-lazy no-`!important` cascade guard.

## Scope boundary

This PR does not modify:

- Supabase migrations;
- RLS;
- auth/MFA;
- security-owned S3/S8 work;
- security PRs #138/#142/#143/#144;
- payroll approval policy;
- automatic attendance/compliance consequences.

Do not use this branch to take over the separate security programme.

## Verification completed off protected Actions

Source verification confirms:

- PR #147 is stacked on the current Phase 6 branch;
- approved reference asset is present at the locked Git blob;
- Executive navigation order is locked in tests;
- the 12-destination desktop/mobile acceptance matrix is wired;
- no security/Supabase files are changed by PR #147;
- semantic Work and Portfolio states use existing factual status/health fields;
- Finance income uses the accepted Executive-readable `income_lines` model;
- Recent activity uses existing authorised `activity_events`;
- Executive redesign CSS is route-isolated and explicitly budgeted.

## Still required before acceptance

Do **not** mark this redesign accepted/merged merely because source implementation is complete.

Still required:

1. GitHub Actions must return for the flagged owner account.
2. Exact-head CI / Migration Replay / Account Security / full Quality Gate must run.
3. The Executive browser matrix must render all required desktop/mobile evidence.
4. Rendered output must be directly compared with `CEAC_EXECUTIVE_PANEL_APPROVED_REFERENCE.webp`.
5. Vercel must successfully produce a preview of the exact current PR #147 head.
6. The preview must be visually inspected before protected-main closure.
7. Phase 5 and Phase 6 must complete their protected-main acceptance path before this stacked redesign can be reconciled/merged normally.

Current external deployment blocker: the connected Vercel MCP still returns team-scope HTTP 403 for the CEAC team/project, and the local Vercel CLI is unavailable. Do not create probe commits to force deployment.
