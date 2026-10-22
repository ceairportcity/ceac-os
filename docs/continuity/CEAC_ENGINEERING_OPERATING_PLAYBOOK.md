> **20 OCT 2026, 17:50 UTC — CURRENT FIRST-READ OWNER LOCK UNTIL STAGE 2 RELEASE:** Follow the [binding correction-to-release decision](../final-product/PRODUCT_OWNER_DECISIONS.md#20-october-2026-1750-utc--binding-stage-2-correction-to-release-sequence-read-first-until-release) before any change/test. Finish approved visual comparison/corrections → close precise outstanding agreed functionality → verify connected workflows/permissions and complete safe database/deployment release → check the actual live application. Continue PR #124 with the existing ledger and preserved evidence; no restart, expansion or repeated full-suite testing. Apply affected checks during repairs and full mandated verification at the frozen final candidate. Older branch/auth/tooling/programme instructions below are historical where superseded; existing email/password stays, Google and mandatory MFA remain deferred. This is a documentation decision, not release acceptance.

> **13 OCT 2026 TINYFISH RESTORED — NARROW OWNER EXCEPTION:** The blanket "No TinyFish" language below applied when the wallet was empty. Owner has now restored its balance and authorises **a small, bounded recovery-only use**, after secure GitHub-profile sign-in, to inspect and preserve the Work Codespace's unpublished Google/MFA source. Follow the current [migration finish contract](CEAC_MIGRATION_FINISH_DUAL_MODE_EXECUTION_2026-10-12.md) and `AGENTS.md` first-read update for max 35 steps/10 minutes and ≤$1 recovery allocation. This does not permit new hosting, payment, unrestricted site automation, production cutover or bypass of release acceptance.

> **CURRENT OWNER INSTRUCTION / FIRST READ (12 October 2026):** [CEAC_MIGRATION_FINISH_DUAL_MODE_EXECUTION_2026-10-12.md](CEAC_MIGRATION_FINISH_DUAL_MODE_EXECUTION_2026-10-12.md) governs the original **improved CEAC GitHub-account migration** and all subsequent Chat/Work sessions. This playbook's older technical procedures remain useful only where they do not contradict the owner's latest migration-first priority. Chat can act independently with connected GitHub and strictly read-only Supabase/Vercel where allowed; Work owns unfinished Google-only/AAL2 authentication, credentialled acceptance and cutover. No TinyFish (credits exhausted), new paid provider, repeated failed startup loop, source edit overlapping Work or direct production/main change. Read the linked contract *before* choosing a task; persist exact verification and return to actual migration completion.

# CEAC Engineering Operating Playbook

### 22 October — qualify one-date assignment through the complete authority chain

Use the existing routine engine and separate dated assignee from series owner, actual contributor and independent reviewer. Reuse the same date lock/authority at progress, outcome, file registration/finalisation AND the restrictive Storage INSERT policy; testing only metadata registration misses a real byte-upload denial. Test both individual/shared restoration, original-assignee denial, current account/unit checks and concurrent cover/proof. In a browser use the observed role's actual Calendar route (Staff: staff-calendar, Manager: calendar) and actual combobox role/name. A failed selector or wrong test route is not an application defect; inspect trace/page/API evidence before widening permissions. Raw failed runs remain failed. Read latest owner-repair entry for323e0f64 acceptance and private commands; frozen final182 replay/release is still pending.


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
- Under the same Node 22 package-scoped runtime, `npm audit --omit=dev --audit-level=high` and the full `npm audit --audit-level=high` both exited 0 with `found 0 vulnerabilities` for the locked dependency graph.
- GitHub reports a successful Vercel status for documentation checkpoint `a5fb9991b3c8eff9cd5af08107bbce3d9a963d98`, but the connected Vercel account returned 403 when listing deployments and has no local CLI credential. A green commit status is not authenticated functional, visual or production acceptance; do not infer a deployable GO from it.



## 12 October 2026 — local Supabase Auth/Storage preflight without hosted spend

- The product owner declined creating or modifying either visible hosted Supabase project and directed verification toward existing free local capabilities. Treat the production CEAC project and the older unrelated project as non-disposable; neither is a fixture.
- The reviewed CLI is available without changing repository dependencies: `npx --yes supabase@2.117.0 --version` returned `2.117.0`, exit 0. In a disposable `/tmp` directory, `supabase init` completed successfully.
- `supabase start` then exited 1 with `LegacyDockerLifecycleInspectError`: Docker was not found and Podman was not found. This sandbox cannot presently run the local GoTrue/Storage/PostgREST stack. Do not reinterpret CLI availability as a working local Supabase runtime.
- The ordinary apt sandbox user also failed because this execution environment forbids the required setgroups/setuid transitions. Running apt metadata refresh as root bypassed that specific apt-user error but did not establish a container engine; do not cycle package-provider experiments or assume nested-container privileges.
- The authenticated Supabase dashboard fallback reached only the sign-in page and made no account, project, branch, billing or production change. The official public branch rate observed was $0.01344 per branch-hour, but the owner explicitly chose the local-first path. No paid branch is approved.
- Local Auth, TOTP, Storage and invitation-token acceptance remain feasible only in a supported disposable host that has Docker or Podman plus the pinned CLI. Real outbound email delivery, real-user authenticator enrolment/AAL2 acceptance and production Auth/Storage-aware backup restoration remain separate hosted/private-human gates; local simulations cannot certify them.


## 12 October 2026 — Support revocation reason audit repair

Independent source review found that migration 136 correctly wrote the new membership `end_reason` to immutable membership history, but the automatic Support capability-revocation note still copied `NEW.reason`, the original joining reason. This could leave two audit trails describing different decisions.

Repair rule:
- preserve committed migration identities; add forward migration `20261012041000_139_support_revocation_end_reason.sql`;
- replace only `support_membership_history_guard()` so future Support grant revocations use the separately attributable `NEW.end_reason`;
- assert both the final trigger definition and the persisted grant `revoke_reason` in the existing rollback-only membership gate.

Actual Node 22 evidence after the repair: focused contracts 19/19, exit 0; complete `npm run verify:source` 176/176, exit 0; production build exit 0. Candidate inventory is now 143 unique migration files. The affected PostgreSQL replay/gate is NOT RUN in this refreshed shell because no PostgreSQL/container runtime is present; do not promote the source pass to database acceptance.


## 12 October 2026 — Chat follow-on PR #52 (privacy-safe private file UI / Support approval retry)

- **Live reconciliation first:** PR #50 was re-fetched at `37a44ad3f7eacb29e9dee843010627ac814e5666`; PR #51 is **already merged** into PR #50 (12 October 2026). Do not reopen, replay or reset PR #51. Created independent writer branch `chatgpt/pr50-chat-defect-hardening-20261012`, draft PR #52 targeting the established PR #50 branch. No writes to canonical PR #50, production main, Supabase or Vercel.
- **Confirmed existing source risks:** `OperationalFileList` used a single unversioned `load()` callback. An older private document list could settle after a context switch; signed-URL fetches had no scope recheck before launching a new tab; uploads could race. The Support business-decision panel fetched only on mount/account change and offered no retry after a failed fetch, making a valid pending decision unreachable until navigation.
- **Implementation:** `src/components/OperationalFiles.jsx` now distinguishes the currently verified record context at render time, drops stale list/signed-URL/write completions, synchronously locks concurrent upload attempts and provides an explicit retry for failed private-file list reads. It does not weaken server-side operational context RLS or private Storage URL rules.
- **Implementation:** `src/components/SupportAccessApprovals.jsx` now supports scoped refresh/retry, handles unexpected read exceptions, distinguishes a failed read from an empty authorised list, limits decisions to an actually loaded pending request, preserves optimistic version-match update and does not imply actual account changes.
- **Tests:** `tests/private-context-and-support-approval-safety.test.mjs` registered in the existing `npm run verify:source` command. Five exact GitHub-source test callback bodies executed in restricted V8 with `node:test` / `node:assert` / `node:fs` stand-ins: **5/5 pass, 36 checks**, at `9c997ae774f5ed85fcaee7fc16d79230007c9539`. This is a **source contract** check, not native Node, JSX compilation, React integration, authenticated browser or database testing.
- **Unchanged and not reaccepted:** 143 migration versions including pending 139 and 56 registered SQL gates from PR #50 remain untouched by this PR. PR #50's earlier genuine 176/176 Node 22 source pass, build and earlier 142/142+56/56 SQL evidence belong to earlier application SHAs and do **not** certify this child head. Native `npm run verify:source`, `npm run build` and signed-file/role-browser switching are **NOT RUN** for PR #52.
- **Safe integration rule:** Work should review PR #52 against *current* PR #50 HEAD, reconcile any subsequent non-conflicting commits, run native Node 22 + application build and browser scope-switch tests, then integrate only if passing. Never accept the new tests merely because their static assertions passed. Keep GO/NO-GO closed until integrated release, MFA, Auth/Storage, encrypted backup/restore, literal visual and owner approval.


## 12 October 2026 — PR #52 follow-on review: media signed URL and business authority scope

The same independent branch and draft PR #52 remain **NO-GO** and target unchanged PR #50 base `37a44ad3f7eacb29e9dee843010627ac814e5666`. Additional source fixes on `src/components/OperationalFiles.jsx` make `OperationalMediaList` derive its verified signed URL set from `file.id + storage bucket + storage path` rather than ID alone. It suppresses old image/audio/video signed URLs while a new set loads, discards late signing results, makes pending media non-actionable with a truthful loading label, catches URL failures and offers Retry. A new short-lived signed URL opened through a fallback file action is rechecked against the current media key before launching a tab.

In `src/components/SupportAccessApprovals.jsx`, the scope key now includes the refreshed logged-in profile's current unit, all current unit-role memberships and currently issued capability grants (including scope and expiry). Thus an already displayed business approval queue is withheld and refreshed after same-user role changes, transfers or capability changes, not only sign-out. Existing DB RLS, scope-limited manager approval and trusted actor / optimistic version update remain untouched. An external server-side revocation not yet reflected in the client still requires server RLS denial and a fresh identity/queue read; source-only checks never prove real-time revocation.

**Latest source check:** At exact GitHub source commit `5cbf7f89c53baba4399f57043d4e3cde8b65d785`, the seven `tests/private-context-and-support-approval-safety.test.mjs` JS callback bodies executed against the returned private blobs in restricted V8 using Node built-in stand-ins: **7/7 passed, 58 static assertions**. This was **NOT** native `node --test`, JSX compilation, React browser behavior, Storage access, or SQL testing. No migration version or SQL gate changed: same 143 unique versions and 56 gate registrations on the branch.

**Work integration tests:** Node 22 exact-sha `npm ci`, `npm run verify:source` and `npm run build`; real authenticated private-file context switching with network reads and signed media URL requests deliberately delayed; same-account Manager transfer/capability revocation in the Support approver inbox; actual RLS denial and no old approval/title/media rendering. Preserve pending review and release NO-GO; no production changes. Do not claim a green standalone V8 callback as native test acceptance.


## 12 October 2026 — frozen PR #52 integration and final local SQL procedure

- Normal PR integration produced frozen application/security SHA `51223157f28e16e90acda6a35dd71389513b6d6f`; preserve that SHA when later documentation-only evidence commits advance PR #50.
- Package-scoped Node `v22.12.0` remains the accepted Work runtime. At the frozen SHA, clean install, all 184 registered source tests and production build exited 0.
- The prior private PostgreSQL 16.15 prefix, root-identity compatibility shim and synthetic Supabase bootstrap are reusable when the sandbox maps only uid/gid 0. Before execution, inspect the runner's targets: it may drop only the named disposable `ceac_replay` database on loopback port 55432 and must never inherit a live connection variable. Start with TCP only, `timezone=Africa/Accra`, database role `postgres`, synthetic Auth/Storage/Vault compatibility, and `ON_ERROR_STOP=1`; write each applied version to `supabase_migrations.schema_migrations`.
- Acceptance requires four matching counts and exit 0: migration files, unique timestamp versions, migration-ledger rows and successfully applied migrations. The frozen tree produced 143/143/143/143, migration 139 exactly once, then 56/56 registered SQL gates with aggregate exit 0.
- If system packages must be refreshed, this sandbox can download apt packages only when the archive cache is redirected to a writable task-specific directory and `APT::Sandbox::User=root` is used. PostgreSQL package post-install configuration still fails because group/user switching is outside the uid/gid map. Do not treat partially configured packages as proof and do not weaken PostgreSQL's root guard; reuse the previously reviewed local prefix/shim boundary instead.
- `playwright test --list` is safe fixture-independent discovery and returned 741 tests/77 files. Do not run the entire authenticated suite with missing role fixture variables: many older specs call `fill(password)` without a fixture guard. Such failures prove missing harness inputs, not role acceptance. Run only the reviewed credential-independent selection until an isolated Auth/Storage fixture supplies the documented role variables, then run all registered shards.


## Local Supabase on constrained GitHub Codespaces (verified 12 October 2026)

Use the existing CEAC Codespace only after verifying the billing page reports USD 0 billable usage and included allowance. Pin Node and CLI versions; do not rely on the image defaults:

- Node: `npx -p node@22.12.0 node --version`
- Supabase CLI: `npx --yes supabase@2.117.0 --version`
- When Public ECR returns `Rate exceeded`, set `SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io` to use the CLI-supported official GitHub Container Registry mirror.

A two-core runner is insufficient for this repository's full local Supabase bootstrap. The database can be warmed to a healthy state, but concurrent Auth, Storage and REST startup produced PostgreSQL connection timeouts and unhealthy containers. Do not loop the same bootstrap or weaken health checks. Move to an already authorised private runner with at least 4 vCPU / 8 GB RAM, after confirming a hard zero-spend control or included allowance. Generated local keys and service logs remain private; record only sanitised exit codes and health outcomes.


## Four-core Codespace result (verified 12 October 2026)

The existing CEAC Codespace can be resized safely only when the personal account shows a USD 0 Codespaces budget with `Stop usage: Yes`. The verified 4-core option provides 16 GB RAM and 32 GB storage.

Do not assume more Codespace capacity fixes the local Supabase issue. On 4 cores / 16 GB, PostgreSQL and Kong reached healthy state with low resource use, while Auth and Storage repeatedly timed out against PostgreSQL. Excluding Realtime produced the same failure. Stop after these two bounded attempts; do not resize further or loop the CLI. Continue Git-ancestry resilience checks independently and use a verified disposable Supabase project for Auth/Storage acceptance if the owner authorises one.
