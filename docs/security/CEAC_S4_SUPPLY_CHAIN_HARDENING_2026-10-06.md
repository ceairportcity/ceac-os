# CEAC OS — S4 Repository & Supply-Chain Hardening

Date: 6 October 2026
Status: IMPLEMENTED IN CODE / OWNER-LEVEL GITHUB SETTINGS PARTIALLY BLOCKED
Baseline: protected main `2b398eb39ae200c9bd0bb7bd914c136f87623177`
Programme: `docs/security/CEAC_SECURITY_HARDENING_PROGRAM_2026-10-06.md`

## Scope completed

This tranche hardens repository-controlled supply-chain behavior without touching application, database, RLS, auth, notification or product-phase files.

Implemented:

- every external GitHub Action in `.github/workflows` and the local composite action is pinned to an immutable full commit SHA;
- Action version comments remain beside each SHA so Dependabot can keep update intent understandable;
- every workflow declares top-level read-only `contents` permission;
- every checkout disables persisted Git credentials;
- CI now rejects:
  - mutable external Action refs;
  - unpinned Docker actions;
  - `pull_request_target`;
  - `permissions: write-all`;
  - top-level write permissions unless the security contract is deliberately changed;
  - checkout steps that persist credentials;
- Dependabot groups only npm minor/patch updates for the current frontend/tooling group; major updates remain separately reviewable rather than being bundled into a routine group.

## Repository state verified through the connected GitHub integration

At review time:

- repository visibility: **public**;
- repository owner decision: **make private**;
- visible repository rulesets returned by the integration: none;
- branch-protection read endpoint: blocked to this GitHub App with HTTP 403;
- native secret-scanning/settings endpoints are not exposed through this connector and are therefore not claimed as enabled.

The public/private mismatch is an owner-level GitHub setting action. It is not silently treated as complete.

## Owner actions still required in GitHub

1. Change `thestandardinst-star/ceac-os` visibility from **Public** to **Private**.
2. In the effective protection for `main`, verify required checks remain enforced, including:
   - CI;
   - role-and-rls / Quality Gate acceptance as configured;
   - Migration Replay;
   - Account Security / invited-account-flow;
   - any newer required security checks added after this document.
3. Verify force pushes and branch deletion are disallowed for protected `main`.
4. Verify GitHub secret scanning and push protection are enabled if available for the account/plan.
5. Review installed GitHub Apps/collaborators for least privilege and remove access no longer required.

These are not code changes and cannot be truthfully marked complete from the current integration.

## Supply-chain acceptance

A change passes this tranche only when:

- the pinning guard passes in CI;
- ordinary CI/build remains green;
- no database migration is introduced by this tranche;
- no broader GitHub token permission is added;
- repository visibility/protection owner actions remain explicit until independently verified.
