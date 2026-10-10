# CEAC Guide — Product & Adoption Lock

Date: 7 October 2026
Status: OWNER-LOCKED / PRE-RESTORATION IMPLEMENTED / ACCEPTANCE PENDING

## Purpose

CEAC Guide is a permanent in-product operating guide, not a generic FAQ. Its purpose is to let Staff, Managers, Administration and the Group Pastor understand CEAC without depending on the product owner for routine explanations.

The Guide must teach the product in plain language while preserving CEAC's actual authority, privacy and workflow boundaries.

## Permanent placement

Desktop:
- left rail;
- immediately above the signed-in profile/avatar/name block;
- always available after sign-in.

Mobile:
- available under More;
- contextual page help may also open the Guide with the current area prioritised.

The Guide is not a hidden Settings-only page.

## Search and context

The Guide must:
- be searchable;
- filter content to the signed-in role experience;
- prioritise topics that relate to the page from which contextual help was opened;
- remain useful if opened directly with no page context;
- never teach a user to perform an action their role should not perform.

## Required explanation pattern

Guide content should answer, where relevant:
1. What this feature means.
2. How to use it.
3. Who can act.
4. What happens next.
5. What to do when something does not work.

Technical architecture terms should not be the default explanation.

## Required content areas

At minimum:
- Getting Started;
- Home / what needs attention;
- Work / assignments / submissions / review;
- Projects and Manager delivery;
- Calendar / working schedule;
- Attendance and Leave;
- Messages / rooms / announcements;
- My Hub / account;
- Documents and files;
- Notifications and updates;
- Finance / Payroll boundaries;
- privacy / attendance / location evidence;
- installable app / offline behavior;
- support / recovery;
- role-specific Manager, Administration and Executive guidance.

## Getting Started

Getting Started is a restrained role-specific checklist, not a gamified score.

Requirements:
- different practical steps for Staff, Manager, Administration and Executive experiences;
- visible completion progress;
- user may resume later;
- user may reset;
- user may dismiss the checklist;
- user may show it again;
- checklist completion is never employee performance evidence and never changes organisational authority.

## Versioning

Guide version is coupled to the product release/content contract. A material Guide revision increments its Guide version so stale local adoption state does not silently survive incompatible guidance.

Current implementation version:
`2026.10.07`

## Offline/cache boundary

Static Guide content:
- is non-sensitive application content;
- may travel in the same versioned JavaScript/CSS shell assets as the installable app;
- does not require business-record API caching.

Getting Started preference state is an explicitly reviewed low-risk local preference:
- scoped by signed-in profile key;
- value contains only Guide version, role, completed step IDs, dismissal state and expiry;
- 90-day maximum lifetime;
- reset on version/role mismatch or expiry;
- no Work, People, Leave, Finance, HR, Payroll, attendance, security or communication records;
- never treated as authoritative CEAC data.

Authoritative organisational actions remain online/server-authorised.

## Current implementation files

- `src/guide/guideContent.js`
- `src/guide/guide.css`
- `src/screens/Guide.jsx`
- `src/experience-v2/shell/ShellV2.jsx`
- `src/experience-v2/shell/shell.css`
- `src/experience-v2/icons.jsx`
- `src/App.jsx`
- `tests/guide-adoption.spec.js`
- `docs/resilience/CEAC_OFFLINE_DATA_CLASSIFICATION_2026-10-07.md`

## Acceptance required after GitHub restoration

Do not call the Guide accepted until the current exact head passes:
- CI/build;
- targeted/full browser tests including `guide-adoption.spec.js`;
- responsive acceptance at supported phone/laptop widths;
- visual inspection showing desktop placement above the user block and mobile placement under More;
- resilience/offline verification proving no CEAC business/API response is cached for Guide use.

No production deployment is authorised by this document alone.
