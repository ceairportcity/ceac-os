# CEAC OS — PR #47 Product Functional Continuation and Independent Source Evidence
**Date:** 11 October 2026
**Scope:** product implementation ONLY; release and production unchanged
**Source branch:** `chatgpt/product-admin-attendance-integrity-20261011`
**Verified pre-checkpoint implementation HEAD:** `eb437978b32da2f20c6f960f3f28d1d46ff6295f`
**Base:** frozen review PR #44 at `e00f13873409e4cc16ec1493b60b71d5cde1114a`.

## Implemented in this continuation

1. **Administration identity safety:** reset prior organisation/identity records as soon as the viewed account changes; guard all asynchronous queries and the leave-action completion path with generation leases. Do not show a prior user's roster or dashboard figures while loading new authorised records; do not claim an empty inbox/meeting schedule on read failure. A saved leave decision enters a new verification load without keeping the UI permanently busy.
2. **Attendance integrity:** count recent recorded session days using UTC/Accra calendar dates, unique per person; reject invalid/future/stale session timestamps; do not confuse a work-session record with actual presence or an employee/payroll absence.
3. **Invitations:** reject invalid email and missing required new-invitation facts *before* `create_pending_invitation`; detect pre-existing profiles and outstanding invitations in People & Access; when the invitation/resend preparation was saved but OTP dispatch failed, show a specific **recorded-but-email-unconfirmed** error and refresh state instead of encouraging duplicate identities. Do not treat OTP acceptance as delivered mail.
4. **Invitation lifecycle:** Administration's unresolved invitation queue includes expired activation links, excludes revoked or resolved records and explicitly indicates links needing renewal. The existing invitation workflow remains the only path for resend/cancellation.
5. **People & Access:** isolate loaded roster, unit, invitation and lane membership data by authenticated organisation/profile; older requests cannot repopulate data after account change or a failed refresh. Show real sub-team placements; disable duplicate unit responsibility records and require a current unit membership before adding a team, with audited RPCs remaining the only write path.
6. **Technical Help/Support:** isolate reporter case state, saved drafts and queue by active identity and generation. Verify active support membership before displaying queue, prevent slow responses from reintroducing a former account's cases; preserve reporter-only visibility. Add safe case claiming/release, status filters, conditional `updated_at` saves, explicit unavailable-backend notices. The personal queue omits colleagues' assignments. Technical Support cannot mark access cases fulfilled before a business approval and execution record is integrated.
7. **Visual/source contracts:** extend Admin desktop/tablet/mobile viewport coverage, truthful error states, support-only responsive styles and permanent test contracts.

## Executed verification — exact values

**Isolated local Node 22.16.0 unit suite:** `node --test tests/admin-today-summary.test.mjs tests/technical-support-v1.test.mjs tests/invitation-safety.test.mjs` — **20 passed, 0 failed, 0 skipped**. The following SIX local files were verified byte-for-byte against their GitHub Git blob hashes after the test execution:

| File | Verified Git blob SHA |
|---|---|
| `src/lib/adminTodaySummary.js` | `235565dce2e9772aa3c66c83b0eed00c764388d5` |
| `tests/admin-today-summary.test.mjs` | `3fe38b36734ab9d8b33c25787ad49ede94bf67d1` |
| `src/lib/technicalSupport.js` | `b77fb20b657e0aa20d03b4b9c04d4fc36bf0b35e` |
| `tests/technical-support-v1.test.mjs` | `25fd7b1e2c810544f321d938f05d8bdd1c3ab6ae` |
| `src/lib/invitationSafety.js` | `698cab3b4b9af7a55705b9abfebc654bcdf9d295` |
| `tests/invitation-safety.test.mjs` | `70d1d7a65c6a557e972bf7d5ac6014e0b91f8530` |

**Independent live-branch source structure review:** 46/46 explicit read-only assertions PASS against current GitHub content for account-scoped reads/writes, invitation safeguards, attendance truthfulness, source-test wiring and support case concurrency/role boundaries. These are lightweight source checks, not executable browser, JSX compile, interaction, database or migration acceptance.

