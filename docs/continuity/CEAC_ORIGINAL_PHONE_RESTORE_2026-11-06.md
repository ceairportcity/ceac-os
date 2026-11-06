# Restore the distinct phone composition — 6 November 2026

Owner rejected PR #210's stacked desktop cards. Restore the earlier phone interface while retaining Settings and Light/Dark/device appearance. iPad and laptop retain their own composition. This supersedes the prior phone-content acceptance that required desktop preview cards to be stacked on a phone.

## Source authority and cause

Pre-appearance production `6d9d2873d14fcfe161a4097eb30e8429243ce270` contains the compact Manager phone composition: 22px greeting, Today/Work/Team shortcuts, compact next-work lane, and desktop summary/calendar/module/previews hidden. PR #205 preserved those layout declarations while changing colour values to paired theme tokens. Original phone compositions also remain in the shared shell, Work and other route styles.

Read-only PostCSS comparison of the pre-appearance commit against appearance merge `2130d93` confirmed identical display/position/inset/size/padding/margin/gap/grid/flex/font-size/line-height/white-space declarations and media nesting for shell.css, manager-overview.css and work-family.css.

The physical-phone frame workaround kept a 390px frame while media queries could still select the 980px desktop composition. PR #210 restored readability by overriding individual card layouts, including forcing desktop preview cards and the hero summary visible, which the owner explicitly rejected.

## Bounded repair

- Remove the page and shell recreation overrides from `phone-presentation.css`, retaining only physical-frame containment for a stale native viewport and fixed surfaces.
- Select width terms in the existing CSS media rules using physical phone width, preserving the original declarations, cascade, selectors, nesting and breakpoints. Native matchMedia, colour/motion conditions and theme preference remain unchanged. iPad/laptop styles are not rewritten. Original media conditions are retained for restoration, rotation and printing.
- Include lazily loaded route styles through stylesheet load/head-style observation. No repeated full-style scan on theme changes; unchanged-width events return immediately.
- Keep People in its phone list flow when a stale desktop media query would auto-open the first person.
- Advance the existing safe PWA update generation to `ceac-shell-v4-original-phone`. No database, authentication, permissions or dependency change.

The frame guard also contains existing fixed-position dialog backdrops, sheets, toasts and the update banner. A narrow body does not change their native viewport containing block; without this, a dialog could still centre in 980px and a notice could sit beyond the 390px screen. This is frame containment, not a replacement composition. Retain the prior single-line bottom-navigation label guard.

## Verification and pending acceptance

Local Node 24 focused tests: phone detection, original-rule selection/lazy loading/restoration, current app query-grammar audit and appearance persistence passed (11 tests). Resilience source contracts passed. Initial build passed with CSS 676731 bytes, below unchanged 706560-byte budget; final build and Node 22 CI results must be recorded separately.

The prior regression is corrected to require the original compact composition at both native 390px and a pinned native 980px media-query viewport with 390px physical phone signals. It checks Light → Dark → Light changes preserve geometry while colours change, plus reload. Separate cases preserve iPad/laptop composition. The authenticated installed-iPhone test now requires phone shortcuts visible and desktop summary/previews hidden before visiting Work and Settings. These are owner-directed product assertions, not a waiver of failed checks.

Local Chromium cannot create its required Unix-domain socket in this executor; no repeated browser launch/install attempts. Real browser and visual acceptance use the existing CI runner and its captured artifacts. Browser, final security/replay, production deployment and physical-device confirmation remain PENDING until observed. Use focused fixes/reruns for any actual failures and retain mandatory final release checks.

## First candidate evidence — 855ed7492416c9c4d3eaed2e8d79474e5c54bde8

CI build/source (802 cases), account security, migration replay and SQL/authority passed. New compact-phone Light/Dark checks passed at both 390px and pinned-native 980px, as did separate iPad/laptop cases; Light and Dark renders were visually inspected. These are historical evidence when the final bounded corrections below are committed, not final-head clearance.

Retain raw failures in Quality Gate run 42297126847: browser group 4 job 128165258677 expected the bottom label single-line guard (`white-space: nowrap`), which was removed with the broader overrides; restore that isolated guard. Group 6 job 128165258729 selected an unclassed legacy global Give out work shortcut before the Executive role stylesheet hid it. That global shortcut is deliberately hidden in executive-redesign.css; scope the test to the actual Work header action, retaining all subsequent composer assertions. Phone composition tests in that group passed; 144 tests passed and one failed. No browser retry or acceptance floor reduction.

Include real ModalDialog and Toast components and a synthetic update-banner preview in the presentation fixture, testing full physical-screen bounds for these fixed surfaces as well as the restored page composition. Final source/build/browser/security checks remain due at the final candidate SHA.

Bounded-correction local verification: the same 11 focused Node tests passed, final Node 24 production build exited 0 and sealed its script policy, and aggregate CSS is 677530/706560 bytes. Browser files parse and enumerate eight relevant cases. No failed browser check has been retried or marked passed; final Node 22/browser validation remains due.
