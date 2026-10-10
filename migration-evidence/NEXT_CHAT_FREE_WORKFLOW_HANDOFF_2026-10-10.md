# CEAC OS — NEW CHAT HANDOFF / FREE-ONLY COMPLETION WORKFLOW
Verified snapshot: 2026-10-10 ~08:15 UTC. Re-fetch live GitHub and Vercel state on every continuation; SHAs below are checkpoints only.

## Owner's binding decisions
- Finish the existing CEAC OS project; **do not rebuild** or throw away existing work.
- **No GitHub Pro, GitLab, CircleCI, paid upgrades or purchases.** Prefer GitHub Free, existing GitHub Actions, existing Supabase and existing Vercel project.
- Preserve approved designs, scope, migrations, security/HR boundaries, RLS, MFA, auditability and historical commits. Never force-push, reset, overwrite newer valid work, or weaken tests for a green result.
- New `ceairportcity/ceac-os` is the independent **private** long-term canonical development repository.
- The public original `thestandardinst-star/ceac-os` must be **deleted only at the very end**, after new repo + complete history + open work + Vercel + Supabase + all critical product flows + secure restoration/rollback are verified, and the owner explicitly reconfirms which repository should be deleted. **Do not delete the old repo now, the Standard Institute account, any other repository, or the new CEAC repo.**
- Do not falsely promise that deleting an already-public repository removes prior third-party clones, forks, cached or redistributed source.
- User asked to move the work into a fresh ChatGPT chat because the previous one was full. Treat this file and the LIVE repository as the handoff, not a statement that work is completed.

## Established migrated repository inventory
Source: https://github.com/thestandardinst-star/ceac-os (public)
Destination: https://github.com/ceairportcity/ceac-os (private)
- Git history mirror verified: 146 original development branch names with exact original head SHAs at migration; 3,147 reachable commits on original branches, tracked main files/migrations/docs verified. Archived original allrefs Git bundle preserves 171 original GitHub-managed pull refs and 29 PR-only commits.
- Source and destination main at current snapshot: `827fbe7391467dd13d6e411527416402a252993c`. Destination main branch currently NOT protected.
- Original repository remains in place for historical issue/review evidence and currently powers production.
- Destination's archive branch `archive/original-github-history-and-metadata-2026-10-10` has the independently verified historical Git bundle, original PR metadata, selected original visual inspection artifacts, and final migration handoff.
- Do not merge the archive branch into main; keep archive/PR metadata private.

## Live PR state checked 2026-10-10 approx. 08:15 UTC
There were 27 open destination PRs. Selected originals, all unmerged at last check:
- #19 Phase 5 Admin redesign, base main, head `b7609818ec360ca65a2311d85173d08828c599cc`, CI/Replay/Account Security/Quality Gate each SUCCESS. PR open, not draft.
- #22 historical migration-parity security PR, base main, head `9692fe92c5e45e562fec56b438da0f82b3f4f516`, all four workflows SUCCESS. PR open, not draft. Production Supabase migration schema_migrations earlier checked read-only: 119 applied version/name identities present in this security branch.
- #15 Phase 6 staff/volunteer calendar/attendance, base Phase 5 head `4d4d9a3d06865165642b99ae69087f5e7f932760`, CI/Replay/Account Security success; Quality Gate FAILURE at last check.
- #21 Executive redesign, base Phase 6 head `a014e413674d1f8a641d1f4297d865dee6d04d41`, all four workflow groups FAILED at last check.
- #23 resilience/PWA/DR, base Executive head `3e8211b53730a5f1b189ee2d6a7543a669b17474`, all four workflow groups FAILED at last check.
- #24 owner leave/consequence decisions, base resilience head `9e3fb36cd6e2899ef466549fd83252fbec0770d5`, all four workflow groups FAILED at last check.
- #25 final go-live preparation, base owner decisions head `9f3caed57b1513b0aca27baf71e438847221861c`, all four workflow groups FAILED at last check.
- Newer commits from other CEAC development work may have advanced PR heads during the chat. Re-fetch live state before ANY write or merger. Investigate recent failures from source/test outputs; some GitHub Actions log fetch attempts returned ephemeral BlobNotFound, so use Actions job pages and valid available artifacts or re-runs; do not guess failure causes.
- Historical original 22 open PRs were recreated at destination as drafts initially; some have since been marked ready. There are further Dependabot and independent diagnostic PRs. Reconcile each PR against the live dependency graph and locked owner product/UX decisions.
- Full deployed user-role acceptance is not yet confirmed. Do not claim Phase 5/Phase 6/final feature work merged or complete until objectively verified.

