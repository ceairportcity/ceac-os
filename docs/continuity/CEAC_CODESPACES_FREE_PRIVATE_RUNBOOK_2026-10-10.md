# CEAC OS — private GitHub Codespaces release verification

**Status: environment configured, not yet proven provisioned or fully executed.** This is an implementation companion to the independent release gate and the binding 10 October private handover lock. It is not merge or production authorization.

## No payment / no public repo

GitHub Codespaces is available to personal GitHub Free accounts with an included monthly free allocation of **120 core-hours and 15 GB-months**. A standard **2-core** Codespace consumes two core-hours for every runtime hour; creating a Codespace with remaining free quota does not require adding a credit card. If GitHub displays a payment request, a warning about unavailable free capacity, or a paid machine option, **STOP. Do not supply payment details, enable paid overages, switch repository visibility or upgrade**.

The Codespace belongs to the **personal account `ceairportcity`** and is created directly on the **PRIVATE** `ceairportcity/ceac-os` repository. Repository history and archive must not be published.

Official documentation: <https://docs.github.com/en/codespaces/developing-in-a-codespace/creating-a-codespace-for-a-repository> and <https://docs.github.com/en/billing/concepts/product-billing/github-codespaces>.

## Exact setup

1. Sign in to GitHub as **ceairportcity** and open `https://github.com/ceairportcity/ceac-os`.
2. Select branch **`chatgpt/private-independent-release-gate-2026-10-10`** (draft PR #29), then **Code → Codespaces → Create codespace on this branch**. Select the **2-core** machine and ensure the payer is your personal included Codespaces quota. Do not select a billable upgrade.
3. GitHub loads `.devcontainer/devcontainer.json` from that branch, installs Node 22 + Docker-in-Docker, and runs `.devcontainer/setup-ceac-test-tooling.sh`, installing PostgreSQL client and checksum-verified Supabase CLI v2.117.0.
4. In its Codespaces terminal, verify **`node --version` is 22.x**, `docker info` succeeds, `supabase --version` is **2.117.0**, and `psql --version` works. If any fails, classify as **NOT VERIFIED**, do not skip or downgrade the gate.
5. Run the exact private acceptance command from the repo root (sample current heads, must check latest PR and main before execution):

```bash
bash scripts/ci/run-independent-release-gate.sh "$PWD" 27 \
  386e59086fa79e1d27b28c42677d2252877cf0e0 \
  827fbe7391467dd13d6e411527416402a252993c
```

**Do not change the source SHA just to make the script run.** It checks the remote `refs/pull/27/head` and `refs/heads/main`, then creates an immutable detached worktree. If either SHA advanced, inspect the newer commits and substitute only the independently verified current SHAs before rerunning. If the source is not the exact private canonical repo, it fails closed.

The runner executes changed-line hygiene, current action pinning and visual-source contracts, documentation, `npm ci`, Node unit tests, high-severity dependency audit, actual application build, local migration replay, full SQL/RLS/security/payroll gates, a separate Account Security flow, and four full Playwright shards. **All Supabase databases are local and disposable.** It must never inherit production database URLs or protected access tokens.

It writes private per-gate `*.status` and logs, browser artifacts, `manifest.txt`, and `SHA256SUMS.txt` to `/tmp/ceac-gate-evidence.*`. The logs can contain test data. Do not publish them; after redaction, a second reviewer can record only evidence identifiers, tested SHA, PASS/FAIL/NOT_VERIFIED and signatures in the private PR.

On an incomplete run, the script fails and preserves diagnostic evidence. **A failed test is a defect or test-environment issue requiring investigation, not permission to weaken assertions.** The existing acceptance protocol continues to require owner-approved visual Level C acceptance, actual privileged MFA/AAL2 flows, Vercel source-linked preview, reviewed database backup and restore, and second-reviewer manual merge controls.

**When finished**, use GitHub **Codespaces → Stop codespace**, and delete it once its evidence and any accepted changes have been safely preserved in the private repository. Stopping reduces compute usage; stored Codespaces still consume storage quota.

## Why the repo's GitHub Actions remain optional, not waived

This Codespace is an independent runner because current GitHub Actions jobs have failed before any test steps. The Codespace's **executed exact-head Level B result** may be manually accepted as independent evidence by the owner and security reviewer **only if every required gate passes**. It does not confer native enforced branch protection on a Free private repository, does not substitute a second reviewer, and does not authorize production deployment.

If GitHub Codespaces creation itself is restricted on this account, record the exact screen/error; do not cycle through paid or public-repo workarounds. The draft PR and existing `main` remain intact.
