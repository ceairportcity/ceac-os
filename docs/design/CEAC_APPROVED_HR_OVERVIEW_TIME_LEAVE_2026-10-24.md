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
