# CEAC OS — Phase 5 Admin Product Redesign Acceptance Record

**Date:** 7 October 2026  
**Phase:** 5 — Admin Product Redesign  
**Status:** CANDIDATE / FULL LEVEL-B ACCEPTANCE REQUESTED  
**PR:** #136  
**Implementation branch:** `chatgpt/phase5-admin-product-redesign-2026-10-07`  
**Protected-main entry SHA:** `052ba656e0e888f99e98fe858b2ced4f27528918`

## Purpose

This record binds the Phase 5 implementation candidate to the product-owner contract without declaring Phase 5 accepted before the repository's complete exact-head gates and product evidence pass.

## Implemented product contract

### Administration Overview

- Administration Overview is an operational attention surface rather than a configuration catalogue.
- Pending Staff invitations are surfaced as onboarding attention.
- Existing leave, workflow/check, people, payroll, delivery and reporting attention remains factual and authority-bound.
- Durable organisation configuration is handed off to Control Center instead of being duplicated on Overview.
- The former Overview invitation composer was removed; invitation work belongs to People & Access.

### People & Access

- The Administration navigation and page identity are `People & Access`.
- Directory, account/access administration, organisation placement and employee-record work are intentionally connected without collapsing employee identity into login identity.
- New invitations use the existing invitation authority and begin as Staff.
- Existing identities receive additional responsibilities instead of duplicate accounts.
- Unit responsibility add/end operations retain their existing audited RPC boundary.
- Team/sub-team membership retains its existing audited RPC boundary.
- Pending invitations can be reviewed, resent and cancelled through their existing authority.
- Job title never silently grants application authority.

### Employee record

A selected employee has a deliberate Access workspace showing authorised factual state for:

- login identity;
- account/access state;
- invitation state;
- primary unit;
- Manager/reporting line;
- application role;
- recorded unit responsibilities;
- employment status.

Primary-unit transfer, Manager change and employment status remain in the audited employment-record workflow. Protected HR remains behind its existing separate capability boundary.

### Lifecycle / access deactivation

- Offboarding is reached from the selected employee's Access workspace with the same identity preselected.
- Access is not directly flipped from the person screen.
- The existing controlled lifecycle is authoritative for offboarding and final account deactivation.
- The lifecycle workspace is responsive master/detail on wide screens and recomposes to one column on narrow screens.

### Units and Control Center

- Units no longer exposes a second invitation/employee-transfer mutation path.
- Unit People actions hand off into People & Access with the relevant unit context.
- Specialised Unit Head authority remains on the authoritative unit flow.
- Control Center is the durable configuration workspace, grouped around Organisation & People, Operational Configuration, and Security / Integrations / Records.
- Operational monitoring remains on Overview.

## Responsive acceptance target

Phase 5 is not accepted from desktop alone. The acceptance suite includes:

- Administration Overview narrow and desktop layouts;
- People & Access phone and desktop layouts;
- employee Access workspace phone and desktop layouts;
- person-to-offboarding handoff at phone width;
- Control Center phone and laptop layouts;
- horizontal-overflow and minimum interactive-target assertions on the new Phase 5 surfaces.

## Security / data boundary

Phase 5 does not claim ownership of the active security work in PRs #132 or #134 and does not alter their authentication, MFA/AAL2, password/recovery, RLS or privileged-database enforcement files.

No new Phase 5 database model or security migration was introduced. The redesign composes the existing authoritative people, employment, invitation, lifecycle, unit-responsibility and work-lane contracts.

The locked Phase 6 product and visual-contract artifacts remain untouched.

## Acceptance gate

Do not change this record to **ACCEPTED / MERGED** until all of the following are true on the implementation application tree:

- CI PASS;
- Migration Replay PASS;
- Account Security PASS;
- full Level-B Quality Gate PASS;
- authenticated browser acceptance PASS for the Phase 5 surfaces;
- product evidence reviewed for desktop and narrow/mobile composition;
- no security or Phase 6 contract regression;
- protected-main merge succeeds under repository rules;
- exact-main verification passes after merge.

Production deployment verification remains a separate required acceptance item. At this checkpoint GitHub reports the external Vercel build-rate-limit status, and the connected Vercel account exposes no authorised team/project context. That condition must not be misreported as an application failure or as successful production verification.
