# Stage 2 P0 — current-source route, overlay and authority census (17 Oct 2026)

**INVENTORY, NOT FEATURE ACCEPTANCE.** Reviewed source SHA `4abbd390922a655d05c3cf2a6f7794f5a98ceca6` on sole draft PR #118; derived from `src/App.jsx`, `src/experience-v2/shell/navigation.js` and directly inspected existing screens. This document exposes NO real employee records, credentials or confidential designs. It supplements the [P0–P9 acceptance ledger](CEAC_STAGE2_SEQUENTIAL_EXECUTION_LEDGER_2026-10-17.md) and does not authorize P1/P2 commencement or P9 release.

## 1. Enumerated signed-in root client tabs

There are **48** explicit `tab ===` routing cases (the original 47 plus the owner-approved Executive Projects tab of 30 October 2026), plus a separate default `me` My Hub fallback. The first column below is derived from the real source, not a speculative future route. A role-shell link is just a navigation choice; it is NOT RLS, Storage or RPC authorization. The client can attempt a hidden tab via its query parameter and most routes have no additional root guard, so every sensitive data read/write needs **server-enforced role and tenant policy tests**. A conditional screen component may enforce additional UI capabilities, but UI-only denial is insufficient.

| Tab | Main role navigation | App-level render routing | Root screen/component | Acceptance stage | Proof |
| --- | --- | --- | --- | --- | --- |
| `guide` | Deep link, submenu or conditional | Signed in; no additional root guard | `Guide` | P0/P7 | SOURCE ONLY |
| `account` | staff, manager, admin, executive | Signed in; no additional root guard | `AccountActivity` | P2 | SOURCE ONLY |
| `achievements` | Deep link, submenu or conditional | Signed in; no additional root guard | `PersonalAchievements` | P6 | SOURCE ONLY |
| `technical-help` | Deep link, submenu or conditional | Signed in; no additional root guard | `TechnicalHelp` | P0/P7 | SOURCE ONLY |
| `technical-support` | Deep link, submenu or conditional | Signed in; Support capability conditional render | `TechnicalSupport` | P0/P7 | SOURCE ONLY |
| `primitives` | Deep link, submenu or conditional | isAdmin | `DesignPrimitives` | P0/P7 | SOURCE ONLY |
| `home` | staff, manager, admin, executive | Signed in; role-selects component | `Home / ManagerHome / AdminHome / ExecutiveHome` | P3 | SOURCE ONLY |
| `team` | staff, manager | Signed in; role-selects component | `StaffTeam / Team` | P0/P7 | SOURCE ONLY |
| `work` | staff, manager, admin, executive | Signed in; role-selects component | `Work / ManagerWork / AdminWork / ExecutiveWork` | P4 | SOURCE ONLY |
| `staff-calendar` | staff | isStaff | `StaffCalendar` | P4 | SOURCE ONLY |
| `messages` | staff, manager, admin, executive | Signed in; no additional root guard | `Inbox` | P0/P7 | SOURCE ONLY |
| `projects` | manager | isUnitManager | `ManagerProjects` | P5 | SOURCE ONLY |
| `calendar` | manager | isUnitManager | `ManagerCalendar` | P4 | SOURCE ONLY |
| `manager-finance` | manager | isUnitManager | `ManagerFinance` | P0/P7 | SOURCE ONLY |
| `manager-reports` | manager | isUnitManager | `ManagerReports` | P6 | SOURCE ONLY |
| `exec-projects` | executive | isExec | `AdminProjects` (existing cross-department composer; Executive RPC authorization required) | P5 | SOURCE ONLY — 30 Oct 2026 addition |
| `exec-organisation` | executive | isExec | `ExecutiveOrganisation` | P0/P7 | SOURCE ONLY |
| `exec-finance` | executive | isExec | `ExecutiveFinance` | P0/P7 | SOURCE ONLY |
| `exec-reports` | executive | isExec | `ExecutiveReports` | P6 | SOURCE ONLY |
| `record` | Deep link, submenu or conditional | Signed in; no additional root guard | `Record` | P6 | SOURCE ONLY |
| `announcements` | Deep link, submenu or conditional | Signed in; no additional root guard | `Announcements` | P0/P7 | SOURCE ONLY |
| `strategy` | executive | Signed in; no additional root guard | `Strategy` | P5 | SOURCE ONLY |
| `delivery` | executive | canUseDelivery | `Delivery` | P5 | SOURCE ONLY |
| `workload` | Deep link, submenu or conditional | canUseWorkload | `ResourceWorkload` | P0/P7 | SOURCE ONLY |
| `performance` | Deep link, submenu or conditional | canUsePerformance | `Performance` | P6 | SOURCE ONLY |
| `learning` | Deep link, submenu or conditional | canUseLearning | `Learning` | P0/P7 | SOURCE ONLY |
| `assets` | Deep link, submenu or conditional | canUseAssets | `Assets` | P0/P7 | SOURCE ONLY |
| `compliance` | Deep link, submenu or conditional | canUseCompliance | `Compliance` | P6 | SOURCE ONLY |
| `cost` | Deep link, submenu or conditional | isAdmin | `Cost` | P0/P7 | SOURCE ONLY |
| `finance` | admin | isAdmin | `Finance` | P0/P7 | SOURCE ONLY |
| `reporting` | admin | isAdmin | `Reports` | P6 | SOURCE ONLY |
| `attendance` | staff, manager, admin | canUseWorkforce | `Workforce` | P3 | SOURCE ONLY |
| `people` | admin | canManagePeople | `People` | P0/P7 | SOURCE ONLY |
| `lifecycle` | Deep link, submenu or conditional | canManagePeople | `AdminLifecycle` | P0/P7 | SOURCE ONLY |
| `protected-hr` | Deep link, submenu or conditional | canAccessProtectedHR | `AdminProtectedHR` | P6 | SOURCE ONLY |
| `payroll` | admin, executive | canUsePayroll | `AdminPayroll` | P0/P7 | SOURCE ONLY |
| `units` | Deep link, submenu or conditional | isAdmin | `Units` | P0/P7 | SOURCE ONLY |
| `admin-projects` | Deep link, submenu or conditional | isAdmin | `AdminProjects` | P5 | SOURCE ONLY |
| `admin-calendar` | admin | isAdmin | `AdminCalendar` | P4 | SOURCE ONLY |
| `exec-calendar` | executive | isExec | `AdminCalendar` | P4 | SOURCE ONLY |
| `audit` | Deep link, submenu or conditional | canViewAudit | `AdminAudit` | P0/P7 | SOURCE ONLY |
| `events` | Deep link, submenu or conditional | canViewAudit | `AdminEvents` | P0/P7 | SOURCE ONLY |
| `workflows` | Deep link, submenu or conditional | canUseWorkflows | `AdminWorkflows` | P0/P7 | SOURCE ONLY |
| `policies` | Deep link, submenu or conditional | canManageAuthority | `AdminPolicies` | P0/P7 | SOURCE ONLY |
| `integrations` | Deep link, submenu or conditional | canManageIntegrations | `AdminIntegrations` | P0/P7 | SOURCE ONLY |
| `authority` | Deep link, submenu or conditional | canManageAuthority | `AdminAuthority` | P0/P7 | SOURCE ONLY |
| `settings` | admin | isAdmin | `ControlCenter` | P0/P7 | SOURCE ONLY |
| `office-settings` | Deep link, submenu or conditional | isAdmin | `OfficeSettings` | P0/P7 | SOURCE ONLY |
| `me` (fallback) | staff, manager, admin, executive | Any unmatched signed-in tab falls back to My Hub | `Me` | P0/P7 | SOURCE ONLY |