**Repository gates added:** `tests/invitation-safety.test.mjs` and `tests/product-closure-source-contract.test.mjs` were appended to `npm run verify:source`; existing attendance/Support tests were extended. The full source verification script has NOT been executed at this head because the last-observed GitHub Actions jobs failed before executing steps, Vercel Hobby preview builds were rate-limited and the prior Codespace browser could not operate a real terminal. Do not describe these unexecuted tests as passed.

**Read-only production schema checks:** `pending_invitations` has `resolved_at`, `revoked_at` and `expires_at` fields; current observed counts were one unresolved, zero expired and one unexpired. The production `support_cases`, `support_case_events`, and `support_team_memberships` tables remain absent. No production SQL writes/migrations/Auth/configuration or Vercel deployment changes made in this product continuation. **No TinyFish credit use or Vercel preview triggers in this continuation.**

## Required before release integration

- Fully execute latest exact-HEAD `npm ci`, `npm run verify:source`, `npm run build` and full authenticated desktop/mobile role workflows, including all staff, manager, volunteer, Executive, Administration and Support functions.
- Review and reconcile owner-approved literal Admin/Executive/Volunteer/Support mocks against actual screenshots; no approval or visual acceptance is inferred from source tests.
- Finish Technical Support's secured backend migration, membership transitions and business-approval/technical-execution path on a disposable database and pass reviewed RLS, privacy, MFA and migration replay/restore gates. The app's newly added support controls are intentionally **not operational** until the corresponding backend is verified and deployed.
- Release assurance owner must independently verify real-user MFA, invitation delivery, isolated replay of the canonical migration sequence, encrypted backup restoration and release/roll-back plan.
- Keep PR #47 **DRAFT**, do not self-merge to `main` or mutate PR #44. The exact-head source-only work is **not production acceptance**.


## Further independently reviewed fixes — Administration, Workforce, invitations and support

**Exact application HEAD before this documentation update:** `92925d6ffb250b33e511f788642469cc09307c78`.
**Release PR #44 frozen:** `e00f13873409e4cc16ec1493b60b71d5cde1114a`.
**Production main unchanged:** `827fbe7391467dd13d6e411527416402a252993c`.

- All **24 direct Administration reads** have an explicit `org_id = me.org_id` PostgREST condition. The 12 Workforce direct reads have the same guard, independently cross-checked against the existing read-only production table catalogue: every table has an `org_id` column. RPC-level tenancy still requires independent release verification.
- Administration overview now passes calendar, employee roster, payroll readiness and alerts to the renderer **only after the current identity's full snapshot is verified**. A prior user's records cannot flash in the header before React effect cleanup.
- Administration invitations-to-review tiles and decision actions now navigate straight to the existing authorised People & Access **Invitations** tab, not the generic People directory; the invitation queue action is capability-gated.
- The Administration calendar says exactly what it knows: at most **six** future meeting records in the next **14** days; missing preview entries cannot be described as proof no meetings exist. Query bounds have not been enlarged.
- People & Access mutations have synchronous **single-flight** locking, identity-generation leases and noncontradictory partial-success messaging. Technical Help request creation and Administration leave decisions are similarly single-flight; duplicate clicks cannot schedule duplicate RPC operations.
- Technical Support operators may refresh a stale selected case and retry history if the event query rejects; old unverified history is cleared instead of displayed. Business approval and execution gates remain intact.
- Sensitive Support, People, Workforce, Administration, HR and Payroll screens are **keyed by identity** at their React shell boundary. Workforce additionally remounts when the active unit or operational role changes.
- Workforce datasets are explicitly organisation-scoped and settled independently. A rejected network fetch no longer causes a perpetual Loading state or silently retains stale rows for that failed dataset. A later read cannot overwrite a newer scoped refresh.
- Accra (UTC year-round) controls Workforce planning-day math, work-schedule weekdays, session clock/date labels and approval-event timestamps, regardless of the viewer's computer timezone.
- Workforce day-type/schedule/leave/correction/policy RPC actions now use synchronous **single-flight** locking and `try/catch/finally`, distinguish written-but-unverified refresh from failed writes, and require relevant **correction/leave plus decision history** to reload before declaring completion. No production attendance or payroll records were changed.

