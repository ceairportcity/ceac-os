# HR employee entry, communication, assignment and Projects repair

Status: implementation and focused verification in progress; not released.

Owner instruction, 26 October: fix employee fields losing focus after each character; HR must communicate in every authorised department/team room, address individual employees and heads, and give work to people across the organisation. The owner added that HR needs a visible Projects workspace with project creation and the operational features available to Managers. This supersedes the earlier read-only Administration project-surface restriction. It does not make HR an Executive identity or change other roles' rights. Existing contextual shared Rooms remain explicit; addressing an individual in a room is not presented as a private direct message.

## Preserved state and concrete causes

- Start from released main `90cf6f89e347dfac388d27bd4edd6722383c991f`, after implementation #149 and acceptance #151. Preserve independent Start Work PR #150 and existing records, IDs, permissions, visual references, Google/MFA deferrals and hosting.
- The shared overlay focus effect depended on the changing close callback. Add employee supplies an inline busy-aware callback, so controlled field changes repeatedly restored/reassigned focus. Keep the current callback in a ref, and bind focus setup/cleanup to the actual open/container lifecycle.
- Inbox's room directory was Executive-only. The actual production `app_can_access_room` function also omitted Admin from organisation-wide unit/team access and required ordinary membership for projects. HR cannot gain the approved access merely by displaying buttons.
- The existing project creation and cross-department assignment RPCs already authorise Admin. The client routed HR through a unit-bound assignment form, hid Projects from navigation and used a read-only project reader. Reuse the existing department selector and real Manager project workspace with an explicit project department context, preserving the authenticated actor.

## Change boundaries

- Add employee regression types full multiword name, preferred name, job title, email, phone and reason character by character at 390px and 1440px; it checks retained focus, full values, deliberate Tab and retained rejected draft.
- HR Messages exposes the room directory and a people contact view. Person actions choose an actual department room and resolve a real participant mention; the UI states that room participants can read it. HR and authorised leadership can be mentioned without fake memberships.
- HR Give out work uses the existing department selector, active assignees and server Work Engine. Keep ordinary Admin `assigned` origin and Executive-specific origin/implicit project participation unchanged.
- Add Projects navigation. Keep organisation-wide list/filter/calendar/department links; create a project with the existing atomic RPC, validate returned identity by an independent read, then use the existing project objectives/work/files/register/collaboration/close workspace. Project department context never rewrites `me` or memberships.
- One forward migration, `20261026155352_hr_room_authority.sql`, extends the room predicate for verified same-organisation Admin, preserves normal membership and Executive contextual project rules, rejects archived projects, and allows eligible leadership mentions. No profile, membership, message, project or role rows are rewritten by the migration.
- A rollback-only SQL gate covers HR with no department membership, three room kinds, real mentions/replies/read receipts, project creation/participants, all seven Work kinds, and foreign/inactive/archived/Staff/Manager/Executive/anonymous negative boundaries. No production test messages or employees are authorised or needed.

## Verification ledger

- Before this repair, released main #151 remains historical release evidence, not proof for this candidate.
- Baseline keyboard reproduction: the strengthened real-component employee test failed retained focus at 390px with the original shared hook. The repaired hook passed both 390px and 1440px employee cases (2/2). The tests use synthetic intercepted API data, not production writes.
- Early local browser attempts initially stopped on a separate command's isolated loopback connection, before app assertions. Vite and tests now run in one command network namespace. Initial new test attempts also exposed inaccurate authored selectors and missing exposed mock count headers; those fixture errors were corrected, not production defects.
- Node 22.12 full source suite: 629/629 PASS after updating explicitly superseded Administration read-only contracts, new navigation count and exact new migration inventory. Unchanged Executive reader privacy and strict visual/CSS guards remain.
- Production build/sealing passed during initial implementation; final complete candidate source/build/browser/SQL/security/CI and live verification remain pending until actual receipts are recorded below.
- Local runtime maintenance removed temporary tools/logs between turns; published baseline and working source were preserved. Recover tools without restarting source work. Keep subsequent log files under the current workspace.

Do not claim this repair is live, close it from source tests alone, send operational messages, create real employees/projects for testing, or mark skipped/failed/unrun verification as passed. Publish the qualified candidate through normal required checks and record actual source and deployment bindings.

## Frozen candidate preparation

- Final affected browser command: Playwright 1.56.1 / Chromium1194, Node22.12, synthetic intercepted real components, one worker; `playwright test tests/hr-operations-repair.spec.js tests/admin-project-expense-journeys.spec.js tests/admin-remaining-forms.spec.js --grep 'HR |Add employee|Admin project filters|Admin department project' --workers=1` — **12/12 PASS**, aggregate exit0, 1.3 minutes. Covers 390/1440px employee keyboard focus/Tab/rejected draft, organisation room opening/person mention/send payload, HR assignment with no department membership/rejected draft, confirmed project creation/full objectives workspace/reload, Calendar/department→project and back/reload. Log: `../ceac-hr-final-browser.log` in the active Work workspace; exact-head CI remains required.
- Additional local source command `npm run verify:source` — **629/629 PASS**, Node22.12, aggregate exit0, log `../ceac-hr-final-source.log`. The final two Admin-only department-context wording corrections do not alter the tested focus/assignment/data paths; the exact-head source check is still required on GitHub.
- Final local `npm run build` completed with script sealing, exit0; log `../ceac-hr-final-build.log`. Documentation integrity exited0; changed-line hygiene clean. No CSS/reference threshold, package or lockfile change.
- The new fixture initially used inaccurate button/tab and select/count locators. The final focused run resolves controls by their actual semantics and asserts the complete same workflows. Failed authored-selector attempts are not product defects or passes.
- Existing read-only Administration tests are updated only where the owner explicitly superseded that restriction; the Executive read-only reader, private-work exclusion, role isolation, responsiveness and visual/CSS assertions remain intact. No release check is bypassed.
