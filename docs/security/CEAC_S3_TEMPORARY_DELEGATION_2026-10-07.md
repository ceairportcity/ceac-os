# CEAC OS — S3 Temporary Capability Delegation & Expiry

Date: 7 October 2026
Status: IMPLEMENTED ON RECONCILED SECURITY BRANCH; ACCEPTANCE PENDING

## Problem closed

Capability authority previously had only two states: active until manually revoked, or revoked.

That meant temporary delegated access could not expire automatically.

## Model

`capability_grants.expires_at` is optional.

- `null` means the grant is ongoing until revoked.
- a future timestamp means authority ends at that timestamp.
- expiry does not delete or rewrite the historical grant.
- `app_has_capability()` ignores expired grants.
- the signed-in user's `loadMe()` capability set also ignores expired grants, so UI and server authority agree.

## Backward compatibility

The browser RPC remains `grant_capability`.

It gains one optional final parameter:

`p_expires_at timestamp with time zone default null`

Existing four-argument callers continue to work.

The old exact function is removed, the replacement receives the same reviewed `authenticated` / `service_role` EXECUTE access, and `anon` remains denied.

The S2 authenticated SECURITY DEFINER count remains unchanged at 132; only the exact allowlist signature changes.

## Regrant after expiry

The existing unique unrevoked-grant constraint is preserved.

When an authorised actor regrants the same capability/scope after a temporary grant has expired, the RPC first closes the expired historical row with:

- the current authority manager as `revoked_by`;
- current time as `revoked_at`;
- an explicit replacement reason.

The authority had already ended at `expires_at`; this closure is audit housekeeping, not an extension of access.

## Last-authority safety

The existing anti-lockout rule is strengthened for expiry.

Temporary `authority.manage` may supplement authority, but CEAC must retain at least one non-expiring organisation authority manager.

A temporary authority holder therefore cannot become the only future authority holder merely because the permanent grant is revoked or converted to expiring.

## Invitation cancellation authority

A cancelled invitation is an Administration decision, not an ordinary resend state.

S3 hardens `create_pending_invitation()` so:

- Unit Managers can still invite Staff into units they manage;
- Unit Managers can refresh ordinary expired/unresolved invitations within their authority;
- a Unit Manager cannot reopen an invitation after People Administration has cancelled it;
- only current `people.manage` authority can make the explicit decision to reopen a cancelled invitation;
- reopening remains auditable through the normal invitation activity event.

This closes a lower-authority overwrite path in the previous conflict-update behavior, which cleared cancellation fields whenever the same email was invited again.

A dedicated rollback gate proves:

1. Unit Manager creates an invitation in their managed unit;
2. People Administration cancels it;
3. the Unit Manager is denied when attempting to reopen it;
4. People Administration can explicitly reopen it.

## Confirmed-account joiner boundary

Invitation creation alone must not be enough to open CEAC authority.

S3 now requires the signed-in Auth identity to have a confirmed email before core CEAC authority resolves:

- `app_org_id()` returns no organisation for an unconfirmed identity;
- Admin and Executive authority fail closed;
- capability authority fails closed;
- unit membership, Unit Manager and Sub-team lead authority fail closed;
- the browser `loadMe()` bootstrap refuses to open CEAC before confirmation.

This is defense in depth around the existing invite-only creation flow. The existing invitation trigger still requires a valid, unresolved and unexpired CEAC invitation before a profile is created.

A live production inspection before this hardening found:

- **1** active profile linked to an unconfirmed Auth identity;
- **0** Manager memberships on that identity;
- **0** active Sub-team lead assignments on that identity;
- **0** unrevoked capability grants on that identity.

The live finding therefore did not show current privileged authority, but the server boundary is hardened so later role or capability changes cannot accidentally turn an unconfirmed identity into an authorised CEAC actor.

## Mover / unit-transfer boundary

Live work-lane authority now ends with the unit relationship that justified it.

When a `unit_memberships` row is deleted, or its unit changes:

- any Sub-team in the old unit that still names that person as lead has `lead_id` cleared;
- the lead removal is attributable to the signed-in actor;
- the Sub-team audit trail records the changed `lead_id`;
- the internal cleanup function is not browser executable.

This prevents a stale work-lane lead pointer from becoming live authority again simply because a person is later added back to the old unit.

The existing `app_led_sub_teams()` defense remains in place as a second boundary: even if stale historical data somehow exists, active lane authority requires an active Sub-team and a current membership in that Sub-team's unit.

## Joiner / mover / leaver authority safety

S3 now also closes a lifecycle gap that existed outside temporary expiry.

When an active profile is deactivated through the controlled employment/lifecycle path:

- every still-unrevoked capability grant for that profile is revoked with the signed-in actor recorded;
- current unit-membership rows are removed rather than left dormant;
- any live Sub-team lead assignment is cleared;
- the Sub-team lead change is written to the platform audit trail;
- capability grant history remains in place as revoked history rather than being deleted.

This prevents an offboarded person from regaining old capability, manager or work-lane authority merely because their profile is later reactivated.

`app_led_sub_teams()` now also requires:

- an active profile;
- an active Sub-team;
- a current membership in the Sub-team's unit;
- the existing privileged AAL boundary.

A stale historical `lead_id` therefore cannot confer work-lane authority after a unit transfer or membership removal.

The anti-lockout checks now count only **active** permanent authority managers. An inactive profile carrying a historical permanent grant cannot be used to justify removing the last active permanent authority manager.

A live production inspection before this change found **0** inactive profiles carrying unrevoked capability grants, so no unattributable historical backfill is required.

## Payroll separation

Expired grants do not count as active opposite payroll authority.

Unexpired temporary payroll grants remain subject to all existing role and separation-of-duties rules.

## Migration parity

The reconciled S3 migration is:

`20261007083250_118_capability_delegation_expiry.sql`

It is intentionally later than the canonical live S1 migration:

`20261007075418_privileged_mfa_aal2_enforcement`

Production Supabase must not receive S3 under a connector-generated replacement version. Merge and deployment are accepted only when GitHub and live migration history preserve the same S3 version and SQL semantics.

## Acceptance

The S3 SQL gates prove:

- expiry schema and RPC privilege contract;
- unexpired temporary authority works;
- expired authority is denied server-side;
- expired history is preserved and safely replaceable;
- a temporary authority manager cannot replace the last active permanent authority manager;
- inactive permanent authority holders do not satisfy anti-lockout;
- already-expired grants cannot be created;
- offboarding revokes active capability grants;
- offboarding removes current unit membership and live Sub-team lead authority;
- Sub-team lead removal is auditable;
- stale lane-lead attribution without current unit membership confers no authority;
- an unconfirmed Auth identity receives no organisation, Admin, Executive, capability, Manager, unit or lane-lead authority;
- the browser bootstrap refuses to open CEAC before email confirmation;
- removing or moving a unit membership closes live Sub-team lead authority in the old unit and audits the change;
- Unit Managers cannot undo a People Administration invitation cancellation;
- privileged database authority accepts only a verified TOTP factor, matching the CEAC v1 browser MFA experience;
- all prior capability authority/security gates continue to run.

## Gate recovery note

During forward reconciliation after S1 migration parity, the SQL security-gate script briefly lost its executable file mode. The script content was unchanged. The executable mode was restored before acceptance, and S3 must pass fresh exact-head CI, Migration Replay, Account Security and Level B Quality Gate checks before merge.
Protected-main merge requires the exact PR head to pass build, role-and-rls, replay, and invited-account-flow.
