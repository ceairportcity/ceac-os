# CEAC OS — Operational Clarity Build Sequence

Status: **LOCKED NEXT-PHASE SEQUENCE**  
Parent specification: `CEAC_OS_OPERATIONAL_CLARITY_REFINEMENT_LOCK_v1.md`

The sequence is intentionally short and dependency-aware. Do not inflate this into another broad redesign programme.

## OCR0 — Start / reconciliation gate

**Goal:** begin only from the finished current programme.

### OCR0A — Reconcile canonical state
- Fetch protected `main`.
- Confirm PR #99 terminal state.
- Read the operational-clarity lock and existing continuity docs.
- Inspect open PRs and verify one implementation writer.

### OCR0B — Baseline verification
- Exact-head CI.
- Migration Replay.
- Account Security.
- Quality Gate.
- Record any external evidence blocker without fabricating closure.

**Exit:** safe baseline confirmed. No product code before this gate.

---

## OCR1 — Shared Composer foundation

### OCR1A — Composer primitive
Build/reuse one responsive drawer/sheet pattern:
- desktop right drawer;
- mobile full-screen;
- compact metadata rows;
- progressive disclosure;
- sticky primary action where appropriate.

Do not change backend contracts merely for layout.

### OCR1B — Give out work
Replace the long Assign surface with the locked Work Item Composer.

Preserve all existing Work Engine semantics and authority.

### OCR1C — Ministry Objective / Direction
Move Executive strategy creation into the same compact interaction model.

### OCR1D — Announcement composer
Adopt the same compact composer for announcement creation.

**Exit evidence:** desktop + mobile screenshots for all three composer families.

---

## OCR2 — Executive clarity and action hierarchy

### OCR2A — Overview
Reorder around:
1. Needs your attention
2. Ministry direction
3. Delivery / exceptions
4. Finance / reporting
5. Organisation
6. Meetings
7. Recent/supporting records

Reduce technical caveat language to secondary support.

### OCR2B — Ministry
Clarify hierarchy and make objective actions obvious.

### OCR2C — Portfolio
Raise default altitude. Keep operational mechanics behind drill-down.

### OCR2D — Organisation
Improve scanability and exception emphasis.

### OCR2E — Create menu
Executive Create visibly exposes authorised:
- work;
- ministry objective;
- project;
- announcement;
- meeting;
- message.

**Exit evidence:** Executive desktop and mobile acceptance screenshots against approved reference hierarchy.

---

## OCR3 — Files, media and communication

This stage is grouped because Room media and Work/Project attachments must share one storage model.

### OCR3A — File foundation
Create the private operational file domain:
- Supabase Storage private bucket/domain for ordinary CEAC work files;
- Postgres metadata;
- context links;
- permission-aware access;
- file-size/type validation;
- signed/private access pattern.

Do not touch `ceac-hr-private` except to preserve isolation.

### OCR3B — Work attachments
- source attachments in composer;
- source attachments on work record;
- preserve submission/evidence distinction.

### OCR3C — Project Files
- first-class Files surface;
- upload/open/download;
- contextual metadata.

### OCR3D — Room media
- image/document/audio/media attachment support;
- compact preview/file cards;
- same file asset model.

### OCR3E — Executive Room authority
Implement and test the locked amendment:
- Executive may discover/access every active Unit Room and Sub-team Room;
- no unrestricted private staff DM.

### OCR3F — Announcement discoverability
- Create → Announcement;
- Messages → Announcements;
- visible create action on announcement surface.

**Exit evidence:** file access tests + Room authority tests + representative Project/Work/Room screenshots.

---

## OCR4 — Global Search

### OCR4A — Search contract
Replace `Find a destination…` with `Search CEAC…`.

### OCR4B — Search retrieval
Permission-aware results across:
- actions/destinations;
- work;
- projects;
- ministry objectives;
- people;
- units/sub-teams;
- meetings;
- announcements;
- rooms;
- files.

### OCR4C — Search result UI
Grouped results with useful context and direct open actions.

