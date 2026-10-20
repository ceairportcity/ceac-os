# Organisational schedule extension — existing Work engine

Purpose: complete approved custom intervals, due times/timezones and optional end-count semantics on existing recurring_operations and dated schedule versions. No replacement Calendar engine, duplicate projects, automatic completion, scoring or production cutover.

Authority: creation retains create_typed_work's exact assigned/self-created boundaries. Future option changes delegate to the existing creator/department-manager/Administration decision and row lock. The public writer is a reviewed new invoker API backed by a fixed-search-path private trusted implementation. Preview is a new read-only invoker API with source RLS, active identity/tenant/assurance checks and bounded pages. Both new entrypoints and the new private trusted writer are explicitly inventoried and negatively tested; retaining the historical 148 public definers does not mean no new API was added.

Data: interval_count 1–366, recognised IANA timezone (default Africa/Accra), optional local due_time, optional occurrence_limit 1–5000 on each version and current master. Legacy rows default to their existing every-period Accra schedules. No employee/HR/payroll/identity record changes.

Lifecycle: changes are future-dated and append versions. End count counts configured schedule dates from that version's effective date, independent of completion; missing monthly dates are skipped, and a pause does not rewrite this count rule. End date and count both bound a version, whichever ends first. Each due instant is computed by PostgreSQL named-zone rules. A skipped wall-clock time moves forward by the clock change; a repeated wall-clock time uses its later standard-time instant. Null due time means end of the local date. Preview does not fabricate completion. Existing recorded outcome attribution remains append-only.

Audit/reversal: existing schedule change audit plus attributable option-change audit; revert with another future schedule, not historical edits. Failed invalid options roll back the whole attempted version. Pause history remains intact. Existing immutable outcome/date uniqueness and row locking stay authoritative.

Bounds: preview <=200 responsibilities per request, <=370 calendar days, <=370 future days. Count-limited evaluation caps historical scanning at twenty years and errors explicitly beyond that bound. Browser reads every exact-count provider page, rejects changed/missing/duplicate pages, and clears state across identity changes. Complex time calculations stay on the server so Safari support does not depend on a new Temporal polyfill or package.

Verification: SQL covers interval/count dates, rejected dates, preserved recorded proof, invalid-zone rollback, DST spring/fall, cross-unit reads, colleague writes, anonymous grants and future assurance. Native tests cover input validation and provider pagination. Real browsers must exercise self-created and assigned custom schedules and future edits before any acceptance claim.

Still outstanding separately: actual reminder delivery, independent occurrence checklist/evidence/status/review, authorised cover/delegation and final release-wide/reference checks. Stored schedule options alone do not close that broader recurrence contract.

References: https://supabase.com/docs/guides/database/functions and https://www.postgresql.org/docs/16/datetime-invalid-input.html .
