# CEAC OS — S1 Privileged AAL2 Enforcement Design

Date: 7 October 2026
Status: IMPLEMENTATION DESIGN LOCKED / MIGRATION AND APP ROUTING WAIT FOR ACTIVE PHASE 4 LANE
Baseline at branch start: `53379f5e05f82fd37a715ae8e4c29dc48eaa968a`

## Owner rule

Privileged production accounts require two-step verification at go-live.

The active build/test phase must not be blocked by final human enrollment. The technical controls are built and tested first; production enforcement is switched on only after the real privileged users have verified factors.

## Privileged identity definition

A signed-in identity is privileged when its active CEAC profile has at least one of:

- Administration authority;
- Executive authority;
- an active row in `capability_grants`.

Unit-manager role by itself is not part of this privileged-AAL2 definition unless the person also has one of the organisation capabilities above.

This follows the existing authority model rather than job-title text.

## Current production readiness

Verified on 7 October 2026:

- active privileged accounts: 2;
- privileged accounts with a verified MFA factor: 0;
- privileged accounts without a verified MFA factor: 2.

No MFA factor secret was read or recorded.

## Database enforcement shape

### Organisation switch

Add one additive organisation setting:

`privileged_mfa_enforced boolean not null default false`

Default **false** is mandatory during the build/test phase.

No browser setter RPC is required. The go-live switch is an attributable operational migration/change after enrollment readiness is accepted.

### Internal assurance helper

Add one internal-only `SECURITY INVOKER` helper with fixed `search_path`. It is called from the existing authority definers and does not create another privileged routine.

Conceptual rule:

- no signed-in active organisation -> false;
- enforcement off for the person's organisation -> true;
- enforcement on -> current JWT must contain `aal = aal2`.

The helper is not a browser API:

- keep it `SECURITY INVOKER`, not `SECURITY DEFINER`;
- revoke `PUBLIC`;
- revoke `anon`;
- revoke direct `authenticated` execution.

### Central authority helpers

Preserve `app_org_id()` unchanged so an AAL1 session can still identify its active organisation and reach the verification experience.

Apply the assurance helper inside:

- `app_is_admin()`;
- `app_is_exec()`;
- `app_has_capability(text, uuid)`.

This means existing RLS policies and reviewed privileged RPCs inherit the AAL2 requirement through the same authority helpers they already use.

No new SECURITY DEFINER function is required. The S2 exact authenticated-callable ceiling therefore remains **132**, and S1 does not expand the privileged-function footprint.

## Why this is central enough

Live inspection found no public RLS policy using raw profile `is_admin` / `is_exec` or direct `capability_grants` as a caller-authority bypass outside the approved helpers.

Reviewed authenticated SECURITY DEFINER functions that contain raw admin/exec/capability data use those values to classify targets or audiences; their calling authority is still checked through the central helpers.

A future change that bypasses the helpers must be treated as a security-contract change.

## Browser flow

### Enrolled user

On an authenticated route before loading the CEAC workspace:

1. inspect current and next authenticator assurance levels;
2. if the session is AAL1 and can become AAL2, show the dedicated verification screen;
3. do not load the operational workspace until verification succeeds;
4. after verification, rerun normal account boot.

This protects users who voluntarily enroll during the test phase even while the organisation enforcement switch is still off.

### User without a verified factor

During active build/test:

- normal account use continues;
- privileged account page clearly shows the go-live requirement;
- no final enrollment is forced yet.

At go-live, the organisation switch is not enabled until every real privileged account has a verified factor and the challenge path has passed acceptance.

### Recovery/activation routes

`/activate` and `/reset-password` remain account-recovery surfaces, not normal workspace routes.

They must be allowed to complete their secure link/password flow. After completion and return to the normal workspace route, an enrolled account must complete its second factor before CEAC opens operational content.

## Self-service enrollment

The self-only Account Security surface supports authenticator-app enrollment.

Requirements:

- verified factors are visible only to the signed-in person;
- factor secrets are shown only during the setup ceremony;
- interrupted/unverified setup is surfaced and removable before another setup starts;
- verification uses a fresh challenge;
- while enforcement is off, privileged test accounts can remove a verified factor after an AAL2 session so testing remains reversible;
- once privileged enforcement is on, the CEAC UI blocks removal of the account's final verified factor;
- safe product-language errors are used instead of raw Auth/database detail.

## Required SQL acceptance test

A dedicated `privileged_mfa_gate.sql` must run inside a rolled-back local test transaction.

Using deterministic fixtures:

- Administration: `31000000-0000-4000-8000-000000000003`;
- Executive: `31000000-0000-4000-8000-000000000004`.

Test cases:

1. enforcement off + AAL1:
   - current Administration/Executive/capability authority remains available;
   - proves active build compatibility.

2. enforcement on + Administration AAL1:
   - `app_org_id()` still returns the organisation;
   - `app_is_admin()` is false;
   - organisation capability checks such as `authority.manage` are false.

3. enforcement on + Administration AAL2:
   - `app_is_admin()` is true;
   - approved capability checks are restored.

4. enforcement on + Executive AAL1:
   - `app_is_exec()` is false;
   - privileged capability such as `payroll.approve` is false.

5. enforcement on + Executive AAL2:
   - Executive/capability authority is restored.

6. ordinary Staff:
   - active organisation/self access remains available;
   - no privileged authority is created.

7. surface integrity:
   - the internal assurance helper has no direct authenticated execution;
   - authenticated SECURITY DEFINER ceiling remains exactly 132;
   - anonymous callable surface remains zero.

The existing local SQL mechanism `request.jwt.claims` has been verified to drive `auth.uid()`, `auth.role()` and the `aal` claim deterministically.

## Go-live order

1. merge technical implementation with enforcement default off;
2. run exact-head CI, Migration Replay, Account Security and Quality Gate;
3. validate MFA enrollment/challenge using approved non-production/test identities;
4. enroll every real privileged production account;
5. independently verify every privileged account has at least one verified factor;
6. verify account recovery / lost-factor operating procedure;
7. enable `privileged_mfa_enforced` through an attributable production change;
8. rerun privileged negative/positive acceptance against production-safe checks;
9. record acceptance in Issue #118 and the security handover.

If any privileged account lacks a recovery path or verified factor, step 7 is blocked.
