# Google Maps phone failure — 30 October 2026

## Verified scope

The owner reports that Retry still fails on both HR and Executive on their physical iPhone, including after the 18:44–18:46 desktop verification. That later report supersedes any inference that the earlier screenshot was merely stale. The phone defect remains OPEN. Do not describe this as an accepted map repair.

Resumed the existing checkout at local011aaba9 and remotea7175103. Their trees are identical (bea7c8015fe7a358fd9c3ebd6274820e637ec310); reconcile both histories without overwriting newer work. Main remainsad8441a0. A fresh live Executive page in the existing authenticated browser again displayed the actual Google map and employee/office markers. No production records or Google Cloud settings were changed. This desktop observation does not resolve the owner's phone failure.

## Narrow correction and diagnostic step

The shared loader previously collapsed missing configuration, download failure, SDK timeout and Google authorisation rejection into one message. The map also discarded opening errors and street-image timeouts. Google can reject authorisation after the SDK has loaded; a subsequent retry previously returned the cached SDK without retaining that rejection. Retain this explicit rejection until a user-requested page reload rechecks configuration, and never let a later tile event or timeout overwrite it with readiness.

All shared map consumers now show a fixed, non-personal `Map check` code with plain-English guidance: MAP-SETUP, MAP-DOWNLOAD, MAP-SDK-TIMEOUT, MAP-AUTH, MAP-POLICY, MAP-INITIALISE or MAP-TILES-TIMEOUT. Enforced policy events are limited to Maps resource hosts; unrelated Google fonts and report-only violations do not hide streets. No raw SDK errors, request URLs, keys, names, GPS or browser logs are displayed or transmitted as diagnostics. Existing CSP, key, permissions, data queries, map placement and provider remain unchanged.

This is an essential diagnostic release and a verified authorisation-retry correction, not a proven explanation or completed fix for this iPhone. If failure persists after release, obtain the displayed map code once, then investigate that specific outcome. Do not ask the owner to repeat blind Retry attempts, blame the phone/network without evidence, relax CSP on speculation, or replace Google again.

## Local evidence

Node22.12.0: focused actual-loader/map/security tests20/20 PASS, full source664/664 PASS, production build PASS. Chromium focused map browser cases7/7 PASS, then combined map/HR Overview14/14 PASS: phone retry/marker recovery, policy failure versus unrelated/report-only violations, late street recovery, retained authorisation failure, existing Executive desktop/phone access/layout, HR responsive/leave paths and absent-key behaviour. Logs are local private scratch at `/tmp/ceac-map-diagnostic-source.log`, `/tmp/ceac-map-diagnostic-all-source.log`, `/tmp/ceac-map-diagnostic-build.log`, `/tmp/ceac-map-diagnostic-browser.log`, `/tmp/ceac-map-diagnostic-final-browser.log`. The SDK is synthetic in these browser cases; actual provider desktop evidence is separately scoped above.

The authorisation-before-tiles variant additionally PASS1/1 (`/tmp/ceac-map-auth-pending-tiles.log`): a later tile event cannot erase Google's rejection. WebKit2203 initially could not launch because system libraries were missing. Official dependency installation failed in this sandbox (package-user mapping, then archive-cache permissions); a corrected writable archive-cache attempt is separate environment setup, not application acceptance. No Safari or physical-iPhone pass is claimed here. Do not repeat an unchanged installer or disable certificate/browser protections to manufacture acceptance. Current hosted release qualification and deployment receipts belong in the PR after completion. No production change is claimed in this local record.
