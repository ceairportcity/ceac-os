# CEAC Live Handover

### Complete isolated SQL acceptance — 11 October 2026

- Execution source: application/security tree at `91c2bba2b854b71d49749a62b350d96b647f112a`; documentation-only checkpoint `f55af7d043dcb72cec1f376fc2c83a27dd6f752b`.
- Environment: private Work filesystem, PostgreSQL 16.15 on loopback, `timezone=Africa/Accra`, migrations owned by role `postgres`, synthetic CEAC role fixtures only. No production connection or data.
- Ordered replay: 136/136 migration files, lexical order, `ON_ERROR_STOP=1`, exit 0.
- Registered suite: every one of the 52 files in `scripts/ci/run-sql-security-gates.sh` passed; aggregate runner exit 0.
- Covered runtime gates include RLS smoke, exact SECURITY DEFINER surface, privileged MFA/AAL2, report draft/evidence/row tenant integrity, budget tenant boundaries, HR/payroll, capability/JML, invitations, workforce/attendance, Finance, integrations, Technical Support dependencies and production hardening.
- Fixture fidelity corrections required for the managed Supabase analogue: postgres object ownership/default ACLs, migration-history rows, Ghana timezone, Auth MFA table shape, and service-role-only Vault access. These are isolated runner scaffolding, not production migrations.
- Release remains NO-GO: authenticated application journeys, managed backup/restore, genuine real-user MFA/invitation delivery, literal visual approval and independent final review remain open.


## 2026-10-11 18:00 UTC — Technical Support bounded backend promoted and executed

- Starting branch/head: `chatgpt/unified-release-candidate-20261011` at `f865c51a73d4a05c45c6ecf0cb5a914148e6a9c0`.
- Added forward candidate migration `20261011130000_133_technical_support_v1_backend.sql`; no historical migration was edited and production was not changed.
- The migration promotes the reviewed bounded case-management proposal: six support-only capability definitions, dedicated membership, reporter-safe cases, support-only append history, tenant RLS and trigger-only guards.
- Database hardening added during promotion:
  - ordinary support members may claim only for themselves, work only their current assignment and release only to the queue;
  - Support Leads retain the attributable reassignment path;
  - access-request cases cannot be resolved or closed while the separately required business-approval/execution ledger is absent;
  - case source facts, server timestamps and event history remain immutable to browser roles.
- Added and registered `supabase/tests/technical_support_v1_gate.sql`. It executes authenticated behavioral probes for reporter isolation, membership-without-capability denial, member/lead assignment boundaries, cross-tenant isolation, immutable facts/history and fail-closed access completion.
- Updated the capability catalogue gate from 17 to 23 expected definitions. The authenticated SECURITY DEFINER allowlist remains exactly 135 because all three new support guards are trigger-only and have no browser EXECUTE grant.
- Actual verification against the reconstructed private source:
  - `npm run verify:source`: exit 0, 160/160.
  - disposable PostgreSQL 16 full ordered replay: exit 0, 137/137 migration files.
  - `scripts/ci/run-sql-security-gates.sh` registered suite: 53/53 passed, aggregate exit 0.
- Execution environment: the documented local PostgreSQL 16 TCP-only runner, Africa/Accra timezone, synthetic fixtures, no live secrets. Logs remained in the private scratch environment.
- The Supabase CLI binary remains unavailable in this Work runtime. The forward-only timestamp/version was assigned only after confirming the exact 136-file predecessor inventory. This candidate must still receive normal review before any production migration approval.
- Technical Support is now database-backed for bounded case submission, queue access, assignment, status and audit history. It deliberately remains fail-closed for access execution, live service-health claims, support file evidence and membership lifecycle UI until their separately approved authority paths and tests exist.
- Production GitHub main, Vercel and Supabase remain unchanged.

Next immediately executable work: publish this isolated candidate checkpoint, rerun the application build/browser-independent Playwright contracts at its exact commit, then continue the separately contracted support membership lifecycle and business-approval/action ledger rather than weakening the new fail-closed boundary.

