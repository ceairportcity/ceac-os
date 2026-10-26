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
