# CEAC Engineering Operating Playbook

### Local replay fidelity corrections

The passing 52-gate run depends on reproducing the managed database execution context accurately:

- Run repository migrations and SQL gates as role `postgres` (for example with a connection option that sets `role=postgres` after the local bootstrap superuser connects). Running them as the bootstrap account changes object ownership and default privileges, causing false ACL failures or false passes.
- Seed `supabase_migrations.schema_migrations` with each successfully applied filename version; migration-history gates must test the same state the Supabase CLI maintains.
- Configure PostgreSQL `timezone=Africa/Accra`; attendance gates use the approved Ghana operational timezone and can fail incorrectly if the disposable cluster inherits another timezone.
- The runner-only Auth compatibility table must include the fields exercised by rollback-only MFA tests, including TOTP secret and phone factor shapes. Values are synthetic and rolled back.
- The runner-only Vault compatibility extension must grant its managed service surface to `service_role` while keeping ordinary browser roles out. This models the local test boundary only and is not a CEAC production grant.


### Work local browser server networking

Work shell executions can share files and process listings while still isolating loopback networking between execution sessions. A Vite process started in one long-running shell may therefore appear alive from another shell while `127.0.0.1:5173` is unreachable there.

For reproducible local Playwright browser runs:

1. start Vite/preview in the background and capture its PID;
2. poll its HTTP URL;
3. execute Playwright;
4. stop the server with a shell trap;

all inside the same bounded shell execution. A terminal-like persistent process in a different Work execution is not proof that browser workers can reach it. Treat `ERR_CONNECTION_REFUSED` from the cross-session pattern as an invalid harness run, not an application failure.

### Aggregate gate exit status

A shell loop that records individual SQL failures can still return exit 0 when its final command is only an `echo`. Every aggregate runner must explicitly exit non-zero when its failure counter is non-zero. Acceptance evidence requires both the per-gate result list and the aggregate process exit code; a printed `FAIL` line with exit 0 is a harness defect, never a passing run.


## 11 October 2026 — Chat continuation after Work quota

**Canonical candidate:** PR #50, branch `chatgpt/unified-release-candidate-20261011`, source checkpoint `de4601bbf8b68666b5fcb0cb3e27ddd7972149c3` (recheck live HEAD before Work integrates). **Independent Chat writer:** `chatgpt/pr50-chat-technical-access-ledger-20261011` in draft PR #51, derived directly from that PR50 HEAD. No writes to PR50, frozen PR44, live Supabase, Vercel or production main.

**Safe workflow:** The approved Support contract requires business owners to decide and Technical Support to perform narrowly scoped assistance. Implement a forward-only table+trigger state machine on a separate PR50 child branch. Write dedicated business/Support actor RLS policies and rollback-only SQL gates. A support capability is not People Administration, general Manager, HR, Payroll or authority-management power. No external access change may be inferred from a support note.

**Source contract verification available in Chat:** Fetch exact SHA GitHub blobs and execute pure JavaScript source-contract functions with clearly declared Node `test/assert/fs` stand-ins; these results are source-level only. They are not `node --test`, native JSX transpilation, SQL migration replay or browser acceptance. For this milestone, an exact-commit five-case JavaScript source-contract suite ran with **5 passed / 60 assertions**, no source fixture errors, using the GitHub connector + isolated V8. Native package install/build, 139-migration replay, 54 registered SQL gates and role/browser verification must be executed later in a capable Work shell.

**Operational lessons:** Separate user-visible `approved` from `executed`, enforce version/CAS and actor identities in PostgreSQL rather than only client buttons, keep an immutable history, and do not automatically grant permissions or claim email delivery. Report `NOT RUN` for native SQL/Playwright and encrypted restore, not PASS. Keep the existing 138-migration/53-gate checkpoint only as historical evidence for PR50, not approval of the continuation SHA. Preserve prior 133/134 Support migrations and 162-source-test outcomes; new tests must be retested at combined integration SHA.

**Integration:** Work should review draft PR #51 against live PR50, reconcile any meanwhile-advanced PR50 HEAD, ensure both test registrations survive, and run genuine Node/build/Postgres/role acceptance before incorporating this branch. Do not force merge or bypass a missing release gate.

