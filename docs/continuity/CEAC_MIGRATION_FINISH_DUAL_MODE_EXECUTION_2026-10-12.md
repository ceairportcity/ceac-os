> **13 OCT 2026 OWNER UPDATE — BOUNDED TINYFISH CODESPACE RECOVERY:** Owner confirms TinyFish is available again. Connected wallet read-only check reported a positive balance, auto-reload unconfigured; connected browser profile currently has no saved GitHub sign-in. The 12 October blanket "TinyFish unavailable/exhausted" prohibition is **superseded solely for one controlled existing-Codespace recovery workflow** after explicit authenticated profile setup. Check wallet, limit first browser action to 35 steps and 10 minutes, recovery spend ≤$1 without renewed consent. Recovery mission: inspect real Work Codespace, protected uncommitted Google/identity/TOTP changes and exact Git branch/HEAD; safely preserve unpublished changes without copying secrets or altering production. Never use TinyFish to indiscriminately deploy, read private employee records, purchase services, create another workspace, or replace the existing GitHub/Vercel/Supabase. If browser profile sign-in, Credits, VS Code trust, terminal accessibility or ownership blocks progress, report the exact issue once; do not spend credits in retries. Maintain no production GO and all real MFA/restore/role acceptance requirements.

# CEAC OS — Finish the Migration: Chat/Work Execution Contract

**OWNER-BINDING operational instruction — 12 October 2026.** Applies to every Chat, Work, coding-agent and release session. This document is the **first operating contract** for the existing migration effort. It supersedes older, contradictory active-phase or tooling/process instructions; it does **not** weaken the accepted product design, privacy/RLS/HR/security, recovery, audit, tests, or production-GO constraints. Read `AGENTS.md`, `docs/final-product/PRODUCT_OWNER_DECISIONS.md`, `docs/continuity/CEAC_OWNER_RELEASE_SCOPE_FREEZE_2026-10-12.md`, `docs/continuity/CEAC_ENGINEERING_OPERATING_PLAYBOOK.md` and `docs/continuity/CEAC_LIVE_HANDOVER.md` for the full accepted constraints.

## 1. One outcome, not an endless programme

Finish the **already-approved improved application** migration from the former The Standard Institute GitHub repository to the existing **PRIVATE** `ceairportcity/ceac-os` repository. Preserve all accepted visual redesigns, Staff/Manager/Administration-HR/Executive/Volunteer/Technical Support surfaces, functionality, improvements, authority separation, records, permissions, audit and privacy protections.

Deliver the improved application through the **existing Vercel project** and **existing production Supabase** `efjljhftsesssumtshvp` so **real authorised people, especially HR, can sign in and use their actual approved screens and functions**, allowing normal development to resume. Do not roll back to an old, unimproved build simply to get a login page. Do not replace the GitHub/Vercel/Supabase projects, make the repository public, purchase services or rebuild CEAC from scratch.

**Same-release owner requirement (not deferred):** Google-only interactive sign-in restricted to verified HR-authorised Google identities plus CEAC-controlled verified TOTP/Supabase **AAL2 for every enabled role**. Preserve existing `auth.users.id`, profile/employee/HR records, memberships, audit, Storage and grants through verified identity linking. Never disable the present sign-in before the tested Google identity transition/recovery is ready. Enforce authorisation/AAL2 in server-side rows, RPCs, Storage and protected APIs, not only in the UI. The requirement is governed by `docs/final-product/PRODUCT_OWNER_DECISIONS.md`.

Success is demonstrated **end-to-end functionality and safe cutover**, not a passing source suite, new branch, report, percentage, or number of test runs.

## 2. Every session MUST execute this starting sequence

1. Check the **live** canonical `main`, unified PR #50, upstream integrated PRs, most recently touched branches, PR discussion and the relevant release docs. Git SHAs shown below are historical checkpoints, never presumptions. Locate the current Work branch, worktree changes and session handoff if accessible.
2. Read this file FIRST, then the latest owner decisions, freeze, handover, affected source and existing tested procedures. Resolve contradictions toward the **owner's latest migration-first outcome**, never toward a superseded phase or stale procedure.
3. Determine **which session owns each source area/branch**. **Uncommitted Work edits may exist even when GitHub shows no new push.** Absence of a GitHub commit is NOT evidence that Work did nothing.
4. Select one **highest-value, provably non-conflicting, immediately executable** remaining task from Section 3. State its dependency and expected verifiable outcome internally before touching anything. Execute it, verify it, persist the result, then continue with the next independent task while access remains.
5. Record PASS / FAIL / BLOCKED / NOT RUN truthfully, with exact source SHA, real command/exit code or API observation, time, limitations, and next action. Do not inflate historical source tests into authenticated/production acceptance.
6. If something is blocked, name the **single specific prerequisite once**, avoid rerunning the same unsuccessful provider/startup/test experiment, and move to a different independent task. If none exists, leave a precise durable handoff rather than generating busywork.

