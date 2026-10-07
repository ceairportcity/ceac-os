# CEAC OS — S1/S5 Auth Readiness Evidence

Date: 7 October 2026
Status: PARTIAL IMPLEMENTATION — CENTRAL AAL2 ENFORCEMENT WAITS FOR THE ACTIVE PHASE 4 MIGRATION/APP LANE
Baseline when started: protected main `b2a7bfebef58e97f7633a8cc172fac412b78aaad`

## Locked owner rule

- Privileged production accounts require MFA/AAL2 at go-live.
- Active build/test accounts must remain usable before final human enrollment.
- Build the technical enforcement, tests, privilege boundaries, recovery rules and readiness controls now.
- Defer only final human enrollment until onboarding/go-live.

## Live privileged identity readiness

Read-only production inspection on 7 October 2026 found:

- privileged active accounts: **2**;
- privileged accounts with a verified MFA factor: **0**;
- privileged accounts without a verified MFA factor: **2**.

For this programme, a privileged identity means an active profile with Admin/Executive authority or at least one active `capability_grants` row. Legacy capability rows are not authoritative.

Final human enrollment therefore remains a real go-live blocker.

## Existing protections already verified

- account activation is invitation-only;
- invitations expire;
- Administration can revoke an unconfirmed invitation/account path;
- inactive profiles lose application authority even if an older authenticated identity still exists;
- password recovery changes the password through Supabase Auth;
- users can view their own recorded sessions/account activity;
- users can sign out locally or globally;
- safe sign-in errors avoid exposing credentials or raw auth internals.

## Global sign-out semantics

Supabase global sign-out revokes affected refresh sessions. An already-issued access JWT can remain valid until its expiry.

The Account Security UI now states this accurately: other sessions are stopped from renewing, while a currently issued short-lived token can take a short time to lose access.

## S1 technical design ready for the migration lane

When the active Phase 4 migration/App lane clears:

1. define privileged identity centrally from Admin/Executive authority plus active capability grants;
2. add a default-off organisation setting for privileged MFA enforcement;
3. add a central AAL2 helper using the authenticated JWT `aal` claim;
4. require AAL2 for privileged authority when the switch is enabled;
5. add negative SQL tests proving an `aal1` privileged session cannot exercise protected authority when enforcement is on;
6. add the browser MFA challenge gate before an authenticated privileged workspace opens;
7. add TOTP enrollment/management in the self-only Account Security surface;
8. keep production enforcement off until real privileged users are enrolled and the go-live checklist is accepted.

The design is capability-based, not job-title based.

## S5 lifecycle test expansion

The dedicated local Account Security integration test is being expanded to cover:

- expired invitation cannot create a CEAC account;
- a pre-revocation activation link cannot recover CEAC authority after an unconfirmed account is revoked;
- invitation → activation → password sign-in;
- password recovery → changed password → password sign-in;
- global sign-out prevents another device session from refreshing.

This test uses only the local CI Supabase instance.

## Paid-plan readiness

Production Supabase remains on the **Free** plan.

The following remain upgrade/go-live items:

- enable and independently verify leaked-password protection after the planned paid-plan upgrade;
- review paid session controls such as time-boxing, inactivity timeout and single-session mode before enabling them;
- verify final access-token lifetime and recovery settings;
- do not claim any paid control is active before it is independently verified.

## Remaining S1/S5 exit evidence

- [x] privileged identity definition established from live authority;
- [x] current production MFA readiness counted without exposing factor secrets;
- [x] password recovery lifecycle already tested;
- [x] user-facing global sign-out semantics corrected;
- [ ] expanded invitation expiry/revocation and session-refresh tests green;
- [ ] MFA challenge/enrollment UI wired into authenticated routing;
- [ ] default-off central AAL2 database enforcement and negative tests;
- [ ] exact-head gates green after enforcement wiring;
- [ ] final human MFA enrollment for privileged production accounts;
- [ ] paid-plan leaked-password protection verified after upgrade.
