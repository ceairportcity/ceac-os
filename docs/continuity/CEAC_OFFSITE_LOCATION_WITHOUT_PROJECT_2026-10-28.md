# Off-site attendance without a project — 28 October 2026

## Owner decision and source

Owner explicitly clarified that working outside must record current location and
where the employee is working, without requiring a linked project, and approved
implementation. This supersedes PR150's mandatory active-responsibility rule.

Implementation commit: `c80f479a0f515a280a2cd8b14e0de9a7c4f79709`.
Base: current released main `5a02f3c0caef73e0589a482d6de1174a7cd1e91f`.
Branch: `chatgpt/offsite-location-without-project-20261028`.

## Behaviour and boundaries

- Staff and shared Manager/Administration/Executive Start Work forms accept a
  required place name and fresh foreground location without any responsibility.
  A missing, failed or slow optional responsibility read cannot block this start.
- Linking existing work is optional. When selected, it remains employee-, tenant-
  and active-status-bound in both the client and the database.
- The existing session evidence JSON stores `offsite_location_name`; actual GPS,
  accuracy and captured/server times remain in the existing evidence columns.
  No fabricated project, task or employee attendance record is created.
- Workforce session history labels the place as employee-reported, independently
  of GPS, and does not count its descriptive name as an attendance warning.
- Location denial/failure retains the form and draft for retry. Duplicate-click
  and uncertain-write verification guards, End Work, and office geofence remain.
- The new private SECURITY INVOKER insert trigger does not grant a public RPC or
  alter row permissions. Existing office validation executes first and is unchanged.
- Historical imports are unchanged. Existing postgres-owned stale-session recovery
  may continue a genuinely closed, caller/tenant-bound predecessor; a client flags
  key alone cannot enter that path. Existing names are retained; older missing
  names are not invented. Both cases were tested with the actual recovery RPC.

## Verification ledger (28 October, Node 22.23.4)

- Clean `npm ci`: exit 0; 37 packages installed, unchanged lockfile.
- `npm run verify:source`: 650/650 PASS, exit 0. This ran before the final shared
  form CSS/class adjustment; application logic and all tested sources were unchanged.
- On exact implementation commit, affected native source command:
  `node --test tests/attendance-location-scope.test.mjs tests/stage2SharedPersonalSession.test.mjs tests/technical-support-source-contract.test.mjs tests/offsite-location.test.mjs`
  — 49/49 PASS, exit 0.
- `npm run build` on exact implementation commit: exit 0; Vite build and script
  sealing passed. No application source changed after that commit.
- `playwright test tests/start-work-recovery.spec.js --workers=2`: 30/30 PASS,
  exit 0, synthetic intercepted REST and geolocation, both Staff/shared employee
  flows, 390/1440 office and unlinked off-site cases. After the final shared-form
  layout adjustment, affected `--grep 'employee '` selection: 15/15 PASS, exit 0,
  on the exact implementation source. These are 30 distinct cases, not 45.
- Phone shared-form and Staff phone/desktop screenshots inspected. Controls fit
  without horizontal overflow; the shared form's initially cramped select was fixed.
- `CEAC_PGLITE_MODULE=<existing PGlite module URL> node scripts/test-offsite-location-isolated.mjs`:
  exit 0; migration compiled with the actual existing office guard in a disposable
  PostgreSQL/PGlite schema fixture. Two valid unlinked/linked starts, fourteen
  negative direct-insert probes, private-function privileges and both historical
  recovery variants passed. The driver and SQL gate are committed and reproducible.
  This is NOT full Supabase Auth/PostgREST or complete migration-replay acceptance.
- Initial full-source result 647/648 was an expected new-migration inventory mismatch;
  the explicit inventory now includes the forward migration (153 historical + 57
  listed additions). Initial standalone recovery probe mistakenly expanded a
  mutating composite expression repeatedly; using `SELECT * FROM RPC(...)` invokes
  the actual function once and both recovery variants pass. A narrow browser grep
  initially selected zero tests; corrected selection executed all 15 affected cases.
- Logs/screenshots remain temporary under `/tmp/offsite-*`; durable results and
  exact source are recorded here, with full CI evidence linked in the PR.

## Integration and release

Another workspace has unpublished Messages/Memos changes. It was left untouched.
The only currently overlapping tracked paths are `package.json` and
`scripts/ci/run-sql-security-gates.sh`: retain BOTH source-test and SQL-test entries
when integrating. The migrations have distinct timestamps; do not rename either
or overwrite the other workspace's implementation. Re-fetch main before integration.

The rollback-only SQL gate is registered in the existing cumulative runner; the
older Phase 2 checkpoint fixture now supplies the newly required start evidence.
The commit is marked `[level-b]` for the normal complete exact-head CI pipeline.
Do not manufacture external success statuses or treat source/fixture results as
full release acceptance. Complete migration replay, RLS/Auth/security and full
browser CI remain required before release. Physical employee/device acceptance
remains unverified. No production database, attendance, Auth, Vercel configuration,
main branch or other build was changed by this repair. No paid tools were used.

For a later authorised release, apply the forward database trigger before the
frontend, verify exact deployed SHA and use a real employee's own device/location
without fabricating attendance. Rolling the frontend back retains the database
recorded evidence and new requirements; plan the schema compatibility window.

## Approved popup implementation — 28 October continuation

The owner approved the refined popup (identity and exact instruction recorded in
PRODUCT_OWNER_DECISIONS.md). Continued the existing PR159 branch from exact head
`fd26884d443bbeb91ed3dd991f0bfb669edf8a1c`; no new implementation branch, reset,
force-push or replacement of the independent Messages/Memos workspace.

