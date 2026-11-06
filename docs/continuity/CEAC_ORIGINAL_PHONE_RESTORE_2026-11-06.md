# Original phone restoration — production build correction, 6 November 2026

Owner requires the distinct original phone interface restored while keeping Light/Dark/device appearance and the separate iPad/laptop layouts. PR #210's stacked desktop cards were rejected.

## Confirmed production cause

The appearance change added a final CSSO compression pass. Vite's prior minification converts legacy queries to modern ranges. The installed CSSO silently discards those entire media rules:

- @media (width<=720px){.phone-proof{display:block}} compresses to an empty string.
- The same occurs for width>=900px and a bounded 721px<=width<=899px range.
- The emitted production styles contained ZERO width media queries; the compact-phone shortcut retained only its base display:none declaration.
- Disabling the incompatible first minification stage preserves 359 width-media rules in the final compressed application.

This explains the source/development versus production discrepancy. Phone width workarounds and individual card overrides did not repair the missing released breakpoints.

A read-only PostCSS comparison between pre-appearance production 6d9d287 and appearance merge 2130d93 confirmed identical layout declarations/media nesting in shell.css, manager-overview.css and work-family.css. Original compact layouts remain in the source; appearance need not be removed.

## Repair

Use one supported final CSSO pass (Vite cssMinify:false). Fail the build explicitly if modern media-range input reaches that incompatible compressor again. Keep all responsive declarations; do not count deleted responsive rules as a size optimisation.

Remove the replacement desktop-card/shell compositions, retaining physical frame containment, the isolated single-line bottom-label guard, and fixed dialog/sheet/toast/update-banner bounds. Original phone media selection remains a fallback for a genuinely wide native viewport, including lazy route styles, with original declarations/cascade and non-phone restoration. Native matchMedia and colour/motion preferences are unchanged. People retains its phone list flow.

Retain Light/Dark/device appearance, existing work/approval logic and current iPad/laptop layouts. The existing safe update generation is ceac-shell-v4-original-phone. No database, Auth, permission, provider or dependency change.

## Complete-style performance baseline

The previous 690 KiB aggregate ceiling was passing output that omitted every width media rule. The locally measured complete, compressed stylesheet set is 764093 bytes with 359 width-media rules. For this requested restoration, bound the complete set to 750 KiB (768000 bytes, 3907 headroom). Preserve the original core CSS raw/gzip, Executive route, JavaScript, lazy route and vendor limits. This is a documented correction to an incomplete aggregate baseline, not removal of functional or security assertions. Final Node 22 measurement and all remaining size checks are required.

## Browser and build protection

The phone regression now builds production CSS and uses those emitted entry/App/Manager styles instead of development CSS. It requires the compact 22px greeting, Today/Work/Team shortcuts, and hidden desktop summary/calendar/module/previews at native 390px and pinned native 980px with 390px handset signals. Light → Dark → Light must change colours and preserve geometry, including after reload. Real ModalDialog/Toast and a synthetic update-banner preview must fit the physical screen. Separate iPad/laptop cases retain their own composition. These checks would fail against the prior zero-media production output.

The minifier source tests refuse unsupported media ranges, retain legacy phone/desktop/device/colour/print queries, and verify the actual compact Manager rules survive compression. They join the existing source gate.

## Historical evidence, not final production acceptance

855ed749: Node 22 source/build (802 cases), account security, migration replay and SQL/authority passed. The four new development-style compact phone/appearance/iPad/laptop cases passed; both Light/Dark renders were inspected. Run 42297126847 retains two raw failures: group 4 job 128165258677 required the isolated nowrap nav safeguard; group 6 job 128165258729 selected a legacy unclassed global Give out work shortcut before Executive CSS hid it. Restore the nav safeguard and target the actual Work-header action while preserving every subsequent composer assertion.

74c6a4a includes those bounded corrections and fixed-surface tests. Its passing development checks cannot certify production while its compressor drops responsive rules. The PR was explicitly held as soon as this cause was confirmed.

Local Node 24 source checks and build trials are diagnostic evidence, not final Node 22 clearance. This executor cannot create Chromium's required Unix-domain socket; do not repeat browser install/launch attempts. The workspace restarted during the build investigation; use the connected repository and existing CI for the final candidate. Preserve focused repairs for confirmed failures, exact-head mandatory security/release checks and raw failures.

Final compiled browser/visual inspection, security/replay, complete-style size checks, production deployment and device confirmation remain pending until observed.
