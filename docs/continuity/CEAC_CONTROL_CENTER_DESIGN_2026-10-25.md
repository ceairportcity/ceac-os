# Control Center and mobile safe-area correction — 25 October 2026

## Owner decision and scope

After reviewing the three connected mobile mockups, the owner said: “Great. So now, let's go ahead and fix, make these changes.” The approved journey is a searchable grouped Control Center → focused category → single-setting editor. The owner explicitly rejected the permanent `← Control Center / …` row on independent People, Finance and other workspaces. Back belongs only inside deeper settings, returning to the appropriate parent. Phone system time, battery and reception must not overlap the shared app header on iPhone or Android.

Approved concept image SHA256: `2f81d32af96bb87ffda1ae8203aa8c285810c2c6e6fc39400537862e15c41bdf`. This is the newly approved conceptual design, not a byte-identical browser screenshot. Image values, map and portrait are illustrative, never production records. The current app’s supported controls, protected authority and existing data remain the implementation boundary.

## Baseline and implementation

Based on merged PR #144 / main `e9fa552906a3a92af571406314e25ea9dcef7a40`, preserving the deployed Compliance correction from PR #143. Single follow-up branch: `chatgpt/control-center-design-20261025`.

- Shared mobile header consumes `env(safe-area-inset-top, 0px)`. Staff's older outer top inset is removed at mobile widths so spacing is not doubled. Search drawer also reserves the top safe area. The existing bottom inset remains.
- Remove the global ControlCenterTrail implementation. A compact SettingsBack is limited to settings routes. Independent People, Finance, Time & Leave, Payroll and personal workspaces do not inherit it. Person-specific permission entry returns to People. Department detail retains its own return to the department list without a duplicate settings Back.
- Control Center uses grouped destination rows, search, and actual setup needs. No fake health percentage or guessed readiness. Daily employee/invitation, financial and development work remains discoverable in a separate related-work area; protected routes retain their existing guards.
- Separate Attendance & locations, Office location, Duty locations, Check-in codes, Leave rules and Alerts & reminders. `setting` in the URL supports reload and browser back/forward. Each page reads the data it needs; invitations are no longer duplicated in organisation settings.
- Office save retains the existing write path and additionally verifies the returned row, explicit organisation scope and valid location/radius before reporting success. Missing feature compatibility still withholds the code issuer, while permission/network failures remain errors.
- Simplify Authority to Access permissions; Grant capability to Add permission; Checks to Pending decisions; Policies & rules to Organisation rules; Audit to Activity history. Existing stored permission identifiers, server authority, policy versions and immutable records remain unchanged.
- The mockup's generic “Approval rules” label is implemented as the existing supported Organisation rules surface. No workflow designer, invented approval settings or new authority is claimed.
- Remove obsolete Control Center tile/ledger CSS rather than raising the locked CSS budget.

No database migration, production data write, grant change, Auth/provider/configuration change or dependency/lockfile change is included.

## Development evidence

Tests use Node 22.12.0 for the existing 627-source-test suite and production build. Local Playwright 1.56.1 / Chromium runs the repository components with explicit synthetic API responses for UI presentation, navigation, mocked successful/denied save behavior, restricted settings and missing-code compatibility. That synthetic suite is not genuine Auth, RLS or database-persistence proof. Full required exact-head release qualification remains mandatory before integration.

- Source: `npx -y -p node@22.12.0 -c 'npm run verify:source'`: 627/627 PASS, exit 0.
- Production build: Node 22.12.0, PASS, exit 0; emitted CSS measured below the unchanged 631808-byte ceiling after removing obsolete styles.
- Five focused existing source-contract Playwright checks: PASS, exit 0.
- Seven initial UI browser cases passed. The initial eighth used a CDP safe-area command unavailable in this installed Chromium; this was a test-environment limitation, not a passed device check. Replace that unsupported command with an explicit 47px safe-area CSS-variable simulation. The focused simulation passed. Final full eight-case execution and screenshots are recorded on the candidate after all edits.
- Screenshots inspected at 390px for the settings hub and office editor; repeat screenshots cover 320/390/430/1366px, with page-width checks and parent-return navigation.

