# Live audit: browser privileges and Content Security Policy

The owner directed continuing to the next audit fixes after PR136/PR137 were released. Base protected main is `a2deff4a0d26d1a78d92ce0919c5def793386178`. This bounded batch addresses the original audit's unnecessary browser-role TRUNCATE grants and missing CSP. Preserve all completed query, identity, leave, reporting, archive and schedule fixes. No new product design, account, provider, MFA, payroll or department decision is introduced.

## Confirmed live findings and authority

Fresh catalogue inspection found TRUNCATE on 65 public tables for `anon`, 129 for `authenticated`, and 202 for `service_role`. TRUNCATE bypasses RLS, and browser application flows have no legitimate use for it. This finding establishes an unnecessary privilege, not an observed remotely callable truncation route or exploitation. No truncation was attempted on production.

The public table defaults for both `postgres` and provider-owned `supabase_admin` include the same privilege. The application connection is `postgres` and is not a member of `supabase_admin`. The migration changes existing public-table grants and future application-owned (`postgres`) public-table defaults. It deliberately does not impersonate or alter provider-owned default privileges. Future provider-created objects need separate provider-authorised review; universal prevention across every provider owner is not claimed.

A fresh public HTTP response had no Content-Security-Policy or Reporting-Endpoints header. Source inspection found only first-party application scripts, Google Fonts, CEAC's production/staging Supabase endpoints, uploaded image/media resources and the existing Google/OpenStreetMap map embeds. Existing geolocation/microphone, approved map consent, private file access and trusted service behaviour must remain intact.

## Implemented database fix

`20261024100121_browser_truncate_privilege_hardening.sql` revokes only TRUNCATE from PUBLIC, anon and authenticated on public tables, and from the `postgres` public-table defaults. It changes no source row, RLS policy, RPC, role membership, ordinary row privilege or service grant.

The new rollback-only `browser_truncate_privilege_gate.sql` is registered in the existing cumulative runner (80 gates). It checks existing public grants, creates one synthetic table to test future defaults, requires actual anonymous/authenticated truncation denial with the fixture row retained, exercises ordinary row operations, and confirms trusted-service truncation on that disposable fixture only. All fixture mutations roll back. Migration inventory explicitly adds this one file: 204 = 153 original plus 51 reviewed additions; no ceiling or old assertion is weakened.

The new gate fails against the unchanged isolated staging grants. The exact candidate plus the full gate passes inside a rolled-back transaction. A pre/post matrix in that same transaction proved all non-TRUNCATE browser privileges and all audited service privileges unchanged. The migration was subsequently installed once in isolated staging. Independent installed-state readback shows browser counts 0/0 and service count 202. Two redundant post-install fixture executions returned the connector's expired-request-state transport error and are not claimed executed; the complete native CI gate remains required.

## Implemented browser fix

The hosting CSP blocks unknown scripts, eval, inline script handlers, objects, base-tag hijacking and embedding the application. It permits the existing styles/fonts, private media, explicit CEAC Supabase HTTP/WebSocket endpoints, workers, manifest and map frames. Inline styles remain necessary for the existing React/Motion layout; inline JavaScript is not generally allowed. Existing security headers are retained.

The static build cannot supply a fresh response nonce. Every build therefore seals each emitted entry with SHA-384 SRI and replaces its parser-inserted module tag with one fixed, hash-authorised classic bootstrap. That bootstrap obtains its own `document.currentScript` metadata, creates a non-parser-inserted module with the pinned integrity value, and loads the existing application. The fixed bootstrap hash is tested against the hosting header. `strict-dynamic` authorises its module graph; no script host wildcard or unsafe-inline/eval escape is added. Initial module-preload hints are disabled because parser-inserted preloads do not inherit this trust; native on-demand imports and existing chunk splits remain. This can alter request timing, not layout or application scope.

The initial attempt to hash only the parser-inserted external module failed the real built-app browser check: its imported/PWA modules were blocked. Disabling preloads alone did not fix inherited parser metadata. The fixed trusted bootstrap resolves that concrete failure without loosening the negative script tests. A subsequent selector failure was traced to the genuine production login's labels, rather than the development-only placeholders; the test now uses the observed production controls.

The CSP diagnostics receiver is same-origin `/api/csp-report`, excluded from the SPA rewrite. It uses the standard Web Request/Response handler, bounded 16 KiB stream parsing, method/content-type and cross-site checks, and at most ten reports per batch. It logs only fixed allowlisted directive names and aggregate counts. URLs, queries, samples, identities, headers and raw bodies are never forwarded or logged by its code. It returns no report contents and has no credentials, database access or business action. Both Reporting API and legacy CSP reporting formats are supported. Report delivery is best-effort browser diagnostics, not a completeness or security score.

Trusted Types, new authentication rules, provider changes, generic telemetry and stronger cross-origin isolation are outside this bounded fix and are not silently enabled.

## Verification and release continuation

Native Node22.16: all 616 source tests and the production build pass after a clean locked install. Six new native tests cover report privacy/bounds, fixed bootstrap/entry integrity, repeat sealing and hosting policy. Local real Chromium tests pass the attack probes, altered-byte rejection and actual built login. Four genuine fixture-role cases are explicitly skipped locally without an isolated Auth backend, and must execute in the existing CI environment; skipped coverage is not PASS.

The CSP browser tests serve the actual built output and exact hosting policy. For the four role cases, the existing disposable local Auth/RLS backend is exposed through a test-only same-origin transport; the test refuses non-local backend URLs. No synthetic claims, token or fixture request is sent to production. Existing role, geometry, approved visual, source, replay and security assertions remain required. No parallel replacement QA harness, retry or status bypass is introduced.

Freeze one integrated candidate and record the exact SHA/tree and commands/results in its PR/checkpoint. Complete all required exact-head CI, migration replay, account security, all 80 SQL gates, eight browser groups and final evidence/role aggregates. Inspect the deliberate existing-project preview, its CSP/SRI, genuine login and safe diagnostic endpoint. Before production, capture/compare source/setup hashes and ordinary privilege matrices, then apply the tested grant migration once and deploy through the existing project. Verify zero browser TRUNCATE, unchanged ordinary/service access and records, real HR navigation, CSP delivery and diagnostics. Do not report completion until actual release checks succeed.

## Preserved prior results and remaining facts

PR136 and PR137 are already live: 15 reviewed content roots archived, all three Administration tool routes discoverable, day-type reset fixed, 17 saved standard weeks, and roster-only attendance displays corrected. Original protected source hashes and the five day types/seventeen schedules were verified unchanged; accounts/profiles remain 17 each, operational archive events 26 and finance events eight. Employment start dates remain October7; schedule versions start October24. Do not repeat these writes.

Three Strategy archives still require an existing Strategy-authorised actor. The actual quarterly event date/deadline, Gabriel Rockson's flexible daily hours and seven deferred identity/account-dependent appointments remain unresolved. Do not invent them, infer identity from names, expand grants or re-ask answered policy questions. These are distinct from the two hardening fixes in this batch.
