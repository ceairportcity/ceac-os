# CEAC product engineering: Administration attendance and access accuracy — 11 October 2026

Status: PRODUCT CHANGE SUBMITTED FOR INDEPENDENT RELEASE REVIEW. No production modifications, deployment authorisation or Level C acceptance.

Canonical repository: `ceairportcity/ceac-os` (PRIVATE).
Isolated branch: `chatgpt/product-admin-attendance-integrity-20261011`.
Frozen review ancestor: PR #44 `e00f13873409e4cc16ec1493b60b71d5cde1114a`.
Last application/source commit before this checkpoint: `a6de862d1695193488019b7fab352e17a886354a`.

## Cause and corrected behaviour

1. `AdminHome` formerly counted open work-session **rows**, not unique people. Multiple open rows for one person could inflate "Working now"; an overnight open session was not represented as working if it began before midnight. The dashboard now queries currently open work sessions and deduplicates them against active account profiles, while retaining today's independent session/leave context.
2. The previous day boundary used the browser's local timezone even though Administration reporting dates are in Africa/Accra. The UTC calendar boundary now follows Ghana time year-round; the today query has an explicit exclusive next-day upper bound.
3. The "People on record" metric was actually counting active login profiles. It now says "Active accounts" and explicitly distinguishes this subset from the separate employee roster, which remains authoritative for HR and Payroll.
4. An accepted Auth OTP request was presented as confirmed invitation delivery. Copy now says "Activation email requested"; pending invitation copy does not assert successful delivery without independent mail evidence.
5. If invitation cancellation failed, the modal previously closed and discarded the reason. It now stays open until the server action succeeds. A successful server write followed by a failed refresh is reported as recorded but not freshly displayed, so operators are not encouraged to repeat a possibly successful write.

## Protected boundaries

- No change to DB schema, RLS, RPC definitions, Auth policy, confidential HR, payroll authority or employee identity.
- No change to `main`, PR #44 candidate branch, existing Vercel production configuration, domains or Supabase production data.
- These dashboard account metrics do NOT replace the 18-row employee roster.
- Lack of a work session still means neither absence nor payroll deduction.
- No invented meeting, attendance, employee or payroll records.

## Files

- `src/lib/adminTodaySummary.js` (new pure summariser)
- `tests/admin-today-summary.test.mjs` (five deterministic regression tests)
- `src/screens/AdminHome.jsx`
- `src/experience-v2/admin-overview/AdminOverviewV2.jsx`
- `src/components/PeopleAccess.jsx`
- `package.json` (new regression test included in `verify:source`)

## Evidence available in this product session

- Executed Node 22 isolated helper suite: **5 passed / 0 failed**. Local files and committed GitHub helper/test files match by exact git blob SHA:
  - helper `5c85c8fb6967eca394f7c32669a7cd43b0b8eec1`;
  - test `9b1870eb54eca7e5ca401e9d5e4435780ea1eeb3`.
- Supabase information_schema **read-only** confirms `public.work_sessions` has UUID `profile_id`, non-null timestamptz `started_at` and nullable timestamptz `ended_at` in the existing database.
- These are NOT an exact-head clean checkout build, browser test, migration replay, employee privacy test or visual parity acceptance.

## Independent tests still required

- `npm ci && npm run verify:source && npm run build` at final exact PR head.
- Signed-in Administration at 1366 and 390; count unique people with duplicate and overnight fixture rows; verify active-account metric is not mistaken for full roster.
- Actual People & Access invite, resend and cancellation success and failure pathways; verify external delivery rather than inferring it from accepted API response.
- Full 44-case functional, 31 visual, role/tenant SQL security and protected-HR/payroll tests.
- Compare the material Administration design with the actual owner-approved full-resolution reference. Owner visual sign-off is NOT on record.

## Release integration handover

This product branch should become a draft PR targeting PR #44's **current branch** for independent review only. Keep PR #44 frozen until release owners independently accept and incorporate reviewed product changes. Do not merge to `main`, run migrations or deploy production based on this checkpoint.

The deliberate `[vercel]` checkpoint is for a single existing-project PREVIEW source/build validation, not live product visual acceptance or a production cutover.


## Product continuation — self-service Technical Support (following the original Administration fix)

