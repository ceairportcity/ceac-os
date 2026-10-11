# CEAC confidential recovery and genuine MFA acceptance protocol

**11 October 2026. Status: PREPARED, NOT EXECUTED. Production NO-GO.**
Frozen PR #44: `e00f13873409e4cc16ec1493b60b71d5cde1114a`.
Production Supabase project: `efjljhftsesssumtshvp` (PostgreSQL 17). Keep production and main unchanged.

## What can be established from the existing connected services

Read-only counts at the audit: 119 applied migrations, 9 Auth users, 2 Storage buckets, **0 Storage objects**, 0 enrolled Auth MFA factors, 0 verified factors, 0 organisations currently requiring privileged MFA. Counts may change; capture them again at the real backup window. No export, off-site encrypted archive, restoration or real MFA enrolment has been executed.

The existing `scripts/ops/prepare-ceac-db-backup.sh` script is a **backup-export preparation** tool. It asserts exact SHA, canonical repo and linked project, produces an AES256 GPG archive and checksum, and refuses an in-repo destination. It does **not** prove database restoration, complete Auth provider settings or Storage blob recovery. The Supabase connector can run read-only catalog queries, but does not expose a confidential full dump/restore action. Never claim an archive exists based on a script's existence.

## Independent encrypted backup and isolated restoration — operator execution contract

1. On an already-authorised private machine with the **pinned Supabase CLI**, PostgreSQL client, GPG and Docker, use a private checkout at the precise accepted SHA. Authenticate the Supabase CLI privately; do not copy database passwords, project secrets, TOTP seed, API keys or decrypted dumps into GitHub comments, browser automation, shared logs or this chat.
2. Provide a new private backup directory **outside the repo** and an existing AES256 passphrase file outside both the repo and backup directory (mode 0600). Use environment variable paths `CEAC_BACKUP_DIR`, `CEAC_BACKUP_PASSPHRASE_FILE`, and `CEAC_EXPECTED_SHA` to run the existing reviewed script. Confirm its project-link check is the real CEAC project, and that it performs **reads only**. Log timestamp, source SHA, package/CLI version, archive SHA256 and operator identity, not credentials.
3. Keep the encrypted archive in restricted independent storage with a separately held recovery key and retention decision. Preserve a second copy and perform a **decryption/inventory check**. Inspect roles, public schema, data, migration history, protected HR schema and Auth/Storage coverage. Official Supabase CLI documentation states the **default** `supabase db dump` excludes managed `auth` and `storage` schemas. Thus the existing script's `roles.sql`, `schema.sql` and `data.sql` alone cannot establish a complete recoverable copy of 9 real Auth users or the two Storage buckets, regardless of their metadata counts. The script now expressly marks `complete_recovery_backup=NO` and `auth_managed_schema_data=NOT_IN_DEFAULT_EXPORT`; only a separately verified managed-schema Auth/Storage export and actual isolated restoration can satisfy the full-recovery gate. Use a provider-supported managed-data and encryption-key migration route; don't assume a raw Postgres import can restore provider-managed encrypted fields. At audit time Storage has two buckets and no blobs; any new objects before backup require separately copying encrypted object bytes and metadata.
4. Start a genuinely **separate disposable** private PostgreSQL/Supabase restore target with correct major version/extensions and NO link to `efjljhftsesssumtshvp`. Positively confirm the isolated target identity and clean state. The operator must never run a database reset, restore, migration-repair command or import against CEAC production. Use the official Supabase restore flow for roles, schema and data, with `psql --single-transaction --set ON_ERROR_STOP=1` and a private target connection, adjusting only version-dependent incompatibilities **in the isolated copy**. Keep full logs private.
5. Run counts/hashes and protected-data invariants against that actual restored database: migration ledger 119 unique versions at backup time; public/HR table and policy/grant inventory; Auth 9 users at audit time or revised backup-time count; leave/payroll/employee/report record counts; sample referential integrity; 0 unauthorized direct protected-HR reads; Storage bucket/object list and actual file access where applicable. Validate that no authentic user's password or second factor is exposed in reports. Check restored user sign-in via **new private test credentials or approved isolated fixture**, not by reusing an individual's production password.
6. Compare backup-time source counts with the restored copy and record any difference. Prove an encrypted archive can actually be used to recover **real** source data before claiming PASS. Re-run the 130 original migrations and 11 pending version effects against a separately staged representative copy, then rerun the full SQL/role suites. Note 124's guarded table removal and annual-leave historical changes. Preserve an exact pre/post count and recovery report, and securely destroy temporary sensitive copies after acceptance.
7. Restore verification is distinct from app rollback: Vercel's earlier READY frontend deployment cannot undo a database migration. Specify permitted recovery point/time and who can authorise cutover. Production deployment and changes still require explicit owner approval.

Official restore reference: https://supabase.com/docs/guides/self-hosting/restore-from-platform
Official backup/restore reference: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
Official CLI dump's excluded managed schemas: https://supabase.com/docs/reference/cli/supabase-db-dump

## Real-user privileged TOTP MFA — acceptance, not simulated proof

Existing code includes Account MFA setup and dedicated PostgreSQL AAL2 test fixtures, but production has **zero real enrolled factors** and `privileged_mfa_required=false`. Do **not** toggle the organisation enforcement flag now; doing so could lock out every privileged operator.