## 2026-10-11 19:10 UTC — Browser discovery and credential-independent execution

- Published Technical Support checkpoint: `432ee6410912b05b60306a5aba9984837fc1d126` on PR #50 by normal expected-head fast-forward.
- Repaired `notification-work-state-phase4.spec.js` so it creates a service-role client only when all isolated fixture variables exist and otherwise marks its credentialed tests skipped. Before this repair, `npx playwright test --list` crashed at module import with `supabaseUrl is required`.
- `npx playwright test --list`: exit 0, 741 tests discovered across 77 files.
- Credential-independent Playwright source/UI contracts: 63/63 passed, exit 0.
- Real Chromium signed-out application/PWA smoke at 1366×768 and 390×844: 3/3 passed, exit 0; production Supabase requests were intercepted and no credential was used.
- Resilience/PWA execution: R1 manifest, R1/R2 service-worker cache boundary and offline shell passed 3/3. R3 then stopped correctly because this reconstructed source tree has no `.git` ancestry; two later serial cases did not run. This is not accepted recovery evidence.
- A first all-file attempt used Vite and Playwright in separate Work execution sessions and produced loopback `ERR_CONNECTION_REFUSED`; that run is invalid application evidence. Work sessions share files/process visibility but not necessarily loopback networking. The canonical playbook now requires server startup, readiness polling, Playwright and cleanup in one bounded execution.
- No authenticated role fixture password, service-role key or private test Supabase endpoint is present in this runtime. The remaining credentialed browser cases were not represented as passed.
- Production remains unchanged and PR #50 remains draft/NO-GO.

Next immediately executable work: commit the collection/playbook repair, then either obtain a genuine private Git checkout/isolated role-fixture environment or continue source/database implementation work that does not require owner credentials.

## 2026-10-11 19:25 UTC — Stale Playwright source contracts reconciled

- After excluding the invalid cross-session loopback failures, nine credential-independent assertions inside otherwise credentialed Playwright files were stale relative to newer accepted implementation language/composition.
- Reconciled assertions only; application behavior was not changed:
  - Administration `Invitations to review` replaced the superseded `Pending Staff invitations` label;
  - Executive Finance, Reports, Organisation and overview checks now bind to the current equally strict factual/non-performance wording;
  - Personal and Manager leave checks now bind to the confirmed annual/secondary leave language and explicit no-automatic-payroll consequence;
  - the Executive overview visualization contract now binds to the measured-only `strategyProgress` helper, while the shared `DataVizChart` family remains separately covered.
- Focused Playwright source-contract rerun: 9/9 passed, exit 0.
- Latest durable candidate before this test-only checkpoint: `60623d3236331d8bef09e0707dd728669dfa8102`.
- Production remains unchanged; credentialed browser flows still require an isolated test Supabase and private role fixtures.

## 11 October 2026 — Independent Technical Support review repaired

- Independent read-only review of checkpoint `432ee6410912b05b60306a5aba9984837fc1d126` found the bounded backend safely fail-closed but not release-complete. Concrete findings were mutable membership history, assignment to a member without case authority, base-table reporter projection, permissive-policy false-pass risk, and missing cross-tenant Support behavior.
- Published forward-only repair `0bfada37befc0d5c6c0617575aa7c1a29b2ec8c9` on PR #50. Migration `20261011183000_134_technical_support_authority_hardening.sql`:
  - makes Technical Support membership add/end attributable to People Administration, forbids deletion/reactivation/fact rewriting, and records immutable membership events;
  - atomically revokes active `support.*` grants when membership ends without deleting capability history;
  - prevents Support capability self-grant, unit-scoped Support grants, and grants to a person without active Support membership;
  - rejects assignment to a member lacking active, unexpired `support.case.manage` authority;
  - confines reporter and affected-person reads to `support_case_safe_status`, which excludes internal assignment and object identifiers, while the base relation is Support-only.