### Source-level verification actually executed

- Node 22.16.0 isolated suite `node --test tests/admin-today-summary.test.mjs tests/technical-support-v1.test.mjs tests/invitation-safety.test.mjs tests/workforce-date.test.mjs tests/workforce-queries.test.mjs` => **26 passed, 0 failed, 0 skipped**.
- Ten tested helper/test inputs matched canonical GitHub Git blob SHA byte-for-byte. This includes earlier six Administration/Support/Invitation blobs, plus:
  - `src/lib/workforceDate.js`: `6df04cae29432113a7f562b4dc1a1c57f0e07ec2`
  - `tests/workforce-date.test.mjs`: `7fccf2bbdebc6f28bb426bf49982ece4ed5fc31e`
  - `src/lib/workforceQueries.js`: `8c881157cbf9a894a59fe9f25d96d0a910c9300a`
  - `tests/workforce-queries.test.mjs`: `b99dc6df774a76222c4a835b0732442bfe23f3ce`
- Current live-branch sources: **113/113** product source-contract pattern assertions PASS; **59/59** Administration visual-source pattern assertions PASS; **24/24** direct Administration table reads and **12/12** Workforce table reads visibly organisation-scoped. Seven sensitive React remount boundaries independently checked.
- This is **NOT** execution of every `node --test` contract or the latest Vite/JSX build. It is not an authenticated browser screenshot, backend security, real MFA, payroll or release acceptance.
- Exact latest PR #47 `npm ci`, `npm run verify:source`, `npm run build`, responsive screenshot/mockup comparison, staff/manager/volunteer role acceptance and restored-production-clone migration testing remain mandatory and outstanding.
- Technical Support production tables/approval ledger are still **not deployed**. Release integration, Supabase production, Vercel production, PR #44 and `main` have not been touched. No TinyFish, new CI system, paid provider or Vercel preview reruns were used during these changes.

**Decision:** Product development PR #47 remains **DRAFT / NO-GO**, to be independently tested/reviewed and integrated later; source-only progress is not production approval.


## Further confidential-People and case ownership fixes (11 October 2026)

**Implementation HEAD before this appended evidence:** `066e9612b8d9e081254df3f5927d15c00bfef28f`. Branch: `chatgpt/product-admin-attendance-integrity-20261011`.

- **Technical Help:** corrected a real single-flight validation defect. Previously `submitBusyRef.current` became true before summary/description validation and the invalid-input return never unlocked it. Now invalid drafts can be corrected and successfully resubmitted; rapid valid double-submits remain synchronously locked.
- **Technical Support:** case status/resolution controls are now disabled for unassigned cases and cases owned by another technician. The UPDATE also requires matching `assigned_to=me.id` and `updated_at`, so concurrent reassignment cannot silently overwrite a colleague's work. Support event-history reads explicitly require the active organisation *and* selected case.
- **People/HR directory:** added per-request generation leases to employee roster, selected employee detail, confidential files and access-navigation; slow record A cannot appear after operator opens record B or switches to Invitations. Pending private editors and old upload controls are cleared on navigation. Failed roster reads fail closed to a retry view rather than showing outdated confidential employee information.
- **Protected HR:** salary/payment/identifier updates are single-flight; write and refresh are bound to the originally selected employee ID. Rejected RPCs are handled without leaving a permanent busy state. A recorded-but-unverified refresh is not presented as a fully confirmed saved edit. Invalid or overflowing currency minor units and invalid stored currency metadata cannot silently become authoritative compensation or crash the employee screen.
- **Employment:** changes are single-flight, bind to the selected immutable profile ID, require a server-returned current record, and only update the selected employee if the employee ID remains unchanged. A subsequent roster refresh is checked and can report failure.
- **Volunteer decisions:** the decision update is conditional on `status='pending'`, requires a returned changed row (`.maybeSingle()`), and cannot label zero rows updated as success. Existing production does **not** yet have the `volunteer_change_recommendations` table, so this remains reviewed future-compatibility code, not a production-tested volunteer approval.
- **People & Access:** duplicate role assignments and residual team placements cannot be treated as independently safe member removal. A read-only inspection of the production `admin_record_unit_responsibility` RPC confirmed that ending a unit responsibility atomically removes that person's memberships from *all* sub-teams in the affected unit, including inactive sub-teams. The interface therefore asks for explicit confirmation and explains this consequence rather than incorrectly demanding individual team removals. Auto-selection now uses distinct unit IDs, so a person holding multiple roles in one unit still selects that unit correctly.
- **Accra date integrity:** employee work sessions, protected HR roster birthday, support events and invitation timestamps use Ghana/Accra time rather than the operator browser's local timezone.

