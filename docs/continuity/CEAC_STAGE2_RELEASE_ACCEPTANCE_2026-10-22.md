# CEAC Stage 2 release acceptance — 22 October 2026

Continue sole PR #124 and existing branch. Production remains unchanged. Existing invitation-controlled email/password and accounts, passwords, data and permissions are preserved; Google OAuth and mandatory MFA remain deferred.

## Free runtime recovery and concrete defects

The canonical remote candidate inspected is 6c45c0422dce6b0739f9cc557c15c81bfe260e09 (tree 413ade4f12b4aecb286a49f5b870b6b9c178c227). The earlier Codespace local 408f44a8 and its uncommitted files could not be retrieved through GitHub. Its known fixes were reconciled individually against the newer remote source; its alternative HR migrations and creation API were NOT substituted for the newer 184–187 implementation.

Restored missing JSX braces in ComplianceOverview and EmployeeScheduleEditor. Real Node22 production build first failed, then passed after those two corrections (488ms). Fixed latest-issued reporting target/evidence deduplication so a duplicate reduced join row cannot discard the first canonical row's next-target facts. Updated three stale source assertions for verified day types, cluster cycling and employee-focused Workforce reads. Added the ten actual 178–187 filenames to the exact migration inventory (153 historical +39 staged=192); no migration body or permission was changed.

Recovered the Vite8.3.3 exact pin and lockfile after the older lock produced a real high dependency audit. Restored the demonstrated print-specific visibility specificity fix for Executive/personal PDFs, printable collapsed milestone inclusion with screen-state restoration and page fragmentation. Added the actual backend annual_leave_policy_not_active explanation to Me. The print/runtime changes still require renewed acceptance on this combined source.

## Actual evidence and limits

Private evidence root: /workspace/scratch/38cbdd825b13/. Node22.16.0; pinned Playwright1.55.0; application source blobs verified against the Git tree before edits. Reconstruction is NOT a git checkout or a valid ancestry-bound backup artifact.

- npm-ci.log/exit: locked installation passed.
- acceptance-build.log/exit: actual missing-brace failure retained.
- acceptance-build-repaired.log/exit: actual production build passed after braces, before subsequent print/Me/dependency repairs.
- acceptance-source.log/exit: first incomplete recovery run retained, not accepted (569/585).
- acceptance-source-repaired.log/exit: 600/601 passed; sole failure was absent vercel.json in reconstruction. The restored unchanged file's existing seven-test group then passed in acceptance-restored-vercel.log/exit. This is split coverage, NOT a fabricated single601/601 run.
- acceptance-audit.json: real older Vite high finding retained; repaired audit pending.
- staging-browser-acceptance.log/exit: browser launches failed before application interaction because chromium_headless_shell1187 was absent; no HR workflow pass.
- staging remains approved ugaifpxjgkclmcdvyppx. Seven labelled synthetic Auth/profile accounts and eight synthetic roster records were provisioned solely there for actual password/Auth/Storage/browser acceptance. Bootstrap used transaction-local replica mode only to initialise synthetic identities and grants, restored to origin before commit. No real employee copied, invitation sent, production data or database policy changed. This bootstrap is NOT invitation-delivery or account-activation proof.
- Latest four required GitHub Actions at6c45c042 remain failures. Inspected CI build job119835489795 has zero executed steps and runner_id0. Local evidence does NOT replace required exact-head checks.

## Continue to release

Finish browser runtime repair and acceptance of connected role/HR/private-storage/account-link and print journeys; preserve passed unaffected historical evidence. Freeze integrated candidate and execute complete mandated final acceptance once; fix observed defects with affected checks. Fresh recoverable production backup and restore rehearsal, ordered historical Google-only reconciliation, genuine existing-user password access and existing-project Vercel deployment/rollback/live checks remain mandatory. No release-ready, merged or live claim yet.
