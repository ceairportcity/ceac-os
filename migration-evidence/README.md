# CEAC OS — original GitHub source archive (2026-10-10)

This archival branch is **not** the application development branch. Its single new commit stores migration evidence and GitHub metadata independently of the 146 original source development branches. Original Git commit and tree SHA identities remain untouched on the migrated development branches.

- Original repository: https://github.com/thestandardinst-star/ceac-os
- Destination: https://github.com/ceairportcity/ceac-os (private, not a fork)
- Source and destination main at migration: 827fbe7391467dd13d6e411527416402a252993c
- Preserved original source branch refs: 146; tags: 0; Git notes: 0
- Identical commit count reachable from branches: 3147
- Original GitHub-managed pull refs: 171, **not pushed** into GitHub-managed pull refs on the destination
- Extra commits reachable only through original GitHub-managed refs: 29
- original-source-allrefs.bundle: historical Git objects and refs for all 146 source branches plus 171 original GitHub-managed pull-request refs. Use git bundle verify and git bundle list-heads to inspect. This is a lossless Git archive, not an active set of destination pull-request refs.
- github-metadata/: API JSON snapshots covering 149 historical pull requests, including review/comment/commit metadata, plus available repository metadata, protections, workflow runs, environment names, labels, and more.
- Historical pull-request numbers, reviews, check results, execution logs, and GitHub approvals remain authoritative in the original repository; JSON captures do not convert these into live destination records.
- No secrets or environment-variable values were intentionally retrieved. Treat archived comments as potentially sensitive. Keep this branch **private**.
- GitHub Actions were temporarily disabled during migration to avoid accidental CI runs. Reactivate only after verification and guardrails.
- No production deployment or live Supabase database was modified during source cloning and Git transfer.
- SQL security integration tests requiring a local Supabase/PostgreSQL service are not evidence of a successful database test unless actually executed.
- Local source filesystem cloned from the destination built successfully and passed 20 Node unit tests; see verification report.
- This branch is for audit and recovery only. **Do not merge into main.**
