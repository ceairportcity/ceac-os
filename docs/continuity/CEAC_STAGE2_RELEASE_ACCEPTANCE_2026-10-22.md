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


## 22 October, 15:28 UTC — exact saved preview and real Auth/Storage continuation

Continued sole PR #124 with head and base independently rechecked: candidate `abfa18da37c182e5f2900f3435b24302d980659c`, production/main `34f3c69818679f36c9a91161a40c31ec76ece468`. No application source, schema, role/capability, Auth-provider, production setting or deployment was changed in this continuation. No new branch, browser-runtime retry, paid compute, invitation email or repeated HR creation/schedule SQL suite.

### Preserved previous-session evidence (read, not rerun)

- `/workspace/scratch/38cbdd825b13/final-source.log/.exit`: actual complete native source run **601/601, exit 0**, replacing the older split-run limitation above. Exact source attribution remains the prior repair session; do not falsely call it a newly run required GitHub check.
- `frozen-5767da72-build.log/.exit`: production bundle PASS, exit 0.
- `frozen-5767da72-audit.log/.exit`: zero vulnerabilities, exit 0.
- `print-source-affected.log/.exit`: 32/32, exit 0. This is source evidence, not rendered PDF acceptance.
- Six previously completed staging SQL gates in the owner continuation remain valid historical stage evidence: roster creation/leave policy, SECURITY DEFINER surface, roster-only employment, roster required hours, roster identity linking and annual leave policy. They were not repeated.

### Existing Vercel preview confirmed

Existing deployment `dpl_9B4ipbDVSmHbvwpQoy8xeLixHEJw`, existing CEAC Hobby project `prj_bAv4ggX6umjp54UjjLqqGm7bBcIB`: dashboard shows **Ready**, Preview, exact source `abfa18da37c182e5f2900f3435b24302d980659c`, Node22.x, Standard Deployment Protection retained. Build log visibly records Vite built in2.20s, Build Completed, Deployment completed at15:12:06UTC. No replacement deployment was created.

Preview opened through the existing authenticated Vercel cloud-browser session at https://ceac-5it958fbg-thestandardinst-6345s-projects.vercel.app/ and displayed the actual CEAC email/password screen; its recovery button displayed the recovery form. Neither is proof of successful browser authentication, sent recovery email, activation or completed recovery.

The environment dashboard confirms all four new public client-config names are scoped ONLY to Preview branch `chatgpt/stage2-owner-contract-repair-20261019`, with separate pre-existing Production entries. Revealing the values demanded Vercel recovery-code verification; that prompt was dismissed. Therefore the values were **not independently revealed/reconfirmed**, and no security verification was bypassed. Independent unauthenticated HTTP asset inspection redirected to Vercel Login; deployment protection was preserved, not disabled or bypassed. Do not claim bundle-level staging-target proof from that HTTP attempt.

### New actual synthetic Auth/REST/private-byte evidence

Command: `python staging-api-acceptance.py` from private scratch `/workspace/scratch/48aa0a3fc141`; standard Python urllib requests only, publishable staging key + existing private synthetic password, no service-role bypass. Hard assertion restricts destination to `https://ugaifpxjgkclmcdvyppx.supabase.co`. Logs never print passwords, session tokens or signed URLs.

- All seven existing synthetic identities actually authenticated with email/password and retrieved their own profile over REST: admin, staff, manager, exec, other, sameunit, managerb. This verifies genuine staging password Auth and profile access, **not** invitations, real production accounts, browser rendering or recovery.
- HR read the canonical eight-entry roster. Staging remains195 migration receipts through20261022121427; existing184–187 receipts were preserved.
- HR registered a synthetic `employee_document` on the existing roster-only fixture `41000000-0000-4000-8000-000000000178`; actually uploaded100 bytes to private Storage; finalised it; retrieved identical bytes both with authorised authenticated download and an HR-issued signed link. FileID `2da79cdf-e032-403e-bf4a-979d920325fb`, SHA256 `7bd4f49f9aad921c80db894f2843841187824d6999ffa5cc019809a4e7f7fc65`. Installed metadata independently confirms active state and100 bytes. No real HR material was uploaded.
- Staff, Manager, unrelated-unit other, same-unit colleague and ManagerB each proved denied file metadata, authenticated download and signed-link issuance. Five role-negative triples PASS.
- The combined runner then **failed, exit1**, because its final assertion incorrectly expected plain Executive status to download this Admin-only operational employee-document context. Do not relabel that combined run PASS. The reviewed `admin_hr_security_gate.sql` explicitly denies implicit Executive HR-private authority; operational employee documents and the separately capability-gated protected-HR domain must not be conflated. No permissions were widened to satisfy the assertion.
- Corrected **only the affected Executive metadata expectation** in a separate private invocation: `staging-exec-document-boundary-corrected.log/.exit`, PASS exit0. Prior Executive byte-download HTTP400 is retained as denial evidence; Executive signed-link denial and separately capability-authorised protected-HR positive access are not certified by this correction.

