# Approved HR Overview, map and Time & Leave implementation

Date: 24 October 2026. Owner instruction: “All right, then I think we are good to go. Let's proceed with the implementation.”
Base: canonical main `5f2c0e7db7be41a7ad3078a9a740ec470bf0a2ec` (People & Access PR #139 preserved).

## Approved reference and scope

The latest discussion-approved HR proposal supersedes earlier Overview variants for this bounded work. Reference: `exec-bd7f8636-5891-4b7e-babb-474157286807.png`, SHA-256 `8cdab352c2df4dd1292c19a8b2b596b58e9d3d306013764e12a8777c9937e11e`. The reference remains in the conversation; no employee-bearing image is published into this public repository. This specification makes the accepted composition recoverable without that image.

1. Blended existing landscape, personalised greeting and adjacent real month calendar. Manager Overview itself is preserved.
2. Compact personal work controls, then HR requests, announcements and access approvals. These take priority over location context.
3. Full-width recorded work-start map after priorities. Named pins, shared-location selection, details only on selection; no permanent employee detail sidebar or table. Collapsed employee browsing preserves keyboard access and missing-GPS records.
4. Quieter organisation facts and expandable secondary context preserve all real destinations and functions.
5. Calendar-led Time & Leave for Staff, Manager and HR. Approved and requested leave have distinct labels and treatments. Existing forms, tabs, balances, RPC handlers and approval routes remain authoritative.

The owner accepted OpenStreetMap. No Google account/key is required. Tiles load only after existing explicit viewer consent. Only map viewport tile addresses go to the provider; staff identities and work-start records remain first-party. Starts are snapshots, never live tracking or proof of attendance/absence. Latest recorded start is the default; first-start selection and history remain available. A missing latest GPS capture never silently substitutes an earlier location.

No database, authentication, RLS, payroll, employment-date, roster or capability changes. No deletion of unrelated mockup history.

## Change impact and verification ledger

Application SHA: assigned by the candidate commit containing this record. These are pre-commit local results, not exact-head release acceptance.

| Check | Environment and result | Coverage / evidence |
|---|---|---|
| Affected source tests | Node 22.16, PASS | map selection/history, calendar UTC boundaries/status overlap, existing Administration contracts; local `overview-affected-source.log` |
| Complete source suite | Node 22.16, 620/620 PASS, exit 0 | `npm run verify:source`; local `overview-full-source-final.log` |
| Production build | Node 22.16, PASS | `npm run build`; built CSS 631372 bytes, existing 631808-byte cap unchanged |
| Local browser execution | BLOCKED before test interaction | Browser socket creation denied by environment; no rendered result claimed. Local `overview-browser.log` |
| Complete release gate | PENDING | CI, Migration Replay, Account Security, all SQL/security contracts, eight browser shards, merged evidence and final coordinator required at final SHA |
| Product fidelity / actual deployment | PENDING | Compare actual synthetic screenshots with approved hierarchy at phone, tablet and laptop/desktop. Existing historic Administration fingerprint must be reviewed against changed composition, not skipped or tolerance-relaxed. |

First full source run: 619/620. The only failure was the direct-query inventory changing from 24 to 25 because Overview now reads published announcements. The test now explicitly requires that new read to be tenant-scoped as well as retaining the all-query scope invariant. Restrictive announcement archive RLS continues to exclude archived content. Final rerun passed 620/620.

New real-component synthetic fixture and seven browser cases cover priority-before-map hierarchy, consent, shared pin cycling, missing GPS, responsive overflow, calendar selection and all three scope presentations. These complement, rather than replace, existing authenticated role/authority tests. Synthetic screenshots contain fixture identities only. Map tiles are stubbed in browser tests; no production records or provider requests are used.

TECHNICALLY ACCEPTED: NO — final release gate pending.
VISUALLY / PRODUCT-EXPERIENCE ACCEPTED: NO — rendered comparison pending.

## Candidate review and corrections — 24 October, 18:00 UTC

Candidate `84e94d4de67be83209c3b1453105c21954201cff`, PR #140, complete Quality Gate [40117171896](https://github.com/ceairportcity/ceac-os/actions/runs/40117171896): **FAIL**, retained as evidence. CI [40117171831](https://github.com/ceairportcity/ceac-os/actions/runs/40117171831), Migration Replay [40117171893](https://github.com/ceairportcity/ceac-os/actions/runs/40117171893), Account Security [40117171811](https://github.com/ceairportcity/ceac-os/actions/runs/40117171811) and SQL/authority contracts passed. Browser shards 2/3/4/7 passed; 1/5/6/8 failed. No release or technical/visual acceptance is claimed from this run.

Confirmed corrections for the next candidate:
- Phone map details intercepted shared-pin activation. Details now occupy the opposite vertical side of the selected marker and scroll within the available map space; ResizeObserver tracks both actual viewport dimensions. No forced clicks or weakened assertions.
- New calendar eyebrow/date labels and Administration weekday/work-strip text fell below the 12px minimum. Restore 12px throughout; preserve the minimum-size tests.
- Existing shell, Manager Workforce and Administration corridor tests assumed permanently expanded policy/secondary context. They now open the real disclosures before the same assertions. A downstream corridor history failure followed its prerequisite Administration scenario stopping early, rather than a changed history implementation.
- The visible Schedule arrow changed its accessible name; restore the established `Schedule` accessible label and preserve the multi-unit meeting test.
- Reduce duplicate empty calendar context, make the personal work strip horizontal as designed, and place the long support-approval explanation in a disclosure in the HR Overview only. Pending support decision rows and actions remain visible; default rendering elsewhere is unchanged. Personal leave balances are shown in the policy summary without requiring expansion.

Rendered comparison: inspected actual synthetic Administration product screenshot from shard 8 artifact `12570067136`, `visual-home-administration-desktop-1440.png`, SHA-256 `aeb48933e9c900d3871500a5d58b9375ea01e9b308934b902c2df34d55d6f5c7`. Its greeting/calendar, priority-before-map and selection-only composition follows the approved proposal. The old Administration comparator drifted by 16.54 against the intentionally changed design. Pin the observed whole-image 12x12 RGB fingerprint for **Administration only**; Staff, Manager and Executive arrays, all 330 role-content comparison channels and the <=6 threshold are preserved. This reference records the approved changed composition; the explicit interaction/readability corrections still require the next complete gate and rendered review. No runtime self-snapshot, blank baseline, masking or tolerance increase. No private image bytes committed.

Additional synthetic evidence inspected: shard 6 artifact `12569937590`, desktop/tablet HR component renders and phone My/Team/Organisation leave calendars. Initial evidence lacked successful phone pin cycling; do not mark it PASS. Next candidate captures initial, selected-map and missing-location states separately and returns the page to the top before full-page captures.

Local correction verification (Node 22.16): 23 affected source tests PASS; final full source suite 620/620 PASS, exit 0 (`overview-corrections-source-full.log`); production build PASS (`overview-corrections-build-final.log`); aggregate CSS **631600 bytes**, below unchanged 631808 cap; `git diff --check` PASS. These local logs are pre-commit evidence, not a replacement for exact-head release checks.

Next: freeze corrected candidate, complete all required gates and inspect its phone/laptop/desktop screenshots before acceptance/deployment.

## Corrected candidate render review — 24 October, 18:16 UTC

Application source is frozen at `b207b89be0435a110ce14e06384f0ecb66d1197f`. [CI 40118632960](https://github.com/ceairportcity/ceac-os/actions/runs/40118632960), [Migration Replay 40118632881](https://github.com/ceairportcity/ceac-os/actions/runs/40118632881), [Account Security 40118632840](https://github.com/ceairportcity/ceac-os/actions/runs/40118632840), SQL/authority and browser shards **1–7 passed**. [Quality Gate 40118632889](https://github.com/ceairportcity/ceac-os/actions/runs/40118632889) remains **FAIL** solely because Administration's comparator still represented the pre-correction spacing (mean RGB error 6.67 against unchanged <=6). All seven new map/calendar browser cases passed. The original reference threshold is preserved.

Inspected corrected evidence:
- Authenticated synthetic HR phone/laptop/desktop: shard 1 artifact `12571135305`, `admin-premium-briefing-*` and `redesign-r7-stage7-admin-*`. Existing multi-unit scheduling and the complete Administration/corridor journey now pass.
- Selected map, missing GPS and initial states at 320/390/820/1440: shard 6 artifact `12569854389`. Shared pins are reachable with details open; closing restores marker focus. My/Team/Organisation phone leave calendars remain labelled and scoped.
- Exact final Administration 1440x960 reference: shard 8 artifact `12569774709`, `visual-home-administration-desktop-1440.png`, SHA-256 `e9d15e4eb34c26a58cb7f457bdb2fbdb86468bb2d1c2a5111714868adc8e0a85`. This supersedes the preceding candidate's Administration fingerprint after the documented density corrections. No application source changes accompany this final reference correction. Staff/Manager/Executive arrays remain byte-equivalent as parsed values.

Product comparison findings: personalised blended photo/calendar, personal work controls, HR priorities before the map, selection-only employee details and quieter lower organisation context match the approved hierarchy. Phone recomposes into one column; desktop retains adjacent calendar. Typography, overflow, controls, truthful loading/empty/missing-GPS states and retained destinations passed their browser checks. The map's tiles are deliberately stubbed in automated screenshots; these prove CEAC overlay interactions rather than the provider's cartography. Existing provider loading/attribution/consent code is preserved. No live employee or genuine HR screenshot is published.

This checkpoint changes only the pinned reference and this ledger. It does not claim the failed gate passed. Next: run the required exact-head gate for the final reference correction, then the deliberate deployed acceptance checkpoint and production verification.

TECHNICALLY ACCEPTED: NO — exact-head final reference gate pending.
VISUALLY / PRODUCT-EXPERIENCE ACCEPTED: NO — deployed-product/release acceptance pending; corrected synthetic design review passed.

### Final missing-session edge case

A subsequent source review found that selecting a roster record without any session in the collapsed employee browser could show “Session ended.” Correct this presentation to “No session recorded”; it must not infer an ended session from a missing start. Closing these fallback details now restores focus to the selected employee button. The existing four responsive map cases also assert this no-session state and focus return, using an additional synthetic roster entry without a session. No query, data, permission or map coordinate changes. This concrete defect invalidates the earlier source freeze and justifies superseding the short-running reference-only candidate `c493b08`; its cancelled checks must not be represented as passes. Final exact-head gates will cover the correction and final pinned reference together.

### Exact department filtering

The same final map review found a concrete filter defect for department names containing commas: splitting the display string discarded the original department identity. Preserve structured unit labels in the existing presentation helper, build options from those labels (including authorised operational profiles), and filter by exact membership. The displayed unit text and all underlying records are unchanged. Add a source test for commas/multiple memberships and extend the responsive no-session browser case with a comma-bearing department. This justifies superseding `077a33c` before release; any cancelled checks remain unaccepted. No additional feature scope, provider, query, data or permission changes.

## Application acceptance and deliberate deployment checkpoint

Accepted application SHA: **`ea9a60de3f6aab75bc9096a26bbb3129ec8a0b9a`**. No subsequent application changes are included in this documentation checkpoint. Canonical main was refreshed and remains `5f2c0e7db7be41a7ad3078a9a740ec470bf0a2ec`.

Exact-head acceptance:
- [CI 40120753222](https://github.com/ceairportcity/ceac-os/actions/runs/40120753222): PASS, complete registered source suite and production build.
- [Migration Replay 40120753285](https://github.com/ceairportcity/ceac-os/actions/runs/40120753285): PASS.
- [Account Security 40120753249](https://github.com/ceairportcity/ceac-os/actions/runs/40120753249): PASS.
- [Quality Gate 40120753318](https://github.com/ceairportcity/ceac-os/actions/runs/40120753318): PASS, complete SQL/authority contracts, all eight browser shards, merged exact-head evidence and final `role-and-rls` coordinator.
- Administration visual regression PASS using the final reviewed Administration reference, unchanged 330 role-content channels and <=6 tolerance. Other role references are preserved.
- Final responsive map cases PASS for shared selection, missing GPS, no-session truthfulness, focus return and exact comma-bearing department membership.

Exact-head artifact pointers: authenticated HR route screenshots shard 1 `12571466957`; responsive map and three leave-scope presentations shard 6 `12570982911`; all-role visual inventory/reference comparison shard 8 `12570793585`; merged R7 product inspection `12570679302`. Synthetic design review and prior comparison evidence remain as recorded above. No genuine employee screenshot is committed.

This deliberate `[vercel]` checkpoint changes only this ledger and is application-equivalent to the accepted SHA above. It enables the one intended acceptance deployment under the existing repository policy. Deployment readiness, protected-preview accessibility and the genuine existing HR production-session inspection are still to be recorded; a skipped/cancelled deployment is never PASS. The live production baseline before this bundle is Ready deployment `dpl_AMDoraGjDgnmAncbzh9RXBdJzjRi` at main `5f2c0e7`. No production data, authentication or schema changes have been made for this bundle.

TECHNICALLY ACCEPTED: YES for application `ea9a60d` (all required exact-head gates passed).
VISUALLY / PRODUCT-EXPERIENCE ACCEPTED: NO for release — synthetic visual/interaction acceptance passed; deployed-product verification pending.

## Final live acceptance — 24 October 2026

**Complete for this approved HR Overview, shared recorded-start map and calendar-led Time & Leave bundle.** PR [#140](https://github.com/ceairportcity/ceac-os/pull/140) merged as `d0bcc0f8ce62bbf14a73c51657b8ea8706bd15c1`. Its tree `78159f30646d376610b7c458e914909f99a77322` exactly matches the accepted deployment checkpoint `3b93c20fa3f3e62951e64b15529a97593723c8a8`; application source is equivalent to fully tested `ea9a60de3f6aab75bc9096a26bbb3129ec8a0b9a`.

Deployment evidence:
- Deliberate preview `dpl_DomSHBxSwUphyLMQfzjr9kCGtZv7`: READY; actual deployed CEAC sign-in loaded successfully. No CEAC-origin startup error observed (an unrelated browser-extension metadata error was excluded).
- Production `dpl_QKesLmNkbtWja2aUdymHnt1eew4z`: READY at merged main `d0bcc0f`. Live URL: [CEAC OS](https://ceac-os-git.vercel.app/). Vercel's production alias matches that deployment.
- Public production root returned HTTP 200 with CSP and `nosniff`; script policy contains neither `unsafe-inline` nor `unsafe-eval`.

Actual existing Administration/HR session verification (read-only, 24 October):
- Personalised greeting, loaded scenic photograph and adjacent calendar are present. Both requests and announcements end above the map. Secondary organisation context defaults collapsed; no selected-employee popup is present initially. Measured horizontal page overflow: 0.
- Organisation leave calendar loads the two genuine pending requests. Selecting a current request shows its Manager-approval stage; Administration approval is not exposed at that stage. No leave decision was submitted.
- The genuine department name containing commas returns its matching employee in the no-session filter. Selecting that record says **No session recorded**, does not say **Session ended**, and closing details restores employee-row focus. Default filters were restored afterwards.
- Today had zero captured work-start GPS records during inspection. No staff pin or work session was fabricated. Valid-GPS, shared-pin and missing-GPS interactions are proven by the exact-head synthetic browser cases; actual provider cartography was not represented as a live staff-GPS verification on this empty day.
- No employee, account, schedule, payroll, work-session or business-decision mutation was made during the live verification. Normal existing application activity telemetry is outside this statement. Other roles are covered by the complete isolated role suite; genuine production identities were not impersonated. Manager Overview source remains unchanged.

Post-merge main qualification is also PASS:
- [CI 40122371901](https://github.com/ceairportcity/ceac-os/actions/runs/40122371901).
- [Migration Replay 40122371918](https://github.com/ceairportcity/ceac-os/actions/runs/40122371918).
- [Account Security 40122371891](https://github.com/ceairportcity/ceac-os/actions/runs/40122371891).
- [Quality Gate 40122371879](https://github.com/ceairportcity/ceac-os/actions/runs/40122371879): SQL/authority, all eight browser shards, merged exact-head product evidence and final `role-and-rls` coordinator PASS.

This final record is documentation-only; it changes no accepted application source and may use the documented documentation-integrity fast path. Earlier failed, superseded or cancelled candidates remain historical evidence, not passes. This acceptance does not close unrelated historical audit deferrals or owner-deferred account-readiness work.

TECHNICALLY ACCEPTED: **YES**.
VISUALLY / PRODUCT-EXPERIENCE ACCEPTED: **YES**, for this approved bundle with the explicit live-GPS evidence boundary above.
