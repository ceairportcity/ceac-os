# Shared Work oversight — 6 November 2026

Owner approved the interactive Work oversight direction and authorised implementation through production release without another permission milestone. The approved visual direction uses the existing CEAC palette, readable content, restrained Apple-inspired navigation, and a list/detail conversation. It extends the current Work tab rather than replacing Projects, routine dates, private diary or final review.

## Responsibilities and behaviour

- Staff/manager owns delivery. A shared update has no approval state and does not create a submission or notification. Existing dated personal diary remains separate.
- A milestone requests an independent decision without completing the parent assignment. Decision/support requests and responses stay attached to that work. Only the request's named independent recipient can decide it.
- HR/Admin coordinates shared organisation work, including assignments Admin did not create, follows up, and requests supervisory attention. Coordination does not grant blanket milestone approval.
- Managers supervise their staff. Staff reporting lines reuse HR's existing employee roster. No second staff reporting configuration is created.
- HR can record a manager's named Executive, with reason and attributable history. The verified named Executive becomes the manager's existing final reviewer; an actual assigning Admin remains the exception. Without an explicit reporting line, the previously released reviewer route remains.
- The separate Coordination / Oversight / Team oversight view uses real, bounded, current authorised Work records. Existing personal/team/review/Projects flows stay accessible.
- Private and confidential work never enters the new shared conversation or queue. Account/organisation/scope and current active authority are checked server-side on every read and action.
- Work notifications reuse the existing CEAC feed and optional device transport. Requests coalesce by unresolved request; rapid follow-up messages are limited. No private note text enters a notification preview.

## Database and deployment

Forward migration generated with Supabase CLI 2.117.0: `20261106152354_work_oversight.sql`. Private tables have RLS and no ordinary table grants. Writes use guarded RPCs; message request UUIDs make retries idempotent. Review and reporting-line history is attributable. No reporting relationships are fabricated or auto-populated.

Staging: `ugaifpxjgkclmcdvyppx`. Production target: existing `efjljhftsesssumtshvp`, after final qualification. Keep previous Vercel production deployment for rollback; additive schema remains compatible with the prior frontend. New Edge Function source must be deployed with its established configuration; do not expose any server secret.

## Verification checkpoint

Base main: `e4a013001cdfd9bd17c46e7f8a0e227dea5b6210` (PR #204).

- Node 22.12.0: production build passed; affected source suite 50/50 passed (manager routes, notifications/delivery, work register).
- Staging migration applied successfully. Rollback-only synthetic SQL acceptance passed: actual authenticated role, tenant/private/confidential isolation, named reviewer, assigning Admin exception, independent milestones, whole-assignment state preservation, idempotent retries, duplicate nudges, response authority, notification recipient and inactive-account revocation.
- Two initial acceptance attempts failed at the revocation fixture's deactivation actor, not oversight behaviour. Corrected the test to use the existing signed-in Admin deactivation authority; no production guard was weakened.
- Local Playwright could not start a browser because this execution sandbox disallows the required socket. Do not count local rendering as passed. New real-component browser controls/responsive test is registered as `tests/work-oversight.spec.js`; isolated SQL authority test is `supabase/tests/work_oversight_gate.sql` and registered in the existing SQL gate.
- Required exact-head CI, clean replay, security, all browser groups, screenshot inspection, staged deployment and production acceptance remain pending at this checkpoint.

Focused Testing remains the iteration method. Run full mandated final qualification only on the frozen release candidate. Preserve raw failures and historical coverage as such; never claim an unrun device test.

## Frozen-candidate preparation

Full native source suite: 790/794 passed. Four failures were stale source assertions (three Work register guard strings now also select the new oversight view, and the migration inventory lacked the newly generated filename). Updated those exact assertions without removing their scope checks; affected rerun 23/23 passed. Final exact-head CI must still execute all source tests.

The broad staging security-surface gate failed because staging lacks the pre-existing `public.workforce_map_day(p_date date)` API (actual=191, expected=192). No unexpected API appeared; the five new oversight interfaces are explicitly inventoried. Keep this baseline staging drift recorded rather than dropping the expected old function. Clean replay/security CI remains required.

Staging advisors report the new private tables' intentional deny-all RLS and the five intentional, guarded authenticated RPC entry points; these follow the existing API model. No ordinary direct table grants were added. Account-wide pre-existing advisor findings remain outside this change.

## Release-candidate CI — PR #206

Connected CEAC GitHub repository ownership and push authority verified. Published candidate `a44c969e3839f946083b642c0ba756cef7cd2fa5` (same tree as local `05d5ea0`) through the connected account because terminal Git has no credentials. PR: https://github.com/ceairportcity/ceac-os/pull/206.

- CI Node 22 source: 794/794 passed; classifier/preview contracts: 35/35 passed; npm audit: zero vulnerabilities. Build job then failed on one trailing blank line in the new migration, corrected without changing SQL behaviour. Raw job: 127987411659, run 42245754995.
- Clean migration replay passed: run 42245754678. Invited-account security flow passed: run 42245754553.
- SQL job 127987496841 correctly rejected the previous independent surface count of 187 after five individually inventoried guarded oversight APIs made 192. Updated all four independent count assertions and their source contract to exactly 192, retaining exact named-signature matching, anonymous denial, fixed-search-path and MFA checks. Focused source rerun: 18/18 passed, log `/tmp/ceac-oversight-inventory-repair.log`.
- Browser groups on this candidate remain in progress. Local browser attempts are environment failures, not product results: missing Playwright bundled executable; system Chromium then fails at sandbox-disallowed singleton socket. Do not repeat the same local launch attempt. Browser screenshots are now written into the existing CI-uploaded `test-artifacts` directory.
- Preview deployment READY: `dpl_vCFBMBbT4BJQXdRNcLGcNodu8L5k`, source exactly a44c969e. Production is still base e4a0130, deployment `dpl_8uzQKdQjqoNAr1QZtN7SiezdY6Zw`, retained as rollback candidate.
- Vercel explicit historical team scope returned 403; project-scoped authenticated reads without that stale team selector succeeded and verified repository, commit, project and deployment. No access setting was changed.
- Production migration is not applied. Current latest production migration: 20261106063621 notification_delivery_followups. Existing production ceac-web-push source/metadata captured for rollback before any replacement.

## Device delivery integration correction

Review found that `ceac_push_context_visible` still limited work notifications to assignee/final reviewer. A manager's named supervisor can differ from the final reviewer on Admin-assigned work, so the dispatcher could suppress an otherwise authorised attention request. Forward migration `20261106155308_work_oversight_device_visibility.sql` extends only its Work branch with the same active-actor, tenant and nonprivate/nonconfidential oversight predicate. The helper stays service-only; no new browser API grant is added. All other notification contexts retain their existing rules.

Applied to staging and reran the rollback-only oversight integration gate: passed, including named-supervisor device visibility on Admin-assigned work, tenant/private/confidential denial and service-only helper grants. Affected source tests: 25/25 passed (`/tmp/ceac-oversight-device-focused.log`). Migration inventory explicitly includes both new filenames (237 total).

Candidate dd7ed58 passed CI source/build, Account Security, clean Migration Replay and complete Level B SQL/authority contracts (job 127991160977); browser groups remain pending. These are historical results once the device visibility correction is committed, not certification of the later head.
