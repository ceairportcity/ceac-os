# 30 October 2026 — usable session correction and verified save

Owner rejected the mobile earlier-session sheet: controls ran together and saving/correcting circumstances was not usable. The earlier PR162 repaired continuation identity checks but did not fix this form. This is a concrete reopened defect, not acceptance of the earlier UI.

Baseline: released main `0ea50b63fe8b4febd9a402a004e027064f89f6b1`. A single focused hotfix is isolated from unreleased Google Maps PR163 so repairing attendance is not blocked by Maps API configuration. PR163 and its source remain preserved; no new infrastructure, database migration, permission, account or attendance-record mutation is involved.

## Changes

- Shared SessionRecoveryDialog for Staff, Manager, Administration and Executive. Reuses existing Start Work spacing, CEAC role colours, Sheet focus/dismissal management and controls.
- Original start shown with explicit Accra time. Separate native end date and time; date defaults to the original day, time remains blank until the person enters it. Correction note is optional.
- Visible Save end time footer, Cancel, compact close control, scrolling fields on short phone viewports, disabled submission/dismissal while saving. Start today's session remains available under an explicit alternative.
- Incomplete, before-start and future end times produce inline validation without writes. Accra/GMT input is serialized explicitly as UTC, independent of browser timezone.
- Failed writes or verification retain values and the form. Further writes are blocked until Recheck saved session reads the exact original actor/org-scoped row and current open session. A committed save with a lost response is acknowledged without writing twice. Another open row cannot silently receive the entered correction.
- Existing audited reconcile_work_session close RPC, specific-row post-save verification, new-day linked-session verification and original histories remain authoritative.

Changed objects: src/components/SessionRecoveryDialog.jsx; EmployeeWorkSession.jsx; StartWorkDialog.jsx/.css; src/screens/Home.jsx; src/lib/session.js; focused browser and source-contract tests. No database objects changed.

## Verification — 30 October, 12:52 UTC

Environment: local Node 22.23.4, Chromium 140, synthetic fixtures with every external request intercepted. Base SHA above; final GitHub candidate receives independent exact-head release checks.

- `node --test tests/stage2SharedPersonalSession.test.mjs`: 15/15 PASS, exit 0.
- `npm run verify:source`: 660/660 PASS, exit 0; /tmp/ceac-correction-source.log.
- `npm run build`: PASS, exit 0; /tmp/ceac-correction-build.log.
- `playwright test tests/session-correction-form.spec.js tests/stale-session-rollover.spec.js --workers=2`: 45/45 PASS, exit 0; /tmp/ceac-correction-browser.log. Includes actual manual close and post-close Start availability for all four roles at 320/390/1440; invalid dates/times, retained rejected inputs, safe recheck/resave, lost acknowledgement, overseas timezone, linked continuation and negative continuation evidence.
- After the short-viewport and busy/dismiss tests were added: `playwright test tests/start-work-recovery.spec.js tests/session-correction-form.spec.js tests/visual-fidelity-performance-closure.spec.js --workers=2`: 75/75 PASS, exit 0; /tmp/ceac-correction-final-browser.log. Includes unchanged Start Work/location/failure journeys, 390x420 keyboard-sized viewport, disabled saving/dismissal and immutable production bundle/CSS budgets.
- Inspected actual 390x740 Executive correction screenshot: test-artifacts/session-correction-executive-390.png. Clear separate fields, no overflow, visible blue Save end time. This is rendered synthetic evidence, not a production or physical iPhone screenshot.
- `git diff --check`: PASS.

Production acceptance remains pending required CI, reviewed merge, exact-SHA READY deployment and live existing-user verification where authentication permits. No synthetic test is called a real employee correction, and no actual employee session was changed for testing.
