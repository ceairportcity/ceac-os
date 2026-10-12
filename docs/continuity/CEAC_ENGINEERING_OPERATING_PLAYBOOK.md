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


## 11 October 2026 — Chat milestone 2: completed Support membership/evidence and truthful system panel

New forward-only migration order after PR #50's 138:
- `20261011190000_135_support_access_approval_execution_ledger.sql`: business decision/Support-assisted execution evidence.
- `20261011193000_136_support_membership_end_reason.sql`: original joining reason vs independently attributable end reason; preserve history and automatic Support grant revocation.
- `20261011195500_137_support_private_case_evidence.sql`: extends existing `ceac-operational-private` operational files to `support_case` / `support_evidence`; requires current same-org Support membership + `support.case.manage`, and current assignment or Lead for uploads; reporters and ordinary managers cannot inspect internal evidence; file relinking from employee/project contexts into Support and vice versa is refused.
- `20261011201000_138_support_evidence_audit_history.sql`: append immutable, actor-bound `evidence_registered` event after a new case file-link registration, **not** a false claim that storage upload succeeded. Never write credentials or filenames to case event notes.

The existing 133/134 case backend and support capability checks are preserved. The system-status page continues to show every service as **Not verified** unless trusted health-provider data becomes available; it now displays counts of *actually recorded unresolved case reports* by exact service name separately, never extrapolates "Working" or "Down" from reports. Protected HR storage buckets are not used.

Current isolated review target is **142 unique migration timestamp versions** and **56 registered SQL security gates** (the earlier 138/53 remains a historically completed separate candidate). Three new rollback-only SQL gates cover access approval, membership end reason and private case file/audit rules. Full migration replay and database behaviour for the new SHA are **NOT RUN** in Chat.

**Source contracts executed at exact GitHub SHA `c6c9ebc8135b11d900ff8ffd2b03ee3633b08fa7` with source verified through the connected GitHub account:** new approval contract: 5/5 callback tests, 60 source/assertion checks; membership lifecycle contract: 3/3, 27; private Support evidence/audit contract: 5/5, 45; service health case-report helper: 1/1, 6. These JavaScript callback executions use a restricted JS runtime with explicitly defined stand-ins for Node test/assert/fs, not genuine Node's test command. **Total newly added/revised focused JS callbacks 14/14 (138 assertion checks) at source SHA**, pending final exact-HEAD check after documentation commits. Never use these tests to certify native Postgres, Playwright or final Vite build.

**Work-first acceptance:** run `npm ci`, full `npm run verify:source`, `npm run build`, all 142 migration versions in isolated Supabase Postgres, 56 SQL gates including adversarial role tests, Support file registration/finalisation and download in authenticated browser, person transfer/membership end, real business approver/technician separation and account/invitation delivery. Do not trust "registration" event as verified upload; browser must prove the bytes actually exist. Preserve release NO-GO, real MFA, encrypted backup/isolated restore and visual review boundaries.

**Implementation note:** The new `app_can_read_support_case` and `app_can_write_support_case` SQL helpers are intentionally not directly callable by `anon` or `authenticated`. They are invoked by the existing reviewed operational-context SECURITY DEFINER entrypoints. Thus this extension does not arbitrarily enlarge the exposed browser RPC surface. Work must verify actual effective grants and service-role behavior after replay.


## 12 October 2026 — PR #51 reconciliation and exact SQL replay procedure

- Re-fetch both branch refs immediately before integration. PR #50 was still `de4601bbf8b68666b5fcb0cb3e27ddd7972149c3`; PR #51 was the clean 47-commit descendant `9c1bdf5ae7905288382c292a7e13dc6a518c085b` with merge base exactly `de4601...`, so PR #50 could be advanced by a normal non-force ref update while preserving every continuation commit.
- When a reconstructed workspace contains unpublished experiments, Git-blob-verify every file copied from the continuation and explicitly restore any locally modified files outside the continuation diff before treating the workspace as exact. An extra trailing newline changes the Git blob; compare with `git hash-object`, not file size or visual inspection.
- The local disposable PostgreSQL 16 method remains valid for the 142-file tree: postgres-owned objects, Africa/Accra timezone, migration-history rows, synthetic Auth/Vault compatibility and a runner that exits non-zero when any gate fails. The accepted aggregate result requires the printed per-gate list and process exit code 0.
- New lifecycle gates must satisfy newer forward contracts. Ending a Support membership now needs a substantive `end_reason`; cross-tenant fixture objects must be prepared before `SET LOCAL ROLE authenticated`; application actors must never be given organisation-creation power just to make a test pass.
- `app_can_write_operational_context(text,uuid)` remains an internal SECURITY DEFINER dependency of the vetted file RPCs, not an authenticated browser RPC. `register_operational_file` is the supported write probe. Pending file links are intentionally invisible through the ordinary link SELECT policy until the file is finalised, so registration acceptance uses the returned private bucket plus immutable registration event rather than weakening RLS.
- This Work runtime currently resolves Node `v24.19.0`, while `package.json` requires `>=22.12 <23`. Native source/build results from this host are useful defect evidence but do not replace the final Node 22 gate. Do not hide the `EBADENGINE` warning or relabel Node 24 as Node 22.

