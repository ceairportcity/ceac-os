# CEAC OS — S1 Privileged MFA/AAL2 Database Enforcement

Date: 7 October 2026
Status: IMPLEMENTED ON SECURITY BRANCH / ENFORCEMENT DEFAULT OFF

## Owner rule preserved

Privileged production access requires MFA/AAL2 at go-live. Current test accounts must remain usable until real privileged-user enrollment is complete.

This tranche builds the database lock now but leaves the organisation switch off.

## Enforcement setting

`organisations.privileged_mfa_required` is additive, non-null and defaults to `false`.

It is read through the existing own-organisation RLS boundary. No browser setter RPC is added.

## Privileged session rule

When enforcement is enabled, elevated authority requires both the signed Supabase JWT authenticator-assurance claim to be `aal2` and at least one currently verified MFA factor for the signed-in user.

Supabase issues AAL2 only after a verified MFA challenge. Because JWT claims can remain valid until refresh or expiry, the internal database helper also checks the current protected Auth factor state. Removing the last verified factor therefore removes elevated CEAC authority immediately even if an older access token still carries `aal2`.

The internal helper `app_privileged_aal_allowed()` is SECURITY DEFINER with a fixed search path because the browser role cannot read `auth.mfa_factors`. EXECUTE remains revoked from `anon` and `authenticated`; it is not a browser API and does not increase the authenticated SECURITY DEFINER ceiling.

## Authority paths covered

The rule is inherited by the existing authority surface through:

- `app_is_admin()`;
- `app_is_exec()`;
- `app_has_capability(text,uuid)`;
- `app_managed_units()`;
- `app_led_sub_teams()`;
- `app_can_review_item(uuid)`.

This covers Administration, Executive, explicit capabilities, Unit Managers, work-lane/Sub-team leads and responsible work reviewers.

Ordinary bootstrap helpers `app_org_id()` and `app_my_units()` remain available at AAL1 so a privileged person can still open account-security/verification flows instead of being locked out before MFA can be completed.

## Bypass closed

`ministry_events.mev_write` previously contained a raw `unit_memberships.role='manager'` check.

It now routes Manager calendar-write authority through `app_managed_units()` while preserving the existing `owns_calendar` and organisation requirements.

## S2 ceiling preserved

No new authenticated SECURITY DEFINER function is exposed.

The exact authenticated SECURITY DEFINER ceiling remains **132**, and anonymous callable SECURITY DEFINER exposure remains **0**.

## Acceptance coverage

The dedicated SQL gate proves:

- default-off leaves current testing authority unchanged;
- Staff AAL1 keeps ordinary organisation/unit context;
- Manager/work-lane/review authority is absent at AAL1 and restored at AAL2;
- Administration capability/People authority is absent at AAL1 and restored at AAL2;
- Executive/payroll approval authority is absent at AAL1 and restored at AAL2;
- a stale AAL2 token loses elevated authority when its verified factor is removed;
- raw Manager calendar-policy bypass is removed;
- callable SECURITY DEFINER ceilings remain unchanged.

The migration reads current MFA factor status only inside the non-browser-callable authority helper. It does not create, modify or enroll factors. Test factors exist only inside a rolled-back local acceptance transaction. Final human enrollment remains a separate go-live action.

## Remaining S1 work

- reconcile and wire the browser challenge/setup UI from the preserved stale S1 branch against the current authority model;
- keep TOTP the initial CEAC factor method unless a separate phone-provider decision is made;
- keep final human enrollment deferred until go-live;
- after every real elevated-authority account has a verified factor and recovery path, enable `privileged_mfa_required` through an attributable production change and run production-safe acceptance.