- The behavioral SQL gate now locks the exact base SELECT policy, checks the safe projection, exercises People membership attribution/history/capability cleanup, denies Lead self-grant, denies assignment to membership-without-power, and checks both reporter and Support cross-tenant isolation.
- Actual private isolated evidence for the repaired tree:
  - `npm run verify:source`: 162/162 passed, exit 0;
  - `npm run build`: exit 0;
  - PostgreSQL 16 ordered replay: 138/138 migration files, exit 0;
  - all 53 registered SQL gates: 53/53 passed, aggregate exit 0.
- A first aggregate attempt printed three failures but returned exit 0 because its local loop ended with `echo`. It was rejected as evidence; the runner was corrected to exit non-zero when `FAIL>0`, defects were repaired, and the complete run above was repeated. The playbook now records this mandatory runner rule.
- No production database, GitHub main, Vercel deployment, real user, Auth factor or Storage object was changed. Access approval/execution, operational support evidence, system telemetry, authenticated role-browser acceptance, genuine backup/restore, real-user MFA/invitation delivery and owner visual acceptance remain open release gates.

Next immediately executable work: implement the separately authorised access approval/action ledger without giving Technical Support business-approval authority, then add its adversarial SQL and application behavior tests. Production remains NO-GO.


## 11 October 2026 — Chat continuation Technical Support access approval and execution (draft PR #51)

- Source reconciliation: private canonical PR #50 initially verified at `de4601bbf8b68666b5fcb0cb3e27ddd7972149c3`; independent branch `chatgpt/pr50-chat-technical-access-ledger-20261011` created with that exact parent. PR #51 targets PR50's existing branch, remains DRAFT/NO-GO. Frozen PR44 `e00f13873409e4cc16ec1493b60b71d5cde1114a` unchanged.
- Completed source implementation: forward-only migration `20261011190000_135_support_access_approval_execution_ledger.sql`, database-enforced one active record per access-help case, monotonic pending → approved/declined → executed, immutable actor and decision history, version-based stale/concurrent write denial, same-org/target checks, approval by actual Unit Manager or People Administration, support-member non-self approval, active assigned technician and `support.access.apply_approved` execution boundary, and evidence-gated access-case closure. Ordinary incidents preserve original flow.
- Purposefully bounded actions: `unit_access_assistance`, `invitation_delivery_assistance`, `account_recovery_assistance`. Business approval record uses server-enforced fixed safe labels. **This ledger records approvals/technical assistance and does not independently create accounts, deliver email, assign business roles, grant capabilities, reset real credentials, or prove downstream service actions.** Existing People/authority APIs remain the only permitted business power source.
- UI implementation: `src/components/SupportAccessApprovals.jsx` embedded in `AdminHome.jsx` (People Administration) and `ManagerHome.jsx` (unit-level Manager); `src/components/SupportAccessCaseActions.jsx` integrated with `TechnicalSupport.jsx`, plus `technicalSupport.js` conditional closure affordance. Frontend uses optimistic version comparisons, loading/scope guards, and literal evidence references; backend remains authoritative.
- SQL regression source: `supabase/tests/support_access_approval_execution_gate.sql` registered in `scripts/ci/run-sql-security-gates.sh`. It contains rolled-back seeded actor checks for nonself approval, actual manager decision, unrelated-unit denial, duplicate request/foreign unit denial, stale version, immutable event history, proper execution, access closure and ordinary technical incident independence.
- Node regression source: `tests/support-access-approval-contract.test.mjs` registered in `package.json`. Chat executed its **five exact GitHub-blob JS test callbacks (5 PASS, 60 assertions)** in an isolated V8 harness substituting restricted `node:test`/`assert`/`readFileSync`. **Not native Node test execution.**
- **Not run:** genuine `npm ci`, full `npm run verify:source`, Vite production build, isolated PostgreSQL replay, SQL security gate execution, authenticated browser roles, invitation email delivery, real privileged MFA/AAL2, encrypted backup and isolated restore, owner literal mockup review, independent release review.
- No Vercel deployment, Supabase production SQL/Auth modification, merge to PR50 or production, paid infrastructure, or TinyFish use. Latest continuation PR commit must be re-fetched after documentation updates; the implementation parent is the exact canonical SHA above.
- **Work handoff:** inspect PR #51 source diff, audit the ledger business authority and resource scope, execute 139 ordered unique migrations and registered SQL suite in an isolated production-free PostgreSQL fixture, rerun real source suite + build + authenticated role journeys, confirm approved access actually has an underlying authorised business operation where applicable, then integrate reviewed changes on a new combined PR50 SHA. Release NO-GO persists.


