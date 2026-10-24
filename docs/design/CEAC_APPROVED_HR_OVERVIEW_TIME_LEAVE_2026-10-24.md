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
