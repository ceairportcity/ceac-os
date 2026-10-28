# Learning reference repair — 28 October 2026

The owner rejected the released Learning implementation after PR157. The earlier completion claim did not establish visual fidelity. Original private comparison PDF SHA256 c83d072a270035373ba6f3100a2bc2128ad15d436f8e13e2a9802f46028cf5af, pages19/20 (mockups13/14), was re-rendered and inspected. Do not commit that private source or substitute generic visual acceptance.

## Concrete mismatch and correction

The released builder was a stacked course detail with an outline/preview toggle and a context strip. The reference instead specifies a dedicated course workspace, four stages (Course details, Modules & resources, Audience, Publish), selectable outline alongside the selected module editor, resource controls, completion requirements, Save module, learner preview and explicit review/publication.

This correction implements that composition. Existing draft course/module editing now also works inline through the same tenant-filtered confirmed-save contract. Resources retain the existing named drawer. Quiet reloads preserve selected-module and section drafts. Hidden stage/preview panels retain unsaved inputs; account/course keys isolate them. Unsaved/pending inline edits block publication. Published content remains read-only and real required-module/resource publication guards remain.

Audience uses recorded assignment rules and opens the existing person/unit/role/onboarding assignment form only for published courses, as required by the existing Stage8 lifecycle. No new draft-assignment persistence, upload provider, learning format, quiz, scoring, certificate, schema or authority is invented. Protected HR, Payroll, other role palettes, independent PR150 and all unrelated completed repairs remain untouched.

## Verification and visual observations

- Node22.12 clean lockfile installation and sealed build passed (`test-artifacts/learning-clean-install.log`, `learning-frozen-build.log`). Initial development selection:54/54 passed, exit0; coverage includes draft/denied updates, record identity, catalogue follow-up, responsive composition, invitations/private work and design-system guards. It predates the final narrow draft-publication guard.
- Actual final-component screenshots at390/1440 were compared with the private reference. Review caught an unintended300px mobile header flex basis; corrected to intrinsic sizing. Added an actual rendered header-height assertion, side-by-side desktop/stacked phone geometry assertions and no-document-overflow assertion.
- Final changed-area selection11/11 passed, exit0 (`test-artifacts/learning-ready-browser.log`): tenant/id-bound confirmed inline course/module/resource writes, denied resource/module preservation, selected-module context, four stages, author-free preview, account transition, retained inputs across stage/preview, and blocked publication while unsaved.
- Final640/640 source tests passed, exit0 (`test-artifacts/learning-ready-source.log`), sealed build passed (`learning-ready-build.log`). CSS files and immutable631808-byte ceiling remain unchanged. Final code/source SHA and required full hosted qualification are recorded on the release PR; local working-tree checks alone do not establish release acceptance.
- An intermediate background test invocation returned a truncated log without a terminal test summary. It is not counted as final passing evidence. The final invocation above returned all11 cases and a terminal pass summary.

Frozen-head CI, complete browser/SQL/security/migration evidence, exact-source deployment and existing-HR-account no-business-write checks remain PENDING until recorded on the release PR. Production at the start of this repair remains dcb7cd15549c41bdf454ce83236107ffccb8e878, READY deployment dpl_135HpeA1r14kDTssP9kutPN2RbLM. Preserve this recovery point. No production learning data is created for testing and owner aesthetic approval is not presumed.