## 11 October 2026 — PR #51 additional implementation and Work acceptance

Latest source evidence before writing this entry: `c6c9ebc8135b11d900ff8ffd2b03ee3633b08fa7` on `chatgpt/pr50-chat-technical-access-ledger-20261011`, draft PR #51 targeting the existing PR #50 branch. No production, PR #50, PR #44, Supabase, Vercel, CI/billing or TinyFish changes. No historical SQL migration changed.

**Completed new files and UI (second tranche):**
- `supabase/migrations/20261011193000_136_support_membership_end_reason.sql`, `src/components/SupportTeamMemberships.jsx`, `src/components/PeopleAccess.jsx`, `tests/support-membership-lifecycle-contract.test.mjs`, `supabase/tests/support_membership_end_reason_gate.sql`: distinct signed join vs end reasons, People Administration-only Support membership editor and immutable history; original staff role and Support-only grant revocation retained.
- `supabase/migrations/20261011195500_137_support_private_case_evidence.sql`, `supabase/migrations/20261011201000_138_support_evidence_audit_history.sql`, `src/screens/TechnicalSupport.jsx`, `tests/support-private-evidence-contract.test.mjs`, `supabase/tests/support_private_case_evidence_gate.sql`: reviewed Support-only operational private file attachments, cross-context relink denial (including employee documents), storage metadata/secure signed URL through existing `OperationalFileList`; immutable **registration** audit (not successful upload claim).
- `src/lib/technicalSupport.js`, `src/screens/TechnicalSupport.jsx`, `tests/technical-support-v1.test.mjs`: recorded unresolved case counts per exact service, all service health labels stay **Not verified** without provider telemetry.
- Existing `scripts/ci/run-sql-security-gates.sh` now registers **56** gates; `package.json` includes three new Support contracts in the existing suite.

**Checked against latest actual GitHub content:** 142 migrations, 142 unique versions, no duplicate timestamp keys; the original integrated candidate had 138. Before this documentation append, exact revision `c6c9ebc8135b11d900ff8ffd2b03ee3633b08fa7` focused source-contract callbacks executed using verified GitHub source and restricted V8 Node built-in stand-ins: 5 approval + 3 membership + 5 file/evidence + 1 service-case health = **14/14 source callback tests, 138 assertions PASS**, though neither `node --test` nor browser/SQL was executed. This is a source-level preflight only.

**Known limitations to hand to Work:** private Auth/Storage operational file bytes are not in default Supabase dump; new evidence registration events cannot certify physical upload/finalisation; authenticated business decisions and actual Support execution must be verified with real role fixtures; real account role grants/invitations remain under existing business-authority APIs, not this ledger. Exact merged source SHA, role-level application/browser tests, full encrypted/restored DB, MFA AAL2, owner mockup screenshot comparison, independent review and GO/NO-GO remain Work-only and NOT DONE. No new paid provider or user action requested.

**Next developer tasks if source-only capacity remains:** focused security review of the Support ledger's stored status projection and nested file-link ACL, review potentially stale membership/approval snapshots and case concurrency, then finish final PR #51 review comment with native command instructions for Work. Do not weaken legacy 162/138/53 acceptance or declare its results apply to this new SHA.


## 12 October 2026 — Chat continuation integrated and database-accepted on PR #50

