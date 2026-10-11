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
