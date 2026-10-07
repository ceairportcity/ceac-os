# CEAC OS — S8 Attendance Safety Policy Backend Contract

Date: 7 October 2026
Status: IMPLEMENTATION CONTRACT — MIGRATION PENDING CANONICAL VERSION GENERATION

## Locked attendance policy

General organisation schedule:

- Monday: 12:00–17:00
- Tuesday–Friday: 10:00–17:00

Schedule hierarchy:

1. person-specific effective schedule;
2. employment-type/contract-specific effective schedule;
3. organisation default effective schedule.

The canonical employment-type field is `employment_records.employment_type`.

Thresholds:

- grace window: 30 minutes after expected start;
- within-grace events become a pattern only after more than two occurrences in the same calendar month;
- formal-late threshold: 45 minutes after expected start.

Required factual start states:

- `on_time`
- `within_grace`
- `outside_grace_below_formal_late`
- `formal_late`
- `no_start_work_evidence`

The third and later `within_grace` occurrence may set a separate `grace_pattern=true` evidence flag, but the factual state remains `within_grace`.

## Safety boundary

Attendance evidence is not disciplinary automation.

The system must not:

- auto-mark misconduct;
- auto-mark absence;
- auto-deduct salary;
- create automatic disciplinary punishment;
- convert a factual late state into a performance score;
- treat missing Start Work evidence as proof the person was absent.

Any consequential human decision must consider:

- the applicable effective schedule;
- Start Work evidence;
- approved leave;
- recorded attendance notice/permission;
- approved exception/correction;
- other relevant factual context;
- human review.

## Existing schema to preserve

Existing `workforce_schedule_versions` is append-only and already supports:

- effective dates;
- supersession;
- day maps;
- per-day `clock_map`;
- person schedule history.

Existing `attendance_corrections` is append-oriented and should be extended for approved exceptions rather than replaced by a new punishment ledger.

Existing `attendance_day_evidence(date)` already combines schedule, session, leave and attendance-notice evidence. S8 should evolve that factual evidence path rather than create a parallel scoring engine.

Phase 6 PR #140 also introduces append-oriented attendance corroboration for short-lived front-desk codes and trusted network signals. Those rows remain evidence only: they must never become authoritative absence, misconduct, discipline, salary or Payroll conclusions. S8 should consume or reference that corroboration where useful rather than create a second office-presence evidence subsystem.

## Required schedule-schema extension

The current `workforce_schedule_versions.profile_id` is mandatory, so it cannot represent an organisation default.

Extend the table with explicit scope:

- `scope_type`: `organisation`, `employment_type`, or `person`;
- `employment_type` nullable;
- `profile_id` becomes nullable.

Backfill all existing rows as `scope_type='person'`.

Enforce exactly one subject shape:

- organisation: `profile_id is null`, `employment_type is null`;
- employment_type: `profile_id is null`, non-empty `employment_type`;
- person: non-null `profile_id`, `employment_type is null`.

Existing `unit_id` may remain as historical/provenance context but must not override the locked hierarchy unless a later owner decision explicitly introduces unit schedule precedence.

Schedule versions remain effective-dated and superseded, never destructively rewritten.

## Organisation default seed

The S8 migration should create the general organisation default only through the reviewed workforce schedule model.

Use the existing day-type model for expected working days and encode day-specific clocks through `clock_map`:

- Mon: start 12:00, end 17:00
- Tue: start 10:00, end 17:00
- Wed: start 10:00, end 17:00
- Thu: start 10:00, end 17:00
- Fri: start 10:00, end 17:00

Weekend/non-working behavior remains governed by the day map rather than inferred as misconduct.

The seeded version must be attributable and effective-dated.

## Effective attendance policy version

Create an append-only `attendance_policy_versions` table with:

- `id`
- `org_id`
- `policy_key`
- `version`
- `effective_from`
- `effective_to`
- `grace_minutes` default 30
- `grace_occurrences_before_pattern` default 2
- `formal_late_minutes` default 45
- `supersedes_id`
- `reason`
- `created_by`
- `created_at`

Constraints:

- grace minutes >= 0;
- pattern occurrence count >= 0;
- formal-late minutes > grace minutes;
- one effective version per policy chain/date;
- append-only supersession.

Do not put salary, punishment or absence consequences into this table.

## Schedule resolver

Add a server-side schedule resolver for one person/date.

Resolution order:

1. latest effective non-superseded `person` version;
2. latest effective non-superseded `employment_type` version matching `employment_records.employment_type`;
3. latest effective non-superseded `organisation` version.

Return factual schedule identity, day type, expected start/end and source scope.

Do not use browser-only schedule precedence for authoritative attendance evidence.

## Factual start-state calculation

For an expected working day with resolved start time:

- first valid Start Work at or before expected start → `on_time`;
- > expected start and <= expected start + 30 minutes → `within_grace`;
- > expected start + 30 minutes and < expected start + 45 minutes → `outside_grace_below_formal_late`;
- >= expected start + 45 minutes → `formal_late`;
- no Start Work evidence → `no_start_work_evidence`.

Do not infer a state when no working session is expected for that day.

The function should separately return:

- applicable schedule/version;
- factual start state;
- minutes after expected start when measurable;
- monthly within-grace occurrence count;
- `grace_pattern` boolean;
- approved leave context;
- approved attendance notice/permission context;
- approved exception context;
- `human_review_required`;
- evidence IDs used.