1. A designated authorised Admin/Executive/Manager independently signs into a nonproduction verified CEAC build, chooses the application's Account → MFA enrollment flow, and scans their TOTP QR **on their own authenticator**. Never ask for the QR, seed, recovery code, current OTP or screenshot containing it. Verify using Supabase Auth MFA challenge/verify, not direct mutation of `auth.mfa_factors`.
2. After verified enrollment, check that the server sees `auth.mfa_factors.status='verified'` for the authorised test subject without exposing sensitive factor contents. Verify that the **current** signed session is actually `aal2` and its `amr` records `totp`; a stored factor alone is insufficient. Refresh/re-authenticate where required.
3. Use real signed-in sessions to exercise Admin, Executive, Manager, Staff, Volunteer and restricted Technical Support routes. In an isolated test organisation with MFA required, assert that Admin/Manager/payroll/protected-HR/capability actions are **denied at AAL1**, permitted only within authority at real AAL2, and denied across organisations/units even at AAL2. Ordinary Staff enrollment/bootstrap must remain usable when privileged enforcement is on. Validate token refresh, session expiration, unenrollment and recovery without bypassing factors.
4. Prove actual staff invitation delivery and onboarding to an authorised test mailbox without disclosing invitation tokens in logs. Confirm the authorised recipient has correct department and minimum privileges and cannot impersonate an unrelated employee or read private HR/payroll records.
5. Capture signed outcome by role and exact release SHA. Only after at least one legitimate privileged recovery path is enrolled, backup/restore is proved, and explicit owner authority is recorded may an approved production change window enable `privileged_mfa_required`; prove it with a fresh privileged login before declaring success.

Official Supabase MFA: https://supabase.com/docs/guides/auth/auth-mfa

## Codespaces native verification — exact evidence rule

### Confirmed old-checkout runner mismatch — Git blob parity, not conjecture

Independently fetched both the frozen PR #44 tree and the existing Codespace's **remote** checkout branch `chatgpt/private-independent-release-gate-2026-10-10` using the authenticated CEAC GitHub connector:

- `.devcontainer/devcontainer.json` is the **same blob** `920f02fb8a93c46d8cd76b8676a15fda7e4a4956` in both and does configure `postStartCommand` and `postAttachCommand`.
- In the **existing verification branch**, `.devcontainer/launch-automatic-verification.sh` blob `5c6657460f7d6181b79e7278884bb57697fa3a1f` treats the presence of ANY previous exit-code + summary as a valid cache and does not compare a recorded SHA with live PR #44.
- Its `.devcontainer/ceac-private-runner.sh` blob `8c4f557679837bb065659d18472f6bcc6b73d4e0` **hardcodes obsolete PR #27** `386e59086fa79e1d27b28c42677d2252877cf0e0`, labels itself PR27 and tries to post its summary to **PR #29**, not PR44.
- Frozen PR #44 has corrected launcher blob `00f3d9db3d82a93f3635fa4fd5bbcc6a052a4837` (cache bound to remote PR #44 HEAD) and corrected runner blob `f32d54278f20d4ddc4bef58ddb7f5ac49558f917` (fetches live PR44 + main and executes detached candidate).
- PR #29 conversation has no later real exit-code report proving PR #44's SHA; PR #44 has no such report either. An existing Codespace may have run an OLD verification but can never be counted as PR44 acceptance without independently recovering its tested SHA and status files.

**Consequently the one indispensable native execution capability remains a direct authenticated shell or read-file channel inside the *existing* Codespace**: inspect its actual `/tmp/ceac-private-autorun-*` evidence, then run the current PR44 exact-head launcher/runner **from the PR44 commit** in a detached worktree without relying on the old checkout scripts or stale cache. The GitHub connector cannot access Codespace process `/tmp` or execute a terminal command; no browser automation retries, paid runners or new CI are authorised. Simply restarting the old checkout or seeing a `postAttachCommand` line does **not** correct this discrepancy.



Existing private Codespace `fuzzy-space-giggle` at https://github.com/codespaces/fuzzy-space-giggle-xrx595q5r555266qq was observed connected to `ceairportcity/ceac-os`. The repository's `.devcontainer/devcontainer.json` defines `postStartCommand` and `postAttachCommand` invoking `.devcontainer/launch-automatic-verification.sh`. It may start the exact-head runner automatically, but **configuration and running Codespace do not prove that it did run**.

PR #44 has no authenticated, exact-`e00f138` Codespaces per-gate runner summary, exit code, checksum manifest or Level B pass comment at this review. GitHub API shows failed/skipped Actions runs (jobs report zero executed test steps), not a passed browser/migration suite; only the Vercel preview status is READY.

**One indispensable missing access capability:** a native read/execute channel for that existing Codespace's shell/runtime evidence, to inspect `/tmp/ceac-private-autorun-tested-head`, `/tmp/ceac-private-autorun-exit-code`, `/tmp/ceac-private-autorun-summary.md`, and `/tmp/ceac-private-autorun-result.log` and, if needed, invoke the existing launcher. No such Codespaces terminal action is exposed in the connected GitHub tools; neither production SQL nor GitHub comments can substitute. Do not retry exhausted TinyFish, launch another paid CI, claim a terminal command ran merely because it was submitted, or mark checks PASS from a READY preview.

**Acceptance state:** NOT VERIFIED until actual Codespace exit code, exact source SHA, SQL/role/browser gate results and private checksum evidence are independently inspected. Owner approval and a human second reviewer remain separate release gates.
