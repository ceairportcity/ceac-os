# Attendance, working patterns and permissions — Phase 2

Authority: the owner's post-onboarding instruction of 6 October 2026 and the canonical master register/sequence. This additive contract preserves Stage 9 Workforce, Request semantics, capability grants, protected HR, immutable session evidence and roster identity.

## Purpose and population

Expected attendance, recorded presence, authorised context and subsequent review remain separate. Missing sessions, late verified starts and location failures do not create absence, guilt, scores, deductions or payroll changes. The evidence read uses the employee roster, including employees without login accounts; unlinked employees remain visible to authorised workforce/Compliance roles with unconfigured expectations and no fabricated sessions. Recording patterns and notices uses existing linked profile authority; creating account identities is outside this phase.

## Working patterns

Extend `workforce_schedule_versions` with a day-keyed `clock_map`. Each selected day has its own start/end or explicitly unconfigured clocks. Legacy records retain their original common-clock interpretation. Administration records a superseding version with effective dates, actor and reason through `workforce_record_pattern`; existing versions are never rewritten. A future version does not displace current expectations before its effective date. Stale revisions fail. The existing legacy recorder remains compatible.

The discussed Monday 12:00–17:00 and Tuesday–Friday 10:00–17:00 hours remain a **policy draft**. No migration seeds them or assigns them to employees. Per-person/contract differences remain expressible through the existing person schedule and employment context. Same-day patterns are supported; overnight shifts require a future explicit contract rather than silent end-date assumptions.

## Notices and authority

Attendance notices are an immutable typed anchor on existing `work_items(kind=request)` and `work_requests`. This is an extension of the Request engine, not another decision engine. A self-bound server entry point permits only four attendance kinds and uses the active employment unit plus its recorded active manager. Where no named manager exists, the existing responsible-unit route remains, with Administration's existing Request response authority. Emergency/medical notices can be communicated immediately without advance approval. Acknowledgement does not retrospectively prove presence or approved leave.

Temporary permission records departure, expected return and derived duration. A separate append-only return record captures actual server receipt time, actor and any open session link, explicitly labelled **self report**. It never pretends to be verified location. Original requests, responses and returns remain preserved; a cancelled notice can be replaced by a new attributable notice. Responses use existing Request history and final-state guards, plus an attendance-specific guard that also protects the generic Item response path. A person cannot approve their own notice. Decision history preserves prior/new state in the platform audit.

Staff reads own notices. Managed-unit managers read the notice route in their managed scope. Workforce administration uses `workforce.manage`; Compliance monitoring uses organisation-level `compliance.manage`. Compliance does not acquire workforce configuration or permission-decision authority. No new capability is silently granted. Unit selection does not alter organisation-level grants.

Medical notices accept dates/status only and reject reason/note narratives, including in server calls. Medical responses accept a fixed operational message. Protected medical detail remains in Protected HR. The sanitised organisation evidence read omits leave categories/reasons, private notice narratives and private response narratives for Compliance. Raw notice tables remain inaccessible through a Compliance grant alone.

## Foreground presence and pre-close

The application attempts a discrete hourly foreground sample and one daily pre-close sample. Hourly cadence is a technical sampling limit, not an attendance rule or grace period. The browser must be visible and focused, with an open session; the collector does not run in a service worker or use continuous `watchPosition`. Automatic checks do not prompt for new location permission. An available Permissions API must report geolocation permission granted before collection; unavailable/denied permission records a factual failed attempt. Network/offline failure cannot be recorded until a server request succeeds and must not be represented as evidence.

Pre-close is derived from the effective person's daily expected end, within its final hour, and validated on the server. No recorded end means no pre-close check. The server binds actor/subject/org/session, checks freshness and coordinate/accuracy validity, computes office-area result, records device/capture/server times and schedule version/end context. A session lock plus server-generated hourly/date slots prevents duplicate tab/reload samples. Failed evidence is append-only and cannot later be overwritten by a successful retry in the same slot. Ordinary work continues if an intermediate check fails. Browser GPS evidence is not a guarantee against a device spoofing location.

Start and End Work keep their accepted contracts. End Work still closes without location. The latest-location map plots discrete recorded points without a third-party map provider or claims of continuous movement. The evidence view keeps location separate from attributable CEAC activity and explicitly displays unverified endpoints/checks. Verified late-start comparison uses the server session start backed by office start evidence; a merely claimed office/off-site session is not a verified office start.

## Close foundation and stop boundary

The expected-close timestamp and schedule-version context on checkpoints prepare future close prompts. Existing attributable session reconciliation remains available for continue/finished-earlier flows. No timer closes a session, changes payroll or invents a grace period. Scheduled-close/grace policy, final Compliance dashboard, disciplinary cases, executive override, scoring, awards, deductions, full volunteer/PFCC models and background surveillance remain deferred/gated by the programme sequence.

## Verification

Six new signed-in definer RPCs are reviewed in `attendance_phase2_gate.sql`; the exact inventory increases from 129 to 135 while no-anonymous execution, fixed paths and actor binding stay mandatory. Rollback SQL verifies self/manager/Compliance boundaries, immutable histories, future patterns/stale revisions, medical privacy, hourly duplicate prevention, zero-coordinate evidence and nonblocking location failure. Unit tests cover pattern resolution, factual start states and pattern-derived pre-close. Browser tests cover request/decision persistence, return provenance, medical forms and phone/desktop reflow. Production deployment and exact-main gates are recorded separately in the programme sequence; implementation alone is not completion.
