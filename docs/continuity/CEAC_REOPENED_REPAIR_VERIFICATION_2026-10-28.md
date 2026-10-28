# Reopened owner repairs: development verification, 28 October 2026

Continue `chatgpt/approved-owner-corrections-20261027`, based on local merge `f0329b0c1e1f7a52a31e75c80e4ab616ad4242ed` and released main `d82baab58b4be1b6f6fb2835ecd2db31c9156794`. These are **unreleased working-tree changes**, not an exact-head release qualification or owner design acceptance.

The owner explicitly reconfirmed Units and replacement of the old designs, including linked Administration & HR unit detail screens. Scope also retains Learning, Calendar recurrence, People employment warnings and bounded attention lists, Overview technical-approval removal, map failure handling, understandable Pending Decisions and usable Payroll salary entry. Notification redesign remains discussion only. Preserve all role colours, actual data and existing authorities.

## Salary owner correction — 28 October

The owner pointed out that base salary already has a Protected HR editor and questioned a second editable salary on Payroll. The candidate now keeps **one salary editor in Protected HR**. The proposed Base salary option in the Payroll adjustment form has been removed. Payroll exposes a direct employee-verified link to Protected HR and a read-only preview of the active protected salary covering the draft's period. Applying that reviewed record uses the existing audited `payroll_set_line` contract, references the protected source version in its note, preserves other lines and changes only the selected draft. It does not rewrite protected salary, approved runs or payment snapshots. Source currency must match the entry; no conversion or attendance deduction is introduced.

The selected protected record uses canonical employee identity, applicable dates and active versions. Denied or superseded reads do not restore old amounts; failed applications retain the source preview and show failure. Future salary editing remains exclusively in the existing protected editor. Its currency default now matches validation/payload, and exact-cent parsing rejects overprecision rather than silently rounding.

## Implemented owner scope

- Calendar: recurrence fields use a single-column narrow-panel layout; private series completeness and owner controls are retained.
- People: linked employment warnings use the contract type atomically saved by the employment workflow, then refresh. Unit-head gaps consult actual memberships rather than requiring a roster link. Three attention lists are bounded, named keyboard-focusable scroll regions; the unclear organisation label now says Units without a recorded head.
- Overview: technical access approval panels removed from Admin and Manager home. Admin decisions remain in People & Access → Technical Support; Manager decisions remain under Get technical help. Staff receive no new authority. Attendance follows the remaining attention/announcement area.
- Units: compact searchable sortable numeric register, bounded directory/detail content, clear unit header and section navigation, actionable overview, all existing child sections, project opening and a corrected setup drawer visible from the unit itself. Only active recorded accounts count as heads.
- Decisions: show the original dated employment snapshot with before/after details, actor and reason, rather than generic capability/status jargon. Source verification and authority gate actions. Confirm review and Flag for follow-up retain history; neither pretends to reverse an already recorded change. Routine review comments are optional.
- Maps: tile errors retain employee markers/records, offer retry and explain external background loading. Older-browser sizing fallback retained. This does not prove the cause on a particular owner's PC; no new provider, background tracking or spend is added.
- Learning: role-colour-preserving course cards with proper hierarchy and explicit opening, searchable status-filtered catalogue, current assignment follow-up, focused builder and author-free preview; original supported lifecycle and permissions retained.
- Broader notification redesign remains discussion only. No new migration or production business-data write is part of this candidate. PR150 remains separate.

## Historical checks before the final salary steering

All commands use pinned Node 22.12.0. Browser tests use local Chromium 1194, synthetic intercepted responses and widths 390/1440; they do not establish real-account persistence or hosted authorisation.

| Check | Result | Local evidence |
|---|---|---|
| `npm run verify:source` | 635/635 PASS, no skips, exit 0 | `/tmp/ceac-reopened-review/current-source-tests.log` |
| `npm run build` | sealed production build PASS, exit 0 | `/tmp/ceac-reopened-review/final-build.log` |
| Payroll remediation browser journeys | 6/6 PASS, exit 0 | `/tmp/ceac-reopened-review/payroll-browser.log` |
| Existing duty-map, employment, employee creation, unit setup, announcement and reporting/Payroll form regressions | 18/18 PASS, exit 0 | `/tmp/ceac-reopened-review/changed-areas-browser.log` |
| Units bounded register/all eight detail sections; map failure/retry; original dated decision context | 4 PASS in initial six-test layout run | `/tmp/ceac-reopened-review/layouts-browser-fixture-failed.log` |
| Corrected recurrence-layout delta | 2/2 PASS, exit 0 | `/tmp/ceac-reopened-review/calendar-delta-browser.log` |