Application HEAD before preview checkpoint: `50b2af38bd108a2cfe4b497574deca685c15844b`.

- Reporters can now open their own submitted support requests to see authoritative case status, original description, and Technical Support's recorded response. Request reads remain explicitly scoped to `reported_by = me.id` AND `org_id = me.org_id`; direct internal `support_case_events` access is not exposed.
- Reporters can retry failed request-history loads. A role change clears the previous account's selected request and list.
- Help Desk search now filters the at-most-150 recently loaded, RLS-authorised cases by reference, summary, category, and case status. The UI truthfully describes that bound rather than implying global full-text search.
- Support case list refresh rechecks current active Technical Support membership before returning queue data. Previously selected case data is cleared before this check; membership or case fetch failure leaves no old queue visible.
- One deterministic helper test was added to `tests/technical-support-v1.test.mjs` covering search, category, status, order preservation and empty input. Two new source assertions were added for reporter scoping and bounded search.
- Existing backend SQL remains under `supabase/proposals/` and has NOT been deployed; no role or support case database record was created or altered by this product effort.

**Release status:** still NO-GO. Authenticated role/browser/SQL tests and owner design acceptance are outstanding. A deliberate single existing-project Vercel PREVIEW is requested by this documentation commit to exercise `verify:source` plus Vite build at the exact new head; Vercel READY must not be mistaken for complete approval.


## Further completion — support ownership and validated preview

- The Technical Support case-details panel can now **take an unassigned case** using the active support member's own verified profile ID, a conditional `assigned_to IS NULL` update and the existing support-only RLS/trigger membership checks. An already assigned case cannot be silently seized, and a concurrent assignment leaves an explicit refresh instruction instead of false success.
- Case assignments have an explicit "Unassigned / Assigned to you / Assigned to another support member" status. The same support-case audit trigger proposal records assignment history once deployed.
- Support role/account switches clear formerly loaded support case records before new authority verification; reporter and manager refresh actions similarly clear old record state on failure.
- Source contract regression added for assignment concurrency/authority restrictions.
- **Existing-project preview:** `dpl_Cicqz7Nh9JVjPyAULeUQ7c9miSox`, source `694fb51cb310cfe69ad849452af8cd95bf993719` reported Vercel **READY**, and GitHub Vercel status **success**. `vercel.json` requires `npm run verify:source && npm run build`. This does not prove authenticated support roles or database migrations.
- Application head for this checkpoint: `fa4494ee17241b57799918b6fe3c3dc9e398d383`. A new preview will verify source and Vite compilation at the latest head.

**Still not deployed:** proposed Technical Support database tables, transition RPCs, protected-file evidence, provider-backed health, human approvals and exact owner visual parity. The unrelated release team must independently validate/approve these before production.


## Continued product work — Administration team placement accuracy

Application HEAD immediately before this checkpoint: `84299552924dcf70ddda6be8870b7e3444fa8635`.

- People & Access now retrieves actual current team-placement records through `sub_team_members`; the existing Supabase catalog verified the table contains `sub_team_id` and `profile_id`, and its current SELECT policy scopes through visible `sub_teams`.
- The current team placements are shown for the selected person, with the related unit context, and no missing association is invented.
- Selecting a person with one existing active unit membership preselects that known unit; someone with multiple memberships must still explicitly choose the relevant unit.
- `Add to team` is unavailable for a selected lane already joined; `Remove from team` is unavailable for a lane not joined. The existing audited `admin_set_work_lane_membership` RPC remains authoritative for both actions. No direct browser modification to `sub_team_members` was introduced.

## Executed verification and external limits

- Fresh isolated Node 22.16.0 execution of **nine exact-blob pure unit tests**: **9 passed, 0 failed**. Actual local Git blob hashes match the four relevant GitHub source/test files:
  - `src/lib/adminTodaySummary.js`: `5c85c8fb6967eca394f7c32669a7cd43b0b8eec1`;
  - `tests/admin-today-summary.test.mjs`: `9b1870eb54eca7e5ca401e9d5e4435780ea1eeb3`;
  - `src/lib/technicalSupport.js`: `e9d2e37784dafb58ce938fadfa885871d3eec77d`;
  - `tests/technical-support-v1.test.mjs`: `cba5fb632ba2d8d9bb963f93064c36bf5ca880b7`.
