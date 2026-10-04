# CEAC OS — Operational Clarity & Collaboration Refinement Lock v1

Status: **LOCKED — NEXT PHASE / DO NOT IMPLEMENT YET**  
Locked: 2026-10-04  
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

# 6. Cross-role Form and Action Sweep

After the core composer exists, perform a **targeted** cross-role sweep across Manager, Administration and Executive.

Correct only genuine instances of:

- excessively long creation forms;
- hidden primary actions;
- repeated helper text that overwhelms the task;
- unnecessary full-width controls;
- duplicate navigation;
- system/database language exposed to ordinary users;
- excessive scrolling on mobile.

This is **not** permission to redesign every screen again.

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
