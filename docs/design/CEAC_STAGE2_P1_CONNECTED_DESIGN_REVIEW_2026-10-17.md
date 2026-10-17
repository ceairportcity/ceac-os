# CEAC Stage 2 P1 — connected role design review candidate

**Engineering review only, not owner sign-off and not an app release.** Source SHA will be the enclosing commit. The prototype [opens as a standalone HTML design](stage2-v4/CEAC_STAGE2_P1_CONNECTED_ROLE_REVIEW.html) and keeps the canonical white/light-blue Stage 2 V4 design's palette, density, navigation and responsive structure.

**Connected simulated flows:** Staff Overview/session and Work; Manager Work assignment, Projects, factual reporting and Team; scoped Technical Support; Administration People/HR/private ratings; Executive strategic outcomes/quarterly evidence; volunteer nonsalaried participation; provider-neutral TOTP setup/challenge/recovery. Local view switching, overlay forms and a demo attendance state are illustrative; no Supabase, Auth, privileged data, live writes, external JS or worker secrets.

**Known P1 outstanding acceptance blockers:** latest owner-approved revised Projects PNG exact binary not in verified source; incomplete full-page references for all 47 app routes and additional nested/mobile flows; no current screenshot parity or owner review of these new layouts. Do not mark P1 accepted, or attempt visible production redesign, based on this document alone. Continue extending and getting owner approval for each missing reference.

**Stage lock:** P0 inventory accepted in preceding parent commit, P1 now active. Previously implemented P2–P7 code is preserved unmodified. Actual report error state, CSS size and Staff/Executive RGB regression remain P6/P7 defects; do not relax evidence, invent employee ratings or grant new authority.

## Exact P1 review coverage and acceptance limitations — 17 October

The checked-in [connected standalone V4 review candidate](stage2-v4/CEAC_STAGE2_P1_CONNECTED_ROLE_REVIEW.html) is **runnable design source**, not a static screenshot, authenticated CEAC OS app or owner-approved literal screenshot reference. It has local-only, non-persistent interactions for role switching, work creation/give-out inspector, human rating inputs, TOTP challenge and synthetic work-session Start/End. The live application's role/capability and database permission model is *not* changed.

| Role / capability demo | Connected preview surfaces | Minimum outstanding owner-reviewed routes and states |
| --- | --- | --- |
| Staff | Personal Overview/Start-End, Work inspector, Projects, My achievements, TOTP | Entire actual Staff role navigation; Calendar, evidence attachment, dated actions, review/rework, private session and remote/field correction |
| Manager, solo and multi-unit | Overview, Give Out Work, project and Team context, Manager period report | Real selected-unit switch, dropdown search, project close/contribution assessment, report no-data/fail-closed states, quarterly human rating and cross-unit negative flows |
| Technical Support capability | Help desk, assigned cases, personal Overview/Work | Separate Support head vs team member permission, case reporter-safe projection, individual case state, reassignment collision, phone views and audit history |
| Administration/HR | People & access, protected HR review, quarterly rating, Projects read-only | Admin workforce, payroll and finance; invitation detail, employee record access, separate Compliance/HR issuance and employee response; protected form/drawer mobile |
| Executive | Overview, ministry strategy, source-linked quarterly results, read-only Projects | Distinct leadership card hierarchy, authentic reports/exports, unit coverage, verified impact, independent HR narrative exclusions and responsive views |
| Volunteer | Nonsalaried Overview and authorised Work/Projects | Volunteers register, profile, individual activity permissions, annual schedules, no payroll or work-session misclassification |
| Cross-role authentication | Invitation/password description, authenticator TOTP challenge and safe recovery explanation | Full branded sign-in, genuine AAL1 setup-only, enrol/challenge/recovery, expired-session and permission denied states, accessible small-screen references |

**Architecture and threat-boundary constraints:** Navigation is not permission. The actual implementation must separately enforce role/capability, unit/organisation scoping, authenticated identity, AAL2 only after approved cutover, Storage read/write restriction, support case privacy, HR-private evidence, employee response and sourced factual reporting. An interactive prototype cannot prove any of those. All demos use invented safe placeholders, not live employee data.

**Acceptance rule:** Explicit owner review must cover connected desktop and phone references across **all 47 root application routes and the eight nested overlay forms**, plus loading/empty/error states and print where applicable. The exact newer owner-approved Projects PNG is still missing from verified assets, so no superseded bitmap may be promoted. Do not claim P1 complete or quietly rebaseline approved RGB <=6/CSS limits because this review candidate renders.
