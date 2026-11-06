# Notification completion after PR #201

Base: main `fc2cf9a04f1b56632d6cf96483108068b25851e8`. Preserve the released Work design, review authority and existing app colours. No production changes in this continuation.

## Implemented

- Sender/reply-author attribution and department details, private-by-default Memo previews, sender-controlled privacy tied to the saved draft timestamp, and recipient/device preview choice. No message bodies are copied into push.
- Exact, same-origin destinations for Work, dated routine work, Memos, Rooms, meetings, personal Calendar events, leave and personal reminders. The application still checks source access after sign-in.
- Current recipient/access/status checks before delivery; completed routine dates and changed/cancelled/deleted sources are suppressed. Notification reads do not approve or complete work.
- Work submission/return/approval, routine review, HR leave, meeting invitation/change/cancellation and Room mention events use the existing durable personal feed and push queue.
- Ordinary Room pushes require explicit device opt-in and respect the Room's all/mentions/mute preference. Removed Room messages stop outstanding notices. Executive visibility does not automatically subscribe every Room.
- Category controls, Ghana quiet hours, timed reminders (5/15/30/60 minutes), device test, clear blocked/unavailable/retry states.
- Thread grouping/coalescing, exact unread counts separate from outstanding work, paginated history with timestamp/UUID cursors, background badge payloads, and Declarative Web Push fallback where an authorised CEAC app origin is known.
- Immediate post-commit worker wake for new notices/tests, bounded concurrent delivery, expiring leases, retry/retention, minute-based recovery, and source checks before sending. Foreground push signals refresh the existing feed instead of adding a new toast or socket stack.

## Verification ledger

2026-11-06, Node 22.12.0:

- Source checkpoint `51e4ff3`: 93/93 focused tests passed, exit 0. Command: `node --test tests/notificationCompletion.test.mjs tests/ceacWebPush.test.mjs tests/ceacNotificationEvents.test.mjs tests/ceacNotificationScreen.test.mjs tests/notificationPriority.test.mjs tests/messages-memos.test.mjs tools/push-foundation/delivery.test.mjs` (executed with the pinned Node package).
- `npm run build` under Node 22.12.0 passed, exit 0, including the built-script policy seal. Logs: `/tmp/ceac-final-focused.log`, `/tmp/ceac-final-build.log` (local scratch, reproducible).
- `git diff --check` passed. Subsequent changes before publishing align migration identity and browser fixtures; production implementation code is unchanged from the source checkpoint.
- Staging `ugaifpxjgkclmcdvyppx`: migration compilation and rollback-only synthetic acceptance passed for reviewer routing, Memo participant/privacy defaults, queue coalescing, revoked access, unread grouping and service-only table/function access. Synthetic identities use the invitation trigger with a deferred fixture inviter FK; no Auth trigger is disabled and no fixtures remain committed.
- The additional local SQL concurrency test simulates JWT claims solely in the disposable CI database. Hosted acceptance did not execute that simulation; two later confirmation windows expired. Do not call this case passed until its local CI SQL gate succeeds.
- Staging migrations applied as `20261106034650_notification_completion` and `20261106063621_notification_delivery_followups`; repository filenames match those recorded versions.
- Staging `ceac-web-push` version 5 ACTIVE. The worker request tested on version 4 returned HTTP 202 / `accepted:true`; that is server acceptance, not a device receipt. Version 5 adds the final Room/privacy follow-ups and requires its own protected dispatch check.
- No enrolled staging devices. Actual locked-phone receipt and cross-account revocation remain unverified.

## Existing staging discrepancy

The broad SECURITY DEFINER surface gate fails on **unchanged main** with actual 183 / expected 184, missing `public.workforce_map_day(p_date date)`. With the three new reviewed caller-bound interfaces it reports 186 / 187 with the same sole missing signature. The new RPC grant checks passed. Do not remove an expected signature or mark the broad gate green to hide this staging discrepancy. Fresh migration-replay/CI qualification remains required.

Security advisors report intentional caller-bound SECURITY DEFINER RPCs and intentionally inaccessible RLS tables, plus an existing Auth leaked-password-protection warning. New privileged push helpers remain inaccessible to anon/authenticated; the three app interfaces are caller/org bound. Relevant advisor explanation: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable .

## Pending acceptance / continuation

1. Run the committed `notification-controls.spec.js` at 320, 768 and 1440px. Local Chromium cannot launch in this workspace (`socket() failed: Operation not permitted`); this is not a browser pass. The harness mocks delivery and cannot prove phone receipt.
2. Preserve mandatory exact-head CI/security/migration gates and fix only failing areas during iteration. `notification_completion_gate.sql` is included in the existing SQL runner; new Node cases are in `verify:source`.
3. Verify the latest staging worker dispatch, signed-in preferences, real iPhone Home Screen permission/closed-app receipt, exact destinations and logout/account switch. Device delivery remains subject to OS settings/connectivity. Other-device badge clears require opening the app or a later visible push; no silent push is claimed.
4. Production release must apply both migrations, deploy the matching Edge code and app, and verify the actual resulting deployment. This branch has not changed production or claimed release readiness.

## Published candidate and focused CI corrections

Published candidate `afc8f6be5f0ccf80748dd0715de2cadb97f33dba` (PR #203) has exactly the verified local tree `69efaf8d3e83888005280f2981aa68a060c3da88`. Account Security and Migration Replay passed on that head. The first CI/source qualification exposed inventory contracts requiring deliberate updates for the two new migrations, three reviewed caller-bound RPCs and notification-only personal Calendar route. The exact named SECURITY DEFINER allowlist remains enforced; the independent numeric checks now agree at 187 rather than retaining the pre-change 184. The Room read-success contract now checks the scoped CustomEvent payload while retaining its error/stale-room guards.

Focused local correction checks: the route/owner/source contract group ran 84 tests, with 83 passing and one additional stale independent-count assertion identified; that single assertion then passed after its expected gate counts were aligned. The 790-case source qualification was not repeatedly rerun locally after these fixes. Required new-head CI remains authoritative.

The project-default Vercel connection resolved the earlier explicitly scoped access error; the preview error is its source verification step, not a demonstrated hosting outage. PR #203 preview variables are now restricted to its branch and isolated staging Supabase. No production environment variables changed. Staging worker v5 protected dispatch returned HTTP 202 / accepted:true (request 14). Physical receipt remains unverified.