- Earlier existing Vercel source/build preview `dpl_Cicqz7Nh9JVjPyAULeUQ7c9miSox` at `694fb51c...` was READY; that is **not** build evidence for later changes.
- Later Vercel check for `8678f4fd...` returned **build-rate-limit** failure, not a source test failure. No paid upgrade, duplicate preview retries or substituted production project were attempted.
- Current Support case claim and People & Access team membership changes have **not** received exact-head full npm/build/Playwright acceptance. Do not call them production-ready. Historical source and role tests cannot substitute for final-head acceptance.
- The release gate remains **NO-GO**; production main, preview release PR #44, live Supabase schema/Auth and Vercel production aliases untouched.

## Continued product and security corrections — 11 October (additional live review)

Application HEAD before this documentation update: `b6b5f9ae531a730d3b4cec22d5f8e04f53e27953`.

**Administration daily briefing**
- The hero no longer claims an empty decision inbox, zero invitations or zero leave decisions before the authoritative reads have completed.
- On a query failure the hero and meeting rail describe data as unavailable rather than implying an empty schedule.
- The Time & Leave overview now says "Open work sessions" and "Not verified live presence" because an unclosed database session does not establish current presence, and missing sessions cannot establish absence.
- Authenticated screenshot assertions now explicitly capture desktop 1440, desktop 1366, tablet 820 and phone 390 (reference comparisons still required).

**People & Access**
- Sensitive roster/unit/invitation data is invalidated immediately on authenticated identity/organisation change.
- Older in-flight reads cannot reinsert another account's directory state after a newer scope change; network rejection yields a fail-closed retry state.
- True current sub-team placements and idempotent add/remove availability are driven from RLS-scoped records. Existing server-side audited RPC remains the only write route.

**Technical Support**
- Reporter self-service shows own status and recorded response, with case-list refresh.
- Help Desk supports bounded search/state filters, active membership revalidation and per-case assignment to self or return to the unassigned queue without moving another technician's case.
- The personal "Needs you" view excludes cases assigned to colleagues and cases awaiting business approval.
- Status/resolution updates compare exact server `updated_at` so stale operators cannot quietly overwrite another saved decision. Assignment changes refresh case history using the new server timestamp.
- Resolved/closed cases cannot be taken/released through these controls.
- When the secure `support_cases` tables are absent (read-only Supabase catalogue reconfirmed none exist), users see a truthful not-enabled message rather than an invented empty queue or false lack of personal authority.
- This UI is **future backend-dependent**: the protected migrations, support membership administration, business approval/execution, private case evidence, service telemetry and recovery evidence still require completed independent implementation.

**Executed evidence (not release acceptance)**
- Fresh local Node 22.16.0: **11 unit tests PASSED**, including personal ownership routing and undeployed-backend handling; exact local tested source/test Git blob SHA equals canonical current GitHub blobs:
  - `src/lib/technicalSupport.js`: `95553cbe01762b8ff4076c11759664ca8f3b47c1`;
  - `tests/technical-support-v1.test.mjs`: `90d3a3bf6119d168e13224096802faa9ebb63694`;
  - Administration helper/test blobs remain `5c85c8fb6967eca394f7c32669a7cd43b0b8eec1` and `9b1870eb54eca7e5ca401e9d5e4435780ea1eeb3`.
- Current GitHub files underwent 21/21 lightweight source-structure assertions PASS. These are NOT executed JSX compilation, browser tests, full technical/security acceptance or visual signoff.
- Live GitHub Actions at latest commits still terminate jobs with **zero executed steps** (external runner restriction), not a recorded code failure. Existing Vercel Hobby preview later returns `build-rate-limit`; no chargeable alternative was launched.
- Connected GitHub browser explicitly confirmed existing active `symmetrical goggles` Codespace. A non-mutating attempt to operate a new VS Code web terminal through TinyFish could not reliably focus/send commands; **no claim of npm CI/build execution** at latest SHA. No existing assurance runner, release branch or terminal job was changed.

**Release:** production main and PR #44 unchanged; production Supabase/Auth, schema and Vercel main unchanged. PR #47 must remain DRAFT and unmerged until exact-head application/visual tests, secure support backend, independent migration and release gates pass. NO-GO is intentional.
