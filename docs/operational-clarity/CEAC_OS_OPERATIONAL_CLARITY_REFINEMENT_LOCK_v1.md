# CEAC OS — Operational Clarity & Collaboration Refinement Lock v1

Status: **LOCKED — NEXT PHASE / DO NOT IMPLEMENT YET**  
Locked: 2026-10-04  
Amended: 2026-10-04 — cross-role workspace harmonisation added after Administration/HR audit; People + Control Center elevated to transformation scope  
Current protected-main baseline at lock time: `5254d7a685825c6130f8963598f55a02e32e943a`  
Current active implementation PR at lock time: **#99 — Final literal parity closure**  
Current PR #99 head at lock time: `89062b7d2baa7baa16ca1950c3b78ad9f1167bc5`

## Start condition

This refinement programme must **not** begin while PR #99 is still the active implementation writer.

Implementation may start only after:

1. PR #99 has completed and merged through protected-main rules, or has otherwise reached an explicitly accepted terminal state.
2. Protected `main` is re-fetched and reconciled forward.
3. Exact-head CI / Migration Replay / Account Security / Quality Gate are green or any remaining external evidence blocker is documented.
4. There is only one active implementation writer.
5. The writer reads this lock, `BUILD_SEQUENCE.md`, `ACCEPTANCE_CONTRACT.md`, and the existing canonical owner / HR / Payroll / Leave continuity documents before writing.

This branch is documentation-only. It must not be used as an implementation branch.

---

## Product intent

This is a **targeted refinement programme**, not another redesign of CEAC OS.

The purpose is to remove high-friction, confusing interaction patterns while preserving the accepted system architecture, authority model, Work Engine, employee roster, protected HR, Payroll, Leave, Finance, project integrity and audit foundations.

The programme is intentionally constrained so it can be executed quickly and safely. It must not turn into another multi-day visual rewrite.

### Non-negotiable operating rules

- Reuse the existing system and data contracts first.
- Do not rebuild accepted areas merely for consistency.
- Do not invent business data, progress, priority, financial truth, HR values or authority.
- Do not add another infrastructure product where Postgres/Supabase already fits.
- Do not weaken RLS to make UI easier.
- Any authority change must be explicit, tested and documented.
- Mobile must be designed intentionally, not produced by stacking desktop cards vertically.
- Screenshot acceptance is mandatory for the surfaces governed by the approved reference.

---

# 1. Shared CEAC Composer System

The current long-form pattern is rejected for high-frequency creation flows.

A reusable **CEAC Composer** becomes the default interaction pattern for creation/edit flows that currently require excessive scrolling.

## Desktop

Use a compact right-side drawer, approximately 460–520px wide depending on content.

## Mobile

Use a full-screen composer using the same hierarchy and interaction model.

## Required interaction principles

- Required fields first.
- Compact clickable metadata rows instead of permanent full-width selects.
- Progressive disclosure for optional/advanced content.
- Sticky primary action where appropriate.
- Clear plain-language labels.
- Supporting explanation only where it prevents a real misunderstanding.
- Same object language for create → view → review where practical.

## 1A. Give out work / Work Item Composer

Replace the current long Give out work form.

Required primary content:

- Work type as a compact selector.
- What needs doing.
- Why this matters.
- Assignee.
- Due date.

Compact context rows:

- Project.
- Team / unit context where relevant.
- Created date after creation.
- Status after creation.
- Progress only from authoritative recorded checklist state.

First-class secondary sections:

- Attachments.
- Subtasks / checklist.
- Instructions.
- Finished result.

### Work attachments distinction

Assignment/source files and submission/evidence files are different concepts.

- **Assignment/source attachments** = material supplied with the work.
- **Submission/evidence files** = material returned by the assignee.

Do not collapse these concepts into one record type.

### Priority

Do not fabricate a Priority field merely to match a visual reference.

If Priority is later introduced, it must become a real stored product field with explicit allowed values and filtering semantics.

## 1B. Ministry / Strategy Composer

Replace the existing long stacked strategy form for Executive use.

Plain-language structure:

- New ministry objective / direction.
- Objective name.
- What are we trying to achieve?
- How will we know?
- Start date.
- Target date.
- Status.
- Optional reason/context.

