# Live leave-pool correction — 23 October 2026

## Owner clarification and scope

The owner corrected the previous interpretation: the total yearly 24 days comprise **15 annual days plus ONE shared nine-day allowance**, and confirmed that the shared allowance is earned gradually. Keep the existing completed-quarter/joiner method: 3.75 annual + 2.25 shared per full completed quarter. Shared sick/study requests use one allowance, not nine days per request type. Other category membership was not individually specified: maternity/paternity and protected entitlements are deliberately not capped by this clarification.

Existing production was independently inspected: active annual-only policy is 24/6, secondary quantities are unset, legacy settings are not calculation authority. Three leave requests exist (one pending annual, one pending study, one declined annual); no approved request has been changed or fabricated.

## Candidate

Base main `4d45762bbddfe292f458f55713a5983b447b9265`; branch `chatgpt/live-leave-shared-pool-20261023`. One forward migration created with Supabase CLI: `20261023183628_leave_annual_shared_pools.sql`.

- Reuses the existing public summary RPC, with the same guarded subject/tenant checks and a private, non-browser-callable pool calculator. No public interface or permission is added.
- Returns separate annual/shared balances; only final approved scheduled working days count, pending/Manager-only requests do not deduct, and reversal restores the allowance. Missing policy/date/schedule evidence stays unavailable, not zero or a fabricated balance.
- Shared first-quarter rounding receives the remainder so the two credits preserve the original combined pro-rated total exactly.
- Existing authorised policy writer enforces annual 15/3.75 plus one shared_other 9/2.25 rule. The separate sick/study numeric rules cannot create duplicate allowances. Maternity/paternity policies retain their own contract.
- Administration Time & Leave offers explicit activation of the confirmed split through the genuine signed-in HR workflow, with source/reason, superseded version, confirming actor and history. DDL does not activate policy or impersonate HR.
- My Hub and Time & Leave distinguish the two balances; old hardcoded 24-day fallback removed; guide and settings wording aligned.

## Executed evidence

- Final local source suite: 608/608 PASS, exit 0; production build PASS, exit 0, Node 24.19.0 (repository release CI uses Node 22). Logs: `/tmp/ceac-leave-source-final.log` and `/tmp/ceac-leave-build-final.log`. Exact-head remote CI remains pending until candidate publication.
- Real isolated hosted staging project `ugaifpxjgkclmcdvyppx`, known synthetic fixture organisation/accounts only: migration plus updated rollback-only annual/pooled allowance SQL gate executed in ONE transaction, then rolled back. PASS. No staging schema or policy persisted.
- Actual SQL checks: annual 15/3.75 and shared 9/2.25; three quarters = 11.25 annual + 6.75 shared; three sick + two study days deduct five shared and zero annual days; pending and Manager-only approvals do not deduct; HR reversal restores two shared days; mid-quarter joiner credits 1.88 annual + 1.12 shared = 3.00 combined; Staff direct internal-helper execution and unauthorized subject read denied. Existing annual request/Manager/HR/adjustment/reversal and permission checks remain in the same passing gate.
- Source/build, migration replay, all required exact-head SQL/role/browser checks, production migration, deployment and genuine signed-in HR activation/readback remain required. Do not call this live or completed until those are recorded.

## Confirmed preceding task and continuation

A6 finance is COMPLETE, independently rechecked: three spend records (GHS45,950), three budgets (GHS273,450), two requests are archived; zero unarchived confirmed demo finance records. Current A6 assessment contains the actual signed-in release/archival evidence and preserved source fingerprints. Do not redo the archive.

After leave correction, continue the broader operational demo cleanup, including owner-confirmed test task Speakers servicing. Then A7 duplicate reporting periods, A8 schedule/department/Payroll data readiness, A9 capability-aware module navigation, A10 verified recovery evidence. These are audit items requiring current-state checks, not all confirmed code defects. Seven remaining identity cases stay deferred by owner instruction. Do not infer that all broader app corrections are closed.

## Tool continuity

GitHub public clone/fetch works; shell git push lacks credentials. Use connected CEAC GitHub tree/commit/ref operations for a single atomic reviewed candidate. Do not expose credentials or use another account. BrowserAct CLI installed, but its core command daemon failed readiness; no browser session/HR activation was obtained or claimed here. Native cloud browser may be needed for the genuine app UI after candidate release. No paid service or production impersonation authorised.

## First frozen candidate release evidence and test correction

PR #134, application/test head `8a33ba5ab3308f11afb3d9c6a7a43c327ce0ea74`, exact tree `7e9c716b78e6f915d8f6daf4e8ca792a06e4f597`. Official Node 22 CI `40008089750`, Migration Replay `40008089717`, Account Security `40008089715`, and Quality Gate SQL job `120601180964` PASS. Browser groups 1, 3, 4 and 5 passed at inspection; remaining groups are still allowed to finish rather than cancelling useful evidence. Group 6 failed eleven assertions: ten Manager viewport/source assertions expected the previous guidance phrase; one checklist test expected guide version 2026.10.07 instead of 2026.10.23. These missed expectations are corrected in two test files; no application, SQL, permission or policy payload changes. Manager authority/tenant/viewport, checklist persistence/expiry and all workflow assertions remain intact. The first failed browser result is NOT claimed passed. Final corrected candidate checks, production release and activation remain pending.

Additional isolated October-7 joiner probe passed inside a rollback-only migration/test transaction: zero earned annual/shared days on 23 October, 3.51 annual and 2.10 shared earned by 31 December under the retained completed-quarter rule. Staging cleanup independently confirmed seven unchanged synthetic profiles, zero shared policy rules and no residual private pool helper.

Actual live cloud browser is authenticated as the existing Administration account; current Time & Leave policy was read at 24/6 and remains unchanged. No new sign-in, production user impersonation or leave decision was performed.
