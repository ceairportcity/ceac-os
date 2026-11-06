# Physical-phone content repair — 6 November 2026

Owner supplied five new iPhone screenshots after PR #209: mobile navigation now works, but Manager Overview keeps five desktop preview columns, the scenic hero summary overlaps its copy, Your Day uses two narrow columns and a notification breaks into individual letters, and the Work introduction is squeezed beside its actions.

Cause: physical-phone shell width is correctly forced to 390px while WebKit can keep a 980px media-query viewport. Earlier repair explicitly covered shell and Settings and only some page grids. Content breakpoints were not consistently applied.

Repair extends the existing physical-phone stylesheet with component-scoped Overview, Your Day and Work compositions independent of viewport media queries. Hero copy and summary stack, preview cards have a full-width lane, modules have two readable columns, notification text has its own flexible track, action status moves below its text, and Work's introduction and actions use separate rows. Tablet/desktop selectors and reporting/approval behaviour are unchanged. No authentication, database or dependency change.

Service-worker static cache generation advances to ceac-shell-v3-phone-content so resumed installed clients can discover the repair through the existing safe update flow.

## Verification

- Local base main: 58b8a11c2afaf3845d76405af3874e81a6548e6f. Production rollback: retain PR #209 production deployment dpl_Euk9USRdKERNZfF3kGtySi6C98ui until this repair is accepted.
- Node v24 local production build passed; emitted aggregate CSS 683870 bytes, below unchanged 706560-byte gate. CI Node 22 result remains pending.
- Existing phone classification tests 5/5 passed. Resilience source contracts passed.
- New real-component fixture contains actual ManagerOverviewV2, OverviewNotifications and WorkPageHeader with synthetic data only. Browser tests cover both normal 390px and mismatched 980px CSS viewport with a 390px physical phone. Assertions measure each card/text track, non-overlapping hero summary, full-width previews and readable Work introduction; screenshots use the existing CI evidence directory.
- Existing authenticated installed-iPhone test now checks Overview and Work content before Settings, so shell-only success cannot close this defect.
- Browser, final security/replay and deployed-asset checks are pending. Do not infer physical iPhone success from deployment status alone.

Use focused repairs and relevant reruns during iteration. Preserve existing final release gates and all raw failures.
