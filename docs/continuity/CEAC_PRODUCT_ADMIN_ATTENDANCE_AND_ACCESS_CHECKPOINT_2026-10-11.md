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
