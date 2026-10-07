# CEAC OS — S1 MFA Decision Foundation

Date: 7 October 2026
Status: IMPLEMENTED FOUNDATION / NOT YET ROUTED
Baseline: protected main `53379f5e05f82fd37a715ae8e4c29dc48eaa968a`

This tranche adds no database migration and changes no current login behavior.

## Purpose

The MFA decision layer is deliberately separated from UI and database enforcement so the shared `App.jsx` / migration lane can remain owned by the active Phase 4 writer.

The policy distinguishes four states:

- `allow`: current session is already AAL2, or privileged enforcement is not active and no verified factor requires step-up;
- `challenge`: the account has a verified TOTP factor and the current session is below AAL2;
- `enroll`: privileged enforcement is active but the privileged account has no verified factor;
- `unsupported-factor`: the account has a verified factor that the CEAC v1 MFA experience cannot safely challenge yet.

A verified factor is never silently ignored.

## Privileged identity

Privileged identity is derived from actual authority:

- Administration;
- Executive;
- Unit Manager authority;
- work-lane / Sub-team lead authority;
- any active capability grant.

Job title alone does not make a person privileged.

This matches the locked owner decision and the actual server authority paths. Read-only live inspection found 5 active identities with one or more of these authority paths and 0 verified MFA factors. The earlier organisation-capability-only subset was 2 and was too narrow for the final privileged MFA boundary.

## Test-phase behavior

The organisation-level enforcement switch does not exist yet and therefore cannot be active.

Current test users continue to work unchanged.

The next S1 tranche, after the Phase 4 shared migration/App lane clears, will:

1. add the default-off organisation enforcement flag;
2. add the central database AAL2 guard to the accepted authority helpers;
3. add AAL1 denial / AAL2 acceptance SQL tests;
4. wire the browser challenge before privileged workspace access;
5. add TOTP enrollment/management to the self-only Account Security surface;
6. keep final human enrollment as a go-live gate.
