# CEAC OS — S3 / Technical Support / Recovery reconciliation checkpoint

Date: 2026-10-11 UTC  
Repository: `ceairportcity/ceac-os` (private)  
Release status: **DRAFT / NO-GO. Do not merge, migrate or deploy.**

## Source of truth and traceable ancestry

- Existing production `main`: `827fbe7391467dd13d6e411527416402a252993c` (unchanged at preflight).
- PR #40 Executive styling: `05e953c73bed4e1de7ef2a8c2425229ae45665ec`.
- PR #41 read-only baseline: `fe01e8cd3db77156282081a5d9f0d9729ae0e28f`.
- PR #42 Technical Support source baseline: `78f08d363545f02991ef9a146c50e57ad38dec1b`.
- S3 PR #14 original head: `f2055636c1f87ff4ff7cbb2a87e6c490a5f52253`.
- Two-parent S3/source merge: `c73b0011c10848a696b8d47282f626275bd2f0b3`; 17 intended file changes, 14 exact blobs and 3 forward-reconciled.
- Later PR #43 source-contract CI checkpoint: `db68769be0b527b68c6a71c4de07b1c33b09c865`.
- Original backup-preparation PR #30 head: `d4edd77ac6651c818c415dddb7dbe2a4b304e1da`.
- Two-parent backup source merge: `24208a19a43416362afd4643910941ee0991ee48`, adding exactly the three reviewed PR #30 files, keeping their original blobs.
- PR #43 is a draft stacked above PR #42. No normal release merge has taken place.

The latest integrated application contains S3's `expires_at` support and verified-email check. **This application source MUST NOT be deployed before its exact matching S3 database migration is accepted/applied**, since production does not yet have `capability_grants.expires_at`.

## Fresh production READ-ONLY preflight

Connected project: `efjljhftsesssumtshvp`. Production data remains unchanged.

- Applied migration ledger: **119 versions**.
- S3 `20261007083250` present on production: **NO**.
- Ten subsequent pending migration versions present on production: **0**.
- Planned isolated migration replay ledger once all 11 are executed: **130 versions**, with exact recorded SHA/version checks, not just file presence.
- 8 existing profiles; 0 currently inactive.
- 8 Auth accounts, 7 confirmed email accounts.
- 9 unit memberships and 8 active sub-team lead records.
- 19 historical capability grants, 19 not currently revoked, of which 4 are in people/authority/payroll-approval capabilities.
- 0 production verified MFA factors; mandatory privileged MFA cannot yet be enabled.
- Production `capability_grants.expires_at` does not exist.

The last two points are release blockers, not a request to change production settings immediately.

## 11 pending migration source dependencies

S3 source file:
`20261007083250_118_capability_delegation_expiry.sql` — exact Git blob `035ce68118699c3411395ecba5cd4abb1349bc60`.

The ten later files remain in their original timestamp order from PR #30's historical risk matrix. Source-level scan confirms that none of those ten directly replaces or drops any of the **18 function names** defined by the S3 migration. This is a *static name-overlap check*, not proof that the migrations execute successfully or preserve semantics.

S3 adds `expires_at` to `capability_grants`, refines privilege/MFA checks, changes the `grant_capability` signature (with defaulted expiry), installs audited deactivation/mover cleanup, and tightens invitation and identity checks. Its DML inside function bodies is not a top-level production data cleanup; however triggers can alter access when later HR transitions occur and require exhaustive fixture tests.

## Executed narrow checks

- PR #42 pure support logic: three Node test bodies executed with isolated V8 harness — **3/3 PASS**; not full Node CI.
- PR #43 repo-source contract at `db68769be0b527b68c6a71c4de07b1c33b09c865`: **7/7 PASS** in isolated V8 using fetched exact GitHub blobs and filesystem/crypto shims. Includes actual independent SHA-1 Git blob computation for Executive CSS integrity. The suite is also registered in `.github/workflows/ci.yml`, but GitHub Actions has not returned a completed passing checkout/build/test job on this head.
- Script retained all newly introduced Phase 6 annual-leave/attendance SQL gates AND S3 identity/expiry gates.
- Fresh production privilege inventory: 132 authenticated-executable public SECURITY DEFINER functions; zero anonymous-executable public definers; all 132 have explicit search_path; privileged HR access still needs real authenticated attack tests.
- Source code compared with current branch HEAD before each material modification; no prior accepted visual role sheet changed.

## Recovery preparation — source only

Copied all three original PR #30 artifacts without reauthoring:
- `scripts/ops/prepare-ceac-db-backup.sh`: refuses unapproved canonical SHA, wrong repo/project, non-private destination, missing encryption secret or unavailable CLI; produces AES256 GPG-encrypted logical export and manifest with SHA256 checksum when run with approved operator credentials in an appropriate private environment.
- `docs/continuity/CEAC_DB_MIGRATION_RELEASE_GATE_2026-10-10.md`.
- `docs/continuity/CEAC_TEN_PENDING_MIGRATIONS_RISK_MATRIX_2026-10-10.md`.

Those two 10-migration documents remain historical as of October 10; this addendum supersedes their **pending count only** (now eleven including S3), not their findings or safety rules. The export script has **NOT** run; no encrypted backup or restore has been completed; Auth/Storage objects need separate recovery coverage.

## Mandatory remaining gates

1. Acquire an isolated owner-authorised **nonproduction** environment with complete local Docker/Postgres/Chromium capability, without paid overages or a public-repository workaround. The connected Supabase account lists production and a second existing project not established as disposable. **Do not repurpose it or apply test migrations there.**
2. Run the complete 130-migration replay and verify catalogue/ledger parity plus all SQL security gates, especially S3 confirmation/expiry/privileged AAL2 and post-S3 Technical Support case isolation. The support proposal still needs independently approved canonical migration generation; do not add it to the 130 counts until reviewed.
3. Complete the incomplete Technical Support approved access approval/execution workflow, support-team controlled membership transitions, evidence/upload permission contract, real service health, recovery checks and leadership reports. Confirm owner-approved visual parity against references for all four families.
4. Execute a secure encrypted **real production backup and independent isolated restore**, including authentication, private object data, supported database objects and ledger. Only afterwards assess the authorised migration/deploy sequence.
5. Obtain actual verified privileged TOTP factors, invitation delivery evidence, full exact-head Node/Vite/44-case browser/31-case visual tests, independent owner and reviewer acceptance and working existing Vercel private Git-App access.
6. When and only when all mandatory conditions are genuinely satisfied, authorise normal GitHub integration and Vercel controlled cutover with demonstrated rollback.

No production write, SQL migration, MFA enablement, Vercel switch, GitHub main merge or billing change is authorised by this checkpoint.
