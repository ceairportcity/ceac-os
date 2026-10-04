# CEAC OS — OCR6 Final Acceptance Matrix

Date: 2026-10-04
Status: **FINAL CLOSURE IN PROGRESS**

OCR5 accepted exact head: `f4f9bc0233c075e8f3cedf9189003eb9fcc37d44`.

This matrix maps the locked OCR6 requirements to existing authoritative evidence plus the final focused workflow corrections. It does not weaken any security, data or role contract.

## OCR6A — Responsive acceptance

Authoritative coverage:
- `tests/visual-parity-all-pages.spec.js` — complete desktop route inventory and 390px mobile route sweep for Staff, Manager, Administration and Executive.
- `tests/visual-fidelity-responsive-closure.spec.js` — 320–430px phones, 768–1024 tablet/small-laptop, exact 1366×768 laptop and 1440×900+ desktop matrices.
- family-specific responsive tests remain authoritative for dense Work, Finance, Workforce, People, Calendar and Executive surfaces.

Pre-closure evidence from OCR5 exact head:
- all four Level B browser shards passed;
- no route-level horizontal overflow was reported;
- OCR5 route archetype sweep passed across all four roles.

Final OCR6 exact head must pass the same gates again.

## OCR6B — Security / authority acceptance

Authoritative SQL/RLS evidence:
- `scripts/ci/run-sql-security-gates.sh`;
- `supabase/tests/operational_clarity_files_gate.sql`;
- account-security workflow;
- complete Level B SQL/authority suite.

Locked assertions:
- `ceac-operational-private` stays private;
- protected HR storage stays private and separate;
- operational file RPCs are not anonymous;
- unrelated users cannot read another project file;
- authorised project participants can read permitted project files;
- employee document visibility remains Administration-bound;
- direct-message / DM Room kinds remain prohibited;
- Executive may access active Unit and Sub-team Rooms;
- Executive does not receive blanket Project Room access;
- explicitly contextual Project Room access remains possible;
- Global Search executes through the signed-in Supabase session and therefore inherits RLS;
- announcement creation/publishing remains role/capability-authorised.

Final product correction:
- Executive **Create → Message room** must open the organisational Rooms directory so the Executive deliberately chooses an authorised Unit/Sub-team rather than silently entering the Executive fixture's own Unit Room.

## OCR6C — Workflow acceptance

Required corridor and authoritative tests:

1. Create work → attach file → assign → open.
   - final acceptance extends `tests/acceptance-core.spec.js` to attach a private source file and prove the assigned Staff account can open the Work record and see it.

2. Project → upload file → find in Files → search.
   - `tests/experience-v2-shell.spec.js` already opens Stage 4 Browser Project, uploads a private Project file and finds it through permission-aware Search;
   - final acceptance also opens the signed file result.

3. Room → share media → authorised recipient opens.
   - final acceptance extends the existing Manager/Staff Unit Room journey with private image media.

4. Executive → Create → Announcement → publish.
   - final acceptance publishes a real fixture announcement through the authorised Executive Composer.

5. Executive → Message → choose authorised department/sub-team → communicate.
   - final acceptance enters the organisational Room directory from Create, chooses Fixture Video Team and sends a message.

6. Executive → create Ministry Objective via compact Composer.
   - final acceptance creates an attributable Ministry Direction parent, then opens the Executive Create action and records a Ministry Objective through the compact Composer.

7. Search → open project/work/person/announcement/file.
   - Project and Work open from the accepted OCR4 grouped-search test.
   - final acceptance extends People, Announcement and private File results to open their authorised records.

## OCR6D — Side-by-side visual acceptance

Binding reference:
`docs/operational-clarity/reference/APPROVED_REFERENCE.html`

Comparison dimensions:
- dark persistent role rail and blue active/action hierarchy;
- Search CEAC + Create command layer;
- decision/attention-first opening hierarchy;
- compact factual cards and queues;
- compact right-side Composer behaviour;
- Executive ministry/organisation clarity;
- People directory + employee workspace;
- organisational Room selection and communication;
- private Files/Media affordances;
- Search result grouping;
- deliberate responsive reflow rather than desktop compression.

Illustrative reference numbers/content are not data authority. Current real fixture data, truthful empty states and security boundaries outrank decorative literal copying.

## OCR6E — Merge and post-merge verification

Merge only through protected-main rules after the final OCR6 exact head is fully green. After merge:
- fetch protected main;
- confirm the merge commit contains the final OCR6 implementation;
- verify protected-main required checks;
- report any external deployment/authentication limitation separately from application defects.
