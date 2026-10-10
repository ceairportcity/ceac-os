# CEAC OS: source GitHub and Git-history migration evidence

Source: https://github.com/thestandardinst-star/ceac-os
Destination: https://github.com/ceairportcity/ceac-os
Captured: 2026-10-10 UTC (git transfer initiated 2026-10-09 UTC).

This is an audit-only branch; do not merge into application main.

The application and every original development branch were transferred using native Git operations.
All 146 source branch head SHAs were verified against destination.
The source has 0 tags and 0 notes.
3147 commits are reachable from source branch tips and the same 3147 commits are reachable from destination branch tips.
GitHub exposed 171 GitHub-managed pull refs. Those refs are NOT pushed into the destination's GitHub-managed namespace.
The separately stored original-all-git-refs.bundle contains the complete original Git object graph reachable from all advertised refs, including pull refs.
source_all_ref_inventory.txt records original heads and GitHub-managed refs.
The original full mirror counted 3176 commits reachable from all refs, including 29 GitHub-PR-ref-only commits.
source_bundle_verify.log records verification of the bundle and source_bundle_sha256.txt its checksum.

GitHub-hosted metadata not natively portable has been captured as JSON:
- 149 historic PRs, including 22 open at capture time
- PR reviews and conversation/inline comments, original URL and source head/base relationships
- labels, milestones, issues, releases, repository and branch protection, environments, actions workflows and recent workflow-run metadata
- names only for accessible Actions secrets/variables (secret values were NOT captured)
- limited webhook metadata without URLs or credentials.

Historical GitHub PR numbers, reviews, check statuses, and Action run IDs cannot be reassigned to this new repository. Consult archived source URLs and JSON.

No production deploy, live database migration, or secrets change was performed during Git transfer.
This archive may contain developer discussions; retain branch private.