All four built-in shell role sets have an always-available Help route and a `support.case.manage`-gated separate Support destination. Technical Support is **not** a fifth employment role. The volunteers' authorised employment-like view needs its own nonsalaried negative tests. Base per-role destination counts: Staff 8, Manager 11, Admin 12, Executive 12. The shell applies additional capability filters to individual entries. Hidden deep links are not evidence of permission.

## 2. Actual nested routing and state order

The source's overlay precedence is: (1) `itemId` → `Item`; (2) `assigning` → `Assign`; (3) `projectId && isUnitManager` → current-unit `ManagerProjects`; (4) `goalId` → `Goals`; (5) `person && isManager` → `PersonDetail`; (6) `roomContext` → `Room`; (7) `meetingDraft` → `MeetingScheduler`; (8) `meetingId` → `Meeting`; (9) `pageForTab()` root fallback. These overlays are not independently full-coverage-tested simply because the router handles them.

The actual URL parser supports `tab`, `item`, `project`, `meeting`, and `roomKind` / `room` for unit, sub-team, and project rooms. Other drawer state (person, assignment, goals, meeting draft) is in React state. Account activation and password recovery handle `/activate` and `/reset-password` before normal root routing. Each overlay must prove own-unit/own-person constraints, cross-unit dismissal, inaccessible IDs, narrow client error states, keyboard/mobile interactions, and proper return/navigation. URL presence never grants a tenant read.

## 3. Screen-to-backend reader/writer dependency clusters