Measurement detail expands only if the user chooses a numeric measurement.

Internal terms such as generated percentages, strategy record mechanics and revision semantics must not dominate the default surface. Audit/revision history remains authoritative in the background.

## 1C. Announcement Composer

Announcement creation must use the same compact composer language.

Primary fields:

- Title.
- Audience.
- Message.
- Attachments.
- Publish timing.
- Acknowledgement requirement where supported.

Audience options must remain authority-aware.

---

# 2. Executive Panel Clarity

The Group Pastor panel must be reworked around leadership decisions, not database language.

The current implementation overuses phrases such as recorded signal, recorded movement, descriptive records and system disclaimers. Those safeguards remain valid but should become secondary context.

## 2A. Executive Overview hierarchy

The default overview should read in this order:

1. **Needs your attention**
2. **Ministry direction**
3. **Delivery and exceptions**
4. **Finance / reporting context**
5. **Organisation overview**
6. **Upcoming meetings**
7. **Recent activity / supporting records**

The first screen should answer:

- What needs my attention?
- Why?
- What decision or drill-in is available?
- What changed?
- Where should I go next?

Do not turn the page into a KPI wall.

## 2B. Ministry

The Ministry surface must present hierarchy in human terms:

**Ministry direction → Ministry objectives → Unit objectives → supporting projects**

The Executive must be able to create/revise ministry objectives through the compact composer.

Descriptive objectives remain descriptive. Numeric progress must never be inferred where the record does not support it.

## 2C. Portfolio

The Executive default portfolio altitude should emphasize:

- Major initiative / project.
- Objective served.
- Owner / delivery owner.
- Explicit recorded health or attention state.
- Required Executive decision where one exists.

Participant registers, dependencies, remittances, detailed project state controls and other operational mechanics remain available through drill-down rather than competing for attention on the default Executive page.

## 2D. Organisation

The Executive Organisation surface should emphasize:

- Department / unit.
- Recorded leader.
- Authoritative headcount where available.
- Missing-leader / reporting / structural exceptions.

Avoid a wall of repetitive zero-value cards when the information can be scanned more effectively.

---

# 3. Executive Create, Announcements and Communication

## 3A. Executive Create menu

The Executive `Create` action must visibly include, where authority permits:

- Give out work.
- Ministry objective.
- Project.
- Announcement.
- Meeting.
- Message.

If a capability is not permitted by the canonical authority contract, do not show it merely for visual parity.

## 3B. Announcement discoverability

Announcement creation must be obvious from:

1. `Create → Announcement`
2. `Messages → Announcements`
3. The Announcements surface itself for authorised users.

The current hidden path through a Room action menu is not sufficient.

## 3C. Executive Room authority amendment — LOCKED OWNER DECISION

The Group Pastor may discover, enter and communicate in **every active CEAC Unit Room and Sub-team Room** in the organisation.

This is an explicit authority amendment and must be enforced at the database/RLS layer with tests.

This does **not** create unrestricted private one-to-one staff messaging.

The management chain remains intact:

- Group Pastor can address organisational rooms.
- Group Pastor does not gain a general private-DM channel to every staff member.
- Existing Project Room authority remains contextual unless separately justified.

The Executive Inbox should not become a firehose of every message in the organisation.

Default Executive Messages should prioritize:

- conversations the Executive participated in;
- mentions;
- relevant recent activity;
- announcements.

`Create → Message` or the Messages surface should offer an organisation-aware picker for authorised Unit / Sub-team rooms.

---

# 4. Unified CEAC Files & Media

CEAC needs one secure file capability consumed by Work, Projects, Rooms, Meetings and Announcements.

Do not create separate physical file stores for each feature.

## 4A. Canonical storage

Primary CEAC-uploaded operational files:

- **Supabase Storage**, private.
- File metadata and links in Postgres.

Protected HR remains separate in its existing private HR storage domain.

Google Drive is **not** the primary CEAC file store.

Google Drive may later become an optional external source for existing collaborative files such as Docs / Sheets / Slides.

## 4B. File object model

