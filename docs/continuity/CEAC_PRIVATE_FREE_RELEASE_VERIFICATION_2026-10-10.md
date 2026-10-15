# CEAC OS — free, private, fail-closed independent release gate

**Status:** independently executable procedure implemented in a separate candidate branch; **NOT YET EXECUTED OR ACCEPTED**. This file does not supersede the 10 October owner lock, Level B/Level C protocol, SQL/RLS rules or mandatory second reviewer. The private GitHub repository stays canonical. **No GitHub Pro, public visibility, CircleCI, GitLab, new Vercel production project or production database writes.**

## Why this exists

The four Actions workflows on private destination PR #28 failed before the first step. A controlled CI re-run also failed before steps. The cause cannot be attributed to product code, a runner, an exhausted quota or a billing setting without additional evidence. In contrast, an earlier integrated PR #26 actually executed SQL/browser checks and reported defects subsequently repaired in the source of draft PR #27; those repairs need their **own exact-head executed checks**.

The independent runner `scripts/ci/run-independent-release-gate.sh` uses a real isolated machine, **a separately authorized private Git clone**, Docker, Git, Node 22.12+, npm, PostgreSQL client, Supabase CLI **2.117.0**, local Supabase containers, and Playwright Chromium. No provider production credentials should be present. The script refuses known production environment variables and verifies the current PR HEAD and original main SHA before creating a detached, isolated Git worktree at the exact PR commit.

## How to run (only on a disposable, trusted machine)

1. Verify free/unbilled runner capacity and that the host can run Docker, Postgres client, the pinned Supabase CLI, Node and Chromium. Do **not** start a paid runner or permit overage charges. If the selected Vercel Sandbox is unavailable under included usage, use an already-authorized disposable local environment rather than purchasing resources.
2. Authenticate the private clone **using the operator's existing Git credential mechanism** and grant read access to `ceairportcity/ceac-os`. Do **not** paste a token into commands/chat, put secrets in source files, or embed tokens in a clone URL.
3. Ensure the repository's remote `origin` is the canonical private repository and the runner script is obtained from the reviewed independent verification branch. Review the script and keep the checkout and logs private.
4. Before running, fetch the live PR and `main` SHAs independently from GitHub. Example at initial preparation (must replace with current live values):

```bash
bash scripts/ci/run-independent-release-gate.sh /path/to/ceac-private-clone 27 \
  386e59086fa79e1d27b28c42677d2252877cf0e0 \
  827fbe7391467dd13d6e411527416402a252993c
```

5. Retain the `/tmp/ceac-gate-evidence.*` directory securely with access limited to reviewers. It contains test logs and possibly private test data. **Never upload its raw contents to a public artifact store.** Redact and approve any evidence before adding a minimal SHA/checksum/pass-fail manifest to the private repository.

## What the script actually verifies

- Immutable PR and `main` SHA match against the canonical remote; non-force detached worktree; changed-line hygiene.
- Existing workflow action-SHA security policy, visual-source contract, documentation integrity.
- `npm ci`, four current Node unit-test files, `npm audit --audit-level=high` and the actual production build.
- Exact CLI version and **local** clean Supabase migration replay including the repository's documented legacy baseline artifact.
- Existing complete cumulative SQL/RLS/security/HR/Payroll gates, **separate** account-invitation security test on its own clean database, and all **four** Playwright shards each on a clean, re-seeded local database.
- Per-step private logs, PASS/FAIL/NOT_VERIFIED files, expected commits and SHA256 checksums.

If the environment or a mandatory step fails, that step cannot count as PASS. A script syntax check or a Vercel build is never equivalent to the executed full acceptance matrix.

## Outstanding checks the script does NOT prove

- Owner-approved **Level C literal visual comparison** using true rendered desktop/mobile screenshots and the committed mockups. A source-marker assertion does not prove design fidelity.
- Real production user invitation delivery, activation, access boundaries, MFA/AAL2 enrolment, manager/admin/executive flows, payroll separation, access revocation or actual mobile UX.
- Supabase project backup and **tested restore**, dry-run/rollback plans for the **10 unapplied migrations**, or production data safety post-cutover.
- Official GitHub App authorization to the existing Vercel project, exact candidate preview with safe environment, live cutover or rollback.
- External second review and informed owner acceptance of **manual merge risk**, including the absence of enforceable private-repository branch protection.

These are mandatory separate acceptance records. Passing this runner must **never** auto-merge, deploy, publish a repository, approve payroll, mutate production or hand over CEAC.

## Fail-closed private GitHub Free merge procedure

1. Re-fetch `main`, all PR bases/heads and the intended exact merge ancestry. Independently check the original security PR #22 migration filenames/versions and preserve the product stack #19 → #15 → #21 → #23 → #24 → #25. Do not blindly merge overlapping security PRs.
2. Demand full exact-head Level B evidence on the **final combined release SHA**. Verify each gate, visual Level C acceptance, high/critical security findings, migrated filenames, SQL history, test counts and **zero unresolved mandatory gates**. Earlier green checks for different SHAs do not transfer.
3. Obtain an **independent second reviewer**, record their identity, evidence audit and review decision, and obtain the owner's written acceptance of uncompensated private-main branch-protection risk.
4. Immediately before each merge, compare live PR head, base SHA, and intended tested SHA again. If any changed, **STOP; rerun**. Use a normal GitHub PR merge with expected head only; never force-push, rewrite, set merge bypass or delete the history archive.
5. Reverify merged `main`, replay and security tests on the exact merged commit. Deploy **only** after separate production authorization, migration backup/rehearsal and candidate preview.
6. Record the final private visibility, restricted Technical Support membership/authority, tested restore, remaining limitations, deployed SHA and signed owner handover. Pending work stays pending.

## GitHub Actions account restriction

The linked GitHub integration cannot inspect account-owner Billing & licensing usage or spending-control details. The owner can check **Settings → Billing & licensing → Usage (Actions)** and **Budgets and alerts**. Capture only the relevant amounts/statuses, never financial or security credentials. A `0`-step run by itself does **not** prove the allowance was exhausted. Do not repeatedly rerun known blocked jobs or silently increase any spending limit.

## Completion record

- Canonical repo: `ceairportcity/ceac-os` (private when prepared).
- Initial `main`: `827fbe7391467dd13d6e411527416402a252993c`.
- Original combined release candidate: draft PR #27 at `386e59086fa79e1d27b28c42677d2252877cf0e0`.
- This document/script: independent staging branch, not an accepted PR #27 code update.
- **Independent full gate:** NOT VERIFIED until executable evidence exists.
- **Production acceptance / final private handover:** NOT APPROVED.
