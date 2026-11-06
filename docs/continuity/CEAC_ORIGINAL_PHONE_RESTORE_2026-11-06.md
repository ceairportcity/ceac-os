# Restore the distinct phone composition — 6 November 2026

Owner rejected PR #210's stacked desktop cards. Restore the earlier phone interface while retaining Settings and Light/Dark/device appearance. iPad and laptop retain their own composition. This supersedes the prior phone-content acceptance that required desktop preview cards to be stacked on a phone.

## Source authority and cause

Pre-appearance production `6d9d2873d14fcfe161a4097eb30e8429243ce270` contains the compact Manager phone composition: 22px greeting, Today/Work/Team shortcuts, compact next-work lane, and desktop summary/calendar/module/previews hidden. PR #205 preserved those layout declarations while changing colour values to paired theme tokens. Original phone compositions also remain in the shared shell, Work and other route styles.

The physical-phone frame workaround kept a 390px frame while media queries could still select the 980px desktop composition. PR #210 restored readability by overriding individual card layouts, including forcing desktop preview cards and the hero summary visible, which the owner explicitly rejected.

## Bounded repair

- Remove the page and shell recreation overrides from `phone-presentation.css`, retaining only physical-frame containment for a stale native viewport and fixed surfaces.
- Select width terms in the existing CSS media rules using physical phone width, preserving the original declarations, cascade, selectors, nesting and breakpoints. Native matchMedia, colour/motion conditions and theme preference remain unchanged. iPad/laptop styles are not rewritten. Original media conditions are retained for restoration, rotation and printing.
- Include lazily loaded route styles through stylesheet load/head-style observation. No repeated full-style scan on theme changes; unchanged-width events return immediately.
- Keep People in its phone list flow when a stale desktop media query would auto-open the first person.
- Advance the existing safe PWA update generation to `ceac-shell-v4-original-phone`. No database, authentication, permissions or dependency change.

## Verification and pending acceptance

Local Node 24 focused tests: phone detection, original-rule selection/lazy loading/restoration, current app query-grammar audit and appearance persistence passed (11 tests). Resilience source contracts passed. Initial build passed with CSS 676731 bytes, below unchanged 706560-byte budget; final build and Node 22 CI results must be recorded separately.

The prior regression is corrected to require the original compact composition at both native 390px and a pinned native 980px media-query viewport with 390px physical phone signals. It checks Light → Dark → Light changes preserve geometry while colours change, plus reload. Separate cases preserve iPad/laptop composition. The authenticated installed-iPhone test now requires phone shortcuts visible and desktop summary/previews hidden before visiting Work and Settings. These are owner-directed product assertions, not a waiver of failed checks.

Local Chromium cannot create its required Unix-domain socket in this executor; no repeated browser launch/install attempts. Real browser and visual acceptance use the existing CI runner and its captured artifacts. Browser, final security/replay, production deployment and physical-device confirmation remain PENDING until observed. Use focused fixes/reruns for any actual failures and retain mandatory final release checks.