- Live reconciliation confirmed production `main` remains `827fbe7391467dd13d6e411527416402a252993c`, PR #50 remained `de4601bbf8b68666b5fcb0cb3e27ddd7972149c3`, and draft PR #51 was a clean, non-divergent 47-commit descendant at `9c1bdf5ae7905288382c292a7e13dc6a518c085b`. No other post-checkpoint continuation PR was identified.
- PR #50 was advanced by normal non-force ancestry to repair commit `ed00759d7b12f7f590ace78dba7ede76a7913f42`, whose parent is the complete PR #51 head. PR #51 itself, frozen PR #44, `main`, Vercel production and Supabase production were not modified.
- Native execution found and repaired continuation integration defects rather than weakening tests: stale source assertions for the executed-ledger closure argument and 142-file inventory; missing membership `end_reason` in the older gate; an authenticated cross-tenant fixture attempting to create an organisation; and a private-evidence gate that directly invoked an internal write helper and tried to read a pending link hidden by valid RLS.
- Final application/security tree `ed00759...` evidence in the private Work shell:
  - `npm ci`: exit 0, with explicit `EBADENGINE` because this runtime supplies Node `v24.19.0` rather than required Node 22;
  - `npm run verify:source`: **176/176 passed**, exit 0;
  - `npm run build`: exit 0;
  - PostgreSQL 16 clean ordered replay: **142/142 migration files applied**, exit 0;
  - all registered SQL/RLS/security gates: **56/56 passed**, aggregate exit 0.
- Database acceptance used only synthetic fixtures in a disposable loopback cluster. No production database, real Auth factor, real invitation, protected employee record or Storage object was touched. The Node source/build evidence must still be repeated in Node 22 against the final SHA.
- Release remains **NO-GO**. Open mandatory gates: genuine Git checkout/ancestry-bound resilience run, Node 22 final suite, authenticated multi-role Supabase/browser fixtures, actual Support upload/finalisation/download, literal desktop/mobile reference comparison and owner acceptance, encrypted production backup plus genuine separate restore including managed Auth/Storage, real-user MFA/AAL2/invitation/recovery acceptance, independent final review and explicit owner production authorisation.

Next immediately executable action: run credential-independent Playwright and ancestry/resilience checks against `ed00759...`, inspect the available secure fixture/runtime paths without exposing secrets, and prepare the isolated authenticated test environment. Do not deploy or apply migrations to production.

## 12 October 2026 — credential-independent browser gate and environment boundary

- Canonical PR #50 documentation HEAD entering this checkpoint was `c52f85d6e897a2cee153263f0a6145ae5c61ce73`; application/security tree remains `ed00759d7b12f7f590ace78dba7ede76a7913f42`.
- After installing the matching Playwright Chromium `1194` bundle, the signed-out laptop/phone/PWA smoke suite passed **3/3**, exit 0. The complete credential-independent Playwright subset then passed **68/68**, exit 0.
- The resilience suite passed manifest, service-worker and offline-shell checks, then failed R3 exactly because `git rev-parse HEAD` returned 128 in the reconstructed source directory; aggregate suite exit 1, with two later serial checks not run. This is an environment failure and remains an open gate, not an application pass.
- Verification of the canonical recursive tree showed this reconstruction is not a genuine checkout: 317 tracked documentation/reference files are absent and `AGENTS.md` differs. No synthetic repository metadata was created.
- Vercel lists only stopped historical Node 22 sandboxes for the CEAC project. The billing-charge endpoint returned `404 costs_not_found`, so zero-charge capacity was not proven and no sandbox was resumed or created. Supabase lists zero development branches, and no isolated fixture credentials are present in the Work environment.
- Production `main`, production Supabase, Vercel production and MFA enforcement remain untouched. Release status remains **NO-GO**.

Next immediately executable action: complete remaining read-only source/security review and preserve evidence; then obtain one approved isolated-runtime path: either a genuine private checkout with Node 22 at confirmed no cost, or explicit cost confirmation for an isolated Supabase branch. Authenticated fixtures, real Support file lifecycle, restore, real-user MFA/invitation/recovery, literal visual acceptance, independent final review and production authorisation remain mandatory.

## 12 October 2026 — Node 22 gate completed without external compute

