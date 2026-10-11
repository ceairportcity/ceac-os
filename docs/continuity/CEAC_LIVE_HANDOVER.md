undefined

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