## 12 October 2026 — browser runtime and checkout preflight continuation

- Playwright `1.56.1` may install its Chromium `1194` payload through the Microsoft fallback after the primary `cdn.playwright.dev` route returns a zero-byte/non-ZIP response. Preserve both messages in private execution logs; a successful fallback and command exit code 0 are required before retrying browser assertions.
- Vite and Playwright must run inside the same bounded Work shell invocation. Start Vite on `127.0.0.1:5173`, poll readiness, execute Playwright, capture its exit code, and terminate/wait for Vite before returning that code.
- The integrated application passed the signed-out laptop/phone/PWA smoke gate **3/3** and the complete credential-independent subset **68/68**, both with exit code 0. These executions used Node `v24.19.0`; they do not replace the required Node 22 final run or authenticated acceptance.
- The serial resilience suite passed its first three checks, then correctly failed R3 at `git rev-parse HEAD` because the Work reconstruction has no `.git`; two later checks did not run. A recursive Git tree audit of canonical HEAD found 317 tracked files absent from the reconstruction and one differing tracked file. Never manufacture `.git`, relabel this reconstruction as a checkout, or accept an ancestry-bound recovery bundle from it.
- The original Vercel project still exposes stopped Node 22 Sandbox records, but the available billing-charge query returned `404 costs_not_found`, which does not prove that resuming or creating compute is included and charge-free. Do not resume/create Sandbox compute without an approved cost basis.
- The connected production Supabase project currently has no development branches. This Work shell exposes no Supabase, role-fixture, GitHub or Vercel secret environment variables. Creating a Supabase branch requires the connector's explicit cost-confirmation flow; do not treat production as the fixture environment.

## 12 October 2026 — package-scoped Node 22 execution works in Work

- When the host Node version is outside CEAC's engine range, use npm's temporary package environment rather than changing `package.json`: `npx --yes -p node@22.12.0 -c 'node --version && npm --version'`. It returned Node `v22.12.0` and npm `11.9.0` in this Work shell without Vercel compute.
- Run CEAC commands inside the same wrapper, for example `npx --yes -p node@22.12.0 -c 'npm ci'`, then `... -c 'npm run verify:source'` and `... -c 'npm run build'`. For Playwright after a clean install, add it only to `node_modules` with `npm install --no-save --no-package-lock @playwright/test@1.56.1`, then invoke `./node_modules/.bin/playwright` inside the Node 22 wrapper. Nested `npx playwright` inside `npx -p node ... -c` produced npm `EUSAGE`; use the local binary path.
- Actual Node 22 results on application/security tree `ed00759d7b12f7f590ace78dba7ede76a7913f42`: clean install exit 0, source/unit **176/176** exit 0, production build exit 0, credential-independent browser subset **68/68** exit 0.
- A Node 22 resilience selection passed manifest, service-worker and offline-shell assertions, then R4 correctly failed because standby packaging also calls `git rev-parse HEAD`. This confirms both recovery and standby artifact gates need a genuine checkout.
- Direct private Git transports in this Work shell remain unavailable: GitHub HTTPS requires credentials, and the platform Git proxy likewise requested a username or rejected guessed namespaces. Do not expose a connector secret or fabricate repository metadata.
- A fresh read-only production Supabase query still showed exactly 119 applied historical migrations and zero development branches. Candidate migrations remain unapplied. Current production security advisors still report the known pre-candidate exposed SECURITY DEFINER surface; candidate isolated acceptance does not change production until an authorised release.