These are **direct source dependencies**, compiled from actual `.from(...)`, `.rpc(...)` and component imports in current `src/screens` sources. They do NOT enumerate every imported child component or prove a legal RLS predicate. For every family, required final verification is exact-SHA positive actor journey plus cross-tenant, inactive-identity, wrong-unit, wrong-capability and AAL1 negative attempts. Normal users have no implied access to elevated payroll, Support, HR or Integration functionality.

| Family | Readers / actors | Inspected source areas | Direct data/API dependency examples | Required authority negative proof | Stage |
| --- | --- | --- | --- | --- | --- |
| Overview and attendance | Staff, Manager, Admin/HR, Executive; Support staff by employment role | Home/ManagerHome/AdminHome/ExecutiveHome; Workforce; EmployeeWorkSession | work_sessions, work_items, leave_requests, unit_memberships, schedules, attendance corrections; verified session RPCs | Only genuine actor/session evidence; HR correction capability; personnel locality and multi-unit consistency | P3/P8 |
| Work and delegations | All employment roles; invited volunteers within grants | Work/ManagerWork/AdminWork/ExecutiveWork/Assign/Item | work_items, submissions, work_sessions, projects, objectives, unit_memberships; create_task_with_checklist/create_typed_work | Creator, assignee, reviewer, unit and personal privacy; no unauthorised write | P4/P8 |
| Projects | Unit Head, authorised Admin and Executive readers | ManagerProjects/AdminProjects/Delivery/ManagerProjectClose | projects, project_units, work_items, objectives, project_phases, milestones, project closes; create_project_with_participants | Unit-create authority, cross-unit visibility, project-close evidence and count-once | P5/P8 |
| Performance and published achievements | Person/Manager/Compliance/HR/Executive boundaries | PersonalAchievements/ManagerReports/Performance/Reports/ExecutiveReports/Compliance | work_items, submissions, report_periods, reports, appraisal_cycles and evidence; save_and_submit_report, admin HR RPC | No inferred human scores or HR narrative disclosure; report state/error must fail closed | P6/P8 |
| People and employment | Admin personnel staff; private HR delegated grants | People/PersonDetail/AdminLifecycle/AdminProtectedHR | profiles, unit_memberships, employment_records, leave; admin_employee_roster_detail, hr_employee_protected_record | People.manage differs from hr_private.access; volunteers are not salaried | P6/P8 |
| Finance and payroll | Manager budget, Admin finance, Executive finance; payroll capability only | ManagerFinance/Finance/Cost/ExecutiveFinance/AdminPayroll | budgets, spend_lines, internal_transfers; payroll_list_runs/payroll_approve_run | No broader finance or protected compensation from navigation alone; payroll not task-time computed | P6/P8 |
| Technical Support | All authenticated users can report; approved Support case managers can inspect | TechnicalHelp/TechnicalSupport | support_cases, support_case_events, support_case_safe_status, support_team_memberships | Case reporter limited projection, audited Support authority, no implicit HR/admin power | P0/P2/P8 |
| Personal calendar and communications | Staff/Manager/Admin/Executive, with private calendars | StaffCalendar/ManagerCalendar/AdminCalendar/Inbox/Room/Meeting | personal_calendar_events, personal_day_tasks, meeting_sessions, room_messages | Private personal calendar never leaks into managerial reporting | P4/P8 |
| Connected Apps Edge runtime | Integration managers; separately authenticated background worker | AdminIntegrations, integration-runtime deployed Edge v1 | integration_connectors and provider RPC; auth.getUser, integration.manage; worker-key RPC | JWT and capability alone do not demonstrate universal P2 AAL2; inspect worker privilege split and deny probes | P2/P8 |

### Hosted baseline security facts (read-only, not acceptance)

Original Supabase project `efjljhftsesssumtshvp` was healthy on inspection, with **152 applied** migrations through `148_support_invoker_projection`, while repository's future migration series includes 149–156 and the historical pending Google-only migration. Production has **zero verified TOTP factors**, **two active profiles with unconfirmed Auth email**, **no current Google-only PostgREST pre-request hook**, and **no installed Google-only Storage policy**. Current `storage.objects` has five permitted access policies for explicitly scoped HR-private and operational files. All discovered public base relations in the inspected read-only RLS audit had RLS enabled; selected sensitive empty-policy tables also lacked direct anonymous/authenticated table grants. This does **not** prove future AAL2 user sessions, safe migration transitional application, recovery, or negative tenant isolation. One deployed Edge function `integration-runtime` is currently v1 with JWT verification and distinct credentialed worker RPC; it has not been certified under planned universal AAL2 requirements. Live read-only security advisor notes one leaked-password-protection warning, plus existing carefully restricted security-definer grants. **No live change was made.**