- Added one shared StartWorkDialog presentation for Staff and the existing
  Manager/Administration/Executive EmployeeWorkSession. Header, paired native
  location radios, conditional place/venue field, collapsed optional work link,
  foreground-location note and Cancel/Start footer match the approved structure.
- All colours come from current CEAC tokens and existing primary-button styles.
  No global palette, unrelated page, geofence, session API or database guard was
  changed by the popup implementation. A truthful independent loading state is
  now shown inside the optional responsibility section of the shared form.
- Sheet accepts opt-in naming/placement and busy-dismiss protection; existing
  consumers retain their defaults. Keyboard focus includes summaries and excludes
  hidden fields inside closed details. Cancel and Close never post attendance;
  Escape/backdrop cannot hide an in-progress location capture.
- Static layout styles are shared local React style objects; only responsive
  placement overrides enter CSS. Actual emitted aggregate CSS is 631552 bytes,
  within the unchanged 631808 limit. No budgets, dependencies or build policy
  changed, and unrelated styles were not removed to make room.

### Actual local verification and corrections

Node 22.23.4; clean npm ci; sealed production build: PASS, exit 0.
`npm run verify:source`: final 650/650 PASS, exit 0.
`playwright test tests/start-work-recovery.spec.js tests/visual-fidelity-performance-closure.spec.js --workers=2`:
48/48 PASS, exit 0: 46 Start Work cases and both actual production/performance
checks. All remote requests/geolocation are intercepted synthetic evidence, not
physical or production attendance. Four-role 320/390/1440 layouts, collapsed
optional fields, native radio/keyboard controls, cancel/focus return, duplicate
clicks, office/off-site validation, unavailable lists, location denial/retry and
uncertain-write read-back are covered. Synthetic screenshots under test-artifacts
were visually inspected against the approved proposal; no private employee
screenshot is committed.

The first browser attempt exposed an older desktop Sheet top-position rule
moving the new form outside the viewport. Fixed through scoped placement
specificity, with later role/width geometry checks passing. The first full-source
run was 649/650 because an error-message source assertion still expected the
pre-extraction markup. It now binds to the shared component's error and guarded
submit instead; no guard was weakened. The first location of these 31 focused
source checks ran on host Node24 and is historical only; the final build/source
and browser acceptance used the installed Node22 runtime.

The earlier PR159 full run 40746884432 was FAILED, not accepted: shard1
123023112328 had 131 passed / 1 deferred MFA skip / 1 failed. The failure was the
Phase2 foreground pre-close fixture inserting an off-site start without the new
required place/GPS evidence (tests/attendance-phase2.spec.js:68). The fixture now
supplies fresh synthetic location and a descriptive place while retaining its
original older-start/pre-close/permission-denial assertions. The application
validation was preserved. Seven other shards, SQL, CI, Migration Replay and
Account Security passed at that old head; they remain historical evidence, not
checks on this updated popup. Exact new-head full CI remains required.

Logs: /tmp/start-popup-install.log, start-popup-all-source-corrected.log,
start-popup-build-final.log, start-popup-final-browser.log. Initial failed or
interrupted diagnostics remain separately named /tmp/start-popup-source.log,
start-popup-all-source.log and start-popup-browser.log; no failed attempt was
relabeled as a pass. Latest source and this ledger must be pushed together after
rechecking the remote expected head. No production business record, migration,
Auth setting or Vercel configuration was changed. Production release is pending.

### Exact-head full verification follow-up (c88f3ca)

Popup tree `6c3042af9abda7dea1ad735ebaa9446657fcd578` was submitted as
`c88f3ca73eb708493817b555ef018a37322695f4`. CI 40750953155, Migration Replay
40750953326, Account Security 40750953294 and SQL job 123037249871 all PASSED.
Full Quality Gate 40750953159 FAILED; do not describe it as accepted.
Six browser shards passed; the two remaining logs show three test failures and
one existing deferred MFA skip, with 1075 actual passed cases overall:

- Shard1 123037250205: 143 PASS, 2 FAIL, 1 SKIP. The real review-loop test still
  clicked the removed button text at acceptance-core.spec.js:150, and therefore
  did not create the completed record needed by its later closure-corridor test.
  Both office-start selections now use the approved native `CEAC location` radio;
  all real review, approval, session and closure assertions remain unchanged.
- Shard8 123037250195: 124 PASS, 1 FAIL. The personal PDF test expected a nonempty
  contribution table but never supplied an attributable contribution. The fresh
  shard seed has no completed work/submission; sharding changes exposed its
  dependence on unrelated earlier tests. This test now inserts its own uniquely
  named current-period completed-work fixture using the existing strictly
  localhost-only service test client and asserts that exact title in each PDF
  table before retaining all existing column/geometry/PDF assertions. No report
  application source, permissions or actual CEAC record was changed.

The Phase2 pre-close fixture repaired earlier passed in this full run. All 46
Start Work browser cases passed in shard8. The follow-up changes touch two
browser test files and this ledger only; they do not invalidate the unchanged
650 native source checks, 48 focused browser/performance checks or sealed build
as historical application evidence. Node22 collection for both edited test files
passed (47 cases). Full new-head verification remains required. This repeat is
justified by actual recorded failures; no application test was skipped, given
extra retries or weakened to manufacture success. Raw GitHub failure evidence
and downloaded synthetic shard artifact remain available; production unchanged.
