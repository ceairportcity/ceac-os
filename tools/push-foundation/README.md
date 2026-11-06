# Dormant push delivery foundation — pause at integration

Owner instruction, 5 November 2026: build only the independent parts; stop before actual or potential overlap with the active Work redesign (PR #201). This directory is server-only, dependency-free and not imported by the application. Nothing is enabled or deployed.

## Implemented

- Subscription shape and provider endpoint checks (Apple, Google FCM, Mozilla), HTTPS-only and no arbitrary server destinations. These checks are input validation, not cryptographic verification of device ownership.
- Bounded, plain-language preview formatter with sender name and department for explicitly allowed ordinary previews. Private/unknown content and disabled previews omit identities and message content. Examples in tests are synthetic.
- Provider response classification: accepted, expired subscription, permanent rejection or bounded exponential retry.
- Delivery executor with injected atomic lease store, access/preferences check, encrypted transport adapter and clock. Fails closed on denied access; retries transient authorization outages without sending. Errors do not persist raw provider exceptions, endpoints or subscription keys.
- Per-device retirement, event expiry, stable notification tags and lease-aware completion contract.

## Deliberately not implemented

No production queue, schema, registration endpoint/UI, signed VAPID/encrypted Web Push transport, keys, scheduler, service-worker listener, notification routing or event triggers. The test transport is a stub; passing tests do not prove delivery on a phone. This is reusable delivery logic, not an operational push service.

## Required integration contracts — STOP here

1. **Account/device registration and logout:** use authenticated server-derived account/organisation identity; reject caller-supplied authority; prove endpoint possession before associating an existing endpoint with another account. Account switch must revoke the previous binding without deleting another device's subscription. Do not implement before reviewing shared session ownership.
2. **Durable queue and existing notification record:** one unique event/device key; atomic lease claim and attempt increment; lease token checked on finish and retirement; bounded transport timeout shorter than lease; explicit stale-lease recovery; rate-limit jobs and cap each worker batch. These require coordinated schema/server authority work. Retain only necessary subscription data, protect it, and never expose it in logs or general notification reads.
3. **Authorisation:** `authorize(job)` must re-read current recipient/tenant/access/device preferences and actionable source state. It must return literal `true` only when all checks pass. A stale snapshot is not adequate. Build payload from the fresh authorised record. This touches Work review, overdue and routine-date rules in PR #201.
4. **Transport:** select a maintained Web Push implementation; validate signing/encryption against browser interoperability; keep private VAPID key on server; disable redirects; require TLS; bound timeouts, concurrency and payload size. The provider host allowlist needs device verification and explicit extension for other supported browsers. No credentials were generated.
5. **Service worker and tap routing:** modify existing `public/sw.js` only after integration review; resolve `notificationId` to an authorised destination, retain destination across sign-in and avoid trusting arbitrary URLs. Adding a second service worker would risk replacing the app's existing worker.
6. **Shared feed/UI:** preserve the redesigned Work/Calendar/Memos state and current palette. Read is independent from approval/completion. Sender, recipient context and action must use clear wording; show a recipient label when necessary to distinguish a group or role. iOS controls system notification appearance and user preview privacy. Confidential records must remain protected even when preview is enabled.

No exactly-once guarantee: a crash after a push provider accepts and before durable completion can lead to a retry. Atomic claims limit concurrent sends; stable tags reduce duplicate visible cards but do not prove device receipt. Do not mark this guarantee as tested or complete.

## Focused verification

Run `node --test tools/push-foundation/delivery.test.mjs`. Tests exercise isolated logic and injected adapters only. Full app/browser/SQL/push-device acceptance remains pending until integration is authorised. Resume by first inspecting PR #201's latest state, comparing its files to current main, then implementing contracts 1–6 with the existing focused testing policy. Do not merge this package as a finished push feature.
