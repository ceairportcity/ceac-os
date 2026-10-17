# CEAC Stage 2 P1 — connected role design review candidate

**Engineering review only, not owner sign-off and not an app release.** Source SHA will be the enclosing commit. The prototype [opens as a standalone HTML design](stage2-v4/CEAC_STAGE2_P1_CONNECTED_ROLE_REVIEW.html) and keeps the canonical white/light-blue Stage 2 V4 design's palette, density, navigation and responsive structure.

**Connected simulated flows:** Staff Overview/session and Work; Manager Work assignment, Projects, factual reporting and Team; scoped Technical Support; Administration People/HR/private ratings; Executive strategic outcomes/quarterly evidence; volunteer nonsalaried participation; provider-neutral TOTP setup/challenge/recovery. Local view switching, overlay forms and a demo attendance state are illustrative; no Supabase, Auth, privileged data, live writes, external JS or worker secrets.

**Known P1 outstanding acceptance blockers:** latest owner-approved revised Projects PNG exact binary not in verified source; incomplete full-page references for all 47 app routes and additional nested/mobile flows; no current screenshot parity or owner review of these new layouts. Do not mark P1 accepted, or attempt visible production redesign, based on this document alone. Continue extending and getting owner approval for each missing reference.

**Stage lock:** P0 inventory accepted in preceding parent commit, P1 now active. Previously implemented P2–P7 code is preserved unmodified. Actual report error state, CSS size and Staff/Executive RGB regression remain P6/P7 defects; do not relax evidence, invent employee ratings or grant new authority.

## Exact P1 review coverage and acceptance limitations — 17 October

The checked-in [connected standalone V4 review candidate](stage2-v4/CEAC_STAGE2_P1_CONNECTED_ROLE_REVIEW.html) is **runnable design source**, not a static screenshot, authenticated CEAC OS app or owner-approved literal screenshot reference. It has local-only, non-persistent interactions for role switching, work creation/give-out inspector, human rating inputs, TOTP challenge and synthetic work-session Start/End. The live application's role/capability and database permission model is *not* changed.

| Role / capability demo | Connected preview surfaces | Minimum outstanding owner-reviewed routes and states |
| --- | --- | --- |
| Staff | Personal Overview/Start-End, Work inspector, Projects, My achievements, TOTP | Entire actual Staff role navigation; Calendar, evidence attachment, dated actions, review/rework, private session and remote/field correction |
| Manager, solo and multi-unit | Overview, Give Out Work, project and Team context, Manager period report | Real selected-unit switch, dropdown search, project close/contribution assessment, report no-data/fail-closed states, quarterly human rating and cross-unit negative flows |
| Technical Support capability | Help desk, assigned cases, personal Overview/Work | Separate Support head vs team member permission, case reporter-safe projection, individual case state, reassignment collision, phone views and audit history |
| Administration/HR | People & access, protected HR review, quarterly rating, Projects read-only | Admin workforce, payroll and finance; invitation detail, employee record access, separate Compliance/HR issuance and employee response; protected form/drawer mobile |
| Executive | Overview, ministry strategy, source-linked quarterly results, read-only Projects | Distinct leadership card hierarchy, authentic reports/exports, unit coverage, verified impact, independent HR narrative exclusions and responsive views |
| Volunteer | Nonsalaried Overview and authorised Work/Projects | Volunteers register, profile, individual activity permissions, annual schedules, no payroll or work-session misclassification |
| Cross-role authentication | Invitation/password description, authenticator TOTP challenge and safe recovery explanation | Full branded sign-in, genuine AAL1 setup-only, enrol/challenge/recovery, expired-session and permission denied states, accessible small-screen references |

**Architecture and threat-boundary constraints:** Navigation is not permission. The actual implementation must separately enforce role/capability, unit/organisation scoping, authenticated identity, AAL2 only after approved cutover, Storage read/write restriction, support case privacy, HR-private evidence, employee response and sourced factual reporting. An interactive prototype cannot prove any of those. All demos use invented safe placeholders, not live employee data.

**Acceptance rule:** Explicit owner review must cover connected desktop and phone references across **all 47 root application routes and the eight nested overlay forms**, plus loading/empty/error states and print where applicable. The exact newer owner-approved Projects PNG is still missing from verified assets, so no superseded bitmap may be promoted. Do not claim P1 complete or quietly rebaseline approved RGB <=6/CSS limits because this review candidate renders.

## P1 Compliance and protected Payroll connected-flow extensions (engineering review)