### OCR4D — Search acceptance cases
At minimum:
- `announcement`;
- known project name;
- known work title;
- known person;
- known department;
- uploaded filename.

No protected record may appear to an unauthorised persona.

**Exit:** search no longer behaves as a duplicate sidebar.

---

## OCR5 — Cross-role workspace harmonisation

This stage is page-level refinement, not another system rewrite.

### OCR5A — Administration Overview
Rebuild the information hierarchy around:
1. Needs Administration
2. People & HR
3. Time & Leave
4. Payroll readiness / approvals
5. Finance & reporting
6. Organisation setup / exceptions
7. Meetings / recent activity

### OCR5B — People Experience transformation
- preserve the canonical 18-person roster and employee/auth separation;
- build Directory / Organisation / Needs attention views;
- add optional secure employee-photo identity treatment with initials fallback;
- use desktop master-detail where practical and mobile directory → record;
- create a tabbed/grouped employee workspace: Overview / Employment / Work / Time & Leave / authorised Protected HR / Documents / History;
- collapse history by default;
- keep roster-only employees fully represented;
- surface actionable people exceptions without inventing missing values.

### OCR5C — Protected HR experience
- preserve private HR storage and capability checks;
- keep protected values out of ordinary People views;
- use grouped protected-record detail;
- move add/correct protected records into the shared Composer;
- keep attributable version history collapsed by default.

### OCR5D — Workforce + Payroll
- separate ordinary daily workforce operation from advanced policy setup;
- preserve Leave authority exactly;
- harmonise Payroll list/detail and decision sheets without changing preparation/approval authority.

### OCR5E — Control Center transformation
Build Control Center as the CEAC configuration/governance command centre:
- System health / Needs attention first;
- status by domain: Ready / Needs attention / Partly configured / Not configured / Awaiting policy;
- focused categories for Organisation, People & access, Work & operations, Time & Leave, Payroll & Finance, Security & governance, Integrations and Audit & records;
- direct deep-links to authoritative configuration surfaces;
- no long “managed elsewhere ↑” arrow chains;
- advanced forms only after explicit drill-in.

Do not invent a numeric system-health score.

### OCR5F — Administration system surfaces
Refine Lifecycle, Checks/Workflows, Authority and Policies into shared Queue / Record / Settings archetypes.

### OCR5G — Manager + Staff consistency pass
Use the Manager family as the strongest current interaction reference, then correct genuine remaining inconsistencies in Manager and Staff.

Do not make role content identical.

### OCR5H — Full route-by-route visual sweep
Inspect every reachable role page at desktop/laptop and mobile.

For each route classify it as:
- Overview;
- Queue;
- Record;
- Ledger;
- Composer;
- Settings.

Correct structural violations only. Do not reopen accepted product functionality.

**Exit evidence:** route matrix + representative screenshots + no unresolved page-level inconsistency in the locked scope.


---

## OCR6 — Final closure

### OCR6A — Responsive acceptance
Verify laptop/desktop and mobile.

### OCR6B — Security/authority acceptance
- RLS.
- Executive Room amendment.
- file access.
- search visibility.
- announcement permissions.

### OCR6C — Workflow acceptance
Run:
- Create work → attach file → assign → open.
- Project → upload file → find in Files → search.
- Room → share media → authorised recipient opens.
- Executive → Create → Announcement → publish.
- Executive → Message → choose authorised department/sub-team → communicate.
- Executive → create Ministry Objective via compact composer.
- Search → open project/work/person/announcement/file.

### OCR6D — Side-by-side visual acceptance
Compare implementation against:
`reference/APPROVED_REFERENCE.html`

### OCR6E — Merge and post-merge verification
Merge only through protected-main rules.

---

## Scope-control rule

If an issue discovered during this programme is not required for:
- Composer clarity,
- Executive clarity,
- Announcements,
- Executive organisational Rooms,
- Files/Media,
- Global Search,
- cross-role long-form cleanup,
- or acceptance/security closure,

record it separately and do not expand this programme automatically.
