# CEAC OS — OWNER-ORDERED RELEASE SCOPE FREEZE
**Effective: 12 October 2026. Status: binding project-owner instruction for all CEAC development and release sessions.**

**Candidate anchor:** private `ceairportcity/ceac-os`, unified PR #50. Base when freeze was recorded: `37a44ad3f7eacb29e9dee843010627ac814e5666`. Before any write refresh the actual HEAD and the active continuation PRs. Do not regress or overwrite concurrent work.

## Immediate stop rule
STOP proposing or implementing new features, aesthetic redesigns, enhancements, alternative platforms, tools, migrations or exploratory refactors merely because an opportunity exists. No new paid hosting, Vercel project, Supabase fixture purchase, CircleCI/GitLab/TinyFish, public-repo workaround, extra PR stack, or restart.

**Allowed from this moment:**
1. Integrate or reject existing, documented, launch-essential fixes already in flight (especially PR #52), after review; avoid duplicate implementation and preserve approved scope.
2. Repair a reproducible, specific blocker against a locked release requirement (broken approved function, security vulnerability, privacy/role breach, migration failure, genuine authenticated journey or recoverability failure). Each must state the requirement, reproduced evidence, minimal diff, test, and affected SHA before editing.
3. Finish mandatory release acceptance: exact-SHA build/source tests, isolated SQL/RLS checks, authenticated role/browser journeys, genuine backup plus isolated Auth/Storage-aware restore, real MFA and invitations, owner visual comparison, independent review, explicitly authorised safe cutover.
4. Document execution evidence/decisions or improve verification tooling **only** when necessary to execute a named blocked mandatory gate. Prefer already proven local PostgreSQL procedures, and reuse existing setup.
5. Essential access/approval safety work already approved by product owner, not new workflow invention.

**Not allowed:** opportunistic UX polish, performance tuning without measured blocking failure, new Phase 7 scope, new frameworks, extra vendor research loops, changing historical migrations, mass security refactoring, expanding tests indefinitely without mapping them to specific release acceptance criteria, fictional PASS claims, and changing live production without GO approval.

## Finite release ledger and stop criteria
Every mandatory gate is one ledger item. Mark PASS only with exact tested SHA, command/action, timestamp, actual output/exit code/evidence. Mark FAIL with reproducible defect; BLOCKED with exact missing prerequisite and next no-cost action; NOT RUN when unexecuted. Owner visual signoff and real-user MFA/auth cannot be inferred from source checks.

Mandatory ledger:
- A. Review existing PR #52 and any pre-existing urgent continuation; reconcile only essential fixes onto PR #50 with independent review.
- B. Freeze application/security SHA; no unrelated writes. Re-run final exact-head clean Node source suite/build.
- C. Re-run ordered isolation migrations and the registered SQL/security gates for final exact SHA, including Support authorisation.
- D. Obtain genuine Git checkout/ancestry and execute missing resilience recovery tests; do not fake Git metadata.
- E. Run real authenticated multi-role browser and Support/invitation/storage journeys in an approved isolated fixture; use zero-cost local Supabase-compatible environment if viable. No production-as-test.
- F. Securely export and actually restore production-dependent data including supported Auth/Storage recovery coverage, only in an authorised private environment.
- G. Real authorised privileged MFA/AAL2 and invitation delivery; owner-approved literal Admin/Executive/Staff/Manager/Volunteer/Support desktop/mobile visual comparisons.
- H. Independent final reviewer signs tested exact SHA; owner authorises explicit GO; normal main integration, controlled production migrations and existing Vercel project deployment; post-release production smoke and handover.

Do NOT call the release ready before A–H have genuinely passed. Do not create arbitrary completion percentages or delivery-date guesses.

## Tool/time discipline
Each working session must:
1. Read this freeze and current GitHub candidate/PR evidence before work.
2. Select the **single highest-priority resolvable blocker**, execute it, verify and mark outcome; continue the next finite gate.
3. If a needed capability is missing, document it ONCE with actual error and stop repeating attempts. Continue independent work. Ask the owner only for a specific indispensable action/permission or final GO.
4. Make minimal changes on an isolated branch if another session owns PR #50. One writer per branch. Work and Chat must not race or overwrite.
5. Persist concise final-state evidence and next specific action in `docs/continuity/CEAC_LIVE_HANDOVER.md` and PR #50 before session ends; keep this freeze available to every session.

## Enforcement boundary
This file and PR comments are owner instructions and review conditions, **not automated GitHub branch protection**. If Actions/private branch protections are unavailable, do not claim a technical prohibition on commits; manually reject out-of-scope PRs and never merge them. Existing main, Vercel production and Supabase production remain untouched until explicitly authorised release.

**Definition of success:** close the approved release, not continually expand CEAC.