## 4. Verified UI design inventory and P1 handoff

The exact checked-in [white/light-blue V4 canonical interactive HTML](../design/stage2-v4/CEAC_STAGE2_V4_CANONICAL_INTERACTIVE.html) has Git blob `8e49e09253a677baa194862a73ee52c3c56570c0`, **seven** demo navigation pages (`overview`, `work`, `projects`, `team`, `calendar`, `reports`, `support`) and five demo role options (single-unit Manager, multi-unit Manager, Staff, Administration/HR, Executive). Those controls are **not** 47 complete, owner-approved desktop/mobile application screens. Additional Design P1 requirements: Volunteer, payroll/finance, protected HR, real compliance review, nested projects/new latest approved Projects PNG identity, work assignment, quarterly human ratings, report PDFs, TOTP/recovery, empty/error states, and all role mobile layouts. Existing user-approved visual direction is locked; absent references require specific new owner sign-off rather than inventing approval.

## 5. Accepted evidence vs remaining P0 gate

- Exact-source role navigation contract `tests/stage2OwnerUxContract.test.mjs` verified against App and navigation; source CI **PASS** at SHA `4abbd390922a655d05c3cf2a6f7794f5a98ceca6`: [workflow](https://github.com/ceairportcity/ceac-os/actions/runs/39009924783).
- [Account Security](https://github.com/ceairportcity/ceac-os/actions/runs/39009924848), [Migration Replay](https://github.com/ceairportcity/ceac-os/actions/runs/39009925001) and Quality Gate SQL scope PASS at this reviewed SHA. Browser shards **cannot be called passed** while the still-running or failed jobs have not closed. Earlier Manager Reports and Staff/Executive visual/CSS failures remain unreleased defects, not reasons to mutate P6/P7 during P0.
- **Remaining P0 closure:** tie all nested/drawer/action entries to backend policy owners and existing negative test coverage, reconcile owner decisions and any recoverable Codespace uncommitted edits, and explicitly record unresolved dependency vs accepted inventory. Once P0 evidence meets the owner's contract, update the acceptance ledger with exact SHA and hand off to P1 **without** deploying or undertaking speculative P2–P7 feature work.

**No P0 acceptance is claimed by this source census.**


## 6. Explicit existing test-to-authority mapping (P0 discovery, not acceptance)

| Data/role boundary | Existing concrete executable evidence | Interpretation at reviewed baseline | Later-stage negative acceptance |
| --- | --- | --- | --- |
| Four employment role shells, responsive navigation and route source | `tests/stage2OwnerUxContract.test.mjs`, `tests/experience-v2-shell.spec.js`, `tests/stage2-approved-role-workspaces.spec.js` | Root destinations resolve and role-specific screens have source assertions; not a claim that every nested form is approved | Unauthorised deep links, 320/390 desktop-mobile keyboard, complete V4 owner reference parity P7 |
| Solo/multiple Manager headships | `tests/onboarding-multiunit.spec.js`, `tests/stage2SharedPersonalSession.test.mjs` | Real source checks and synthetic role browser flows exist | Wrong-unit stale async result, shared own attendance, other-unit project/HR access P3–P5 |
| Work and recurrence | `tests/experience-v2-work-family.spec.js`, `tests/stage2-recurring-work.spec.js`, `tests/stage2AssignedRoutines.test.mjs` | Existing source/browser implementation evidence, not business flow acceptance | Authenticated stranger, wrong assignee, recurrence idempotence, private Calendar isolation P4 |
| Projects and Support | `tests/stage2-approved-role-workspaces.spec.js`, `tests/technical-support-source-contract.test.mjs`, `supabase/tests/admin_hr_security_gate.sql` | The browser suite asserts read-only Admin/Executive projects and scoped Support case workflows; SQL role grants must still be proven | Forbidden role project editing, Reporter B case data, inactive Support membership, cross-org negative probes P5/P8 |
| Human rating, HR, Compliance and personal reports | `tests/stage2OwnerReportingSource.test.mjs`, `tests/stage2HumanAppraisalSource.test.mjs`, `supabase/tests/stage2_human_appraisal_ratings_gate.sql` | Human and factual operational scores separated in contract/source; full employee→Manager→Compliance→HR→Executive issuance is not yet proven | No reviewer self-approval, no private HR narrative leak, no false published report/export P6 |
| Manager/Executive report loading and UI | `tests/experience-v2-reports-manager.spec.js`, `tests/experience-v2-reports-executive.spec.js` | The **exact** preceding full browser SHA `4abbd390922a655d05c3cf2a6f7794f5a98ceca6` failed the Manager period Work-session evidence fail-closed state; do not claim it passed | Manager error presentation, issued evidence and period metrics P6/P8 |
| Universal TOTP and historic Auth/Storage SQL | `tests/stage2UniversalMfaPolicy.test.js`, `supabase/tests/stage2_universal_totp_all_roles_gate.sql`, `supabase/tests/admin_hr_security_gate.sql` | Migration/source/SQL checks pass in synthetic replay with universal cutover flag OFF in production; deployed identity/Edge/Storage not accepted | New AAL1 must fail every protected table/RPC/Storage/Edge operation; actual authenticator AAL2 and recovery P2/P8 |
| Visual strictness and CSS size | `tests/visual-fidelity-*.spec.js` (exact files in existing Quality Gate job), `tests/experience-v2-shell.spec.js` | Latest full run shard 4: CSS 669,989 vs approved 631,808 maximum; Staff mean RGB 11.52 and Executive 9.67 against <=6, not green | Owner-approved current V4 reference for all screens, no silent baseline/budget adjustment P1/P7/P8 |

**Job evidence:** [full Level B suite SHA `4abbd390`](https://github.com/ceairportcity/ceac-os/actions/runs/39009924808) finished with browser shards 1 and 2 PASS, 3 FAIL (184 pass, 1 fail), 4 FAIL (181 pass, 4 fail); SQL authority PASS, aggregate role-and-RLS FAIL, evidence merge SKIPPED. On subsequent documentation-only SHA `051df51cd6b1e678a12ae5a4bac210c287663920`, CI, Migration Replay, Account Security and the **documentation contract** completed successfully; the Quality Gate skipped all Level B SQL/browser shards. Passing that summary is **not** evidence that earlier browser defects cleared.

**P0 closure condition:** Each numbered route's responsible owner (shown in section 1), special nested overlay (section 2), related source/SQL contract (section 3) and acceptance test above must be reviewed for missing negative paths. The current census closes the *inventory discovery portion* of P0 only. Still unresolved: complete action/drawer-to-policy negative coverage for less-common routes, recoverable unpublished Codespace-only changes (not accessible with this read-only GitHub/API inspection), and dependent owner decisions. These limitations may be tracked as explicit P1/P2 or P8 obligations only if the newest binding owner contract permits; do not silently waive P0 acceptance.

## 7. Eight nested overlay/source authority surfaces — executable P0 inventory

The existing `scripts/stage2/p0-source-inventory.mjs` now enumerates **every conditional nested overlay** independently of the 47 root tabs and extracts its direct `.from(...)`, `.rpc(...)` and direct mutation call references. The test `P0 nested overlays trace the exact eight source modules and their direct data authority` fails closed if any of these source locations disappears without review. This does not prove an RPC is authorised; cross-user/organisation negative probes remain stage-specific.

| Overlay | Direct source | Sensitive data/API examples | Required later-stage evidence |
| --- | --- | --- | --- |
| Item | `src/screens/Item.jsx` | `work_items`, `submissions`, `app_can_review_item`, `approve_work_submission` | Assignee, reviewer, returned-work and other-org denial (P4/P8) |
| Give out / Assign | `src/screens/Assign.jsx` | `work_items`, `project_phases`, `create_task_with_checklist`, `create_typed_work` | Cross-unit assignment and invalid project link denial (P4/P8) |
| Manager project deep link | `src/screens/ManagerProjects.jsx` | `project_units`, `projects`, `create_project_with_participants` | Correct headship, stale-switch and private project checks (P5/P8) |
| Personal Goals | `src/screens/Goals.jsx` | `personal_goals`, `goal_steps` | Owner-only goal reads/writes (P4/P8) |
| Manager person detail | `src/screens/PersonDetail.jsx` | `employment_records`, `work_sessions`, `record_performance_feedback` | Wrong-unit employee/volunteer/HR boundary (P6/P8) |
| Room | `src/screens/Room.jsx` | `room_messages`, `room_reads`, `send_room_message` | Unit/project/subteam membership & foreign-room denial (P4/P8) |
| Meeting draft | `src/components/MeetingScheduler.jsx` | `schedule_meeting`, `unit_memberships` | Organisation versus unit meeting-creation authority (P4/P8) |
| Meeting deep link | `src/screens/Meeting.jsx` | `meeting_private_notes`, `meeting_work_links` | Private note, foreign meeting and participant changes denied (P4/P8) |

P0 documents their **source and responsible future acceptance**, not an approval to access private material. Preserve server RLS, auth/MFA and restricted role boundaries unchanged.
