> **ARCHIVED BASELINE — NOT A CURRENT CUTOVER INSTRUCTION (12 October 2026).**
> This file preserves the 10 October PR #27/129-version evidence for audit only. Do **not** use its ten-file pending list, 129-version total, old PR reference or GO checklist to migrate the current CEAC OS release.
> The owner-frozen integrated application/security commit is `51223157f28e16e90acda6a35dd71389513b6d6f` on unified PR #50; the complete isolated replay executed **143/143** unique migration versions and **56/56** registered SQL gates under Work. The last independently recorded production migration inventory was **119 applied**; if it remains unchanged at cutover, **24** forward versions, not ten, are pending. Requery the *live* version/name history and compare with the exact owner-approved candidate before preparing an ordered cutover, and refuse any missing/mismatched historical version.
> These isolated successes are not a rehearsal on restored real production data. The destructive migration-124 emptiness guard, annual-leave pre/post rows, protected Auth/Storage-aware encrypted backup and actual isolated restore, real authenticated/MFA/visual acceptance, independent review and owner GO are all mandatory before any production change. See `docs/continuity/CEAC_OWNER_RELEASE_SCOPE_FREEZE_2026-10-12.md` and `docs/continuity/CEAC_LIVE_HANDOVER.md` for active release authority.

# CEAC OS — production database migration safety gate

**Audit date:** 2026-10-10 UTC. **Outcome:** READ-ONLY BASELINE VERIFIED; MIGRATION RELEASE BLOCKED.
**Production project:** `efjljhftsesssumtshvp` (Supabase Free, PostgreSQL 17.6, EU West).
**Candidate:** draft PR #27, originally `386e59086fa79e1d27b28c42677d2252877cf0e0`; re-fetch exact SHA before any action.
**This branch:** backup-preparation evidence only. It does not merge candidate code, apply SQL, access protected staff records, or start production cutover.

## Verified read-only production baseline

At approximately 15:00 UTC on 2026-10-10, direct project inspection found:
- Database `postgres` active/healthy; approximately **31 MB** used.
- **119** entries in `supabase_migrations.schema_migrations`, **119 unique versions**, newest `20261007075418`.
- The **119** live version/name pairs match the candidate's historical migration files: **zero missing, extra, mismatched, or duplicate historical versions**.
- **161 public base tables**, all with RLS enabled; **10 `hr_private` base tables**.
- Two public reference counters have RLS enabled but intentionally no policies. Do not add permissive policies to silence an advisor warning.
- No waiting locks in that snapshot; six database connections at sampling time.
- One existing annual-leave request and one existing owner-routing annual-leave policy rule meet the broad conditions for the pending annual-policy change. Actual update effect must be compared in a restored copy, not guessed from source.
- Baseline privileged RPC examination found no `anon` execution on inspected payroll, account-trigger and attendance RPCs. Broad `authenticated` EXECUTE on selected security-definer RPCs needs internal-authority testing, not automatic revocation.
- Supabase security advisor reported privileged-function warnings and leaked-password protection disabled. Those are separate release acceptance gates.

## Precisely ordered pending migration set

The following **10 files** have no matching live migration-version record as of audit. Apply only in lexical/file order through the normal migration mechanism, after a *complete* isolated replay on the final exact candidate SHA:

1. `20261007090000_119_phase6_volunteer_operating_model.sql`
2. `20261007093000_120_phase6_private_day_planning.sql`
3. `20261007094500_121_phase6_personal_planning_extensions.sql`
4. `20261007095500_122_phase6_personal_event_note_primitives.sql`
5. `20261007102000_123_phase6_attendance_integrity.sql`
6. `20261007103000_123_phase6_attendance_integrity.sql`
7. `20261007104000_124_phase6_attendance_integrity_reconcile.sql`
8. `20261007180500_go_live_annual_leave_policy.sql`
9. `20261010010000_125_restrict_legacy_office_code_rpcs.sql`
10. `20261010030000_126_phase6_network_service_role_guard.sql`

The two files labelled `123` have distinct **timestamp versions**, not a duplicate migration version. Migration `124` intentionally removes redundant tables from the *first* attendance draft, but must fail closed if those draft tables contain data. Do not skip or reorder either `123` file; do not waive that safety exception.

## Mandatory isolated acceptance before production