- A package-scoped Node `v22.12.0` runtime was established in the Work shell using `npx --yes -p node@22.12.0`; no repository dependency or production configuration changed.
- Against application/security tree `ed00759d7b12f7f590ace78dba7ede76a7913f42`: clean `npm ci` exit 0; `npm run verify:source` **176/176**, exit 0; `npm run build` exit 0; credential-independent Playwright **68/68**, exit 0.
- The Node 22 resilience subset passed manifest, service-worker and offline-shell checks, then failed standby R4 at the same truthful missing-Git boundary. Genuine checkout/recovery bundle remains open.
- GitHub HTTPS and the Work Git proxy do not provide this shell with a scoped private credential. Vercel was not resumed because zero-cost capacity is unproven. Production still has 119 migrations; candidate versions are unapplied and the known pre-candidate SECURITY DEFINER advisory surface remains live.
- Release remains **NO-GO**. The Node 22 source/build/credential-independent-browser sub-gates are now complete; authenticated isolated acceptance, complete ancestry-bound resilience, restore, MFA/invitation/recovery, visuals, independent review and owner-authorised release remain open.
- Node 22 dependency audit also passed for production-only and complete locked graphs: both commands exited 0 with zero reported vulnerabilities.
- GitHub's Vercel status is green for the documentation checkpoint, but direct deployment listing is forbidden to the connector and no Vercel CLI credential exists in this Work shell. Preview status was not promoted to acceptance.



## 12 October 2026 — owner-directed local-first continuation

- PR #50 live HEAD rechecked through the CEAC GitHub connection: `2b04225962d7a19e35559e0cefbfb4bfcd73170e`; application/security tree remains `ed00759d7b12f7f590ace78dba7ede76a7913f42`. Production `main` was not modified.
- A clean HTTPS clone was attempted and failed before transfer because this shell has no scoped private GitHub credential: `could not read Username for 'https://github.com'`, exit 128. The unrelated local Git history was rejected as a source for PR #50.
- Pinned local Supabase CLI preflight: version command exit 0 at `2.117.0`; disposable `supabase init` succeeded; `supabase start` exit 1 because neither Docker nor Podman exists. No hosted Supabase project, production record, credential or paid branch was touched.
- Owner decision: do not purchase/create a hosted fixture and do not modify either connected project. Continue independent implementation/source/security work and use the documented PostgreSQL-only runner for database gates. Local Auth/Storage/browser acceptance remains blocked in this particular sandbox until an existing no-cost disposable host supplies a container engine.
- Hosted/private-human-only gates remain explicit: real outbound invitation delivery; real-user privileged MFA/AAL2 and recovery; encrypted production backup plus separate managed Auth/Storage-aware restore; owner literal visual acceptance; and production authorisation. None is passed by local simulation.

Next immediately executable action: finish source/security review and any repairs on PR #50, rerun affected Node/PostgreSQL/browser gates only when code changes, and use a genuine private checkout plus Docker/Podman when an already-authorised free environment becomes available. Release remains NO-GO.


## 12 October 2026 — forward audit repair checkpoint

- Independent review found mismatched reason provenance when a Technical Support membership ended: immutable membership history used the new end reason, while automatic Support capability revocations reused the original joining reason.
- Added forward-only migration `20261012041000_139_support_revocation_end_reason.sql`; no prior migration was edited. The existing rollback SQL gate now requires the exact end reason on the revoked capability grant.
- Exact source/build evidence in Node `v22.12.0`: focused contracts 19/19, exit 0; full source suite 176/176, exit 0; production build exit 0.
- Current migration inventory: 143 files/unique timestamp versions. PostgreSQL replay and the affected SQL gate are NOT RUN for this new migration in the refreshed shell because local Supabase start has no Docker/Podman and the prior standalone PostgreSQL binaries are absent.
- Production GitHub main, Supabase, Vercel, Auth, Storage and real users remain unchanged. Release remains NO-GO.

Next immediately executable action: obtain the already-approved disposable PostgreSQL capability, replay all 143 migrations and rerun all registered SQL gates; then continue authenticated local Supabase browser acceptance when an existing no-cost Docker/Podman host is available.
