# CEAC Phase 6C — Reviewed Attendance RPC Security Surface

Date: 10 October 2026

## Review boundary

The Phase 6C owner-approved attendance-integrity design extends the authenticated
SECURITY DEFINER surface previously bounded at 132 functions after S2 migration
114. Replayed Phase 6 migrations require a reviewed ceiling of 136, a net growth
of four. This is an explicit feature-specific security review, **not** a
general relaxation of RLS, authority, privacy or protected-HR restrictions.

## Exact reviewed browser RPCs

- `attendance_integrity_status()` — caller-bound organisation status;
  the rotating code itself is disclosed only with workforce-manage authority.
- `attendance_set_office_code(boolean,integer)` — workforce management only;
  bounded TTL, attributable change and rotation.
- `attendance_verify_office_code(text,uuid)` — only the signed-in person's
  own currently open office session, with short-lived code validation.
- `attendance_corroboration_for_day(date)` — caller, authorised Unit Manager,
  workforce manager or permitted Compliance scope; sensitive volunteer
  exclusion remains enforced.
- `attendance_day_evidence(date)` — authorised attendance evidence summaries,
  preserving existing actor/organisation boundaries.

All five require authenticated execution, deny anonymous execution, use fixed
search paths, and retain SECURITY DEFINER only because browser callers cannot
read the underlying protected tables directly. The general security gate
checks that every callable definer RPC is identity/authority-bound. The Phase
6C SQL gate additionally tests tenant isolation, append-only evidence and
role-specific authority and exercises negative cases.

`attendance_record_network_corroboration(text,uuid,uuid,boolean,text)`
remains service-role-only. Browser-supplied network claims cannot forge office
presence. Historical `attendance_create_office_code(uuid,integer)` and
`attendance_verify_office_code(uuid,text)` have already been removed by
migration 124 in clean replay. Migration 125 only revokes authenticated grants
if legacy definitions remain on an older deployment.

## Consequence / payroll boundary

Corroboration is evidence, never automatic absence, misconduct, salary
deduction, discipline or a payroll input. The approved volunteer
no-attendance/no-recorded obligation does not generate ordinary staff
lateness or absence conclusions.

## Acceptance conditions

The authenticated-definer upper bound is 136, not an unbounded allowance.
The security gate enumerates these five exact function signatures. Any further
expansion requires another review and allowlist update. The unchanged
no-anonymous-definer, fixed-search-path and RLS-on-all-public-tables gates
remain mandatory. Full SQL/RLS, migration replay, Account Security and
browser Level B must pass on the same exact head before merge.

This document does not approve a deployment, production database migration,
branch-protection bypass or a merge.
