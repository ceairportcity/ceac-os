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
