# Operational demo archive and September period reconciliation

Owner authorised the next two live-audit fixes together after the completed 15+9 leave correction: demo projects/tasks, including the explicitly confirmed test task Speakers servicing, and duplicate September reporting periods. Preserve every original record and attachment. Seven identity cases remain deferred; accounts, leave policy, finance archival and actual business history are outside this change.

## Baseline and scope

Base main `9d383cab8a15b69a736fca2fea5ab4288b732da6`, branch `chatgpt/live-operational-demo-periods-20261023`. Current live source and database inspected independently. Three explicit demo projects, five explicit demo work items, and one owner-confirmed test task remain live. Genuine September Services and other ordinary work are retained. No current work/project dependency edges, active demo work sessions or linked private personal-day tasks were found.

The genuine September month starting 1 September and ending 30 September has two records: one open and one already closed at this inspection. Neither has reports. The explicit demo month has one submitted report. Retain the open genuine period as canonical, link/archive the unfiled closed duplicate, and separately archive the demo period while retaining its report. Do not fabricate a quarterly review date or rewrite submitted reports.

## Implementation

Forward migration `20261023195406_operational_demo_and_report_period_reconciliation.sql`, initially created with the Supabase CLI, adds an append-only archive ledger. No production IDs, title-based automatic filtering, seeded-data changes or business-state transitions occur in the migration. Administration reviews the current row fingerprint and archive revision; an atomic batch validates all rows before any change. Project archival requires every linked task classified and rejects unresolved live finance, reports, personal work and dependency consumers. Restoration preserves original states and requires the project restored before its task. Active work sessions block archival.

The existing tenant, role and private-work authority checks remain. Normal project/work/reporting RLS and private definer read projections apply the archive boundary to live data and aggregates. Existing FK-parent write triggers also reject new or changed operational use, including inside privileged mutation RPCs. Clock history and private planning records remain retained rather than converted into absence or fabricated outcomes. Two new exact Administration RPC signatures are independently inventoried: archive reader and atomic writer. The reviewed authenticated definer surface moves from 161 to 163, with no anonymous access or direct archive-event mutation grant.

Reports has an Administration-only review/restore panel. It retains report narratives and statuses for archived periods. Duplicate reconciliation is limited to an unfiled source period with exactly matching kind/date identity and a live canonical target. Report-bearing duplicates fail closed for a separate reviewed reconciliation. New duplicate ordinary reporting periods are rejected under a transaction advisory lock. Custom project-kind periods retain their existing scope.

## Executed evidence before publication

- Native source suite: 608/608 PASS, exit 0, Node 24.19.0; local production build PASS. Official repository CI uses Node 22 and remains required.
- Existing CEAC-owned isolated hosted staging contained seven synthetic profiles. The prior finance archive DDL was applied there as the necessary dependency, followed by the exact operational migration. Managed staging migration names/versions: finance_demo_boundary `20261023200153`; operational_demo_and_report_period_reconciliation `20261023200201`.
- Rollback-only functional SQL gate PASS: archive and restore project/tasks, classify a task without a Demo prefix, reject an unclassified mixed project and stale partial batch, exclude archived rows and reports from normal RLS and visibility helpers, preserve/review the original submitted report, reconcile the legacy unfiled duplicate, reject a new duplicate, reject filing against an archive, deny Staff and anonymous/direct archive writes, and compare complete source-row fingerprints after restoration. No fixture project or archive event remained; all seven synthetic profiles remained.
- Staging security advisor: existing 12 deny-by-default informational findings and existing leaked-password protection warning; exactly 163 reviewed authenticated definer interfaces after the two new guarded RPCs. No new missing-RLS or function-search-path finding.
- New browser journeys cover archive, restoration, duplicate canonical selection and retained report narrative at 320 and 1440 px. They are pending execution until publication.

## Release status

NOT LIVE at this checkpoint. Required exact-head CI, replay, security/SQL, all eight browser groups and final aggregate remain pending, as do production migration, deployment, genuine signed-in Administration classification, original-row fingerprint readback and actual live project/work/reporting checks. The completed finance and 15+9 leave corrections must not be reopened. Use the current PR description for the final frozen SHA, workflow IDs and subsequent executed release evidence.

## First published candidate and fixture correction

PR #135 first head `b70d6d9f8dcaae8a36a3e813130e154643f399de`, tree `b4646982ab9b8b341a3b2cb4c3277982c65adbb8`, matches local `fce3db5c8ebda087bd0fa53706b4ab8e8718a9db` exactly. Official Node 22 source/build completed before CI `40060790058` failed its changed-line whitespace check on one extra final blank line. The blank line is removed; no SQL semantics change.

Migration Replay `40060790066` and Account Security `40060790044` passed. Quality Gate `40060790057` browser groups 2, 4, 6 and 7 passed at the inspection checkpoint. Group 4 job `120773647717` passed all 73 cases, including the actual new 320px and 1440px archive/restore/canonical/retained-report journeys. Other browser groups were allowed to finish gathering useful evidence rather than prematurely cancelled.

The SQL job `120773647555` reached an older tenant-evidence fixture that creates two same-tenant weekly periods with identical dates; the new live uniqueness guard correctly rejected its setup. Only the denial fixture window changes from 5–11 October to 6–12 October, still containing all 6 October adversarial references. Every positive control, exact negative error and persisted-data assertion is retained. The corrected gate was executed against the isolated hosted staging with its missing standard synthetic work reference seeded inside the same rollback-only transaction: PASS. The archive gate was additionally executed with foreign-tenant reader/writer denial and privileged archived-period/report mutation attempts: PASS, original fingerprints preserved and fixtures rolled back.

This first head is not a final release PASS. Publish the collected test/whitespace correction as one successor; all mandated final exact-head checks, production release and live classification remain required. The existing HR account has been securely signed in again and the live three-period baseline independently read in the UI. No account, record or policy classification has been changed in production.