Do not repeatedly ask the owner for decisions already explicitly made. Ask only for an indispensable permission, identity-mapping ambiguity, secret/setting only the owner can supply, approval of new cost, or **explicit final production GO**.

## 3. Tool/owner division — zero TinyFish dependency

| Tool / capability | Chat independently can do now | Work / authorised owner must do |
| --- | --- | --- |
| **Connected GitHub app** | Read private source/PRs/commits and patch reviews, compare branches; open or review a **small isolated** PR for a confirmed non-overlapping fix; add exact evidence to existing handover or PR; inspect non-secret workflow records | Recover unpushed Codespace work, perform authenticated shell operations and coordinate integration/merge of reviewed final candidate |
| **Connected Supabase app** | **Read-only**, minimised SQL schema/aggregate checks, Auth/profile/invitation counts and migration ledger parity; inspect SQL functions/policies without disclosing private records | Actual OAuth/redirect/identity-link configuration; Auth/Storage fixture, credentialed end-to-end testing, backup/restore and **owner-authorised** production changes |
| **Connected Vercel app** | Read project/deployment metadata **only when permission succeeds**; record denied access without retry loops | Check existing project Git linkage, environment configuration, deploy and live access using the available authorised Work/project-owner environment |
| **Chat local Python/container** | Offline text/code/diff analysis and isolated deterministic tests **only if actual source files are genuinely available and the runtime supports them** | Codespace/Docker/browsers, full private checkout and tests requiring authentication, services, browser UI, OAuth redirects or protected secrets |
| **TinyFish / external agents** | **NOT AVAILABLE / credits exhausted. Never use or depend on TinyFish.** | Not a prerequisite for the migration; do not purchase, top up, or substitute paid browser agents |

**Also disallowed:** new paid GitHub/Codespaces runners, CircleCI, GitLab migration, public-repo workarounds, new Supabase accounts/projects, replacing Vercel, repeated CI reruns without runners, repeated local Auth/Storage starts with the same known failure, or provider-shopping. Do not assume any plugin/connector has browser or terminal access if it does not.

### Chat source-edit admission test (all conditions mandatory)

Chat may create a small source-level fix ONLY after all of these hold:
- A **concrete migration-blocking or already-approved** defect can be demonstrated in the checked-in source, not just inferred.
- The Work-owned feature/files and any possible unpushed modifications are identified as **not overlapping**. When uncertain, **do not write** that source area; do read-only preparatory review.
- The change is minimal, independently reviewable, in a **separate child branch** based on a refreshed, exact PR #50 SHA; no direct production `main` or concurrent PR #50 source commits, force pushes, resets, reverts, historical migration editing or security relaxations.
- The affected source can be meaningfully verified with the tools actually available. If Node/browser/DB tests cannot execute in Chat, do not claim they passed; deliver a review-only change with the missing verification explicit. Never merge unverified security/auth changes.
- A reviewed result can be adopted by Work **without overwriting newer work**. Before merging, refresh both SHAs, inspect diffs and complete actual required verification.

While Work is handling Google/TOTP, **Chat does not independently rewrite its sign-in, onboarding, account identity, MFA or server-side auth/RLS implementation**. Chat can prepare scoped review findings or independent deterministic checks there.

### Work continuation on return

Recover the last true Work checkout and **all uncommitted work first**. Inspect newer remote changes, including isolated Chat changes and this docs-only contract. Keep Work's ownership of the sensitive Google/OAuth/TOTP and real authenticated deployment/fixture/recovery work. Use Chat's verified read-only findings as input—not as acceptance substitutes. Integrate only reviewed and necessary non-conflicting improvements. Proceed to the next release task without restarting product development.

