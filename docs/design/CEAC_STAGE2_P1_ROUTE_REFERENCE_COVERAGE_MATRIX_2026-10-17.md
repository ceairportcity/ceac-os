# CEAC OS Stage 2 P1 — root-route visual-reference coverage and owner acceptance matrix
**17 October 2026 · Status: P1 IN PROGRESS / DESIGN REVIEW ONLY · PR #118.** This owner-review matrix is an engineering comparison, not permission to implement unapproved visuals, rename Finance/Compliance roles, grant RLS access, or deploy. Stage P0 has a separately signed inventory acceptance. P1 remains active until the specific owner accepts connected V4 desktop/mobile screens and their nested flows.

## 1. Reference authority and scope
- **Binding whole-app visual direction:** [exact canonical V4 white/light-blue source](stage2-v4/CEAC_STAGE2_V4_CANONICAL_INTERACTIVE.html), four public-safe reference images and [V4 lock](CEAC_STAGE2_V4_VISUAL_PRODUCT_LOCK_2026-10-16.md). The canonical prototype demonstrates only seven primary destinations, **not every real app route**.
- **Expanded connected P1 candidate:** [role-connected local-only HTML](stage2-v4/CEAC_STAGE2_P1_CONNECTED_ROLE_REVIEW.html), covering Staff, solo/multi-unit Manager concepts, Technical Support, Administration/HR, independent Compliance, restricted Payroll, Finance, Executive and nonsalaried Volunteer previews. It adds connected synthetic headship selection, source-report ready/loading/empty/error states, work/forms and quarterly review. **None of these new layouts has blanket literal owner sign-off.**
- **Known unsupplied exact bitmap:** latest separately owner-approved revised Projects PNG, recorded SHA-256 `66918f3e3d35fe7a6adf36a85eb90b14c0f719fc8f88fed378d538a47518a559`. Do not use the older checked-in Projects image as substitute for this specific acceptance.
- **Root app inventory:** `src/App.jsx` at inspected source SHA `9739c96bf328ba168ca1583e23e685ea42e0a9c0`, 47 root tab conditions plus the default `me` screen and eight mounted nested overlays. App source and demo navigation are different domains; a prototype page named Projects does not establish real Projects route/form parity.

## 2. Exact root-tab audit
Every row below needs a real applicable-role desktop and 390px phone reference, full working state references (including loading, empty, error and denied), and an explicit review decision. A related **synthetic concept** is not a complete matched route. Generic colour tokens do not count as route-specific acceptance.

