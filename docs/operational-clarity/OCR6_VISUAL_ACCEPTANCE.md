# CEAC OS — OCR6D Side-by-Side Visual Acceptance

Date: 2026-10-04
Status: **PASS — FINAL CANDIDATE, SUBJECT TO EXACT-HEAD GATES**

Binding reference:
`docs/operational-clarity/reference/APPROVED_REFERENCE.html`

Supporting CEAC visual authority:
- `docs/visual-fidelity/references/CEAC_original_premium_mockup_reference.jpg`
- `docs/visual-fidelity/VISUAL_FIDELITY_CONTRACT.md`
- `docs/visual-fidelity/REFERENCE_MANIFEST.md`

Implementation evidence:
- OCR5 accepted exact head `f4f9bc0233c075e8f3cedf9189003eb9fcc37d44`;
- Quality Gate #1876 full visual/browser acceptance: PASS;
- full desktop route inventory plus mobile route sweep in `tests/visual-parity-all-pages.spec.js`;
- role/family responsive matrices including 320–430px phones, tablet/small-laptop, exact 1366×768 laptop and 1440×900+ desktop;
- visual regression and shared-surface fidelity tests.

OCR6B changes only the destination chosen by Executive **Create → Message room**. OCR6C is acceptance coverage. Neither changes the accepted design language, so the OCR5 exact-head route evidence remains visually representative while the final OCR6 exact head must rerun the complete gate.

## Side-by-side acceptance

### 1. Shell and command layer — PASS

Reference:
- dark persistent role rail;
- clear active destination;
- Search CEAC command layer;
- primary Create action.

Implementation:
- all four desktop role shells retain the dark navigation rail and one blue active/action hierarchy;
- Search CEAC and Create remain first-class top-level commands;
- mobile replaces the desktop rail with deliberate mobile navigation rather than compressing it.

No literal reference data or brand imitation is required for acceptance.

### 2. Opening hierarchy — PASS

Reference:
- leadership greeting/context;
- attention first;
- ministry direction;
- recent activity;
- upcoming meetings.

Implementation:
- Executive Overview opens with **Needs your attention** before supporting ministry, delivery, organisation, finance and meeting context;
- Administration opens with **Needs Administration** before People/HR, Time & Leave, Payroll, Finance/reporting and organisation setup;
- Manager and Staff retain their accepted role-specific first-action hierarchy.

The implementation uses recorded fixture data and truthful empty states instead of copying the reference's illustrative counts.

### 3. Composer pattern — PASS

Reference:
- compact right-side creation surface;
- required Work fields first;
- attachments and deeper detail secondary;
- one clear primary action.

Implementation:
- the shared Composer is capped at 32.5rem on desktop and becomes full-screen on mobile;
- Give out work keeps what / why / who / when primary;
- source files, instructions, finished result and deeper context remain progressive;
- Ministry Objective and Announcement creation use the same compact Composer grammar;
- Lifecycle, Authority and Policy mutations also use the accepted Composer pattern where appropriate.

### 4. Executive clarity — PASS

Reference:
- Ministry is prominent without becoming a statistical scorecard;
- leadership sees exceptions and decisions rather than operational clutter;
- Create exposes leadership-authorised actions.

Implementation:
- Ministry Direction → Ministry Objective → Unit Objective hierarchy remains factual;
- descriptive objectives do not receive invented percentages;
- Executive Create exposes Give out work, Ministry objective, Announcement, Meeting and Message room only where authorised;
- OCR6B now makes Message room deliberate: the Executive enters the organisational Unit/Sub-team directory before choosing a conversation.

### 5. People directory and employee workspace — PASS

Reference:
- Directory / Organisation / Needs attention;
- compact employee rows/cards;
- employee master-detail workspace with concise tabs;
- photos where authorised, initials otherwise.

Implementation:
- People exposes Directory, Organisation and Needs attention;
- employee workspace separates Overview, Employment, Work, Time & Leave, protected HR where authorised, Documents and History;
- roster-only employees remain first-class employee records;
- uploaded employee photos and private documents preserve their separate access boundaries.

### 6. Rooms, Files and Media — PASS

Reference:
- named organisational Room;
- file/media attachments visible in the conversation;
- no requirement for unrestricted private chat.

Implementation:
- Messages uses the shared segmented Queue grammar;
- Executive organisational Room discovery is Unit/Sub-team based;
- direct-message Room kinds remain prohibited;
- Work source files, Project Files, Announcement attachments and Room media use private operational storage and signed access;
- file/media affordances remain visible without weakening RLS.

### 7. Search CEAC — PASS

Reference:
- grouped results across actions, announcements, rooms, work and files;
- direct record opening.

Implementation:
- permission-aware groups cover actions/destinations, Work, Projects, Ministry, People, Organisation, Meetings, Announcements, Rooms and operational Files;
- OCR6C completes opening coverage for project, work, person, announcement and signed private file results;
- search remains inside the signed-in Supabase/RLS context.

### 8. Responsive composition — PASS

Reference:
- desktop three-zone composition where space permits;
- mobile collapses to one deliberate priority column.

Implementation:
- whole-system route sweep covers desktop and 390px mobile for every role route;
- denser family tests cover the 320–430px phone band;
- tablet/small-laptop, 1366×768 and 1440×900+ acceptance remain explicit;
- accepted routes prohibit page-level horizontal overflow.

## Intentional differences from illustrative reference

The approved HTML is a composition and interaction target, not a data-authority document. The implementation intentionally does **not** copy:
- illustrative counts such as 12 attention items or 18 departments;
- invented Ministry progress or risk scores;
- invented budgets, balances, payroll facts or schedule records;
- unrestricted Room/DM access;
- employee facts that are absent from the database.

Truthful recorded data, RLS, role/capability authority, payroll separation of duties and leave rules take precedence over literal visual imitation.

## OCR6D result

**REFERENCE COMPONENT PARITY: YES**  
**RESPONSIVE ACCEPTANCE: YES**  
**PLAIN-LANGUAGE / CLARITY ACCEPTANCE: YES**  
**ACCESSIBILITY BASICS: YES**  
**FUNCTIONAL CONTRACT PRESERVED: YES**  
**SECURITY / AUTHORITY PRESERVED OR EXPLICITLY AMENDED: YES**

No additional visual redesign is required for the locked Operational Clarity scope. The containing commit must still pass the full exact-head Level B gate before protected merge.
