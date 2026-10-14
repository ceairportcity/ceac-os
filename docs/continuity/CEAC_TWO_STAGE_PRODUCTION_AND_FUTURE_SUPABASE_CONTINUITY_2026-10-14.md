# CEAC OS — Binding Two-Stage Production and Long-Term Data Continuity Decision

**Owner decision: 14 October 2026.** Status: **OWNER APPROVED, DOCUMENTATION PENDING INTEGRATION**. This contract governs release planning, future product development, schema changes and any eventual database cutover. It is not evidence that Stage 1 is accepted or that Stage 2 has been performed. Record in the canonical private GitHub repository, then reconcile into each current active integration/release branch and protected main through ordinary review. This decision supersedes earlier *same-release Google-only* timing where those requirements conflict; it does **not** waive existing security, data confidentiality, recovery, owner GO or product/architecture contracts.

## Why the release was split

The original Supabase production project `efjljhftsesssumtshvp` lives under the original Standard Institute organisation. GitHub's restriction on the original account prevented the needed third-party authorisation for Supabase owner access/transfer. The owner chose **not to wait on GitHub/Supabase Support, replace the first-release database, or restart CEAC's approved application build**. An independent CE Airport City Supabase account/project has been reported as already created, but its actual project ID, access and readiness must be verified before use. Do not guess its project ID.

The ownership blockage is an interruption to the *ongoing, unfinished CAC product programme*, not its end. CEAC product architecture and later phase discussions remain open. Initial production release is not a declaration that the final product is complete.

## Two separate environments and release stages

### Stage 1 — Deliver the improved application on existing production

- Canonical PRIVATE source: `ceairportcity/ceac-os`; existing Vercel project `ceac-os` and domain remain.
- Use the existing Supabase production project `efjljhftsesssumtshvp`, under its current organisation, **without transferring ownership**.
- Use the existing proven email/password sign-in and recovery path for this release; keep required currently supported privileged-user MFA and server-side authorisation. **Google-only OAuth and all-role Google/TOTP AAL2 are deferred to Stage 2, not cancelled.** Never apply the Google-only lockout migration while launching password sign-in.
- Reconcile approved improved app source and existing schema. Production currently has 119 applied migrations, with an historical pending set of 25. Recalculate from actual release HEAD/ledger whenever they change. Identify which features require missing database schema; do not fake functionality or silently deploy broken screens. Follow verified backup/recovery, role/privacy, exact-source build, controlled database-change and owner GO requirements.
- Deploy only after real accepted checks and explicit owner authorisation. No implication of an automatic GO.
- **Continue ordinary approved product development after Stage 1.** New architecture decisions, improvements, fixes and phases may go into the current production system under normal reviewed migrations and release safety, rather than freezing the app for a speculative move.

### Stage 2 — Future independently controlled CE Airport City Supabase + Google

- The later transition is a **required, open programme obligation**, not a forgotten optional idea or an immediate rebuild.
- Verify the already-reported CE Airport City Supabase project, its correct owner/access, project ID, region and settings. Do not create another project unless the owner explicitly decides the existing one is unsuitable.
- Prepare a **current-state migration plan at the time of transition**, not a static replay of today's initial 144 migration files. The future destination must implement **every accepted schema, RLS, RPC, Storage, Auth, extension and approved product change that occurs during Stage 1 and afterward**.
- Rehearse a clean database build or schema reconciliation on the target in an isolated environment; verify dependencies, security definer privileges, policies, storage buckets/objects, Auth configuration, audit/retention rules and production-compatible data.
- At cutover planning, confirm which records are truly disposable test data versus genuine production data. The owner indicated early user accounts could be recreated, **but that does not waive preservation of employee, attendance, HR, payroll, operational, audit or files generated after the Stage 1 launch**. Never treat future live production records as disposable based on the status of historical test accounts.
- Choose and test an owner-approved data transfer or user re-onboarding strategy with privacy, identity mapping, credential-reset, downtime, rollback and loss-prevention requirements. Never copy passwords/secrets as plaintext; do not assume Auth IDs can be retained without tested support.
- Configure and independently verify Google OAuth, HR-approved account admission, correct callback domains, verified TOTP/AAL2 for **every role**, server-enforced restrictions, Auth Hooks, identity linking where applicable, recovery and multi-role acceptance.
- Maintain original production as the recoverable source until destination acceptance and explicit separate owner GO. Switch existing Vercel app to the new destination only through a controlled, reversible cutover; then verify full functional/visual parity and data completeness.