| App root tab | Default role navigation | Current P1 demo overlap | Owner-specific approved reference? |
| --- | --- | --- | --- |
| `guide` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `account` | staff, manager, admin, executive | Related synthetic concept `auth` — NOT literal route acceptance | No |
| `achievements` | conditional, submenu or deep link | Related synthetic concept `achievements` — NOT literal route acceptance | No |
| `technical-help` | conditional, submenu or deep link | Related synthetic concept `support` — NOT literal route acceptance | No |
| `technical-support` | conditional, submenu or deep link | Related synthetic concept `support` — NOT literal route acceptance | No |
| `primitives` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `home` | staff, manager, admin, executive | Related synthetic concept `overview` — NOT literal route acceptance | No |
| `team` | staff, manager | Related synthetic concept `people` — NOT literal route acceptance | No |
| `work` | staff, manager, admin, executive | Related synthetic concept `work` — NOT literal route acceptance | No |
| `staff-calendar` | staff | No direct P1 full-route reference | No |
| `messages` | staff, manager, admin, executive | No direct P1 full-route reference | No |
| `projects` | manager | Related synthetic concept `projects` — NOT literal route acceptance | No |
| `calendar` | manager | No direct P1 full-route reference | No |
| `manager-finance` | manager | Related synthetic concept `finance` — NOT literal route acceptance | No |
| `manager-reports` | manager | Related synthetic concept `reports` — NOT literal route acceptance | No |
| `exec-organisation` | executive | Related synthetic concept `strategy` — NOT literal route acceptance | No |
| `exec-finance` | executive | Related synthetic concept `finance` — NOT literal route acceptance | No |
| `exec-reports` | executive | Related synthetic concept `reports` — NOT literal route acceptance | No |
| `record` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `announcements` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `strategy` | executive | Related synthetic concept `strategy` — NOT literal route acceptance | No |
| `delivery` | executive | Related synthetic concept `projects` — NOT literal route acceptance | No |
| `workload` | conditional, submenu or deep link | Related synthetic concept `work` — NOT literal route acceptance | No |
| `performance` | conditional, submenu or deep link | Related synthetic concept `ratings` — NOT literal route acceptance | No |
| `learning` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `assets` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `compliance` | conditional, submenu or deep link | Related synthetic concept `compliance` — NOT literal route acceptance | No |
| `cost` | conditional, submenu or deep link | Related synthetic concept `finance` — NOT literal route acceptance | No |
| `finance` | admin | Related synthetic concept `finance` — NOT literal route acceptance | No |
| `reporting` | admin | Related synthetic concept `reports` — NOT literal route acceptance | No |
| `attendance` | staff, manager, admin | Related synthetic concept `overview` — NOT literal route acceptance | No |
| `people` | admin | Related synthetic concept `people` — NOT literal route acceptance | No |
| `lifecycle` | conditional, submenu or deep link | Related synthetic concept `people` — NOT literal route acceptance | No |
| `protected-hr` | conditional, submenu or deep link | Related synthetic concept `hr` — NOT literal route acceptance | No |
| `payroll` | admin, executive | Related synthetic concept `payroll` — NOT literal route acceptance | No |
| `units` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `admin-projects` | conditional, submenu or deep link | Related synthetic concept `projects` — NOT literal route acceptance | No |
| `admin-calendar` | admin | No direct P1 full-route reference | No |
| `exec-calendar` | executive | No direct P1 full-route reference | No |
| `audit` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `events` | conditional, submenu or deep link | Related synthetic concept `quarterly` — NOT literal route acceptance | No |
| `workflows` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `policies` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `integrations` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `authority` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `settings` | admin | No direct P1 full-route reference | No |
| `office-settings` | conditional, submenu or deep link | No direct P1 full-route reference | No |
| `me` default fallback | Staff, Manager, Admin, Executive | No complete profile/account fallback reference | No |

**Audit totals:** 47 explicit tabs. 28 have at least a related demonstration concept; 19 lack a direct comparable page, and the `me` fallback has no fully accepted replacement. **0 of the added P1 pages are certified as complete route-specific accepted screens**; this does not revoke the existing four approved *canonical* V4 screenshot references.

## 3. Mandatory nested, permission and alternate-state review
The root table above intentionally excludes **all eight** separate mounted overlays, which also need owner-ready desktop/mobile review:
1. Work Item evidence, reviewer decisions, return/reopen and private files
2. Assignment: give out work, searchable project/objective linking and later relinking
3. Unit Manager project deep link, participation/phase/milestone and close
4. Personal Goals with owner-only records
5. Person Detail with employee vs volunteer and HR-private separation
6. Unit, sub-team and project Room with membership, messages and failure states
7. Meeting Scheduler with organisation/unit scoping
8. Meeting with permitted participants and private notes

Also cover login/invitation/password, authenticator TOTP AAL1 setup/challenge/AAL2/recovery (design only), Report PDF/print, Payroll independently approved correction, Compliance review/HR publication/employee response and responsive 320px/390px layouts. Owner-selected Work/Projects functional strengths are preserved.

## 4. Review decision gate
- `REFERENCE-CANDIDATE` only: code/interactive design exists but owner-specific approval is missing.
- `REFERENCE-REVIEWED`: recorded actual owner acceptance of exact role/page/state/viewport and fixture hash.
- `IMPLEMENTED-ACCEPTED`: later P7 functional, server-authority and strict visual parity verified at one exact source SHA.
- `P1 ACCEPTED` only after full required cross-role desktop/mobile & nested design references and backend/threat contracts, with owner sign-off where mandatory. Missing latest Projects bitmap is an explicit unresolved blocker.

**No fabricated visual screenshot sign-off, no weakened RGB <=6 or CSS budget, no automatic progression to P2 and no Stage2 production changes.**
