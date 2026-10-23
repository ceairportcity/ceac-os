# A6 — Live finance demonstration boundary

The live audit confirmed three explicitly demo spend lines, three demo budgets and two demo finance requests contribute to real operational views. This correction adds reversible, attributable classification without rewriting original values or history. Non-financial demo cleanup remains a separate step; an ambiguous mixed work dependency has now been confirmed as test work by the owner.

## Implementation

- Append-only `finance_demo_events` records each classification, reason, actor and time. Application roles cannot directly insert, update or delete the classification history. Ordinary same-organisation callers can read only the predicate metadata, not reasons or actor details.
- Existing table permissions remain. Three restrictive SELECT policies additionally exclude classified demo spend, budgets and requests. All direct readers, including Manager, Executive and project finance, use this boundary. The existing invoker aggregate respects those policies; the existing definer budget aggregate explicitly applies the same predicate.
- Exactly two new Administration-only RPCs permit review and reasoned classification/restoration. Source fingerprints, latest classification revisions, tenant scope, source row locks and existing active/confirmed/privileged authority checks apply. These two exact signatures are added to the reviewed 161-interface allowlist, without allowing anonymous or internal-trigger execution.
- Archived requests cannot be approved or fulfilled through the existing definer RPCs. Database triggers reject mutation of archived records and new live links to archived spend. Existing linked live corrections/fulfilled requests require review before their original spend can be archived.
- The Administration Finance review sheet offers explicitly titled demo candidates and previously classified records. A title suggests review only; it never classifies a row automatically. Each change retains original money and request state. Restore appends an attributable event.

## Migration and rollout

`20261023175241_finance_demo_boundary.sql` was created through the Supabase CLI. Latest production migration inspected before implementation: `20261023162604`, HR date-only preservation. This migration contains no seeded-row classification and no destructive DML. After qualification, deploy the boundary, then use the actual signed-in Administration workflow to classify the eight independently verified demo financial records. Verify before/after source fingerprints, live totals, archive availability and absence of actionable demo payment requests. Do not impersonate a production user through SQL.

## Verification ledger

- Baseline: main `6e0aa0f184fcdff0d1e47c3f7234ca008bff9181`.
- Local production build: PASS (Node 24.19.0; repository CI remains Node 22).
- Source inventory initially exposed required migration/interface inventory updates; those inventories now explicitly name the new migration and two RPCs. Final result recorded in the PR.
- Disposable SQL gate adds actual archive, direct-read and both aggregate exclusions, blocked fulfilment/reversal/direct-insert, stale source and classification revisions, cross-tenant read/write denial, three non-admin role denials, restoration, immutable source fingerprints and audit attribution. All synthetic data is rolled back.
- Browser acceptance adds a 390px archive/restore form journey with mocked finance classification RPCs. This tests UI orchestration and exact revision arguments; the SQL gate tests actual database authority and ledger behaviour.
- Existing security/performance advisors inspected before DDL. Pre-existing warnings retained, including intentionally callable guarded RPCs and disabled leaked-password protection. No authentication setting is changed here.
- Exact-head required CI, complete migration replay, SQL gates, role/browser qualification, production migration and actual live verification: PENDING until their evidence is recorded in the PR. This document alone does not claim A6 closure.

Rollback: append a restoration classification through the same Administration workflow. Original records remain intact; no money movement or transaction reversal is fabricated. Retain the additive schema and audit events.
