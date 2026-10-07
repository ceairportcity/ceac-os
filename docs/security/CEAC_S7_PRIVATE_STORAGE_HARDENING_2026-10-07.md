# CEAC OS — S7 Private Storage Hardening Contract

Date: 7 October 2026
Status: SECURITY CONTRACT — IMPLEMENTATION MIGRATION PENDING CANONICAL SEQUENCING
Production Supabase: `efjljhftsesssumtshvp`

## Purpose

Close the remaining private-file upload and recovery-integrity gap without weakening the existing protected-HR or operational-file boundaries.

This tranche does **not** claim a backup/restore test has occurred and does not introduce an out-of-sequence production migration.

## Live evidence

Read-only production inspection on 7 October 2026 found:

- `ceac-hr-private` is private;
- `ceac-operational-private` is private;
- both buckets currently contain **0 objects**;
- `operational_files` currently has **0 active**, **0 pending**, **0 active-metadata-without-object**, and **0 stale-pending-over-24h** rows;
- `ceac-operational-private` has a 50 MB bucket limit and an explicit MIME allowlist;
- operational Storage INSERT requires a matching pending `operational_files` row owned by the signed-in uploader;
- operational Storage SELECT requires `app_can_access_operational_file()`;
- `ceac-hr-private` SELECT/INSERT/DELETE requires `hr_private.access` and organisation-path scope;
- `ceac-hr-private` currently has **no bucket-level file-size limit**;
- `ceac-hr-private` currently has **no bucket-level MIME allowlist**;
- the current protected-HR Storage INSERT policy does not require a pre-registered HR document/upload row;
- protected-HR document RPCs validate organisation path, but do not independently prove the Storage object exists or validate its actual type/size before the document record is accepted.

Because there are no current private Storage objects, this can be hardened before data migration/backfill is required.

## Existing boundaries to preserve

Do not weaken:

- `hr_private.access` capability checks;
- organisation-path isolation;
- direct browser denial on `hr_private` tables;
- private bucket status;
- append/replacement history for protected HR records;
- existing operational-file context authorization;
- S1 privileged MFA/AAL2 enforcement;
- S3 capability expiry and lifecycle authority controls.

Technical Support does not gain protected-HR file content merely because it troubleshoots Storage.

## Required protected-HR upload model

Protected HR uploads should follow a registered-upload lifecycle instead of arbitrary direct object creation.

The eventual migration should provide an attributable pending-upload record with at least:

- `id`
- `org_id`
- employee/profile subject
- document type
- original filename
- declared MIME type
- declared size
- generated Storage path
- requested/uploaded by
- created timestamp
- state: pending / active / abandoned
- finalised timestamp
- optional replacement-document reference

Rules:

1. An authenticated actor must hold current `hr_private.access`.
2. The subject must belong to the same organisation.
3. Server code generates the Storage path; the browser does not choose an arbitrary organisation path.
4. The path must be unique and scoped beneath the actor's organisation.
5. Storage INSERT is allowed only when a matching pending upload exists for that actor/path.
6. Finalisation requires the Storage object to exist.
7. Finalisation checks object metadata against the registered upload contract.
8. Only then is the protected HR document made active/visible through the protected-HR summary.
9. Abandoned pending uploads can be identified for reviewed cleanup.
10. No ordinary Staff/Manager/Technical Support route receives access from this lifecycle.

Do not use public URLs for these files.

## Bucket restrictions

The eventual migration must set explicit `ceac-hr-private` bucket restrictions before production file use:

- a finite file-size limit;
- a reviewed MIME allowlist appropriate for CEAC protected HR documents.

Do not invent a larger allowance than the existing 50 MB operational ceiling without an explicit operational requirement.

At minimum, executable/script/archive formats must not become implicitly accepted simply because an HR actor has protected access.

The exact document MIME list should be taken from the approved HR document use cases rather than copied blindly from the broader operational bucket.

## Object/record integrity

A protected HR document record must not be considered active solely because a caller supplied a plausible Storage path.

Finalisation must verify:

- bucket is exactly `ceac-hr-private`;
- object path equals the registered server-generated path;
- object exists;
- object belongs to the same organisation;
- object metadata is compatible with the registered MIME/size contract;
- actor/subject/replacement scope still passes current authority checks.

The database must not accept cross-organisation or arbitrary unregistered paths.

## Recovery integrity

Database backups cover Storage metadata, not object bytes.

The recovery process therefore needs a separate protected object manifest containing, for each exported object:

- bucket;
- exact object path;
- size;
- export timestamp;
- cryptographic content hash calculated during export;
- owning record/reference where available.

Do not store private file bytes, service-role credentials or encryption keys in GitHub.

A restore test must prove that:

1. database metadata restores;
2. object bytes restore to the intended private bucket/path;
3. the recovered object hash matches the export manifest;
4. browser roles still cannot bypass HR capability/path checks;
5. protected-HR document links resolve only through the approved HR surface.

## Orphan and abandoned-object handling

A future cleanup process may identify:

- pending registrations with no object after an approved age;
- objects with no matching registered upload/document;
- document metadata whose object is missing.

It must **not** automatically delete protected files until CEAC has:

- an approved retention rule for that class;
- recovery evidence;
- an attributable review/approval path.

Current live counts are zero, so there is no existing orphan cleanup debt.

## Required SQL/security gates

The implementation is not accepted until tests prove:

- both private buckets remain non-public;
- anon cannot read/write either private bucket;
- ordinary authenticated Staff cannot read/write protected-HR objects;
- `hr_private.access` alone cannot upload an arbitrary unregistered path;
- registered HR upload is restricted to the actor's organisation;
- declared file size/type outside the approved contract is rejected;
- finalisation fails when the object is missing;
- finalisation fails when object metadata conflicts with the registration;
- cross-organisation subject/path substitution fails;
- protected HR document history remains append/replacement oriented;
- Technical Support membership/capabilities alone do not grant protected-HR file access;
- authenticated SECURITY DEFINER surface does not exceed the reviewed allowlist without explicit acceptance;
- anon SECURITY DEFINER callable count remains 0;
- explicit `search_path` remains in force.

## Migration sequencing

Do not create a migration filename manually.

The Storage hardening migration must be generated only after the current security migration sequence is reconciled with protected `main` and live Supabase.

Current blocked predecessor:

`20261007083250_118_capability_delegation_expiry.sql`

Do not apply bucket-policy/schema changes directly to production outside the canonical migration history.

## S7 exit impact

This contract does not close S7 by itself.

S7 still requires:

- real production database export;
- safe non-production database restore test;
- real private Storage export/recovery execution;
- privacy notice approval/publication;
- processing/handover agreement approval;
- owner/legal resolution of DPC/retention questions;
- post-upgrade managed-backup verification when the plan changes.

This tranche removes ambiguity about the private-Storage technical boundary so those operational steps can be executed safely later.
