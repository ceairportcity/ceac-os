# CEAC Start Work office/off-site recovery — 26 October 2026

## Scope and diagnosis

User-reported Start Work failure (screenshots): an authenticated employee had "Location could not be obtained" and the UI subsequently disabled Start until session verification. Another employee reported that the Start Work selection did not respond while no actual duty location had been selected. The user subsequently reported that off-site was unavailable too.

Read-only production findings on 26 October:
- A primary authorised duty location is present; work_session read and office-location API reads succeed.
- Work-session submission history includes a rejected office insert (400; the existing office-location verification trigger raised P0001) and an accepted insert (201), so this is not a universal database outage.
- Off-site sessions already exist in the live database (three records), establishing that the server supports this category.
- Only 3 of 16 active profiles have a work item in the approved active statuses `not_started`, `in_progress` or `returned`. Thirteen currently lack a qualifying responsibility; the existing product/security contract intentionally requires off-site Start to reference a genuine active responsibility. These employees must record a legitimate own task or be assigned work before starting off-site; do not fabricate work or relax the contract.

## Implemented, not yet production-accepted

- When browser high-accuracy location fails, try the normal-accuracy device/browser geolocation route once; retain the actual reported accuracy and capture timestamp. Permission denial never silently falls back.
- When office geolocation fails before any insert, leave the Staff or Manager/Administration/Executive Start form open and show how to enable device/browser location services. This safely permits another attempt without treating an uncertain database response as absent.
- Preserve authoritative exact-session read-back and fail-closed uncertainty after a potentially committed Start.
- Staff off-site selection performs a fresh organisation- and employee-scoped lookup of eligible active responsibilities independent of the Staff Overview's other datasets. Show genuine loading, failure and empty states; offer navigation to existing Work when no eligible item exists. The Start control never enables for an unverified or missing responsibility.
- Shared Manager/Administration/Executive off-site lookup no longer depends on the office-location catalogue succeeding. The relevant failing list is blocked; the independent successful list is usable. Nothing is auto-created.
- No schema, role, RLS, account, provider or production data is changed.

## Verification

Earlier candidate `7a983270`: source CI passed 630 source tests plus 35 further checks, build passed, Migration Replay and Account Security succeeded. A full Quality Gate failed at an external browser-runner installation step, not a claimed application acceptance.
Intermediate tip `515ef266`: the Quality Gate result marked success but classifier selected Level A and skipped full browser shards and SQL. **This must NOT be called full release qualification**.
This document is committed with explicit **[level-b]** to require the mandatory exact-head SQL/security/browser and migration/account checks before any merge. Record the exact resulting commit SHA and terminal run IDs on PR #150. A PASS needs real gate execution, not merely a green classifier. Do not claim live work-session success from source tests or synthetic fixtures. No production Start/End action or fake attendance was performed as part of this fix.

Admin correction PR #149 and its in-flight work remain untouched. This PR #150 contains only the emergency Start Work patch.

## 28 October — owner directs immediate completed repair and release

The owner explicitly asked to fix Start Work now. This supersedes the earlier instruction to leave independent PR150 unintegrated while working on unrelated designs. Continue the existing Start Work branch/PR; preserve all released Learning/HR/reporting changes.

Starting production main c098ab891d0f7c13bcc2f15f62d7c47dbc15e1ad, tree17b963d8c689b1559d0ef54545dc6ed9810d12b1, READY deployment dpl_7T9tFFwazqNMywtQhQGPta4LrM5m. Existing PR150 head7e479f6ef5553852db5cd356b2f446fc3d6f1f2a was NOT qualified: Quality Gate40336366991 failed its Executive own-work retry test (job121619531709), despite the other seven browser shards and SQL succeeding. That old failed gate is retained as failure, not waived. Reconciled current main into the same hotfix branch; resolved only duplicate Ubuntu runner-comment conflicts by preserving the exact current-main workflow files. No workflow changes relative to main.

Read-only production diagnosis on28October: one PostgreSQL work-session error in the24-hour log window came from guard_office_session_location line31, which rejects coordinates outside the selected venue. Its function fingerprint is bbee0a37c0c7515ad4904ed65704c987. Of19 active accounts,4 have an eligible active responsibility. Do not invent tasks or weaken the office geofence to clear these conditions. No employee identity, coordinates, private log payload or credentials are copied into this ledger.

Additional repair: use per-attempt watchdogs for silent browser geolocation, one ordinary-accuracy fallback, and ignore late callbacks from the superseded attempt. Retain real coordinates/accuracy/time, never retry permission denial or fabricate evidence. Classify every known pre-insert responsibility/location validation failure as retryable without claiming a write occurred. Preserve exact actor/tenant session recheck after every potentially committed insert. Surface the actual out-of-venue cause in plain language. Prevent same-event double Start clicks with an imperative in-flight guard. Allow manual in-form refresh of location/responsibility lists, keep off-site work independent of office-list failure, refresh Staff office options on opening, and expose the real Work destination when responsibility is missing.

Validation: clean Node22 npm ci and sealed build passed (`test-artifacts/startwork-install.log`, `startwork-build.log`). Initial source selection647/648 passed; the one obsolete string assertion omitted the stronger imperative guard. Updated that assertion to require the new guard while retaining unverified-write blocking; corrected source648/648 passed, exit0 (`startwork-source-corrected.log`). Geolocation unit cases include silent requests, late callbacks, invalid coordinates, denial and accuracy retention.

Initial browser18/20 passed: two uncertain-response fixtures returned one transient503, which the client safely retried and verified. Those fixtures did not exercise the intended persistent failed-read state. They now keep the read denied until explicit fixture recovery, and still assert no second insert. Added actual same-event double-click cases. Final affected browser selection22/22 passed, exit0 (`test-artifacts/startwork-final-browser.log`), covering both Staff and shared Manager/HR flows,390/1440 location retry, independent off-site selection, failed-list reload, missing/expired work, rejected geofence and uncertain-save recheck. Synthetic requests are intercepted; these are not real employee attendance records.

Freeze the complete resulting tree and require all source-bound full CI/security/migration/SQL/browser gates before merge. Record head/tree, results, deployed main/alias and production no-write checks in PR150 and the ignored release checkpoint. Physical employee/device location confirmation is not fabricated by a cloud browser. No schema/Auth/Storage/provider change, paid infrastructure or production attendance mutation is included.