## Monthly grace-pattern rule

The first two `within_grace` occurrences in a calendar month are factual grace events without a pattern flag.

For the third and later within-grace occurrence:

- factual state stays `within_grace`;
- `grace_pattern=true`;
- surface for human review;
- do not convert it into formal late;
- do not create discipline or salary action.

Approved exceptions should not be counted as unexcused grace-pattern evidence when the exception explicitly covers the start-time variance.

## Approved exceptions

Extend `attendance_corrections.correction_type` with an explicit approved-exception type rather than adding a duplicate discipline ledger.

An approved exception must record:

- person;
- date/session context;
- before/after factual context;
- reason;
- approver;
- effective timestamp;
- reversal link where later corrected.

Authorised approvers:

- existing reviewed attendance/workforce authority where appropriate;
- Group Pastor / Executive may approve an exception.

Self-approval is prohibited.

Exceptions do not rewrite the original work-session timestamp.

## Attendance evidence output

Evolve `attendance_day_evidence(date)` or introduce a narrow helper used by it so each person/day can expose:

- resolved schedule;
- factual start state;
- grace-pattern flag;
- leave/permission/exception context;
- human-review status.

Compliance or leadership views remain sanitized.

Do not expose protected leave/medical narratives through attendance evidence. Medical notices remain status/date-only outside Protected HR.

## Payroll and discipline isolation

No S8 function, trigger or view may:

- write payroll amounts;
- alter compensation;
- invoke payroll preparation/approval;
- mark disciplinary findings;
- automatically create an absence finding.

If a later payroll product consumes attendance, it must consume separately approved human-reviewed outcomes, not raw S8 factual states.

## Required authority and audit posture

Schedule/policy administration continues through explicit workforce authority.

Attendance exception approval must be server-authorised and audited.

All consequential mutations record:

- actor;
- subject;
- reason;
- timestamp;
- original factual evidence;
- resulting approved context;
- reversal/correction relationship when applicable.

No direct authenticated table writes should be introduced.

## Verified current no-consequence baseline

Read-only production inspection on 7 October 2026 verified the current attendance/work-session implementation before S8 policy expansion.

Across all current attendance/work-session server functions and their table triggers:

- direct Payroll writes/calls detected: **0**;
- protected compensation/payment writes detected: **0**;
- Compliance outcome writes detected: **0**;
- disciplinary consequence logic detected: **0**;
- salary consequence logic detected: **0**.

The event/rules layer was also inspected:

- active attendance/work-session-triggered workflows: **0**;
- active attendance/work-session integration subscriptions: **0**;
- attendance policy-rule catalogue currently contains threshold configuration only (`attendance.grace_minutes` and `attendance.late_after_minutes`), not Payroll or discipline rules.

Medical attendance notices remain date/status-only at both RPC and table-constraint level.

This baseline is now executable in:

`supabase/tests/attendance_safety_no_consequence_gate.sql`

The gate is part of the complete SQL/RLS/security suite. It fails if attendance/session code begins calling or writing Payroll, compensation, discipline or Compliance consequences; if protected leave/medical narrative enters the organisation attendance evidence projection; or if an automatic attendance-triggered workflow/integration is introduced without explicit S8 security review.

A future notification-only attendance integration is not permanently forbidden. It must be reviewed and the gate deliberately amended rather than silently bypassed.

## Required SQL gates

The S8 migration is not accepted until tests prove:

- organisation default resolves when no override exists;
- matching employment-type override beats organisation default;
- person override beats employment-type and organisation defaults;
- expired/future/superseded versions do not resolve incorrectly;
- `employment_records.employment_type` is the contract-scope source;
- Monday resolves to 12:00–17:00;
- Tuesday–Friday resolve to 10:00–17:00;
- exact threshold boundaries classify correctly;
- third monthly within-grace event sets only the pattern flag;
- approved exception prevents inappropriate grace-pattern counting;
- no Start Work evidence is not labelled absence;
- approved leave/permission/exception is surfaced separately from raw factual state;
- Group Pastor/Executive exception approval works;
- self-approval fails;
- no S8 path writes payroll/compensation/discipline;
- protected medical/leave narratives remain hidden;
- original work-session evidence remains immutable;
- anonymous SECURITY DEFINER callable count remains 0;
- authenticated SECURITY DEFINER surface does not exceed the reviewed ceiling without explicit acceptance;
- explicit `search_path` remains in force.

## Migration sequencing

Do not invent a migration filename.

Generate the S8 migration only after:

1. historical migration parity PR #148 passes protected checks and merges;
2. protected main/live Supabase history is re-verified at exact parity;
3. S3 temporary-delegation migration is merged;
4. live Supabase records the exact canonical S3 version;
5. GitHub/live migration parity is re-verified again;
6. the migration-generation workflow is available.

Current required S3 predecessor:

`20261007083250_118_capability_delegation_expiry.sql`

## Phase 5 collision boundary

This S8 tranche is backend-only.

Do not modify Phase 5-owned App/Admin/navigation/People visual surfaces while the active reconciled Phase 5 PR #145 remains open. Phase 6 PR #140 also owns attendance/calendar UI and corroboration primitives; S8 must reconcile forward with those surfaces rather than duplicate them.
