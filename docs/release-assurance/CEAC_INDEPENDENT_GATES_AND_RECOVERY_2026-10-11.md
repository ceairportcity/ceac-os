# CEAC OS — independent release assurance, migration effects, recovery and MFA acceptance

**11 October 2026 · PRIVATE · review-only; NO-GO**

Frozen main release PR [#44](https://github.com/ceairportcity/ceac-os/pull/44): `e00f13873409e4cc16ec1493b60b71d5cde1114a`. Production main: `827fbe7391467dd13d6e411527416402a252993c`. Product work continues on separate PR #47; this independent security work is draft PR #48 and must not overwrite either branch. Evidence index: Issue #46.

## 1. Native GitHub Codespaces acceptance evidence

The private repo includes `.devcontainer/devcontainer.json` with automatic `postStartCommand` and `postAttachCommand` invoking `.devcontainer/launch-automatic-verification.sh`. That launcher compares its cache against **remote PR #44 HEAD**, then invokes the checked-in exact-head detached-worktree runner. Its presence and a browser attempt to open a Codespace are **not evidence of execution or passing gates**.

- PR #44 discussions have **no verified post-run SHA+status summary** for the frozen head.
- GitHub Actions at frozen head show CI, Migration Replay, Account Security and Quality Gate failures, with dependent jobs skipped and early jobs having no executed test steps. Vercel preview READY is not browser/SQL validation.
- Existing Codespace `fuzzy-space-giggle-xrx595q5r555266qq` was visible and connected, but native terminal output could not be accessed through the available connector; another historic Codespace launch claim did not include confirmed results.
- **One indispensable execution capability**: authorised read/execute access to the *existing private Codespace's actual Linux shell*, or a connector that can return the exact files below. No new CI service, GitHub Pro, repository publishing or TinyFish retries are needed.
- First inspect (do **not** delete/restart a worker without establishing state): `/tmp/ceac-private-autorun-tested-head`, `/tmp/ceac-private-autorun-exit-code`, `/tmp/ceac-private-autorun-summary.md`, `/tmp/ceac-private-autorun-result.log`, and the identified `/tmp/ceac-gate-evidence.*/manifest.txt`, `*.status`, `SHA256SUMS.txt`. Require exact tested head `e00f138...`, expected main `827fbe7...`, runner exit 0, **every** required status PASS, and verified private evidence checksums. If absent/stale, execute the reviewed `bash .devcontainer/launch-automatic-verification.sh` in the existing Codespace after checking the worker is not already running.
- After release PR receives new reviewed commits, its exact SHA and **the full affected gates** must be rerun; never carry old PASS forward. Do not upload raw logs or test secrets to GitHub.

## 2. Candidate migrations — actual source review and production impact

Live production has **119 applied versions** with exact name agreement against **130 SQL files** on frozen PR #44; **11 unapplied versions**. Timestamp versions are unique: there are two descriptive `123` files but no duplicate version IDs. The review branch adds **five further unique forward versions**, 127, 128, 129, 130 and 131, producing **135** files *only if integrated after PR #44*. Product PR #47 must be reconciled before final sequence lock.

| Order / file | Main change / potential effect | Mandatory isolated test |
| --- | --- | --- |
| `20261007083250_118_capability_delegation_expiry` | Adds `expires_at` and rewrites privileged delegation, grant/revoke and invitation/account helpers. Live 19 capability-grant rows. | Grant expiry, permanent authority-manager anti-lockout, payroll separation, disabled account and real MFA authority |
| `20261007090000_119_phase6_volunteer_operating_model` | New volunteer schemas, triggers, employment/invitation lifecycle alterations. Live 0 volunteer employment records, **4 pending invitations**, but zero rows is not proof of invitation safety. | Existing pending invites survive, sign-up activation, volunteer privacy/pattern rules, trigger effects |
| `20261007093000_120_phase6_private_day_planning` | New private personal plans and RLS; no top-level data backfill observed. | Author-only access, protected-calendar isolation |
| `20261007094500_121_phase6_personal_planning_extensions` | New planning metadata/constraints, no top-level DML observed. | All existing personal-plan data survives, role isolation |
| `20261007095500_122_phase6_personal_event_note_primitives` | Personal event notes and protected schemas; no top-level DML observed. | Personal owner, event-authority and cross-user denial |
| `20261007102000_123_phase6_attendance_integrity` | First temporary attendance-integrity model and code-window tables/RPCs. | Prove temporary tables remain empty until reconcile, no attendance invention |
| `20261007103000_123_phase6_attendance_integrity` | Overlapping second attendance model and network RPC; initial `current_user` service guard is incorrect in a definer, corrected by 126. | No exposed service RPC; confirm final 126 effective |
| `20261007104000_124_phase6_attendance_integrity_reconcile` | Explicitly **drops 3 temporary tables** only after `EXISTS` emptiness guard. | Fail closed with nonempty tables; empty rehearsal preserves all durable corroboration |
| `20261007180500_go_live_annual_leave_policy` | Updates owner-locked annual policy and may enrich historical annual requests from recorded schedule. Live **1 matching routing rule**, **1 annual request** and 1 study request; no automatic guessing allowed. | Pre/post row-diff, annual schedule availability, untouched study request, HR authority, no partial data loss |
| `20261010010000_125_restrict_legacy_office_code_rpcs` | Removes execution privileges from superseded attendance RPC signatures. | Authenticated cannot call obsolete office-code functions |
| `20261010030000_126_phase6_network_service_role_guard` | Fixes service-role JWT check and service-only grant for attendance corroboration. | Browser denial, valid server-only addition, tenant/session match |
| **Review PR #48** `20261011100000_127_report_draft_tenant_integrity` | Protects report period, unit and project tenant linkage; includes draft retrieval/update and version queries. Production has 1 report and **0 pre-existing mismatched period/unit/project links**. | Transactional two-org role-aware gate, positive draft update, no foreign report rows |
| **Review PR #48** `20261011103000_128_unit_budget_tenant_boundary` | Protects budget-position SECURITY DEFINER RPC from cross-org unit reads and from individually mismatched-org budgets, spend lines and finance approvals, retaining legitimate in-org access. | Same-org Finance/admin positive, ordinary staff/foreign unit denied, mismatched ledger rows invisible |
| **Review PR #48** `20261011110000_129_report_evidence_tenant_integrity` | Protects `save_and_submit_report` from linking cross-org work items, submissions or sessions despite matching unit UUIDs. Preserves the existing submission evidence and period rules. | Transactional genuine submission positive; foreign item, foreign submission and foreign session denial with no persisted records |
| **Review PR #48** `20261011113000_130_report_evidence_browser_write_lock` | Closes direct anon/authenticated table DML for report evidence refs, retaining authorised SELECT under RLS and normal SECURITY DEFINER RPC writes. | SQL ACL denial under real role, valid SELECT and RPC preserved, RLS still enabled |
| **Review PR #48** `20261011120000_131_report_row_tenant_invariant` | BEFORE INSERT/UPDATE trigger prevents foreign period, unit, project, profile, submitter, confirmer or correction-lineage links even via direct browser report-table DML, retaining legitimate draft edits. | Positive same-org report save/edit and four negative direct cross-tenant row writes in rolled-back SQL |

**No version in this table has been applied to production by the assurance work.** Review of source syntax and existing database counts is not migration execution.



## 3. Other live privileged-RPC authority review

Production publicly exposed SECURITY DEFINER inventory: **132 callable by authenticated**, **0 callable by anon**, and all 132 have an explicit `search_path`. Neither `authenticated` nor `anon` has `CREATE` on the public schema, and no direct `hr_private` SELECT is granted. Those are useful static boundaries, not proof of absence of privilege escalation.

Two specific investigations:
1. `save_report_draft` originally accepted unit/project IDs without comparing their organisations to the report period; its single-ID foreign keys do not check same-tenant linkage. PR #48 forward 127 and its SQL gate address this. Forward 129 and its SQL gate separately bind work/submission/session evidence rows to the report and reporting-period organisation. Forward 131 independently closes the direct browser reports-table INSERT/UPDATE bypass by enforcing same-org referenced period, unit and project at the database trigger layer. Forward 130 blocks direct browser mutation of the reference table: the live ACL currently grants broad DML to `anon`/`authenticated`, and the `rer_write` policy only tests access to a draft report, not the referenced objects. ManagerReports uses SELECT + the vetted submission RPC, so this closes a bypass without removing intended UI write functionality.
2. `unit_budget_position` originally read arbitrary `p_unit_id` where `app_is_admin()`, `app_is_exec()` or membership in **any** finance unit was true. It lacked a requirement that the requested unit belong to `app_org_id()`. PR #48 forward 128 closes that cross-tenant read while preserving in-org Finance access.

`project_close_readiness` uses `app_visible_projects()`, whose live definition restricts visible project IDs to `app_org_id()`; its lack of a literal org predicate is not by itself a confirmed vulnerability. `mark_room_read` and `mark_announcement_read` check subject-bound access helpers. Audit further exposed RPCs via same-org adversarial tests, not keyword regex alone. Final reviewed SQL surface after pending migrations must match the repository's exact-signature allowlist and all approved grants.

## 4. Encrypted production backup and genuine isolated restore — NOT DONE

**Verified vendor limitation:** Supabase's standard `supabase db dump` excludes managed `auth` and `storage` schemas by default (https://supabase.com/docs/reference/cli/supabase-db-dump). The existing encrypted export script now stamps `complete_recovery_backup=NO`, `auth_managed_schema_data=NOT_IN_DEFAULT_EXPORT` and `storage_managed_schema_data=NOT_IN_DEFAULT_EXPORT`. A successfully decrypted default archive alone cannot recover real users or all Storage metadata; demand a separately verified, supported managed-data export and isolated restore.

The existing `scripts/ops/prepare-ceac-db-backup.sh` is a useful encrypted logical-export scaffold, **not a full accepted recovery**: it explicitly marks `restore_status=NOT_TESTED`, omits Storage object bytes, and needs a verified strategy for Auth/Storage-managed tables. Current read-only snapshot: 9 Auth users, 0 verified TOTP factors, 2 Storage buckets, **0 Storage objects**, 119 migration records. Preserve Auth users and storage metadata even if object count is zero.

Required execution procedure, using authorised private credentials and a trusted nonproduction host, **never ChatGPT chat, source or issue comments**:
1. Confirm exact source SHA, restore Postgres/server compatibility, approved private backup location and separate protected encryption secret. Prevent dumping to the git worktree, public artifact storage or unencrypted logs. Use a secure PG/CLI connection strictly for read-only export.
2. Export exact production roles, application/public schema+data, `supabase_migrations`, required `auth` schema+data and `storage` schema+metadata, and any other managed extension/config objects needed for reproducible restoration. Do not assume a default `supabase db dump` includes Auth/Storage; explicitly inventory inclusion and record any unsupported objects.
3. Encrypt **before off-host storage**, checksum archive and a signed/private manifest, record counts and source snapshot. Preserve the decryption key outside the archive and independent of a single user's device.
4. On a **separate isolated nonproduction Supabase/Postgres environment**, restore roles/schemas/data according to dependency order, handle managed objects using supported Supabase procedures, verify sequences, foreign keys, RLS, 9 Auth identities (count only), application table row counts, 119 migration ledger names, protected-HR grants, buckets and object contents (0 at current baseline). Do not point restored services at production SMTP, webhooks, notifications or payment providers.
5. Run actual read/write and role-level smoke checks against restored data only; dry-run all ordered pending migrations, verify pre/post employee/invitation/report/leave rows and the attendance guard, then repeat affected SQL gates. Validate a second decrypt/restore and retention/access separation. Only then stamp **RESTORE VERIFIED** with evidence checksum, operator, exact SHA, timestamp and isolated target ID.
6. Keep encrypted backup storage and audited restore credentials private. An archive that merely decrypts or lists files is **not** a proved restoration.

**Current classification: BACKUP NOT CREATED / RESTORE NOT TESTED.** Do not turn on production migrations, promote a preview, or erase any source until this gate is complete.

## 5. Real-user MFA and invitation acceptance — NOT DONE

Live Auth has **0 verified MFA factors** and the organisation currently has `privileged_mfa_required=false`. No fake factor SQL fixture, code scan or TOTP screenshot is equivalent to an authorised person's successful MFA sign-in. No new login factors were created in this work.

Acceptance sequence:
1. Privileged owner/admin and independent recovery administrator verify their real email/account state, enrol their own TOTP factors through the approved CEAC UI, retain recovery arrangements outside this app and prove factors are `verified`. Never transmit TOTP secret/code, seed, token or password to chat, GitHub or screenshots.
2. With normal real-user sessions (not service keys), verify AAL1 self-service access remains available but cannot use Administration, Executive, manager approval, Payroll, capability, protected HR or confidential document authority when enforcement is switched on in an **isolated** verified environment.
3. Prove a fresh authenticator challenge yields `aal2` **with TOTP `amr`**, and a currently verified factor is linked to the same user; legitimate elevated actions work only then. Verify logout/session expiry/revocation and email/unverified/inactive users fail closed. Verify one ordinary Staff user and one unrelated unit/organisation cannot see HR/payroll records.
4. Only after at least one functional primary+recovery privileged access route is proved and the owner expressly approves the timing, enable production enforcement and repeat actual privileged role tests. Do not enable the flag while factors count is zero (privileged account lockout).
5. Run real invitation delivery/acceptance/resend/expiry, HR linkage and employee welcome without exposing invitation tokens; log non-sensitive message IDs and completion states. Confirm emails actually arrive and links cannot be reused by outsiders.

**Current classification: REAL-USER MFA NOT VERIFIED / INVITATIONS NOT ACCEPTED.** Do not force MFA enforcement, fabricate factors or weaken RLS to make sign-in work.

## 6. Release and collaboration rules

- PR #44 remains frozen until every baseline acceptance result is associated with its exact SHA and is independently reviewed.
- PR #47 is independent product implementation (Administration/People/attendance/invitations/Technical Support); do not alter it through assurance. Check its latest HEAD before integrating.
- PR #48 is the independent **DRAFT** security repair. Five additional migrations must be reconciled with the final product stack; local verification requires **135**, not the frozen baseline's 130, when tested together.
- No successful Vercel preview or existing Codespace configuration authorises a merge, Supabase DDL, public visibility, paid plan or production deployment.
- Final acceptance requires exact-head locally executed complete unit/build/browser/SQL gates, two-tenant adversarial authority, literal approved-role visual comparison, real restored backup, real MFA, signed second reviewer and separate owner go-live approval.

**As of this record: NO-GO.**