The initial source run had six failures: four callback-harness failures from the newly added initial-employee argument; one assertion still required approvals on Overview; and one migration inventory failure while an empty untracked migration existed. The callback harness now includes the real argument and adds authorised/unavailable employee tests. The approval contract checks the new destinations while retaining permission/version assertions. No empty migration is part of the candidate, and the unchanged migration inventory now passes.

The initial browser setup attempt used the wrong config directory, then a server process was unavailable; these are setup failures, not application passes. A subsequent attempt used a label locator that included select options; the corrected test selects the observed named combobox. The initial recurrence fixture omitted the exposed exact-count response header and correctly left edits disabled. The fixture now supplies its genuine count and exposes the header; application completeness safeguards were not weakened. Those historical logs were captured in the then-active temporary runtime; their paths are historical and are not substitutes for current source-bound evidence.

Rendered narrow recurrence fields were inspected: controls occupy separate rows without overlap, including custom interval and ending count. The rendered mobile Units detail was inspected with its distinct header, section navigation and bounded content. This is development visual inspection, not blanket approval of all requested designs.

## Still required

The scoped development journeys are complete as recorded below. Freeze the complete candidate, commit/push reviewed changes, then run the required source-bound release checks and genuine existing-account/live verification. Do not claim all requested repairs are accepted merely because Payroll, source tests or local browser fixtures pass. Preserve independent PR150 and production data/configuration.

Unexpected working-file changes were observed during inspection. Their cause was not verified; the assistant's claim of another active session was unsupported and withdrawn. No parallel writer should be asserted as fact from those observations alone. Preserve the complete existing working tree and reconcile forward.

## Resumed verification after owner salary steering

The /tmp runtime was unavailable after resuming. Pinned Node 22.12 / Playwright 1.56.1 were restored in ignored local artifacts. Full Chromium could not create its local singleton socket in this environment; that failed before page launch and is NOT an application test. The standard Chromium headless-shell runner subsequently worked with the repository's unchanged Playwright configuration. No sandbox approval or browser-test assertion was weakened.

- 32/32 focused browser journeys PASS, exit 0: current salary preview/application and denial, protected-employee routing and real form payloads, People edit/reload warning correction and named scroll regions, Calendar recurrence geometry, Units register/all eight sections/setup drawer, original workflow context, map failure/retry, connected project/Finance and check read failures. Log: `test-artifacts/reopened-journeys.log`.
- 48/48 additional browser checks PASS, exit 0: Learning composers/denial/preview/current follow-up, original reporting/privacy/invitation/schedule regressions, employee edit and unit setup, emitted CSS/JS budgets and sealed build. Log: `test-artifacts/reopened-final-browser.log`.
- 640/640 source tests PASS, no skips, exit 0. Log: `test-artifacts/reopened-final-source.log`.
- Additional recorded-salary eligibility, stale-run/closed-preview, missing private authority and denied-read tests are included in the existing payroll safety suite (16/16 PASS). Log: `test-artifacts/payroll-source-delta.log`.

These are development checks, not the final exact-head hosted qualification. A final small active-head filter and the source-reviewed complete candidate will be covered by frozen source-bound checks. Required release qualification, deployment and genuine no-write existing-account verification remain PENDING until recorded for their actual SHAs.

## Frozen candidate preparation

After the final unit-head filter, attention-list filter correction and salary-source validation, a clean `npm ci`, sealed build and full registered source selection completed successfully: 640/640 source tests, no skips. Logs: `test-artifacts/frozen-install.log`, `frozen-build.log`, `frozen-source.log`. The final browser delta (including cross-currency/missing salary denial, unverified decision-source denial and unit setup opening) is recorded in `test-artifacts/frozen-delta-browser.log`. Exact-head GitHub qualification remains required before merge. No application colour budget or security assertion was relaxed.

The last 25-test delta initially recorded 24 PASS and one locator failure: the missing-source warning correctly uses the shared attention notice's `status` role, while the new test requested `alert`. Its captured page showed both review actions disabled as required. A subsequent broad status locator also matched the fixture output; the final locator targets the notice text, without reducing the assertion. The test now asserts the actual status notice and retains both disabled-action assertions. This was corrected before any remote candidate/qualification was published.

## First exact-head qualification — 0c060ee6968b5687049f51edee34d26bcb8c7805

