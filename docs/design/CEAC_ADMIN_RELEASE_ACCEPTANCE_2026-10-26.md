# Administration/HR correction release — 26 October 2026

Status: **Released; genuine existing-account live checks completed.**

This closes the owner-authorised Administration/HR audit, legacy-design replacement and connected-workflow correction tranche implemented by [PR #149](https://github.com/ceairportcity/ceac-os/pull/149). Preserve the released Executive work in #148, earlier HR/People/Control Center approvals, independent Compliance placement, existing records and authority, and deferred Google/MFA decisions. Further Manager/Staff design work remains separate. Inspect current main and newer PRs before continuing; independent Start Work PR #150 existed at this cutover.

## Source and deployment receipts

| Receipt | Verified value |
| --- | --- |
| Qualified final PR head | `69d9323ddd5ed65f02befd07cccb5f6cb5f0342b` |
| Qualified complete Git tree | `3921bd75aef8e2a4b30e95dd4e34ed60ec4ba015` |
| Production code merge | `7b9d5049a842928b3fb71079cf56e18ba4afae0d` |
| Merge parents | Released main `77c9efb` and qualified head `69d9323` |
| Merge/tree reconciliation | Complete merge tree equals the qualified tree exactly; no extra application change |
| Explicit preview | `dpl_7sYb7q1PrXkSnTi9QpSXM12tKASe`, Ready, source `69d9323` |
| Production deployment | `dpl_9oF3zqotjJ7XU8y5bXYfEaZpdMqb`, Ready / Production / Current, source `7b9d504` |
| Actual production domain | <https://ceac-os-git.vercel.app/> |

Both deployment source/status bindings were inspected in the actual Vercel dashboard. The connected Vercel API did not expose CEAC; the owner explicitly approved browser fallback. Preview logs positively showed **629 source tests passed, zero failed**, followed by the production build and script sealing. Production was then inspected and the existing HR session reloaded into the released code.

## Delivered corrections

- Preserve approved Overview, People & Access and Control Center identities; use the existing approved header/drawer families across surviving Admin legacy screens and child forms. Distinct Admin navigation/action icons and phone mappings replace confusing duplicate symbols.
- Exact leave-request selection, employee reason, stage-specific HR decision context, selected-request reload and phone inspector priority; retain Manager-first approval and server/RLS authority.
- Connect Calendar and department project entries to the existing authorised project workspace; retain project/task return and reload context. Project summaries filter actual records and distinguish unavailable data from a verified empty catalogue.
- Modernise Expenses, Finance, Payroll, employee/employment, unit, announcement, Learning, Reviews, Reports, Assets and Workforce forms; keep rejected drafts/errors visible. Validate exact-cent amounts and returned write identities; prevent unsupported success on zero-row results. Preserve factual records, human appraisal/publication rules and lifecycle/access boundaries.
- Independent authorised search groups retain verified results when an unrelated lookup fails; Work searches title/reference with deduplication. Failed catalogue reads withhold figures/actions rather than asserting fabricated empty or successful states.
- Duty venues use the existing OpenStreetMap and deliberate map-centre selection, with no raw coordinate-entry requirement. Saving requires a selected point and existing constraints. Primary office remains a reference, never attendance proof. Leave settings opens authorised Schedules & policy through URL/history/reload.
- Build portability: preserve the exact original Executive CSS blob as a hash-checked test fixture, keeping all 36 protected-rule comparisons and original blob identity. Pin browser jobs to supported Ubuntu 24.04 after ubuntu-latest rolled to unsupported 26.04. No dependency upgrade, test threshold reduction or new product CSS baseline.

## Qualification

Final head `69d9323` completed all required checks successfully:

| Check | Run | Result |
| --- | --- | --- |
| CI / source / build | `40334719667` | Success |
| Migration Replay | `40334719913` | Success |
| Account Security | `40334719750` | Success |
| Full Level B Quality Gate | `40334719928` | Success: SQL/authority, all eight browser shards and final evidence |

Browser totals: **924 passed / 1 existing deferred-MFA skip / 0 failed**. Shards 1–8 respectively: 116,118,201,28,137,100,111,113 passes. No new skip, retry expansion, cancellation, guard bypass or visual-reference relaxation. Emitted CSS remains **631579 / 631808 bytes**; approved Overview mean RGB threshold remains <=6.

The portability repair also passed 18/18 focused contracts, the complete 629-test source suite and sealed build on Node 22.12.0 in an exported tree with **no .git directory**. A deliberately altered original-reference fixture is rejected. Pre-Admin rollback source with the portable guard and supported browser runners passes 627/627 source and the production build; this is source/build recovery evidence, not a performed hosting rollback or database restore.

The actual production merge `7b9d504` subsequently completed its own source-bound checks: CI `40339184694`, Migration Replay `40339184670`, Account Security `40339184536`, and complete Level B Quality Gate `40339184552` are all terminal **Success**. This additional identical-tree run was allowed to finish before the acceptance documentation was published; no in-flight evidence was cancelled.

## Genuine production verification

The secure sign-in flow positively restored the existing Rebecca Arthur / Administration & HR session. After the production deployment became Ready, a fresh page reload confirmed the role and released behaviour:

1. Overview Review request opens the exact real selected request, shows its reason and HR-stage context, and retains selection on reload. No leave decision was submitted.
2. Leave rules opens Schedules & policy; selection persists on reload. The real policy revision uses ComposerDrawer and activation remains disabled with required values missing; closed without changes.
3. Duty locations exposes the map-centre selection control and keyboard map group, contains no raw latitude/longitude inputs and disables saving before deliberate point selection. No venue/location permission or record changed.
4. A populated department project opens its actual authorised reader and survives reload; an existing task opens with project context, and Back returns to that same project.
5. Learning's draft-course drawer, the review-period wizard, asset creation and Add employee use the released ComposerDrawer; required save gates remain. Each was closed without submission.
6. Global search finds an existing real work item by its reference and opens that correct record; return to the HR Overview completes without an alert.

No production employee, financial, payroll, policy, attendance, invitation, learning, review, asset or lifecycle business record was written merely for testing. Synthetic fixture mutation/persistence, negative authority, failure states and phone/laptop coverage are documented in the [cumulative correction ledger](../continuity/CEAC_ADMIN_CORRECTIONS_2026-10-26.md); genuine production checks are read-only/open-and-cancel evidence, not a claim of live write persistence. OpenStreetMap sometimes reported partial tile availability in the cloud browser; no provider outage or real tile-loading proof is inferred from the deliberately intercepted synthetic maps. Fresh encrypted backup/restore is not claimed; the owner's existing waiver remains recorded.

The historical failures and intermediate pending statuses in the cumulative ledger remain historical. Continue from this released source and current main rather than restarting this tranche.
