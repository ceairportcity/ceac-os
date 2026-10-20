# Stage 2 — reuse existing Codespace test evidence for GitHub release gates

Decision recorded 2026-10-20. Owner requests **reuse, not redundant reruns**, of genuine Work/Codespace tests. This is an execution handoff for PR #124, **not** approval to merge, alter production, change billing, or weaken branch protections. Continue in the existing Codespace and active PR without resetting its work. Never fabricate green checks.

## Confirmed technical constraints

- Hosted Actions for CI, Migration Replay, Account Security and Quality Gate have been unable to start jobs under the reported billing/spending restriction. An Actions failure with zero executed steps is **not evidence of code failure**, nor evidence of success.
- Existing workflows live at `.github/workflows/{ci,migration-replay,account-security,quality-gate}.yml`; required checks may be individual **job names**, not the four workflow titles. Discover exact contexts and their expected sources from **main** branch protection / rulesets and PR check details rather than guessing.
- GitHub's Commit Status API can report externally obtained evidence against a specific SHA using a distinct context. Token needs **Commit statuses: write**. Check Runs API is separate and generally needs a GitHub App with Checks write. Do not put credentials into repository files or logs.
- Per GitHub required-check documentation, **if a Check Run and commit status share a name, both must pass** when that name is required. A check configured to require the GitHub Actions app **cannot be replaced** by a user/token-created external status. Do not spoof original Actions contexts or declare green until GitHub independently reports the gate satisfied.
- GitHub generally requires required-check success on the relevant current SHA and within seven days; assess whether branch rules require head SHA or merge commit. Older passing records are evidence of tested functionality, **not a passing certificate for subsequent untested code**.

## Execute in the active Work session (no duplicate build)

1. Inventory all existing Work/Codespace evidence: test command/suite, time, tested full SHA, actual exit code, counts, environment, log/artifact location, affected security/SQL/role/browser/visual areas. Match to **exact required job contexts** and document skipped or missing coverage. Do **not** claim an earlier SHA's results apply automatically to later modifications.
2. Check GitHub branch protection and rulesets for `main`: exact required job-context names, expected source Apps, merge queue, strict/up-to-date settings, and stale-failing Actions check runs. Read only; no protection edits until equivalence and owner approval are established.
3. Prefer signed/verifiable **separate external status contexts**, e.g. `ceac/codespace-ci`, `ceac/codespace-migrations`, `ceac/codespace-account-security`, `ceac/codespace-quality`, published **only** for tested SHAs with real log URLs/artifacts, clear pass/fail/pending result and no sensitive information. Don't publish a success for missing, stale, failed or partial evidence.
4. Verify whether the four original required Actions check names are source-bound or collide with external statuses. If so, **do not assume posting statuses unblocks merge**. Propose a one-for-one, equal-or-stronger, documented **required-context substitution** (old four Actions gates replaced by verified four distinct external contexts), including immutable evidence, exact SHA and independent review. Require explicit owner approval before modifying branch protection or rulesets; no general disabling of required checks or bypass flags.
5. If status-posting credentials or branch-protection reads are unavailable, document the exact missing permission and the smallest actionable permission request. Avoid new CI vendors, paid services and self-hosted runner registration unless needed.
6. Maintain Work's existing Stage 2 P0–P9, owner-approved desktop/mobile Work and collaborative Projects mockup acceptance, Admin/HR Control Center corrections, recurrence, private assessment/Executive drilldown, Technical Support/IT, RLS and migration scope. Passing external checks never replaces full final-role/visual/security approval, backup, safe migration and production smoke tests.
7. Only test **actual gaps or changed-impact areas**, plus genuinely necessary integration verification for the final release SHA. Preserve already valid execution evidence. Keep PR draft, production unchanged until all release criteria and authorization are satisfied.

## Audit trail and official documentation

- [GitHub external commit statuses](https://docs.github.com/en/rest/commits/statuses)
- [Troubleshooting required status checks — collision, SHA and source constraints](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
- [Protected branches — expected source enforcement](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

**Handoff acceptance:** Work can show: test evidence → tested full SHA → matching required gate → externally published result → GitHub's actual protection verdict. Until then, external-test-to-merge compatibility is **unverified**.