Raw private evidence: `staging-api-acceptance.log` (initial password/profile reads), `staging-storage-api-acceptance.log/.exit` (actual byte proof and five negative roles, overall failure retained), `staging-exec-document-boundary.log` (failed local module-import invocation, no application test), and `staging-exec-document-boundary-corrected.log/.exit`. The synthetic active file remains available for browser identity-link acceptance; no account or employee identity was changed or linked, and no permission was granted.

### Verified execution blockers — no looping or invented green

1. The cloud browser's supported `browserAuth` interface requires secure user credential entry and forbids sign-in values through model-visible Playwright/UI calls. It cannot import the existing private runtime fixture password. No secret was printed or requested in chat, no session injected, and no alternate lower-level sign-in attempted. Authenticated Work/Projects/role visual comparison, HR UI identity-link journey and actual combined-build personal/Executive PDF acceptance remain **PENDING**. The host socket restriction was not retried or bypassed.
2. All four required exact-head GitHub Actions are terminal **failure**: Account Security39802516416, Quality Gate39802516426, Migration Replay39802516398, CI39802516309. CI build job119906804018 has **zero steps**. The actual run page https://github.com/ceairportcity/ceac-os/actions/runs/39802516309 explicitly says the job was not started because recent account payments failed or the spending limit needs increasing. Repository metadata currently reports PRIVATE. No payment, spending-limit, repository-visibility or protection change was made; no pointless rerun. Vercel success and local tests do not substitute these checks.
3. Full final migration/security/role/Edge/password activation/recovery qualification, literal approved visual comparison, positive real existing-account link with stable employee/Auth IDs and unchanged grants, fresh recoverable production backup/restore rehearsal, ordered historical Google-hook reconciliation and production deployment/live acceptance are still outstanding. Staging has an ACTIVE integration-runtime Edge function; listing it is not Edge negative-authorisation acceptance.

**NO-GO remains.** Preserve this evidence and the existing Ready preview; do not restart development or repeat completed HR tests. The next executable browser step requires a supported secure staging test-account sign-in; required Actions also need an authorised no-spend execution path. Do not change production while these acceptance prerequisites are unresolved.


## 22 October — public-runner access restored; frozen final qualification

Owner completed temporary PUBLIC visibility; GitHub metadata independently confirms public. PR124 head20b5a6a and production/main34f3c698 unchanged at inspection. One retry per previously blocked workflow now actually executes on GitHub-hosted Ubuntu. CI39805593125 job119939448294 ran checkout/supply-chain/visual contract/documentation checks successfully, then failed git diff --check solely on an extra blank line at EOF in staged migrations175 and176. Account Security39805593412, Migration Replay39805593280 and Quality Gate39805593166 returned success in DOCUMENTATION scope; their source/SQL/browser jobs were skipped, so these are NOT frozen application acceptance. Raw failed CI remains retained in Actions.

Removed precisely one final blank line from each175/176 SQL file; no SQL token, function body, policy, ACL, receipt or production database changed. Existing153 historical migrations untouched. Native git diff --check reproduced the failure before correction and passes afterwards. No already accepted HR functional/SQL suite repeated for this formatting fix.

Public read-only Git transport now also succeeds: genuine single-branch checkout at /workspace/scratch/48aa0a3fc141/ceac-checkout, exact verified head20b5a6a with real ancestry. This is separate from the older reconstruction; never relabel that reconstruction as a checkout. No new remote branch, forced push, production deployment or paid compute.

The integrated source is frozen for the existing mandatory [level-b] final qualification on this formatting-and-evidence commit. Let its exact-head source/build/audit, clean migration replay, SQL/security and four browser shards reach terminal; inspect and correct concrete failures with affected checks. This is the required final milestone qualification, not a new development programme or repeated per-edit loop. Hosted staging/browser/PDF/activation/recovery and production backup/restore/cutover/live gates remain open unless their actual evidence closes them.
