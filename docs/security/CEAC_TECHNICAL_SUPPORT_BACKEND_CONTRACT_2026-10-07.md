# CEAC OS — Technical Support Backend Security Contract

Date: 7 October 2026
Status: IMPLEMENTATION CONTRACT — DATABASE MIGRATION PENDING CANONICAL VERSION GENERATION
Source: `docs/security/CEAC_TECHNICAL_SUPPORT_PANEL_SPEC_v1.md`

## Purpose

This contract defines the backend boundary for CEAC Technical Support before any shared-shell UI is added.

Technical Support is an autonomous service team associated with Media & Technical. It is not a normal department and it is not a hidden super-admin role.

## Authority principles

Technical Support receives only support-specific authority.

It must **not** receive or reuse the following merely for convenience:

- `people.manage`
- `authority.manage`
- `hr_private.access`
- `payroll.prepare`
- `payroll.approve`
- `compliance.manage`
- `attendance.correct`

Technical Support membership alone never implies Admin, Executive, HR, Payroll, employment or leave authority.

A Technical Support volunteer can hold a CEAC account and Technical Support membership without becoming an employee.

## Proposed support-specific capability catalogue

The migration should register these capabilities as distinct catalogue entries:

- `support.case.manage` — receive, triage, assign and resolve Technical Support cases.
- `support.access.apply_approved` — execute a previously approved technical account/access action. This capability cannot approve the action and cannot create business authority by itself.
- `support.system.inspect` — inspect support-safe service health, technical diagnostics and failure metadata.
- `support.recovery.verify` — record backup/restore verification evidence and recovery-readiness checks. It does not permit destructive restore execution by itself.
- `support.integration.operate` — inspect and operate approved technical integration configuration within a support-safe scope. It is not a substitute for unrestricted `integration.manage`.
- `support.guides.manage` — maintain Technical Support runbooks and user-facing guides.

All support capabilities are organisation-scoped unless a later reviewed design proves a narrower scope is required.

Support capability grants continue to use the canonical `capability_grants` history, expiry and revoke semantics. Temporary grants therefore inherit S3 expiry once that tranche is live.

## Technical Support membership

Create a dedicated membership record rather than a normal department membership.

Required fields:

- `id`
- `org_id`
- `profile_id`
- `role`: `lead` or `member`
- `active`
- `started_at`
- `ended_at`
- `added_by`
- `ended_by`
- `reason`
- timestamps

Rules:

- one active Technical Support membership per person;
- membership does not mutate `employment_records.employment_type`;
- membership does not create a normal Unit Head;
- historical membership is never deleted;
- ending membership preserves completed support-case attribution;
- the intended lead transition must preserve previous Media & Technical attribution before current placement is deactivated.

## Support cases

Support cases remain separate from ordinary Work Engine visibility.

Create `support_cases` with at least:

- `id`
- `org_id`
- `reference`
- `reported_by`
- `affected_profile_id` nullable
- `affected_unit_id` nullable
- `category`
- `summary`
- `description`
- `affected_service`
- `impact`
- `state`
- `assigned_to` nullable
- `opened_at`
- `resolved_at` nullable
- `closed_at` nullable
- `resolution_summary` nullable

Plain-language categories should map to the locked product choices:

- cannot_sign_in
- something_not_working
- cannot_upload
- access_needed
- information_looks_wrong
- other

Do not create employee-performance scoring, discipline scoring or infrastructure vanity severity.

## Case history

Create append-oriented `support_case_events`.

Every consequential support action records:

- case
- actor
- action
- reason/note
- timestamp
- safe metadata

Events include assignment, status change, diagnostic note, approval requested, approval recorded, technical action executed and resolution.

Historical events are not rewritten to hide mistakes.

## Approval boundary for access changes

Support must distinguish business approval from technical execution.

Create an approval/action record linked to the case with:

- requested action
- target person/account
- target authority/access object
- requested by
- required approver class
- approved/declined by
- approved/declined at
- approval reason
- executed by
- executed at
- execution result

Rules:

