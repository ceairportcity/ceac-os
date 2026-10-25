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
