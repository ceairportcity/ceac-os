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