A single uploaded file can be linked to one or more authorised contexts without duplicating the binary, for example:

- Project.
- Work item.
- Room message.
- Meeting.
- Announcement.
- Submission/evidence.

Metadata should support at minimum:

- filename;
- MIME type;
- size;
- uploader;
- uploaded timestamp;
- storage bucket/path;
- linked CEAC contexts;
- optional external-provider reference where applicable.

## 4C. Project Files

Every Project may expose a real Files surface.

Recommended project navigation:

**Overview | Work | Files | Discussion | Activity**

The exact tab set may vary where an accepted project surface already exists, but Files must be first-class and easy to reach.

## 4D. Room / Message media

Rooms should support work-relevant media and files so users do not have to leave CEAC simply to share:

- images / flyers;
- PDFs;
- office documents;
- spreadsheets;
- audio;
- supported video within sensible size policy.

Images should preview where practical.

Documents should render as compact file cards with open/download actions.

Audio should have an inline player where technically appropriate.

## 4E. Work Item attachments

The Work Item Composer supports source attachments at assignment time.

The work record must keep those separate from later submission/evidence files.

## 4F. File policy

Do not invent an arbitrary “25 files” product limit.

The implementation stage should define file-count and size limits from:

- practical CEAC usage;
- current Supabase limits/cost;
- mobile-network reliability;
- abuse/security constraints.

---

# 5. Real Global Search

The current `Find a destination…` implementation is rejected as insufficient because it only filters navigation labels.

Replace it with:

**Search CEAC…**

The keyboard shortcut may remain.

## 5A. Search scope

Global search must return permission-aware grouped results across the records the current user is authorised to see:

- Actions / destinations.
- Work / tasks.
- Projects.
- Ministry objectives / strategy.
- People.
- Units / departments.
- Sub-teams.
- Meetings.
- Announcements.
- Rooms.
- Files.

## 5B. Required examples

Searching `announcement` must be able to surface:

- Create announcement, when authorised.
- Announcements destination.
- Matching announcement records.

Searching a project name must be able to surface:

- the project;
- matching work;
- matching files where authorised.

Searching a person name must surface only records the current role is allowed to see.

## 5C. File search

Initial file search covers:

- filename;
- title/label;
- type;
- associated CEAC context.

Searching the text *inside* PDFs/Word documents is explicitly **not required** for this fast refinement phase.

Document-content indexing can be a later enhancement.

## 5D. Search architecture constraint

Do not introduce Algolia, Elasticsearch or another external search platform for this phase unless the existing stack proves technically inadequate.

Prefer a secure Supabase/Postgres implementation with proper indexing and permission-aware retrieval.

Search must never become a route around RLS, protected HR, Payroll or other authority boundaries.

---

# 6. Cross-role Workspace Harmonisation

The same clarity problem is confirmed outside the Executive panel, especially in Administration & HR.

The shared shell itself is already role-aware and structurally consistent. The larger inconsistency is **inside the page bodies**: some newer Manager/Work/People families use clear grouped surfaces, while several Administration/HR and Executive pages still mix queues, record detail, long forms, settings, history and explanatory text in one long surface.

This stage therefore covers **page-level information architecture and interaction consistency across all roles**, without reopening accepted backend functionality.

## 6A. Shared page archetypes

Every major CEAC page should primarily follow one of these archetypes:

1. **Overview** — what needs attention, what changed, where to go next.
2. **Queue** — a prioritised set of items requiring review/action.
3. **Record** — one person/project/work item with grouped detail and drill-down.
4. **Ledger** — dense financial/payroll/reporting records with clear totals and immutable history.
5. **Composer** — compact create/edit drawer or full-screen mobile sheet.
6. **Settings** — grouped configuration with collapsible advanced detail.

A page should not casually mix several archetypes into one long scroll.

## 6B. Administration & HR — confirmed refinement scope

### Administration Overview

The current Administration overview contains too many competing panels: operational inbox, setup/access, reporting, organisation pulse, workforce context, cross-unit attention, meetings, personal work and organisation structure.

Refine the default hierarchy around:

1. **Needs Administration**
2. **People & HR**
3. **Time & Leave**
4. **Payroll readiness / approvals**
5. **Finance & reporting**
6. **Organisation setup / exceptions**
7. **Upcoming meetings / recent activity**

Technical explanation and system caveats become secondary support, not the first reading path.

### People — TRANSFORMATION LOCK

People is not merely a roster screen. It becomes the **human system of record and Administration people workspace**.

#### Default People modes

Provide three clear views:

1. **Directory** — visual employee directory.
2. **Organisation** — useful hierarchy / reporting structure.
3. **Needs attention** — employees or structural records requiring Administration action.

#### Directory

The primary directory should support:
- employee photo where an authorised uploaded photo exists;
- initials avatar fallback;
- full name;
- job title;
- unit / department;
- employment status;
- compact identity-state or Administration-attention indicator only where useful;
- search;
- department/status filters;
- compact Grid and List views where practical.

Do not make roster-only employees look broken merely because they do not have an auth account.

#### Employee workspace

Desktop should prefer a **master-detail** pattern where practical:
- persistent searchable employee list;
- selected employee workspace on the right.

Mobile becomes directory → full employee record.

The employee header should answer immediately:
- who this person is;
- what they do;
- where they belong;
- their current employment state.

Use grouped/tabbed sections:
- Overview
- Employment
- Work / responsibilities
- Time & Leave
- Protected HR, only where authorised
- Documents, where supported
- History

History is collapsed/timeline-based by default.

#### Organisation mode

Show operational hierarchy rather than a decorative chart:
- Group Pastor / CEO;
- Units / departments;
- recorded Unit Heads / managers;
- employees;
- sub-teams where authoritative.

Highlight missing leadership, unmapped employees and structural exceptions without inventing reporting lines.

#### Needs attention mode

Aggregate actionable people issues such as:
- identity review required;
- missing authoritative employment values;
- pending invitations;
- missing recorded Unit Head;
- Payroll-readiness gaps where the viewer has authority.

Selecting a category filters to the affected employees/records.

#### Employee photos

Employee photos become an optional first-class identity feature.

Rules:
- never fabricate photos;
- never scrape external photos;
- store uploaded photos securely;
- use initials when absent;
- reuse the same approved photo identity treatment in People, assignee selectors, work records, Rooms and other authorised people contexts where useful.

Protected HR values must never be exposed merely because the People interface becomes richer.


### Workforce / Time & Leave

Keep the operational daily view clear.

Separate:
- Today / attendance context;
- Leave decisions;
- Calendar / schedule;
- policy configuration.

Advanced policy configuration must not dominate the ordinary workforce screen. Use a dedicated compact settings/composer surface for policy editing.

The confirmed Leave route remains:
Employee request → Manager approval → Administration final approval.

### Payroll

Keep the existing preparation/approval separation and immutable approved runs.

The current two-pane/list-detail direction is acceptable and should be harmonised rather than rebuilt.

Refine:
- header hierarchy;
- readiness warnings;
- run selection;
- employee line review;
- decision sheets;
- correction history.

Do not convert Payroll into generic cards or expose protected values outside existing authority.

### Protected HR

Replace the current pattern where record history and a long create/correct form compete on the same page.

Use:
- employee selector;
- compact protected-record summary;
- grouped protected record types;
- history collapsed by default;
- **Add / correct protected record** through the shared Composer.

The existing private storage bucket and separate protected-HR authority remain unchanged.

### Lifecycle, Checks / Workflows, Authority, Policies and Control Center

These currently retain more legacy `card / row / sec` presentation and form-heavy interaction than the newer role surfaces.

Refine them into consistent list-detail / queue / settings archetypes:

- **Lifecycle:** case queue + selected case detail + compact start-case composer.
- **Checks / Workflows:** decision queue + selected decision detail; no explanatory wall beside every queue item.
- **Authority:** people list + selected person's current grants + collapsed history + grant/revoke composer.
- **Policies:** policy list + selected current rule + collapsed version history + compact revision composer.
- **Control Center:** transformed into the CEAC configuration/governance command centre, per the locked section below.

### Control Center — TRANSFORMATION LOCK

Control Center is not a long settings page.

It becomes the **CEAC configuration and governance command centre**.