## Change-tracking obligation from now until Stage 2 is complete

**Every new release, migration or architecture/product amendment MUST assess the future destination impact.**

Keep a **Stage 2 carry-forward ledger** in this file or a linked controlled register. Entries must identify:

1. Source application SHA / PR and live production release or migration version.
2. Feature or owner decision and affected user roles.
3. Schema / RLS / RPC / Auth / Storage / extension / external provider configuration dependencies.
4. Whether historical and post-launch production data must be migrated, reconstructed with proof, or legitimately omitted with owner approval.
5. Required acceptance tests, target compatibility and deferred owner decisions.
6. Whether applied on the current Stage 1 production and/or independently verified on the CE Airport City target.

New architecture phases are not blocked by Stage 2, but must not be designed as if it will never happen. Before Stage 2 cutover, reconcile the source ledger **through the latest actual production deployment**, rather than relying on the 14 October inventory. Never assume an old backup or schema snapshot includes intervening improvements.

### Initial carry-forward register (baseline; refine as source and deployments advance)

| Item | Stage 1 | Stage 2 carry-forward requirement |
| --- | --- | --- |
| Approved Staff / Manager / Admin-HR / Executive / Volunteer / Technical Support source and visual architecture | Preserve and verify accepted launch scope | Full role and feature parity, including post-launch changes |
| Existing email/password and privileged MFA | Use only after real sign-in/security acceptance | Reconcile identity/account transition to Google-only + universal verified TOTP/AAL2 |
| SQL migration inventory | 119 applied in old production at the recorded 14 Oct checkpoint; 25 candidate pending, not automatic launch scope | Reconcile **all** later applied schema/data migrations and security changes, not just initial 144 files |
| Operational, HR, payroll, attendance, leave, volunteer and Support records | Keep whatever is real at launch and generated afterward; no fabricated or silent discarded records | Explicit data-retention/transfer mapping and full validation |
| Storage and protected documents | Maintain correct secure access and recovery | Inventory, transfer or owner-approved disposition and verify private download denial and audit |
| Future architecture and phase decisions | Continue under approved design/acceptance process | Incorporate every accepted phase and open discussion outcome |
| CE Airport City Supabase project | Reported already created; NOT first-release dependency | Verify existing project owner/id/access before target activity |
| Vercel Git and production environment | Preserve current project/domain with safe configured backend | Reconfigure only at reviewed Stage 2 cutover |

## Required first-read and review behaviour

For every new Work/Chat/release or architecture session: read `AGENTS.md`, `docs/final-product/PRODUCT_OWNER_DECISIONS.md` and **this document** before choosing a release or data-architecture path. State clearly which Stage is active, the current real production backend, and the deferred obligation. If a document or PR conflicts with the owner's new two-stage *timing*, follow this decision while preserving stricter data/security/release safeguards. Do not treat an old Google-only PR as the active Stage 1 release automatically.

**Stage 2 is only marked CLOSED after:** destination project ownership verified; exact current-state schema/features migrated and accepted; post-launch production data accounted for; Google/all-role MFA and role-browser verification passed; recoverability/rollback proven; separate GO given; application switched and monitored successfully. Merely creating an account or project is not closure.

## First implementation follow-up

The Work owner must inspect the actual current workspace, newer PRs, unfinished rollback-only rehearsal and installed database/schema, then create a **Stage 1 compatibility/release delta** from the improved candidate: restore working email/password path without removing agreed design/features, exclude Google-only lockout appropriately, classify schema-dependent features, and execute genuine safety/recovery/role acceptance before requesting a Stage 1 production GO. In parallel, record Stage 2 as a tracked future architecture/release obligation. No production mutation is authorised by this documentation commit.
