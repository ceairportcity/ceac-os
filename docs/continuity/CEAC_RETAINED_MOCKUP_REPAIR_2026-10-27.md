# Retained mockup repair — 27 October 2026

## Owner correction and starting point

The owner rejected the blanket completion claim after PR155: Time & Leave still showed its old workspace, and other agreed screens were omitted. The instruction is to find and implement all retained mockups, preserving the existing role colours, accepted Overview, People & Access, Control Center, real data and authorities. This is continued authorised implementation/release work, not a new design programme.

Starting released main: `a455a16af7bcefdc725d7951a6f8aa78d50146f8`, tree `9d289b046eb5657bc7b6e26fe9dd3787b3f210aa`. PR155 is merged; continue its existing `chatgpt/approved-owner-corrections-20261027` branch from that main. Do not reopen PR155 as though its previously missing pages had shipped. Do not touch independent PR150.

Original private comparison PDF recovered locally and independently SHA256 verified: `c83d072a270035373ba6f3100a2bc2128ad15d436f8e13e2a9802f46028cf5af`. A similarly named earlier preview PDF has different bytes; it is not substituted for this source. Private PDF/screenshots are not committed. The six owner-rejected reports/Achievements/Work Review/Payroll proposals are superseded by their separately requested revisions; this does not authorise recolouring any role shell.

## All 19 reference screens accounted for

| Mockup | Surface | Implementation/evidence boundary |
| --- | --- | --- |
| 01 | Account & security | Repair separates Security, Sessions and Account activity, with concise session/activity summaries and the existing provider-verified authenticator. Actor/organisation keyed workspace discards old account reads. Mandatory MFA stays deferred. |
| 02 | Executive reports | PR155 revised composition retained; existing contextual figures, source register and Chart/Table. Not a claim that the rejected original proposal became approved. |
| 03 | HR reports | PR155 revised composition retained; named filing and equivalent views. |
| 04 | Manager reports | PR155 revised role-scoped composition retained. |
| 05 | My achievements | PR155 revised personal composition retained; no rankings or invented facts. |
| 06 | Meeting viewer/organiser | Repair adds agenda/details composition and explicit viewer/organiser context. PR155's organiser-only writes and private notes remain. |
| 07 | Organisation departments | Repair replaces the department card stack with the existing semantic sortable table, recorded head/member counts and nearby Open actions. |
| 08 | Organisation person | Existing membership-aware person layout and deliberate work opening retained; exact private-work query denial rechecked. |
| 09 | Work reviewer | PR155 revised read-only submitted-outcome composition retained; no diary/checklist queries. |
| 10 | Finance overview/requests | Released Finance chart/ledger and independent Admin request/history implementation retained. No threshold, currency or approval-path change here. |
| 11 | Expense/receipt | Released optional private receipt attachment to an existing saved spend record retained. Saving and attaching are attributable separate steps; no simulated local picker is presented as stored evidence. |
| 12 | Payroll | PR155 revised net/context/search/register/setup composition retained; calculation and independent approval controls unchanged. |
| 13 | Learning catalogue | Repair presents course cards with real state/module/resource counts; deliberate opening instead of an always-open builder. |
| 14 | Learning builder | Repair gives the selected course its own focused workspace and return to catalogue. Released draft detail/module/resource editors and author-free learner preview retained. Unsupported uploads/formats and pre-publication assignment are not invented. |
| 15 | Announcements | Repair adds factual All/Published/Draft/Closed filters, publishing checklist and draft preview. Saving is still separate from publishing; confirmed/failed/newer draft protections retained. No scheduled-publishing feature invented. |
| 16 | Invitations | Released current-state filters and truthful delivery handling retained inside accepted People & Access. |
| 17 | Reviews & development | Repair separates Prepare, Assessment, Publication and Response. Existing reviewer authority, structured ratings, independent publication/version checks and draft values remain. |
| 18 | Time & Leave workspace | Repair implements header/action, navigation before content, source-checked summary, compact availability/decision layout, schedule readiness and semantic daily register. Full location evidence remains available on deliberate disclosure. Roster identities are never merged by names; employment-account and roster scopes remain labelled. |
| 19 | Weekly schedule | Released seven-day grid/effective dates/reason/failed-save retention retained and regression checked. |