1. Technical Support may prepare an action request.
2. `support.access.apply_approved` may execute only an already-approved action.
3. The executor cannot synthesize or self-record the business approval.
4. A Technical Support user cannot grant themselves Admin, Executive, HR, Payroll, `authority.manage`, `people.manage` or equivalent power.
5. The underlying business-authority function remains authoritative. Support-specific execution must call a narrow reviewed path rather than bypassing it.
6. Actor, approver, reason, action and time remain auditable.

## Protected-data boundary

Support-case access never implies protected-record access.

Technical Support may see support-safe facts such as:

- account exists / active / inactive;
- invitation state;
- activation/sign-in error class;
- unit/team needed to diagnose access;
- capability names needed to diagnose approved access;
- system/provider error metadata;
- file-upload technical metadata;
- service health.

Technical Support may not read through the support case:

- salary or compensation amounts;
- payroll details;
- medical information;
- protected leave content;
- confidential HR documents;
- disciplinary content;
- confidential compliance findings beyond a support-safe health/state indicator.

If a protected subsystem needs troubleshooting, expose a support-safe health result or require separately approved protected access through its existing authority boundary.

## Private file evidence

Reuse `ceac-operational-private`; do not copy support evidence into `ceac-hr-private`.

Extend `operational_file_links` only with an explicit:

- context type: `support_case`
- relation: `support_evidence`

Add `app_can_read_support_case(case_id)` and `app_can_write_support_case(case_id)`.

Then extend `app_can_read_operational_context` and `app_can_write_operational_context` so `support_case` files inherit the case-specific authorization.

Do not make operational files readable merely because the viewer is a Technical Support member.

## Case visibility

A signed-in person may read:

- a case they reported;
- a case where they are the affected person, subject to safe-field projection;
- a case assigned to them when they hold active `support.case.manage`;
- organisation support queues only when they hold active `support.case.manage`.

Ordinary users must not gain visibility into other users' cases.

Technical Support case projections must exclude protected business content even when the underlying person has separate protected authority; protected data belongs to its original surface.

## System inspection

`support.system.inspect` exposes only reviewed technical health/diagnostic functions.

Default output must map technical data into:

- Working
- Needs attention
- Down

Detailed provider messages, IDs, migration refs and logs may be returned only through a technical-details path and must avoid credentials, tokens and secrets.

No diagnostic function may return:

- service-role keys;
- database passwords;
- private API secrets;
- MFA secrets/recovery material;
- raw confidential HR/payroll records.

## Security posture

All support write RPCs:

- require authenticated identity;
- use explicit reviewed support capability checks;
- use `security definer` only when required;
- set explicit `search_path`;
- revoke `public` and `anon` execution;
- grant only the exact reviewed authenticated/service-role surface;
- preserve the S2 authenticated SECURITY DEFINER ceiling unless a separately reviewed increase is accepted;
- enforce organisation/object scope server-side;
- write immutable/auditable actor/reason/time evidence.

A support function must not weaken RLS to make itself work.

## Required SQL gates for the eventual migration

The migration is not accepted until tests prove:

- Technical Support membership grants no broad business capability;
- self-grant of support or business authority is denied;
- a support member without `support.case.manage` cannot inspect the queue;
- a support case reporter can read only their own safe case projection;
- case assignment and resolution require the narrow support capability;
- access execution without recorded approval is denied;
- access executor cannot create its own approval;
- protected HR/payroll/medical/leave content cannot be obtained through support RPCs;
- support-case operational files cannot be read without case access;
- `anon` callable SECURITY DEFINER count remains 0;
- authenticated SECURITY DEFINER surface does not exceed the accepted ceiling without an explicit reviewed change;
- all security functions use explicit `search_path`;
- S3 capability expiry applies to support capabilities;
- MFA/AAL2 enforcement still applies whenever the support identity holds privileged operational authority.

## Migration sequencing

Do not create a migration filename manually.

The next Technical Support schema migration must be generated after the canonical S3 migration and after reconciling protected main/live Supabase history.

Current required predecessor:

`20261007083250_118_capability_delegation_expiry.sql`

Do not apply Technical Support schema changes to live Supabase until S3 is merged, applied with exact migration parity, and re-verified.

## UI collision boundary

No Technical Support shared-shell/App/navigation integration belongs in this tranche while Phase 5 is actively modifying those files.

Backend contract and security tests may proceed independently.