Its default purpose is to answer:

- Is CEAC configured correctly?
- What needs Administration attention?
- What is already operational?
- Where is each authoritative control managed?

#### Control Center home

Lead with **System health / Needs attention**, not configuration forms.

Show concise status for domains such as:
- Organisation setup
- People & access
- Time & Leave
- Payroll
- Finance
- Work & workflows
- Security & authority
- Policies / governance
- Integrations
- Audit / records

Use explicit status language:
- Configured / Ready
- Needs attention
- Partly configured
- Not configured
- Unavailable / awaiting confirmed policy

Each status must be based on recorded system state, not an invented health score.

#### Configuration categories

Use focused category workspaces rather than one giant scrolling page.

Recommended groups:
- Organisation
- People & access
- Work & operations
- Time & Leave
- Payroll & Finance
- Security & governance
- Integrations
- Audit & records

A category may summarize a control that is authoritatively managed elsewhere and deep-link directly to that surface.

Control Center is therefore a **control map**, not a duplicate implementation of every setting.

Reject arrow-chain language such as:
- “Managed in Workforce ↑”
- long sequences of cards that require the user to infer navigation.

Prefer:
- Leave policy — Partly configured — Review policy →
- People & access — 2 items need attention — Review →
- Office location — Not configured — Configure →

#### Progressive disclosure

Administration should be able to understand system state without first opening advanced configuration fields.

Only show detailed configuration forms after the user explicitly chooses to configure/revise that domain, using the shared Composer where appropriate.


### Administration Work

Administration Work already shares the newer Work-family pattern with Manager Work. Preserve that family and refine only genuine inconsistencies. Do not rebuild it simply because other Administration pages are being corrected.

## 6C. Manager and Staff consistency

The Manager experience is the strongest current reference for page-level clarity, but it is not automatically perfect.

Use the same archetypes and design language across Manager and Staff where appropriate, while preserving role-specific actions and authority.

Do not force every role to display identical content. Consistency means:
- same interaction grammar;
- same density rules;
- same hierarchy patterns;
- same drawer/composer language;
- same empty/loading/error treatment;
- role-appropriate information and actions.

## 6D. Page-level consistency requirements

Across all role panels and tabs:

- primary action must be obvious;
- first viewport must communicate page purpose;
- long secondary/history sections collapse by default;
- dense record data uses list/detail rather than stacked cards where appropriate;
- advanced configuration does not sit in the ordinary operational path;
- technical/database language is secondary;
- repeated disclaimers are reduced to concise contextual help;
- mobile gets purpose-built hierarchy rather than simple desktop stacking;
- accepted RLS / authority / data truth is preserved.

This is still a targeted refinement programme. It is **not** permission to rewrite every component or reopen accepted backend architecture.


---

# 7. Acceptance

The phase is not complete because code was committed or CI started.

It closes only when the acceptance contract in `ACCEPTANCE_CONTRACT.md` is satisfied.

The approved in-repo visual authority is:

`docs/operational-clarity/reference/APPROVED_REFERENCE.html`

That reference represents the **layout hierarchy, density, composer pattern, Executive information hierarchy, Create menu, Room file treatment and Search result structure**.

Illustrative names, counts and values in the reference are not product truth and must never be fabricated.

Where the live system lacks data shown in the reference, preserve truth instead of inventing it.

---

## Protected areas

This programme must preserve all accepted:

- RLS and authentication/session security;
- employee roster;
- protected HR;
- Payroll preparation/approval separation;
- Leave Manager → Administration final approval;
- Work Engine authority;
- project close integrity;
- Finance authority;
- audit trails;
- integration foundations;
- multi-currency rules.

Any change to those areas requires a specific product reason and acceptance evidence.

---

## Continuous execution rule for the future implementation writer

Once this next phase legitimately starts, do not stop merely because:

- a commit was pushed;
- CI started;
- a gate started or passed;
- a substage finished;
- documentation was updated.

Continue to the next safe substage.

Stop only for:

- active writer conflict;
- genuine security ambiguity;
- destructive owner decision;
- indispensable missing access/credential;
- unresolved owner policy that blocks the current substage and leaves no other safe work.