Physical iPhone/Samsung status-bar rendering and externally hosted map tiles are not certified by a desktop browser simulation. Production checks must report that limitation honestly.

## Release gate and recovery

Final candidate must pass the repository's full exact-head engineering/security/migration/browser gates. Do not waive failed tests, weaken privacy, or claim earlier source/synthetic checks are full acceptance. Release status is PENDING until those gates and deployment evidence exist. A code-only rollback target is the baseline main SHA above; there is no database rollback in this change.

### Final visual comparison correction

The initial published candidate `7309c5aad5cfe7b5d496838b00d8fee9a26fcdb2` passed source/build, Migration Replay and SQL/authority, but final screenshot comparison exposed older `admin-page-header` gradient/card rules and the role body background still overriding the new proposal. This is a concrete visual defect, so that candidate is superseded for release. Remove the legacy header class from these two settings surfaces, use the scoped settings heading, and give the settings body its approved white canvas. Add actual computed-style browser assertions for white background/no gradient; do not weaken other role styles or accept the initial candidate as final visual fidelity.

After the correction, eight/eight synthetic browser cases PASS (Chromium, one worker, 8.0s) including all four widths and the 47px top-safe-area simulation. Screenshots of the corrected white hub and focused office editor were inspected. Node 22.12.0 source 627/627 and production build PASS again. These are cumulative changed-scope development results; the final published commit must still obtain its own required exact-head gates. Supabase save checks follow the existing `.select(...).single()` write verification contract; no server rule is changed.

### Broader qualification findings and bounded correction

Candidate `9428ce59b31d8e4ec890f90af941054958b6b929` passed CI, Migration Replay, Account Security, SQL/authority and browser groups 2/3/4/6. Group 7 found two outdated source/label expectations and one outdated Control Center composition expectation; group 5 additionally found the shared-shell role-isolation guard and an older meta-test assertion. These failures remain FAIL, not accepted or waived. Remaining groups were still active when the bounded correction was prepared.

Keep the shared-shell isolation guards unchanged. Remove the unnecessary `.staff-app` override from shared shell CSS and change the original Staff body top safe-area rule to zero in its existing stylesheet; the shared header owns the top inset. Preserve ordinary content spacing and verify that a simulated 47px header inset does not alter Staff body padding. That browser check PASS (1/1, 1.5s); five affected source/meta/security-layer checks PASS (5/5, 1.3s). Production build PASS; emitted CSS 630276 bytes remains below 631808. Earlier source 627/627 and eight presentation tests remain cumulative unchanged-functionality evidence, not certification of a newer exact commit.

Update older assertions to the newly approved groups/labels and inspect the actual AttendanceCodeIssuer for the unchanged location-scoped attendance_set_office_code RPC and corroboration-only language. Retain all migration, no-pay/no-discipline, authorisation and actual invalid/valid-code lifecycle assertions. Update the hub's Connected apps selector without changing the underlying Connected Apps workspace. Extend the real local-database Control Center journey to save the disposable office name, reload and verify it, then restore the fixture name. No production record is used for this check. The final corrected SHA still requires full exact-head qualification.

### Remaining permission journey mismatch

The full gate for `afac596e870a8dad6f6d6b93a1a1d054e87a6c0b` completed six browser groups successfully, but groups 1 and 8 failed one test each. Group 1 reached the actual permission-removal drawer: its title and initiating action were renamed but its confirmation still said Revoke. Align that final confirmation to Remove permission (Removing… while busy); preserve the reason requirement, existing revoke operation, final-manager protection and actual grant/revoke persistence assertions. Group 8 successfully opened the selected person's permissions but still expected the old Manage permissions hub action; target the unique Access permissions settings row and retain the selected-person/current-person value assertions. These are bounded corrections, not waived tests. Production remains on the previous release until the corrected commit passes its own complete required gate.