## Vercel and Supabase
- Existing Vercel project: `ceac-os`, project ID `prj_bAv4ggX6umjp54UjjLqqGm7bBcIB`.
- Latest inspected production deployment remained READY, still connected to OLD `thestandardinst-star/ceac-os` at main SHA `827fbe7391467dd13d6e411527416402a252993c`.
- Vercel GitHub namespace list exposes only `thestandardinst-star`. Official Vercel GitHub App has not yet been granted access to new `ceairportcity/ceac-os`. Owner must grant that repo-only installation through GitHub/Vercel before switching the existing project source. **No replacement production project. No premature source switch.**
- Retain the same existing live Supabase project, database, users, profiles, roles and production migration history. Never reset or apply unreviewed migrations against production.
- Isolated migration replay, RLS security suite, signed-in role testing, visual parity/mobile tests and recovery/backup restore should be completed before go-live.

## FREE-ONLY GitHub safeguard strategy — DO NOT ASK FOR PRO
1. **Safest default: keep destination PRIVATE on GitHub Free.** Existing Actions and PR checks can run (subject to GitHub Free private minutes/storage limits). Manually enforce a strict policy: do not push to main or merge any PR until exact head SHA has passing CI, migration replay, Account Security and applicable Quality Gate, and the owner approves release. This is governance/manual discipline, NOT GitHub-enforced private branch protection.
2. A PUBLIC repo under GitHub Free can enforce branch rules/protection and usually has free standard-hosted Actions minutes. But making the **new** repo public would publish ALL of its branches/history, archival historical PR metadata, and any sensitive details for the world to copy. Current private contents may not be identical in sensitivity to the previously public source. Never change visibility without a complete scan of current and historical secrets, protected HR/private material, migration archives and exact owner's explicit authorization for this exposure. Turning the repo private afterward removes GitHub Free branch protection enforcement. Do not portray temporary public-then-private as durable private protected-main.
3. Check free Actions quota before large test runs. Avoid excessive retests, concurrent redundant CI and paid larger runners. No billing upgrades or payment configurations.
4. Do not secretly bypass failed required tests. If manual enforcement on private is unacceptable for go-live, pause irreversible production merge/cutover and give the user the real remaining options instead of inventing an equivalent free feature.

## Execution order in new chat
A. Reconcile latest main/PR states and CI workflow result URLs in ceairportcity. Determine whether another writer is updating branches; avoid overwriting.
B. Establish targeted failures on all currently failing PRs from job logs and actual code/tests. Repair forward with isolated commits, unchanged RLS/MFA/SQL migration ordering, then rerun exact-head checks; verify decisions/designs referenced by repository.
C. Merge through PRs in correct dependency/security order only after tests and owner-approved acceptance; preserve commit history. Original source main must not be disturbed. Protect against premature deployment or environment changes.
D. Vercel GitHub App: install/allow `ceairportcity/ceac-os` explicitly, verify new Git source is selectable; retain same Vercel project, environment variable names/values and custom domains. Stage and smoke-test using isolated nonproduction environment, then perform controlled existing-project source switch only when safe and owner-authorized.
E. Verify all agreed CEAC role flows, admin+HR invitation, People details, volunteer/calendar/attendance, staff, payroll/leave rules, Executive dashboards, Guide, PWA resilience/offline recovery, visual parity against approved mockups, protected-data/RLS/MFA/DR and production logs.
F. Snapshot and verify independent backup outside the old GitHub host; confirm original 146 refs and historical PR evidence are still in destination/archive; confirm source links won't break essential deployments or logins; verify release stability, rollback, ownership, credentials and secrets audit. ONLY THEN ask the user for explicit final confirmation to delete repository `thestandardinst-star/ceac-os` (not account). Deletion has irreversible effects; public forks/clones may survive.

## Safety / status
This is a LIVE handoff document and does not itself approve any release, PR merge, repo visibility change, billing change, production migration, Vercel source switch, or deletion.
Continue actual code and CI work in the next chat. Do not stop just for routine updates, but do not misrepresent blocked actions or bypass safeguards.
