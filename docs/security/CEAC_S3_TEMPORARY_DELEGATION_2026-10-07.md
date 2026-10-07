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

The S3 SQL gate proves:

- expiry schema and RPC privilege contract;
- unexpired temporary authority works;
- expired authority is denied server-side;
- expired history is preserved and safely replaceable;
- a temporary authority manager cannot replace the last permanent authority manager;
- already-expired grants cannot be created;
- all prior capability authority/security gates continue to run.

## Gate recovery note

During forward reconciliation after S1 migration parity, the SQL security-gate script briefly lost its executable file mode. The script content was unchanged. The executable mode was restored before acceptance, and S3 must pass fresh exact-head CI, Migration Replay, Account Security and Level B Quality Gate checks before merge.
