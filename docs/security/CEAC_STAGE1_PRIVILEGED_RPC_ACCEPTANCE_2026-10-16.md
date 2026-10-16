# CEAC OS Stage 1 — authenticated privileged API security review (16 Oct 2026)

**Scope:** Original production Supabase project and approved public repository; investigation is read-only, and implementation is isolated on security PR #114. Do not treat advisor WARN count as vulnerability count or as permission to mass-revoke endpoint access.

## What the live database actually exposes

- 274 public `SECURITY DEFINER` functions, all owned by postgres and all with explicit configuration/search paths.
- Exactly **145** publicly exposed to **authenticated**; **zero** accessible to **anon**. The exact 145 signatures are explicitly pinned in `supabase/tests/security_definer_surface_gate.sql`; an unexpected new/missing function fails the gate, rather than merely comparing a ceiling.
- The 145 are callable only by signed-in users, not only by administrators. The individual function must validate who is acting, tenant, target and authority before using the database owner's privileges. **An explicit allowlist is not proof that each function is secure.**
- Previous S2 inventory `docs/security/CEAC_S2_SECURITY_DEFINER_INVENTORY_2026-10-06.md` categorized 135 public signatures. Of the present 145, 128 still match older inventory signatures. Differences reflect later protected attendance, performance, volunteer, roster and grant workflows plus earlier revocations/renames.
- Exact historical C/D direct exposure reductions already applied in migration 114: `app_can_write_operational_context`, `cancel_ministry_event` and `link_work_items` revoked from anon/authenticated/PUBLIC; additional revoked `guard_last_authority` and `share_performance_review` have explicit SQL tests.

## Additional function signatures requiring release-level review after 6 October

The current code/security gate intentionally exposes the following **17** signatures, absent from the earlier dated inventory:
- Attendance: `attendance_corroboration_for_day(date)`, `attendance_hr_audit_correction(uuid,text,text)`, `attendance_integrity_status()`, `attendance_manager_decide_correction(uuid,boolean,text)`, `attendance_request_correction(uuid,date,text,jsonb,text,uuid)`, `attendance_set_office_code(boolean,integer)` and overload `(boolean,integer,uuid)`, `attendance_verify_office_code(text,uuid)`.
- Authority: `grant_capability(uuid,text,uuid,text,timestamptz)`.
- Performance: `performance_employee_release_visible(uuid,timestamptz)`, `performance_hr_decide_release(uuid,boolean,text)`, `performance_request_release(uuid,text)`.
- Volunteer: `volunteer_approve_invitation(uuid,text)`, `volunteer_reimbursement_request(text,bigint,text,text)`, `volunteer_reimbursement_review(uuid,text,text)`, `volunteer_request_invitation(text,text,uuid,jsonb)`.
- Workforce: `workforce_record_roster_pattern(uuid,date,date,jsonb,jsonb,text,uuid)`.

Every one of these 17 currently references the signed-in actor and the organisation scope in its definition. Source code checks alone are insufficient: critical target-person and action restrictions need the existing negative SQL tests, rollback-only authenticated-context tests and ultimately genuine browser sessions. Spot-reviewed details: the deprecated two-parameter office-code setter delegates to the capability-guarded three-parameter setter; office-code verification requires the caller's own open work session and rate-limits failed attempts; volunteer reimbursement requires active approved volunteer employment; performance visibility limits to own appraisal; privileged grant requires `authority.manage` plus a reason. Audit markers can be written by domain triggers rather than being directly visible in every function body.

## Engineering decision

**Do not revoke all 145 signatures.** These implement intentionally privileged functions such as `grant_capability`, guarded payroll approval and staff invitations; a global revocation or global `SECURITY INVOKER` conversion would break protected application features and security contracts.

**Keep the exact allowlist, zero-anon access, fixed search paths, mandatory actor/tenant checks, target-ID-swap negative tests and least-privilege HR/payroll role separation.** If targeted deeper review finds an unused browser-executable helper or unguarded function, remove only that exact direct EXECUTE permission in a separately tested forward migration. For the retained business APIs, Supabase's generic authenticated-SECURITY-DEFINER warning is intentionally applicable; suppress/report after individual risk acceptance, not by pretending the finding is zero.

## Public Support view correction

PR #114 replaces `public.support_case_safe_status` with an invoker-only security barrier, delegating the narrowly filtered response to `private.support_case_safe_status_rows()` (private schema not exposed over the Data API). The helper returns only the same 11 personal-case fields and checks confirmed identity, tenant and reporter/affected-person IDs, and never adds raw `support_cases` SELECT to a reporter. The migration grants authenticated but not anonymous helper EXECUTE and the existing view keeps its REST name/shape. Disposable SQL gate tests reporter visibility, unrelated user denial and no raw-table access inside `ROLLBACK`.

**Release boundary:** SQL migration is not approved for direct production application merely because this document exists. Run full exact-HEAD CI, disposable migration replay and all security/privacy gates, independent review, then obtain a separate production release GO. Finally confirm the live Supabase advisor view finding disappears and the original protected status semantics remain. No new Supabase project; do not replay earlier migrations.

**Unrelated outstanding security:** breached-password checks remain disabled and the legacy demo account is still active. These need separate Auth/dashboard/audited Administration actions and are not addressed by migration 148. Stage 2 verified TOTP/AAL2 and restore exercises remain deferred by the owner.

## 16 October production migration-ledger reconciliation

Owner approved the production rollout after full exact-head CI, Account Security, Migration Replay and Quality Gate passed. The connected Supabase migration API generated authoritative version `20261016090159` on original project `efjljhftsesssumtshvp` for this migration (152 applied versions). This filename matches the actual applied-version ledger; its SQL body retains identical reviewed Git blob content. The original planned local-only version `20261016100000` is intentionally removed, not reapplied or ledger-repaired through blind SQL. Live Supabase advisor no longer reports the `security_definer_view` ERROR. Exactly 145 intentional authenticated-callable public DEFINER RPC warnings remain and require separate individually scoped review, not blanket revocation. No new user/HR/Payroll data, separate Supabase project or Stage 2 changes.
