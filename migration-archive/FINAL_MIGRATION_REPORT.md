# CEAC OS direct GitHub migration — verification record

Source: https://github.com/thestandardinst-star/ceac-os
Destination: https://github.com/ceairportcity/ceac-os
Original main SHA and destination main SHA:
827fbe7391467dd13d6e411527416402a252993c

Native Git migration:
- 146 original branch refs preserved and SHA-verified.
- 0 source tags and 0 Git notes.
- 3147 branch-reachable commits identical on both.
- 709 main files, including 118 SQL migrations, 283 documentation files and 4 workflow definitions.
- Full independent Git integrity verification passed.
- The original PR-ref-only 29 commits and 171 managed pull refs are preserved in the independently verified all-refs Git bundle on this audit branch.
- No Git submodule or Git LFS files detected.

GitHub-hosted history:
- 149 original PRs archived with available comments and reviews.
- All 22 original open PRs recreated as draft PRs with head/base relationships preserved; see restored_open_pr_mapping.json.
- 13 source labels restored and 10 PR label assignments restored.
- Original Preview and Production GitHub environment names restored.
- All 11291 original available Actions artifact entries inventoried, but artifact ZIP binaries not copied.
- No original issues, tags, releases or milestones found.

Application tests on independent destination clone at main SHA above:
- npm ci: PASS; Vite build: PASS.
- node --test tests/*.test.mjs: 20 PASS, 0 FAIL.
- npm audit high threshold: no reported vulnerabilities.
- GitHub Actions pinning, documentation and design-fidelity scripts: PASS.
- Live database tests, local SQL replay, browser acceptance and local account-security integration NOT executed (isolated test services/credentials absent).

Production:
- Original Vercel production deployment remains READY, still attached to the Standard Institute GitHub source and original main SHA. No Vercel source switch or Supabase mutation.
- GitHub Actions enabled on destination after transfer.

Outstanding restrictions:
- GitHub rejects private repository branch protection under current plan (HTTP 403, upgrade GitHub Pro required). The source branch-protection settings are archived but NOT enforced on destination.
- GitHub Project V2 records not inspected because authenticated token lacks read:project scope.
- Original Wiki feature was enabled but its Git wiki repository was not accessible. Private destination Wiki feature unavailable.
- GitHub secrets, deployment secrets and historic PR approval identities are not automatically transferable.
- Historic GitHub Actions artifacts are indexed but not rehosted.
- Additional destination automation/archive branches are not part of the 146 intended original refs; no original heads were overwritten.

Continuity:
- Do not merge audit branch into main.
- First review Phase 5 Admin product redesign, original PR 145 / new draft PR 19, against main.
- Phase 6 Volunteer planning and attendance is original PR 140 / new draft PR 15, stacked on Phase 5.
- Later stacked drafts retain the Executive redesign, resilience/PWA and go-live decision work.
- Security hardening drafts remain separate. No drafts were merged by the migration.