### What has and has not been verified

- Local isolated Node 22.16.0 executable suite was rerun on the 12 helper/test files with exact matching committed Git blob IDs: **28 passed, 0 failed**. It covers attendance summary, Support pure helpers, invitation controls, Ghana date boundaries, failed Workforce query settlement and finite leave-policy inputs.
- Post-change live GitHub source assertions: **177/177** product source-contract regex assertions PASSED and **59/59** Administration premium source-contract regex assertions PASSED. These were evaluated independently against exact GitHub file bytes; the complete `node --test tests/product-closure-source-contract.test.mjs` and other JSX-dependent tests have **not** run.
- Direct read scopes unchanged: Administration **24/24** and Workforce **12/12** queries use `org_id=me.org_id`. Production database status has only been inspected read-only.
- PR #47 remains draft and review-only. The secure Technical Support backend is not yet deployed; real authenticated Staff, Manager, Executive, Admin and Volunteer workflows, protected-HR authority, MFA, invitation email delivery, production RLS, full application build, responsive screenshot parity, migration replay and backup restore still require independent execution and acceptance.
- No TinyFish, CI replacement, Vercel rerun/production build, Supabase write or GitHub main/PR #44 modification occurred.


## In-app access acceptance and isolated compensation tests

**Verified PR #47 product HEAD before this documentation commit:** `1514edb87107c88c5e41aa3b2a26f510b8d75809`.

- Inspected production `admin_record_unit_responsibility` and `admin_set_work_lane_membership` definitions with read-only catalogue SQL. The first atomically removes same-unit team placements when a responsibility is ended, including assignments to inactive sub-teams; the second checks that a new lane belongs to an active unit and that the person already has an active unit role. No production function was edited.
- Corrected an initially overrestrictive People & Access form assumption: unit responsibilities need not be manually stripped of each team assignment first, because the production function handles the dependent rows. The form now opens an accessible in-app review dialog that explicitly confirms ending all affected team placements and captures the immutable selected profile, exact membership and entered audit reason. A native `window.confirm` was replaced without changing server authority.
- Extracted safe salary formatting and conversion from the protected-HR employee panel into `src/lib/protectedCompensation.js`; the UI uses this helper. `tests/protected-compensation.test.mjs` verifies GHS minor-unit arithmetic, malformed and overflowing inputs, rounding and unverifiable currency metadata.
- **Actually executed local Node suite:** `node --test tests/*.test.mjs` on seven isolated test files against their exact Git blob source: **32 tests passed, 0 failed, 0 skipped**. The two new verified source/test blobs are `1cb296cb96e6ef3907faea7f78e919146012fbe5` and `c91b314f02315f7fab9317d96e7938dc2f6ccd60`.
- **Independently evaluated live-GitHub source contract:** **180/180** product assertions and **59/59** Admin premium source assertions passed. This is neither a full `npm run verify:source` execution nor an executable JSX build. Protected-HR backend RLS, email delivery, MFA, authenticated visual tests, secure Support backend, migration/backup and release acceptance are still pending.
- PR #47 stays **DRAFT / NO-GO**. PR #44, production main, Supabase production and Vercel production are unchanged. No TinyFish or rate-limited preview use.