## 4. Task order to the finish line

1. **Protect existing work and identities.** Reconcile the live Work tree and latest approved PR #50 candidate, preserve all approved improvements and valid existing user IDs.
2. **Finish authorised Google-only + all-role AAL2 account migration** (Work-owned unless delegated after inspecting exact Work source). Explicitly cover existing unconfirmed/resolved invitation recovery and expired invitations; no duplicate accounts or protected AAL1 data access.
3. **Prove HR/Admin and every other approved role can really sign in and use its approved screens and critical actions**; verify mobile redirects, email delivery, private Storage, cross-role/cross-tenant denials, identity switching and factor recovery in authorised real/isolated browser environments. Compare approved screenshots literally.
4. **Complete protected data release readiness**: full encrypted production-data-and-supported-Auth/Storage-aware backup; prove an independent restore; use an exact ordered rehearsal for pending migrations on appropriately restored data; prepare rollback. No blind production migration.
5. **Integrate and deploy once the actual release criteria hold**: independent review of the final source SHA, owner's explicit production GO, normal merge onto canonical `main`, existing Vercel/Supabase cutover, signed-in production smoke tests and operational handover. Reconfirm every live state immediately before cutover.

Every independent task must make at least one of these deliverables measurably closer. Discard nonessential documentation, redesign, feature creep or open-ended investigations. Keep the finite A–H gates of `CEAC_OWNER_RELEASE_SCOPE_FREEZE_2026-10-12.md` as **safety acceptance constraints**, not as an excuse to substitute reports for the original migration outcome.

## 5. Verified checkpoints — read-only facts, NOT cutover authorisation

From 12 October 2026, before any newer Work commits:
- Unified release PR **#50** branch `chatgpt/unified-release-candidate-20261011`, documentation HEAD `28022d7f4a2b8f486c3bc34e7e4e727e80fc1d07`, draft and unmerged; frozen tested application/security SHA `51223157f28e16e90acda6a35dd71389513b6d6f`. Refresh both.
- Genuine Node 22 source suite **184/184**, build, isolated ordered SQL migration **143/143**, SQL/RLS gates **56/56**, Git resilience suite passed at recorded SHAs; **authenticated role/browser/Storage, real OAuth/TOTP and Auth/Storage recovery NOT passed**. Do not recycle source PASS as proof of these.
- Read-only production comparison: **119 applied Supabase migrations**, matching version/name exactly against the candidate's 143 SQL files; **24 timestamp-versioned migrations pending** (not approved for application yet), no missing or mismatched historical migrations. The descriptive label `123` appears in two distinct timestamp-versioned files: neither is a duplicate version.
- Production read-only Auth aggregation: **9 Auth users, 9 active matching profiles, 0 unmatched**, **9 email identity links, 0 Google links, 0 verified TOTP**, **8 confirmed users, 1 unconfirmed**, 4 invitations of which 3 resolved and 1 expired. The unconfirmed account corresponds to a **resolved** invitation, not the separate expired one. An existing confirmed Admin has past sign-in activity. **Do not identify, reset, delete, re-invite or remap a user from aggregate data**.
- Vercel connector can list an existing `ceac-os` project but project inspection returned 404 and deployment access 403. **Vercel linkage is unverified, not proved broken**. Do not repeat the identical failed API loop. Preserve the existing project.
- Existing local 4-vCPU Codespace Supabase Auth/Storage connection-timeout failure persisted with and without Realtime. Additional resizing/restarting without a new, targeted cause is explicitly unjustified.
- TinyFish credits are exhausted; it is excluded entirely.

Source of read-only production findings: the 12 October PR #50 discussion entries for account preflight (comment **6129949168**) and migration parity (comment **6129962791**). These are evidence; do not copy private record details to GitHub.

## 6. Minimum durable handoff format (keep it short)

After actual work: **exact branch + SHA; owner/session; task; files changed; reproducible PASS/FAIL/BLOCKED evidence; unchanged production state; remaining prerequisite; next non-conflicting task for Chat or Work.** Append to the existing live handover when materially new, and link the exact PR. No parallel narrative reports, no repeated analysis for its own sake.

**End condition:** the owner's **latest improved CEAC OS** is safely running from the new private GitHub account on the existing production stack; real HR and the other authorised users can access their approved functions, and the owner can resume ordinary product building.