# Compliance department placement correction — 25 October 2026

Owner instruction: Compliance is an existing department, separate from Administration/HR. Its departmental operating workspace belongs on the Compliance head's normal panel. Remove Compliance navigation and related tool placement from Administration. Do not create another department, duplicate records or grant unrelated HR authority.

Base: main `1b0321b1ef26513c944a5e018093e13c42fed5d2` (PR #141 merged).

Implemented: remove Compliance from Administration tools and Control Center development wording; expose one Compliance workspace entry on non-Administration/non-Executive panels with an existing organisation-wide `compliance.manage` grant. Desktop and mobile More share the same navigation source. Personal staff policy/evidence access and existing server authority remain unchanged. No migration, record movement or permission mutation.

Verification, 25 October 2026 around 00:30 UTC: Node 22.12.0 `npm ci` PASS; `npm run verify:source` 623/623 PASS; `npm run build` PASS; focused navigation 4/4 PASS; `git diff --check` PASS. Local log: `/tmp/ceac-compliance-verification.log`. Coverage is source/build only, not authenticated deployed acceptance. Browser expectation updates cover Administration sidebar, mobile More and Control Center.

Remaining: verify intended operator has current explicit organisation-wide Compliance authority; assignment must follow the existing authorised access workflow, not a title-based bypass. Run authenticated departmental/Admin desktop/phone checks and required release gates before merge/deployment. Production unchanged.

Owner's subsequent request: propose an improved Compliance page layout for review before applying a redesign. Navigation repair and design proposal are separate scopes. Existing Overview, Attendance cases, Policies, Requirements, Evidence and Exceptions remain the functional basis. Proposal uses illustrative content, not live employee data.

Execution recovery: direct public HTTPS clone/read works. Git push from shell has no credential; use the connected CEAC GitHub account and Git tree/commit/ref tools for reviewable publication. Earlier connector failure resulted from omitting the required account link; explicit CEAC link restores access. Do not request a different chat mode or expose credentials.
