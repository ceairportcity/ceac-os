# CEAC resilience programme build state

Date: 7 October 2026
Branch: `chatgpt/ceac-resilience-pwa-dr-2026-10-07`
Base: Executive redesign `6ea900c3c869dbddbd30e824b8286fce75eb53f8`
Status: IMPLEMENTED AND SOURCE-VERIFIED / NOT PROTECTED-MAIN ACCEPTED / NOT LIVE-VERIFIED

## Scope

- R1 installable PWA: implemented and verified against a production build with Chromium; live production install verification pending.
- R2 deny-by-default offline mode: implemented in source; app shell only, no business/API cache and no general mutation queue.
- R3 recovery release: implemented; exact-SHA manifest, Git bundle, checksums, secret exclusions and deterministic archive metadata verified locally.
- R4 provider-neutral standby: implemented in source; isolated external deployment not yet authorised/created.

## Canonical implementation

- Programme commit: `2058e70cb6a492f14c42673a108f96807a95cb67`.
- Pull request: `#149`, stacked on the Executive redesign branch.
- GitHub returned no workflow runs or commit statuses for the programme commit while the account restriction remains active.
- Vercel project `ceac-os` was resolved read-only, but deployment inspection returned `403 forbidden` for the owning team scope. No authenticated Vercel CLI fallback is available in the execution environment. An isolated standby preview therefore remains pending external Vercel authorization; no new project, production deployment, domain or DNS change was attempted.
- Independent offsite backup placement remains pending selection/authorization of approved encrypted storage. The history-preserving mirror/bundle tool and restore test procedure are implemented.

## Source verification

- `npm ci`: passed (verification workspace used Node 24; the repository and recovery metadata require Node 22 for acceptance/reproduction).
- `npm run resilience:verify`: passed.
- `npm run build`: passed.
- `npx playwright test tests/resilience-pwa-dr.spec.js --reporter=line`: 6 passed, including Chromium offline reload and 390px mobile overflow coverage.
- Recovery release generation and `sha256sum -c CHECKSUMS.sha256`: passed.
- Provider-neutral standby package generation: passed.
- `git diff --check`: passed.

Generated test artifacts are local evidence only and are not committed.

## Parallel security boundary

Security PRs #138, #142, #143, #144, #146 and #148 remain independent. This branch contains no migration, RLS, MFA, protected-HR, attendance-authority or capability-delegation change.

## Acceptance boundary

Do not describe this programme as protected-main accepted or live verified until the exact branch head has passed the repository gates, the product branch lineage is reconciled, and an authorised installed/live test is recorded.
