# CEAC OS — 10 pending production migrations: exact-file preflight and data-protection gate

**Status: prepared, NOT authorised to apply.** This is a documentation-only addition on separate draft PR #30, not on the tested application branch or production `main`. All counts are from read-only checks on 10 October 2026. Recheck immediately before any approved cutover.

## Identifiers and absolute rules

- Private canonical repository: `ceairportcity/ceac-os`.
- Last observed production main SHA: `827fbe7391467dd13d6e411527416402a252993c`.
- Production Supabase project: `efjljhftsesssumtshvp` (EU West).
- Production migration ledger: **119** applied, latest version `20261007075418` (`privileged_mfa_aal2_enforcement`).
- Exact PR #34 release-candidate migration source comparison: **129** SQL files, 119 version matches and 10 unapplied files. Do not equate duplicated *semantic* names with duplicated versions.
- No linked production CLI backup has been taken or test-restored as part of this documentation. No pending SQL was applied to production. **Do not merge/deploy/migrate** until the owner-authorised release gates below are satisfied.
- No table, Auth user, Storage object, invitation, RLS setting, privileged function or production branch was changed by the preflight.

## Exact 10-file pending sequence (commit blobs from GitHub)

| Version / migration file | Exact Git blob SHA | Review risk |
| --- | --- | --- |
| `20261007090000_119_phase6_volunteer_operating_model.sql` | `3c0e51918468dd2a8344d9757255b2da48321bb4` | Employment/invitation engagement fields, new volunteer tables/RLS, activation trigger and attributed employment updates |
| `20261007093000_120_phase6_private_day_planning.sql` | `566beb03b1771f66292b32f9133ea8aa89dd46e6` | Personal task/notes tables; owner RLS and trigger |
| `20261007094500_121_phase6_personal_planning_extensions.sql` | `ca0a069366ee2d98e4e1be9ad540c8ecadee8df2` | Existing personal tables changed; checklist and reminder policy |
| `20261007095500_122_phase6_personal_event_note_primitives.sql` | `b569493ac078490e344bce7d360a5a3dfae43178` | Personal calendar events and nullable date changes |
| `20261007102000_123_phase6_attendance_integrity.sql` | `0f075df377acf2399242511b8bd4b67a3a53c193` | Draft office-code data/RPC surfaces; RLS, event attribution |
| `20261007103000_123_phase6_attendance_integrity.sql` | `d0a45aaa850e0cb1505755f0949427f5a77fe42c` | A *different timestamp/version* with the same descriptive name; attendance network/code/corroboration tables and service-role boundaries |
| `20261007104000_124_phase6_attendance_integrity_reconcile.sql` | `5056dba6852cbbf4723bb08a6dcb23a3b12fc3c0` | **Potentially destructive:** retires redundant earlier-draft code RPCs/tables. SQL has an explicit non-empty-table **RAISE EXCEPTION** guard; confirm no intervening writes and restore evidence before migration |
| `20261007180500_go_live_annual_leave_policy.sql` | `3938f7d16f82eac014c647c5b804e18ec61b19c5` | **Changes real existing HR data:** sets specifically owner-confirmed annual policy to 24 days/year, 6 days/completed quarter, with no carryover; enriches historical annual requests only where attributable schedule evidence exists. Remaining leave types stay unconfirmed, not inferred |
| `20261010010000_125_restrict_legacy_office_code_rpcs.sql` | `9f09538263da645603a2c83b6939d735d42abedf` | Revokes authenticated execution of old office-code RPCs, preserving tightened attendance authority |
| `20261010030000_126_phase6_network_service_role_guard.sql` | `5126bdba0cedee6118677c826ec76adaa15021bd` | Replaces and restricts attendance network corroboration RPC; verify service-role-only access after application |

**Live data blast-radius facts (read-only, no identifiers returned):** one policy rule matches the precise `CEAC_OWNER_LEAVE_ROUTING_2026-10-02` source and annual/routing condition; one existing annual leave request; zero active volunteer employment records; one unresolved/unexpired/unrevoked invitation. `leave_requests.working_days` is not yet on production and is added by the pending migration: do not query it as though already deployed. These observations are not proof of the effects on unknown future/new rows.

## Mandatory pre-cutover evidence

1. Independently fetch `main`, release-candidate PR head, all reviewed security and owner-decision PRs; identify an exact approved source SHA and complete Git ancestry. Do not substitute source-only patches for a full private clone on final merge gate.
2. Obtain an actual **private encrypted logical backup** of the live project using the reviewed `scripts/ops/prepare-ceac-db-backup.sh` from this branch. It asserts exact Git SHA and `supabase/.temp/project-ref`, private directory, private passphrase, checksum and decryption test. **Do not use shared storage or print the passphrase.**
3. The logical dump covers roles/schema/data and migration ledger, **not Storage object payloads**, external Auth/provider configuration, SMTP provider configuration or other managed settings. Separately inventory and back up those relevant items using authorised private channels. Record limitations explicitly.
4. Restore the actual encrypted production logical dump onto **a separate disposable, access-restricted Postgres environment**. Compare migrations, critical table counts and role/RLS/grant catalogues, sample anonymised referential checks, ability to authenticate fixture users without transferring real credentials, and checksum integrity. A simple archive-decryption check is **not** a restore. Preserve privacy and delete the ephemeral copy securely after recording evidence.
5. Independently test the full ten-file sequence with an **existing-schema representative fixture**, including the one annual leave request/policy-rule scenario; confirm the staging database finishes at 129 migration versions and all 41 SQL gates and role/browser gates pass. The existing synthetic 129-version local replay succeeded, but is not a substitute for production backup/restore.
6. Repeat **pre-migration counts and conflict checks** immediately before maintenance window; ensure no active session wrote to draft attendance tables after the reconciliation guard check. Preserve data and halt if nonempty. No `CASCADE`, forced ledger repair or skipped migration.
7. Verify real **privileged-user MFA** at AAL2, invitation deliverability to an authorised recipient, protected employee records and signed-in-user `SECURITY DEFINER` threat analysis. Production currently has **0 verified MFA factors**, **161 public tables with RLS enabled**, **0 anon-callable public SECURITY DEFINER functions**, and **132 authenticated-callable public SECURITY DEFINER functions requiring reviewed business-authority checks**. Supabase security advisor also flags leaked-password protection disabled. No claims of complete security clearance until resolved/reviewed.
8. Obtain independent human reviewer and product owner Level C visual acceptance, documented rollback rehearsal, reviewer signoff and explicit authorisation for **production data migration** and **GitHub private-Free unprotected-main** risk.
9. Execute migrations in a controlled window only after those gates; check schema/ledger and role/RLS/Security Definer entitlements, exact count 129, live role-based smoke, leave-policy balances and pending invitation delivery. Record deployed SHA and Vercel environment settings. There is **no generic safe SQL down-migration**; rollback must be explicitly planned from a restorable backup with operator authorisation.
10. Do not change original Vercel production project, its current Git source, domains or configuration until the private `ceairportcity` GitHub integration and exact-source preview are verified. Preserve the last-known-ready deployment as an app-level rollback target, which alone cannot roll back a database migration.

## Release decision (as of writing)

**NO-GO.** Production migration not executed; actual encrypted production backup and tested restore not evidenced; real privileged MFA not enrolled; final Level C visual/human review and full private merge/preview production release not complete. This file prepares the release safely; it is not authority to trigger it.