The connected white/light-blue V4 review candidate now has two separate capability-specific preview personas: a dedicated Compliance Officer desk and a Payroll-authorised officer desk. These routes are not implied permissions of general Administration. These are design scenarios, NOT production permissions or owner acceptance.

- Compliance displays a policy version, acknowledgement coverage, source-linked exceptions and a synthetic independent-review drawer. Independent Compliance review must not become Manager human ratings or expose HR-private narratives. Actual policy applicability, revision history, negative RLS/RPC tests and role authority remain for P6/P8.
- Payroll displays preparation, separate submission/independent approval, correction and audit stages. Payroll preparation and approval require distinct backend capabilities and should not automatically use attendance/task hours to calculate pay. Actual pay-run versioning, self-approval rejection and salary privacy remain P6/P8.
- Only the dedicated Compliance preview menu contains the Compliance desk, and only the separate Payroll-authorised preview menu contains Payroll. Staff, Manager, Support, ordinary Administration/HR, Executive and Volunteer demonstration menus have neither destination. Switching the local prototype role replaces the navigation. That is not server-side permission enforcement. All sample data is synthetic; no salary, personal identifiers, write calls or actual security secrets are present.
- A companion source integrity test covers the exact role menus, view and drawer wiring, V4 tokens and no live network/auth writes. A test pass is source/design integrity evidence only, not complete owner-approved 47-route/mobile/overlay parity.

**Capability review correction:** Compliance and Payroll now have dedicated review personas with disjoint navigation, rather than appearing as default privileges of the Administration demo. Final role/capability assignments still require owner-specific acceptance and real server-side enforcement.

**P1 remains IN PROGRESS.** The exact newer owner-approved Projects PNG and the unreviewed full role/mobile/nested form/error/print fixtures are still required before acceptance. Do not silently rebaseline visual thresholds or activate later stages.

## Additional connected P1 role and period designs — Finance and quarterly review

The synthetic V4 candidate now exposes **Finance-authorised officer** as a separate demonstration role with a budget/request overview that excludes Payroll, protected HR records and bank information. This preview is not a universal Finance capability grant; real Finance and Manager budget authorisation remain server-enforced under P6/P8.

Administration and Executive preview roles now share a connected **Quarterly review event** design with period selection, source-linked accomplishments, Compliance status and separate protected human appraisal. The preview explicitly distinguishes authorised event initiation from Manager rating entry, independent HR publication, employee response, and presentation-ready Executive reporting. The sample event form does not issue an event, change any employee record, or generate an automatically inferred score.

These additions are **P1 design candidates only**, with synthetic data and local-only forms. Owner review and full-route desktop/mobile literal references remain outstanding, including the exact revised approved Projects PNG. All prior stage gates and production release protections remain unchanged.

## P1 connected reporting error-state review

The Manager and Executive reporting previews now include an explicit locally simulated **evidence load failure**. Switching into this state replaces all visible summary metrics and evidence rows with a clear error and a separate restore-demo action, rather than showing apparently real zero/completed values while a required source query failed. This is a design demonstration, not a fix to the outstanding P6 Manager reporting app defect. A dedicated Playwright source-preview scenario checks both roles, the error announcement and the absence of factual metrics during failure. Actual application P6/P8 tests remain mandatory; do not mark them passed from this P1 HTML.

## Multi-unit Manager selection — connected P1 review-only state

The connected V4 prototype now supports a visibly selected Unit One/Unit Two **synthetic Manager headship** switch. This is an illustrative interaction, not a claim that the real user changed organisational membership. Switching the simulated unit resets the selected preview record and work filter; the general Staff, Volunteer and other role demos cannot acquire new capabilities through the Manager's UI. A companion Playwright test checks this separation, and a source-contract test verifies no backend, Auth or network calls are introduced.

The actual P3–P8 app must independently verify allowed multi-unit manager headships, stale response cancellation, RLS/RPC/Storage authorisation and no privacy leakage. This design remains unapproved until the owner reviews full desktop/mobile reference screens; **P1 stays IN PROGRESS** and production is untouched.

## Reporting design: distinguish loading, no filed evidence and source failure

The P1 Manager and Executive preview now offers **separate synthetic loading, unfiled-period and failed-source-read states**. Each removes the success metrics rather than treating an unfinished query, absent filing or failed request as a verified zero, published result or human-entered rating. The existing fail-closed **Report evidence could not be loaded** design and restoration action remain preserved.

These are local-only design samples with a direct browser test. They are not a fix for the outstanding P6 production Manager report error-state defect, and do not change Auth, RLS, payroll or any real data. Owner approval is still required for connected full role/phone references, including the latest revised Projects PNG. **P1 IN PROGRESS; no premature P2–P9 progression.**