PR157, tree d014d4e2edcf6cd007d037635c57c48efe221427. CI 40657478086, Account Security 40657478005, Migration Replay 40657477803 and Quality Gate's SQL/authority job 122711988845 all SUCCESS. Quality Gate 40657477943 FAILED and is not release acceptance: browser shard 1 (122711988920) had the obsolete Learning introduction assertion and the downstream missing test-course consequence; shard 3 (122711988991) had two source-string assertions for the replaced generic Check title / Unit Head badge; shard 7 (122711989014) had four assertions for the renamed Organisation exceptions heading. The remaining five browser shards passed. These specific assertions are updated to the owner-requested introduction, original-change context, unit register and plain head-gap heading; functional creation/completion, authorities and other checks are retained. Application source has not changed in this correction.

The Vercel preview dpl_G6steBfc4GTUG7fpRakzt1Zuhi5t is READY on this exact SHA; this does not override the failed gate. Production remains d82baab58b4be1b6f6fb2835ecd2db31c9156794. The existing HR account signed in through the secure browser form; no production payroll/HR/workflow records were changed. Candidate correction and all required exact-head checks remain PENDING before release.

The focused correction selection passed 6/6 (four People layout widths plus both updated system/Units source contracts), exit 0: `test-artifacts/qualification-delta-browser.log`. A production read-only aggregate confirmed 18 roster records, nine linked records whose roster import still says not_recorded while the atomically saved profile type is present, and zero mismatches between linked employment_records and profiles. This validates the display-source diagnosis; no employee type was inferred or written to remove warnings. The later real Staff learning corridor remains subject to the next exact-head isolated run.

## Corrected qualification — da2e672343770e3acf5a21d6740f5ebe14961f1c

Tree c13ee838e912c0bb85a34d3827f83f87c4301af8 (local equivalent 27b6fa963923479dbcf8964a43359798ba66d5e6). CI 40660342590, Account Security 40660342568, Migration Replay 40660342443 and full Quality Gate 40660342545 all terminal SUCCESS. All eight browser shards passed: 131 + 133 + 201 + 55 + 128 + 127 + 125 + 128 = 1,028 PASS, with one existing deferred universal-MFA case skipped. Real isolated Staff learning creation/completion and the dependent corridor passed. SQL/authority job 122721589961 passed. This is valid historical integration evidence for unchanged contracts, not a release waiver for subsequent code.

## Final permission-refresh correction

Read-only review found two new preview-cache windows while the same actor's permission list changes. Payroll now immediately withholds the private salary sheet without protected-HR preparation access, invalidates outstanding reads and clears the selection on permission changes. Workflow original-change verification uses a fresh scope token and remounts when permissions change; restoration of an identical permission list cannot revive an earlier verification. No server capability, SQL/RLS rule or protected data was changed.

The prior useful full run was allowed to finish; no checks were cancelled to publish this correction. The correction has 3/3 focused permission/source-contract checks and 17/17 complete salary/decision/layout browser cases PASS, plus 640/640 source tests and sealed production build PASS (Node 22.12, Chromium headless shell 1194). Logs: test-artifacts/permission-delta-browser.log, permission-final-browser.log, permission-source.log and permission-build.log. Exact-head qualification is required for the final code before merge. Production remains unchanged.

Map investigation in the signed-in production browser confirmed all ten street-background images failed while the map/office marker container rendered. The page's image CSP permits HTTPS; this evidence distinguishes external background loading from missing attendance data, but does not establish a specific cause on the owner's individual PCs. No claim that older hardware is the cause is made.

## Permission correction qualified — 2135fab5b392b4738aceeb6fb4afb82c7f8bf073

Tree f7050bad558aa3dc33e55bce1d64c453ac772515 (local d79d8625ac27a41ddbd8beb24e5afdeda7ec1a2d). All four required workflows terminal SUCCESS: CI 40662995307, Account Security 40662995241, Migration Replay 40662995249, full Quality Gate 40662995126. All eight browser shards, evidence merge 122736918362 and final role-and-rls 122737199257 passed. No useful in-flight check was cancelled.

## Final unit-head source reconciliation

A further production read-only aggregate found 16 active units without an active recorded head, including three that the legacy roster-placement fallback incorrectly treated as covered. The display now uses only the active manager membership recorded for the specific unit; neither being a manager elsewhere nor roster placement implies unit authority. The new regression fixture includes an actual head in one unit and a staff-only membership in another, and verifies the second unit still appears for review. No actual head, role, membership or permission was assigned or changed.

All six affected People browser cases passed (including four layout widths), all 640 registered source tests passed, and the sealed build passed after the final correction. Logs: test-artifacts/head-source-browser.log, head-final-source.log and head-final-build.log. Payroll copy also explicitly distinguishes applying a recorded salary to a draft from payment snapshots captured when a run is created; payment refresh is not falsely offered. The final code must pass its own exact-head required checks before release; prior green SHAs remain historical evidence only. Production is still unchanged at this checkpoint.