1. Freeze an exact approved private Git commit; verify its ancestry and migration-file hashes. Re-check PR #27 and dependent security changes for drift.
2. Use an independent **disposable Supabase environment**, *not* production and not a transaction on production. Rebuild the 119-history baseline using the committed local replay tooling, and then apply all 10 pending files in order. The existing private runner in draft PR #29 documents the full local Docker/Supabase path; the connected runtime cannot run that Docker stack.
3. Capture the test DB migration ledger: 129 versions, all unique, zero missing, and 129 expected filenames; never mark history applied as a substitute for executing SQL.
4. Execute `scripts/ci/run-sql-security-gates.sh`, all authentication/security checks, the complete RLS and SQL acceptance suite, plus functional role-based browser testing against the same accepted release tree.
5. Specifically test staff versus manager/admin boundaries, cross-unit and cross-organisation read/write denial, private personal tasks and notes, volunteer payroll exclusion, invitation activation, protected HR, the new annual leave policy and historical leave reconciliation.
6. Verify service-only network corroboration: authenticated users and anonymous callers must be denied; trusted `service_role` calls require valid network-source/session linkage. Test that no attendance code can create automatic absence, misconduct or payroll outcomes.
7. Record migration timing, lock/wait behaviour, reference-data row counts, schema/security snapshots and data differences. Require a **separate independent reviewer** and owner-approved release window.

As of this document's creation: **isolated 129-migration replay, full permission tests and restored-environment acceptance are NOT VERIFIED**. Never infer a PASS from migration filename parity or a Vercel build.

## Backup preparation (read-only, encrypted and separate from GitHub)

The companion file `scripts/ops/prepare-ceac-db-backup.sh` implements *read-only* Supabase CLI logical dumps (roles, application schema, data and migration history). It:
- Refuses noncanonical GitHub origin, mismatched exact commit or any linked project except the live CEAC project.
- Writes a private encrypted GPG archive with SHA-256 manifest to a chosen **external directory**, never the repository. A private passphrase file must already exist **outside** the checkout.
- Requires existing authenticated Supabase CLI access; **no passwords or API tokens belong in GitHub, chat, logs or build artefacts**.
- Checks that the encrypted archive can be decrypted and enumerated; that is **not** a restoration test.
- Marks managed `auth`/`storage` customisations and Storage object blobs for additional review. Supabase CLI normal logical dumps do **not** automatically back up Storage file contents, and managed-schema recovery requires separate care.

Production is on Supabase Free, where automatic daily platform backups are not provided. The connected Supabase plugin has **no database backup or restore-export action**; this document and script are NOT evidence that an actual backup exists. Backup work must take place in a private environment with approved CLI database access and encrypted off-site retention.

An independent *restoration into a disposable nonproduction Supabase project*, with records, authentication, RLS policies and file objects checked, must pass before live migration. Ensure that a trusted operator retains the decryption key and can demonstrate the recovery procedure. Explicitly freeze writes or take an appropriate repeat backup at the actual deployment window so backup age is known.

## Final production GO/NO-GO

**GO requires all of these exact-head acceptance records:**
- All 129 migrations pass clean isolated replay and migration-version parity.
- Full SQL/RLS/auth/MFA/HR/payroll and visual/application gates pass.
- A complete encrypted backup *exists*, is securely held off-site, and a genuine restore has been exercised on a disposable project, including any critical Auth and Storage artefacts.
- Pre/post migration monitoring, contingency restoration method, data compatibility and permitted maintenance window are agreed.
- Authorised owner signs off on the **final candidate SHA** and actual deployment; second reviewer signs off on technical evidence.
- No concurrent CEAC deployment or new migration introduced after the frozen acceptance evidence.
- Only then run forward-only pending migrations using the approved deployment mechanism; record exact versions, timing and post-release permissions. Do NOT use `db reset --linked`, `migration repair` as an execution shortcut, or any live SQL rollback experiment.

**Current gate: NO-GO.** Nothing in this branch authorises a production migration. This is a real safety hold, not a claim that the application code is broken.

## Free isolation and verification options

Supabase quoted **$0/month** to create another project in CEAC's existing free organisation, subject to free-slot availability and explicit owner approval of the destination organisation. Its development branch was quoted at **$0.01344/hour**, which was not authorised. Do not initiate billable branching or provision paid infrastructure. The separate local Docker/Supabase route avoids an additional remote database but requires a working trusted, private Docker runner and GitHub access. Only actual executed acceptance counts.

Vendor references:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/reference/cli/supabase-db-dump
