# CEAC OS — S1/S5 Auth Readiness Evidence

Date: 7 October 2026
Status: PARTIAL IMPLEMENTATION — DATABASE AAL2 ENFORCEMENT MERGED; BROWSER INTEGRATION AND GO-LIVE ACTIVATION REMAIN
Baseline when started: protected main `b2a7bfebef58e97f7633a8cc172fac412b78aaad`
Current reconciled main at this update: `827fbe7391467dd13d6e411527416402a252993c`

## Locked owner rule

- Privileged production accounts require MFA/AAL2 at go-live.
- Active build/test accounts must remain usable before final human enrollment.
- Build the technical enforcement, tests, privilege boundaries, recovery rules and readiness controls now.
- Defer only final human enrollment until onboarding/go-live.

## Live privileged identity readiness

Read-only production inspection on 7 October 2026 found:

- active identities with elevated operational authority: **5**;
- organisation-privileged subset (Admin / Executive / active organisation capability): **2**;
- Unit Managers: **3**;
- active work-lane / Sub-team leads: **2**;
- elevated-authority identities with a verified MFA factor: **0**.

The final privileged MFA boundary is based on actual authority, not titles: Admin, Executive, Unit Manager, active work-lane/Sub-team lead, or an active capability grant. These categories overlap; the union is 5 active identities. Legacy capability rows are not authoritative.

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

The Account Security UI states this accurately: other sessions are stopped from renewing, while a currently issued short-lived token can take a short time to lose access.

## S1 database enforcement — merged and live

PR #134 merged the default-off privileged AAL2 database enforcement.

Production migration history now records:

`20261007075418_privileged_mfa_aal2_enforcement`

The implementation:

1. derives privileged identity centrally from Admin/Executive authority, Unit Manager/work-lane lead authority and active capability grants;
2. provides a default-off organisation switch for privileged MFA enforcement;
3. evaluates the authenticated JWT `aal` claim server-side;
4. denies protected privileged authority at `aal1` when the switch is enabled;
5. includes negative SQL evidence for the privileged authority boundary.

Migration-parity PR #139 reconciled the repository filename to the exact live Supabase version. The production enforcement switch remains **off** until real privileged users are enrolled and go-live acceptance is complete.

## S1 browser work

Browser work continues separately from the database enforcement:

- self-only TOTP enrollment/management in Account Security;
- verified-factor challenge behavior;
- no silent bypass when a verified factor exists;
- privilege evaluation reuses the authority-based model, including Managers and work-lane leads;
- final authenticated-workspace routing is deferred only where it collides with the active Phase 5 shared App/shell writer.

## S5 lifecycle evidence

The dedicated Account Security integration coverage includes:

- expired invitation cannot create a CEAC account;
- a pre-revocation activation link cannot recover CEAC authority after an unconfirmed account is revoked;
- invitation → activation → password sign-in;
- password recovery → changed password → password sign-in;
- global sign-out prevents another device session from refreshing.

The local integration suite is the authoritative test environment for these flows.

## Live S5 security-advisor evidence

A live Supabase Security Advisor inspection on 7 October 2026 confirms:

- leaked-password protection is currently **disabled**;
- the repository-controlled S2 authenticated SECURITY DEFINER ceiling remains **132**;
- production is healthy, but the paid Auth control must not be described as active before upgrade and independent verification.

## Paid-plan activation checklist

After the planned paid-plan upgrade, complete and evidence all of the following before S5 is closed:

- [ ] enable leaked-password protection;
- [ ] independently attempt a known-compromised password through a safe test account and record rejection without storing the password;
- [ ] verify the configured minimum password length and required character policy;
- [ ] verify password-change reauthentication/current-password behavior;
- [ ] verify the final JWT access-token lifetime;
- [ ] decide and configure session time-boxing only if CEAC has an accepted operational need for it;
- [ ] decide and configure inactivity timeout only if CEAC has an accepted operational need for it;
- [ ] decide whether single-session-per-user is appropriate; do not enable it merely because the control exists;
- [ ] retain refresh-token reuse protection unless an evidenced compatibility issue requires a reviewed exception;
- [ ] re-run invitation, password recovery and global sign-out lifecycle tests after settings change;
- [ ] re-run Security Advisor and save the post-change evidence.

Supabase documents time-boxing, inactivity timeout and single-session controls as paid-plan features. Exact timeout values remain an owner/security-operability decision and are not invented in code.

## Privileged-user go-live MFA checklist

Before switching production privileged enforcement on:

- [ ] identify the current live privileged-authority population from server-side authority evidence;
- [ ] ensure each privileged user has at least one verified TOTP factor;
- [ ] require a second verified TOTP factor or another accepted recovery path before removing the only working factor;
- [ ] test AAL1 → AAL2 challenge for each privileged role class;
- [ ] test an AAL1 privileged request is rejected server-side;
- [ ] test an AAL2 privileged request succeeds only within existing capability/unit scope;
- [ ] verify account recovery does not disclose MFA secrets;
- [ ] confirm Administration has a documented lost-factor recovery/escalation procedure;
- [ ] capture exact-main and live-Supabase migration parity;
- [ ] only then enable `privileged_mfa_enforced`.

## Remaining S1/S5 exit evidence

- [x] privileged identity definition established from live authority;
- [x] current production MFA readiness counted without exposing factor secrets;
- [x] password recovery lifecycle tested;
- [x] user-facing global sign-out semantics corrected;
- [x] expanded invitation expiry/revocation and session-refresh tests green;
- [x] default-off central AAL2 database enforcement and negative tests merged;
- [x] live/repository S1 migration parity reconciled;
- [ ] browser MFA challenge/enrollment foundation accepted on exact-head gates;
- [ ] MFA challenge wired into final authenticated privileged workspace routing after the specific Phase 5 collision clears;
- [ ] final human MFA enrollment for privileged production accounts;
- [ ] privileged enforcement switch enabled only after go-live acceptance;
- [ ] paid-plan leaked-password protection verified after upgrade;
- [ ] final paid-plan password/session settings verified and evidenced.
