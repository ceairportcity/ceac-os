# CEAC OS — owner-locked full functionality and personal planning acceptance (15 October 2026)

## Authority
The owner approved **all previously approved functionality in the current one-bundle release**. Do not silently defer any current-release functionality, treat a disabled UI as complete, or enlarge this release with separately deferred Stage 2 Google OAuth / universal MFA work. Production changes remain **NO-GO until a separate explicit owner authorisation**. Preserve the existing production Supabase project, Vercel project, data, role boundaries, and original approved Get In / Give Out Work design. Preserve manager-requested / HR-approved volunteer activation.

## Personal Calendar contract
- Each signed-in person can create, edit, complete and delete **private** notes, tasks, events and recurring tasks; their content must not become visible to Managers, HR, other Staff or Executive through ordinary organisational work views.
- Recurrence: daily, weekdays, weekly, monthly, and custom intervals. End conditions: never, end date, or number of occurrences. Changes to a series must not silently rewrite past completed instances.
- Missed occurrences remain visibly overdue and are never auto-completed. Occurrence generation must be idempotent, timezone-safe (Africa/Accra user-facing dates), and RLS-protected by authenticated owner. Test cross-user denial and duplicate generation.
- The Calendar **Add** action must remain stable during loading. If the underlying schema is missing, show a truthful explicit non-operational state, but do not count this as feature acceptance. Once deployed, actual create/read/update/delete and recurrence must pass authenticated browser and database checks.
- Organisational routines remain distinct from private recurring tasks. Give Out Work should expose its existing routine scheduling model without altering its approved design.

## Cross-role UI acceptance
- Fix unnecessary full-width buttons, long empty strips, stretched forms, uneven field groups and inconsistent type scales on Staff, Manager, Admin, Executive, Volunteer and Technical Support screens; preserve the approved Get In / Give Out Work design.
- Use Instrument Sans, readable minimum 12px for informational text, clear heading/body/label hierarchy, context-width desktop actions and accessible mobile touch targets. Do not globally shrink or hide working controls to achieve a screenshot.
- Inspect and visually compare desktop and mobile routes for each role, including error/empty/disabled states. PR #86's Add Volunteer patch is only an initial targeted fix, **not** cross-role completion.

## Production reality observed read-only on 15 October
- Existing project efjljhftsesssumtshvp ACTIVE_HEALTHY with **119 applied migrations**. Production tables for personal_day_tasks / personal_day_notes and private calendar events were absent. New payroll/volunteer/performance release tables also absent from a name-pattern inventory. These are **not deployed**, not evidence of functional acceptance.
- Source StaffCalendar.jsx currently gates the Add control on personalPlanningReady and disables planning after missing-schema errors. An interim PR #86 fix keeps Add visible but disabled when backend is missing; that is only a UX safeguard.

## Mandatory audit and release gates
1. Enumerate every role route, action, form, conditional feature gate and required RPC/table/edge function; reconcile to the 119-migration production baseline and the exact pending migration manifest.
2. Implement missing approved frontend/backend capability on review branches, with RLS, permissions, auditability, privacy and migration rollback evidence. Do not invent data or weaken privilege checks.
3. Rehearse **the exact integrated migration set** against a disposable/restorable baseline. Prove unique migration versions, no destructive loss, correct privileges, idempotent scheduling and cross-role denial.
4. Execute full source tests, build, account-security checks, SQL/RLS contracts, role browser flows, invitation delivery and visual acceptance. CI with no executed steps is not PASS. Validate actual authenticated users in an authorised non-production environment.
5. Consolidate the accepted bundle and obtain the owner's **separate production GO** before any production SQL, protected-main merge or deployment. Transfer original Supabase administrative ownership only after the verified release and another explicit owner GO.

This decision supersedes any narrower assumption that Calendar/private planning or other already-approved current-release functionality can remain off at launch.
