# Shared Settings and appearance — 6 November 2026

Owner approved implementation of an Apple-style grouped Settings area for all roles, including appearance, notifications, account security and sign out. Implementation branch: feat/shared-settings-appearance-20261106, based on released main 6d9d2873d14fcfe161a4097eb30e8429243ce270. This is a separate feature after notification PR #203. No production changes or release claimed.

## Implementation

- Existing authenticated `account` route becomes shared Settings; no additional root route or permission bypass. Existing `settings`/Control Center remains administration-only, linked under Organisation only for admins. All role navigation labels change Account security to Settings. My Hub links to Settings.
- Account identity, current device appearance, actual authenticator status, device-notification status and separate confirmed local sign-out. Existing sessions/activity/MFA and global revocation stay in Account & Security; existing password form is reused in an embedded panel with network-error recovery.
- Appearance: Light/Dark visual previews plus Use device setting; immediate application, device-local storage, live OS and other-tab updates, malformed/blocked storage fallback. Persisted appearance runs before CSS in the existing hash-authorised entry bootstrap; CSP hash remains exact, with no unsafe script exception.
- Notifications centre reads updates; it links to Settings notifications. Device/category/quiet-hour/reminder/test and Room controls reuse their actual existing implementations in the new settings surface. No synthetic data in production components.
- Desktop/tablet list/detail layout, phone section navigation, keyboard-visible focus, native radio semantics and explicit sign-out confirmation. Device-local theme applies across role changes.
- 71 existing stylesheets retain exactly their prior Light values, verified by resolving the new paired tokens and comparing all files to the base Git tree. The pinned executive design fixture is unchanged; its protected rules are compared against actual resolved Light colours. Theme pairs cover backgrounds, text, borders, accents, glass and native controls. Print uses Light. Photographs/document content are not inverted.
- Build-only CSSO optimisation operates on complete emitted CSS chunks, retaining CSS assets and existing byte budgets. No runtime styling dependency or new service. Need browser acceptance of minified Light and Dark layouts before completion.

## Verification evidence (implementation checkpoint)

- Full source qualification once: 793 tests, 791 passed, 2 failed due protected legacy Light-colour source comparisons. Corrected to preserve exact originals and resolve actual Light tokens before comparison; the pinned reference/hash and protected selectors/geometry remain enforced.
- Focused correction checks: executive scenic hero and approved protected executive rules passed; P7 shell then passed individually after its Light-resolver path was corrected.
- Focused appearance/notification/security/role checks: 31 passed, 0 failed. Covers storage/default/persistence/live OS/cross-tab behaviour, delivery behaviour, notification routing and the exact CSP entry hash.
- Node 22.12 production build and script seal passed. Optimised aggregate CSS measured 656941 bytes before the latest small form/identity edits, below unchanged 706560 budget. Recheck exact final build.
- Local Chromium launch fails before loading pages (workspace process restriction); no local browser pass claimed. Committed settings browser acceptance covers six role fixtures, all appearance modes, persisted reloads, automatic changes, 320/768/1440px overflow and sign-out confirmation. Notification controls tests follow the new settings boundary.

## Remaining work

Publish exact source tree and draft PR; run browser acceptance in CI and inspect visual evidence. Fix only identified failures, preserving passing results. Verify Dark-mode legibility, forms, charts, overlays and all-role application navigation. Required final gates/visual acceptance remain pending. Do not claim deployment or complete browser coverage from the fixture mocks. No SQL, Auth enforcement, production environment or existing production deployment changed.

## First published head and correction batch

Published initial head 7d749acab23e7af56d2f58fea6114af187adbc05, PR #205. CI (all 793 source tests and build), Account Security, Migration Replay and SQL/authority contracts passed. Browser groups 3, 6 and 7 passed. Groups 1/2/4/5/8 identified missing shared `.body` screen convention, stale Account-page titles/selectors, isolated fixtures without the new theme foundation, source-only colour readers and a 339-byte icon overrun. Those were corrected without changing budgets, contrast floors, fixture hashes or authority checks.

A live sample-account visual inspection exposed an additional production-only issue: the CSS compiler lowered light-dark() into compatibility variables driven by authored color-scheme rules; setting the DOM scheme alone updated controls but retained Light surfaces. Explicit root data-theme rules now drive those emitted variables. New browser acceptance builds and exercises actual emitted CSS for manual Dark, Light and automatic device changes, and verifies primary-button contrast. It also records Dark screenshots for all role fixtures and three widths.

Theme foundations are imported by both base and V2 CSS so isolated screens receive the same palette as the application. Foreground accent aliases are separated from solid button/background colours, preserving exact Light values while making Dark text readable. Account protection summary refreshes after verified authenticator setup. Role labels are human readable.

Focused correction checks passed: existing executive protected Light/scenic/shell contracts (3), appearance/security/role checks (15), and Light declaration comparison across the original stylesheets (70 in one pass plus the OfficeSettings file checked separately). Latest pre-publication aggregate CSS was 665529 bytes and icons 20365 bytes, within unchanged 706560/20480 limits. Recheck exact final build and CI.

Preview limitation: Vercel returned 402 api-deployments-free-per-day (more than 100/day) when refreshing the corrected isolated sample preview. No CLI credentials are available, no plan/security settings changed, and no repeated deployment attempts should be made to evade that limit. The older sample preview exposed the defect and is not evidence of corrected Dark surfaces. Continue using CI-produced browser screenshots for corrected visual acceptance. Production remains unchanged.
