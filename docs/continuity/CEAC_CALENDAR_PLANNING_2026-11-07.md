# Calendar planning update — 7 November 2026

## Scope and release state

Owner authorised implementation after comparing current CEAC utility with Apple Calendar, Asana and Monday. Keep the existing palette, separate phone composition, private planning and Work approval rules; avoid adding a heavy calendar package or slowing other destinations.

Implemented in the existing Calendar family:

- Shared Month / timed Week / Agenda, combined layers, month density, calendar search, phone month collapse and keyboard date selection.
- Account-scoped display preferences contain no event contents. Same-day, tab-scoped date context survives opening Work or a meeting. All role Work-to-Calendar routes accept the selected date.
- One indexed event collection; date-bounded shared reads; clipped multi-day leave/events; stale-load protection; bounded agenda rendering; lazy Work/project linking options; changed-row-only private completion; avoid repeated recurrence materialisation through the same horizon.
- Unit Work status now mirrors Work, including waiting for approval. Routine navigation retains its actual scheduled date; private completion never approves shared Work.
- Shared organisational Work deadlines are an optional layer, hidden by default.
- Participant invitation responses and private preparation notes, with owner/organiser access boundaries enforced by a forward migration.
- Organiser editing of upcoming meetings with stale-write protection. The existing notification trigger covers changed times, titles and locations. Invitation responses are bound by a server trigger to the appointment time; changing that time requires a new response.
- Debounced checks of the organiser's own meetings, private appointments and approved leave. No claim that other invitees are free; their private details are not queried.
- Directions and explicit `.ics` export for Apple Calendar/Outlook/Google. Export is a manual snapshot. No automatic subscription or two-way sync is claimed.

Later work from the review remains later: live subscriptions/two-way external sync, cross-participant availability, drag-to-reschedule, richer attachments and automatic travel estimates. No additional provider, subscription or paid service was introduced.

Production is unchanged. The new migration must pass full replay and actual SQL/RLS gates before release. Local isolated checks are not production or hosted acceptance.

## Verification ledger

Baseline: released main `536490b14553585a84648c061897daf8cebbe83f`, tree `647bbe400a202fd04f82088f28fe8b3c3e31920d`.

Runtime candidate: local `cc69fc4c0fc2b36a06ebee0bf1578d182030a5c9`, tree `22a016d739d4fb2d0a638f6636009a2f5b740299`. Subsequent isolated-test timestamp comparison is at `ae632bd`; no runtime change. Connected publication preserves exact tree identity. Commit-check acceptance remains pending until its actual GitHub SHA completes CI.

7 November 2026, 01:20–01:38 UTC, selected Work Mode Node 22 workspace:

| Check | Result | Coverage / limits |
|---|---|---|
| `npm run verify:source` initial integration | 809/810 passed | Sole failure: new migration missing from exact migration inventory. Explicit inventory updated without changing the original 153 migration baseline. |
| `node --test tests/technical-support-source-contract.test.mjs` | 18 passed, exit 0 | Rechecked the corrected ordered inventory and original baseline locks. |
| Focused Calendar, routine date, private recurrence, schema compatibility, Work navigation and phone source checks | 102 passed, exit 0 | Commands and logs retained in `/tmp/calendar-focused-final.log`; targeted subsequent Meeting/Calendar source checks: 71 passed, `/tmp/calendar-final-focused.log`. |
| `CEAC_PGLITE_MODULE=... node scripts/test-calendar-planning-isolated.mjs` | Passed, exit 0 | Isolated PostgreSQL fixture: migration compilation, RSVP owner/organiser visibility, private pre-meeting notes, denied foreign-user/tenant/cancelled/revoked writes, notification fan-out and server-bound response times. It does not replace full migration/RLS replay. |
| Calendar/role/private-planning static Playwright contracts | 4 passed, exit 0 | `/tmp/calendar-static-contracts.log`; source-only checks, no rendered acceptance claim. |
| `npm run build` | Passed, exit 0 | Vite production build and sealed script policy. `/tmp/calendar-build.log`. |
| Existing production bundle budget test | Passed, exit 0 | `tests/visual-fidelity-performance-closure.spec.js --grep bundle`; no budget or minifier changes. `/tmp/calendar-performance-final.log`. |
| Local rendered Calendar tests | Blocked before execution | Chromium cannot create the process singleton socket: OS `Operation not permitted`. Eight cases added to the existing Playwright suite; no passing browser or visual claim. |
| Full replay, actual SQL/RLS, hosted role flows and final rendered/phone checks | Pending CI | New `calendar_planning_gate.sql` is included in the existing SQL security runner. Preserve all required release checks. |

Final measured assets (all lazy routes combined): JS 2,646,563 bytes; CSS 767,116 bytes; combined gzip 911,797 bytes. Baseline JS 2,629,427; CSS 764,093; combined gzip 905,526. Increase: 6,271 compressed bytes across the whole application, not an additional startup payload. Existing route/core/vendor/CSS budget test passes. No dependency changes. This is bundle evidence, not a live-network latency benchmark.

## Continuation

Use the existing branch `feature/calendar-planning-20261107` and its Calendar PR. Reuse valid evidence for unchanged areas. Inspect exact-head CI failures, fix their causes and rerun the affected checks; preserve mandatory final replay/security/role/browser gates. Review the actual phone/tablet/desktop screenshots before declaring visual acceptance. Do not merge or apply the migration while required verification is pending. No live subscription, two-way sync, all-invitee availability or production deployment has been completed.
