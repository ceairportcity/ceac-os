# Administration/HR audit and corrections — 26 October 2026

Status: **IN PROGRESS. Not released, not whole-panel acceptance.**

Owner explicitly authorised Administration audit → fixes → verification → release before another panel. Staff is tentatively next; do not start it or Manager now. Reference Executive design quality and connected journeys, retaining appropriate Admin colours. Preserve accepted Overview, People & Access and Control Center and all genuine role/privacy boundaries. No production leave decision or other business write is authorised merely for an audit.

Base: released main `77c9efb360258a00f7d0b02d517171149ed9e119` / merged PR #148. One active continuation branch `chatgpt/admin-journey-corrections-20261026`. The earlier unapproved navigation experiment was stashed and stopped, then restored only after this explicit Admin implementation/release instruction. No live system changed.

## Confirmed source findings and first corrections

| Surface | Finding | Current correction/evidence |
|---|---|---|
| Overview leave | Review request opened generic attendance, without selecting the request; HR stage actions did exist. Do not describe it as a missing approval engine. | Each queue row and suggested review passes the exact leave ID through existing App URL/history navigation into the actual Workforce review. Waiting for Manager remains distinct from HR final decision. |
| Selected leave | Review omitted the employee's request reason; mobile placed the selected decision below a full month calendar. | Show actual reason/recorded note and clear HR-decision status. On phone, the selected organisation request replaces the calendar until Back to requests, retaining the desktop paired view. No policy/server/RPC change. |
| Read failures | Planner could continue rendering previously supplied rows while unavailable. | Withhold rows and decision controls when unavailable. An inaccessible/missing deep-linked record is explicitly unavailable, never a fabricated empty or approved request. |
| Calendar → Project | AdminCalendar supported a project callback, but App supplied none for Admin. | Wire dates into the existing authorised Admin Projects view. |
| Project → task → return/reload | Admin selected project lived only in page-local state and was lost on task navigation/remount. | Use existing project URL state and task-return semantics; retain authenticated RLS ProjectReader and pass current actor. |
| Old presentation rules | Admin-only `.workforce-tabs` forced legacy pill styling but the actual Admin return uses `.ev2wf-tabs`. | Remove the obsolete Admin selector block, preserving Manager/Staff and current tab family. Reuse freed CSS budget for 44px phone controls and 16px search input in Admin leave review. |

## Development verification

- Clean `npm ci`: PASS under Node 22.12.0, 37 locked packages installed. Playwright 1.56.1 installed without changing package manifests or lockfiles. Chromium primary download yielded an invalid ZIP; supported Microsoft fallback subsequently installed the actual browser. No repeated login attempt, reset or production credential use.
- Full source suite on the initial corrected application working tree: **627/627 PASS**, exit 0; `/tmp/ceac-admin-source.log`. Subsequent changes are focused mobile presentation and fixture fidelity, so retain this as historical working-tree evidence, not a later exact-SHA release result.
- Focused source contracts: **49/49 PASS**, exit 0; `/tmp/ceac-admin-focused-source.log`. Two old source assertions for generic leave navigation were updated to assert exact request navigation; one project-prop assertion corrected its template-string matching. No authority assertion weakened.
- Initial changed-area browser: **11/11 PASS**, exit 0; `/tmp/ceac-admin-browser.log`. Includes selected request, captured reasoned decision payload and refreshed status, pending Manager-stage denial, read-only actor, failed read, existing HR Overview responsive/layout and three-role calendar regression.
- The existing Overview fixture initially omitted Workforce's global family CSS when extended to render the actual Workforce component. Corrected the fixture to load that production stylesheet before treating its screenshots as design evidence. Four selected-review/authority cases passed again (**4/4**, exit 0); `/tmp/ceac-admin-leave-final-browser.log`.
- Latest build/sealed script policy PASS, exit 0; aggregate CSS **631296 / 631808 bytes**; `/tmp/ceac-admin-build-final.log`. No budget/visual threshold raised. Final phone-priority and existing Overview/calendar regression run **11/11 PASS**, exit 0; `/tmp/ceac-admin-browser-final.log`. The selected phone inspector appears before 500px and the month grid is hidden until Back; desktop retains both.
- All browser API responses above are **explicit synthetic fixtures**, with non-local requests intercepted/aborted and mutations captured locally. They prove real component presentation, control gating, request construction and refresh behaviour, **not** authenticated live login, real SQL/RLS or actual persisted leave decisions.

## Mandatory remaining Admin work

Complete rendered design and connected-action review of every Admin root and child: Overview; People & Access and employee tabs; Work and all seven composers/record detail; Time & Leave and history/corrections/schedules; Calendar/private planning/meeting forms; organisation project and department drilldowns; Finance/Expenses; protected Payroll and HR; Reviews & Development; Reports/issue/print/archive; Messages/Room; My Hub/account/achievements; Control Center and each authorised tool (permissions, rules, lifecycle, audit, events, integrations, learning, assets, technical help).

Keep empty/error/loading/denied/small-screen/keyboard/return/reload states in scope. Do not infer a whole-panel PASS from the first leave correction. Source inspection also identifies Admin Projects' non-actionable summary figures, error-state zero/empty presentation, and older child-surface header treatments for rendered review; these are not yet fixed or runtime-certified.

Next: finish final affected leave browser run and project context browser acceptance, then continue the wider Admin audit and repairs on this same branch. Do not release this partial checkpoint as completion. Once the complete Admin candidate is frozen, obtain required exact-head source/build/migration/security/SQL/eight-browser/approved-reference gates and the genuine CEAC Vercel deployment. User-authorised production release follows passing gates; record live verification limitations honestly. No new production backup/restore proof is claimed.
