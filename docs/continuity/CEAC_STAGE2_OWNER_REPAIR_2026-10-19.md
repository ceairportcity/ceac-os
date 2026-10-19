# Stage 2 owner correction — current implementation lane

Owner takeover instruction: 19 October, 21:05 UTC. Continue PR #124 from `0927766b68f9b9f52b25a5ac30e2d5e27211f2bc`; preserve the existing implementation. Production is `34f3c698`, not this correction branch.

## Binding acceptance

Use the original approved Work desktop/mobile and revised Projects references identified in the visual provenance manifest. The rejected live mobile Team screenshot is not an approval. Reconcile the whole owner Work/contribution/reporting contract; do not reduce it to colours or Support. Administration/HR Control Center needs connected navigation, clear back routes, concise messages and no repeated exception/card narratives. Google OAuth and mandatory MFA remain deferred. Existing account, HR, payroll, tenant and permission boundaries remain mandatory.

## Verified first correction batch

- Repaired malformed JSX in Manager, Administration and Executive Work; Node 22 production build now passes.
- Source suite: 468/468 passed. Two executed behavioural regression tests cover correction chains and corrections moved across reporting periods.
- Executive reports now resolve activity correction history before period filtering. Activity editor/project-link drafts remount when changing the selected responsibility; activity pagination has a deterministic tie-breaker.
- Clearing a project after an in-flight relation read no longer leaves self-work creation stuck loading.
- Reconciled stale source assertions and explicitly inventoried all four new migrations without changing the frozen historical migration digest.

## Still open

Work register visual/functional completion, self-created recurrence, complete HR assessment publication/response integration, Admin/HR Control Center correction, full latest-head migration replay and negative authorization, authenticated multi-role browser journeys and literal reference comparison. The latest staging functions are not yet a verified replay of source; no current correction is declared production-ready. Do not merge or deploy based on source tests alone.

## Second source checkpoint — pending rendered acceptance

- Manager, Administration and Executive now use one semantic responsibility register with search, project-ID and status filters, expandable factual status groups and a selected record inspector. Waiting-on/returned records no longer appear under In progress. Selected register filters update the inspector; private records retain their source visibility.
- Control Center displays each settings domain once, with search and a needs-attention view. Missing account privileges and optional integrations are no longer labelled incomplete organisational setup. A consistent Control Center return link is available in its settings pages, and the root returns to Overview.
- Exact private Work desktop/mobile and revised Projects images recovered and inspected. This is not a pixel-match claim. Staff register propagation and other workflows remain in progress.
- 472 source/behaviour tests pass under Node 22. Production build passes. A single explicit Vercel preview checkpoint is requested for real rendered review; routine commits stay ignored by the existing build policy.

## Third source checkpoint — Staff propagation

- Staff Work now defaults to My work and uses the same searchable responsibility register and inspector. Created by me, Assigned and Private stay separate views; the assignee and visibility constraints remain in place. Routine occurrences are below the register, not a second dashboard above it. Secondary schedule/session context is collapsed.
- Invalid saved view values fall back to My work, unavailable session storage does not break rendering, and a serial guard prevents a slower prior-view response replacing the latest view.
- Node 22: 472/472 source and behaviour tests passed; production build passed. No migration or production write was made for this checkpoint.
- The second checkpoint preview is READY at commit `78eacc9136836a07bb3e6ba90d8d796535554e1b`; this third checkpoint is not yet browser-accepted.
- Existing Codespace is connected but VS Code blocks terminal creation in Restricted Mode with “Trust Folder & Continue”. That security decision has not been accepted. Isolated SQL replay and authenticated/browser testing remain pending that essential authorisation.

## Integrated workflow and database validation candidate

- Official Supabase CLI 2.117.0 created forward migration `20261019213252_162_owner_activity_guard_reconciliation.sql`. It corrects the unreachable relink assurance check and reinstalls correction attribution, without editing applied history or enabling Google/MFA. New rollback-only SQL tests cover self relink, append-only activity, immutable original-project attribution, another contributor's denied corrections, manager assessment scope, unpublished employee access and future opt-in AAL denial. These SQL tests are prepared, not yet claimed passed.
- The authenticated SECURITY DEFINER inventory explicitly adds only the two owner Work RPC signatures introduced by migrations 158/160: 145 historical + one existing TOTP helper + two scoped owner RPCs = 148. Trigger functions remain uncallable by browser roles. No generic ceiling or anonymous grant replaces the exact allowlist.
- Project assessment drafts connect to existing formal reviews. Only the assigned reviewer can select their own matching person/period evidence into an unsaved narrative. Existing save, independent HR release and employee response controls remain authoritative. HR's restricted queue opens the person's existing formal review, with explicit missing-review context.
- Staff/Manager/Admin/Executive browser expectations now target the approved register tabs. Added real Control Center search/return-route tests at phone and desktop sizes. All Control Center destination pages have return links.
- 474 Node 22 source/behaviour tests and production build pass. CSS initially exceeded the unchanged 631808-byte aggregate ceiling. Removed 217 retired legacy rules across five stylesheets whose required classes and dynamic class prefixes have no application or test reference, retaining modern component/state families and all referenced rules. Actual built aggregate is now 627683 bytes. Rendered all-route checks remain mandatory; the budget and visual baselines are unchanged.
- Owner's “Stay on it” authorised the specific workspace trust prompt. The existing Codespace was restored with a normal rebuild preserving workspace files; its previous container lacked the configured node user. Node 22, Docker and pinned official Supabase CLI are available. The first local replay reached the documented historical migration-037 live-only helper dependency; continue using `supabase/replay/legacy-live-artifacts.sql` as the repository CI does. No historical migration is modified.