This table records implementation mapping, not blanket owner visual acceptance. New code is not live until source-bound required checks, release integration/deployment and actual production checks succeed.

## Focused verification and retained failures

- Initial changed workforce source selection: 17/17 PASS. Complete source selection before subsequent presentation-only refinements: 633/633 PASS; native clean build and script sealing PASS. Source-bound final candidate checks remain required.
- First browser run: five passes and two Account test failures: the test requested a button named Sessions although the real segmented control is a tab. Corrected to the observed semantic tab, with no app/security/assertion bypass.
- Combined run: 44/46 PASS; two HR form cases still attempted Create plan without opening the new Assessment stage. Tests now follow the actual stage navigation and retain the same denied-save payload/draft assertions.
- Subsequent combined run: 51/53 PASS. Two Organisation cases failed a strict locator because People named both the view selector and the new table sorting button. Navigation is now scoped to the Organisation views group. No app permission or query constraint was loosened.
- Delta after selector correction: 15/15 PASS, including both directory journeys; seven announcement confirmed/late/denied/account-transition cases; phone/desktop screenshots and semantic checks of directory, Learning, HR stages, meeting details and Announcements; and Time & Leave/account views. Synthetic intercepted responses exercise real components, not signed-in production or live database mutations.
- Immutable emitted CSS budget initially failed (635181 bytes versus631808). Removed unreferenced retired Calendar timeline rules, superseded Admin tab styles and the obsolete independent-day-card layout; reused the existing table treatment. Did not increase the budget. Subsequent build/budget contract PASS. Recheck final emitted assets after the final narrow layout refinement.
- Actual screenshot review checked restored Time & Leave summary/calendar/register and Learning catalogue at phone/desktop. Follow-up reduces default duplicate leave entries and restores compact calendar spacing; its affected browser check is required.

Private local evidence logs use `/tmp/ceac-omissions-*`; synthetic screenshots use `test-artifacts/timeleave-repaired-*`, `account-repaired-*` and `retained-*`. These are local development evidence, not public original-reference uploads or production records. Preserve raw failures, and certify only the actual final tree/SHA with its resulting checks.

## Release boundary

No database/auth/storage/configuration change is required by this presentation repair. Preserve production PR155's canonical209 migrations and security fixes, existing accounts/passwords, forward Finance restrictions and the owner's recorded backup waiver. Do not repeat the completed receipt/schema cutover. Full final required qualification and genuine existing-account production verification remain pending at this checkpoint. Reuse prior unchanged SQL/receipt evidence only in its actual historical scope; never manufacture exact-head success statuses.

## Frozen local qualification

Final narrow layout refinement and fixture role reconciliation completed. Pinned Node22.12.0: all633 registered source tests PASS (`ceac-omissions-final-source-node22.log`); sealed build PASS (`ceac-omissions-final-build-node22.log`); immutable emitted bundle/CSS contract PASS (`ceac-omissions-final-budget-node22.log`). Clean lockfile install succeeded. The initial installer used host Node24 and warned about the engine; all final source/build/budget executions explicitly use the accepted Node22 binary.

Final affected actual-component rendering/interaction check at390/1440, Node22/Chromium1194:9/9 PASS, exit0, no skips/retries (`ceac-omissions-frozen-browser-node22.log`). Covers both directory source-read boundaries, all five repaired composition screenshots per width, Time & Leave navigation/summary/table/Manager-first review, separate account views, and failed-session fail-closed behaviour. Prior unaffected passing cases from the51/53 run and15/15 delta remain scoped historical evidence; the two corrected directory cases were rerun and pass. Initial documentation check could not determine HEAD^ in the depth-one clone; run the standard check after recording the local candidate commit, whose parent is present. No requirement is waived.
