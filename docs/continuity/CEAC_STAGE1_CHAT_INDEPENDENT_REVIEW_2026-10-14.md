# CEAC Stage 1 — Independent Chat Source/Database Review (14 October 2026)

**Review anchor:** draft PR #63, commit `f01633cf865350fdf9fc0054cb2075aa66d69d9a` (Stage 1 email/password candidate). This report accompanies an **isolated, not-yet-integrated** privileged-TOTP policy fix. Not a release GO. No credentials, PII, main, production migrations, Auth settings or deployment were changed.

## Findings resolved in the review branch

**S1-MFA-01: AAL2 alone was allowed without the required TOTP method.** In `src/lib/mfaPolicy.js`, `decideMfaAccess` returned `allow` immediately for `currentLevel === 'aal2'`, before inspecting verified TOTP factors. A phone/WebAuthn-only AAL2 session therefore satisfied the Stage 1 privileged client gate despite its TOTP requirement when the organisation enforcement switch was on. This is a client policy gap; database enforcement semantics must independently be confirmed, and a source check is not a real browser acceptance.

**Fix:** when `privileged && enforcementEnabled`, require a verified TOTP factor *before* recognising AAL2 as sufficient. Keep the prior optional-MFA behaviour while the switch is off and preserve ordinary-user behaviour. A verified unsupported factor remains blocked rather than silently substituted. Added three regression tests to `tests/mfa-foundation.test.mjs`.

**Local focused evaluation:** executed the exact new `src/lib/mfaPolicy.js` GitHub blob in a JavaScript isolate and checked six cases: privileged phone-only AAL2 denied; privileged AAL2 with unverified TOTP requires enrollment; privileged AAL2 with verified TOTP allowed; disabled switch behaviour preserved; ordinary role unaffected; privileged AAL1 + verified TOTP requires challenge. **6/6 PASS** at reviewed policy blob. This does **not** replace `npm run verify:source`, `npm run build` or real authenticated MFA testing after integration.

## Read-only live database findings (14 Oct 2026, approximately 10:00 UTC)

Original production Supabase project: `efjljhftsesssumtshvp`. Status ACTIVE_HEALTHY, 119 applied migrations; last `20261007075418`. Current Stage 1 deliberately does not apply its 25 pending candidate migrations.

| Gate | Result / limitation |
| --- | --- |
| RLS table inventory | All 161 `public` ordinary tables and 10 `hr_private` ordinary tables have RLS enabled. Presence of RLS does not prove every individual policy's correctness. |
| Protected-HR direct SELECT grants | 0 of the 10 `hr_private` tables expose direct SELECT grants to `anon` or `authenticated`. |
| SECURITY DEFINER exposure | 0 anonymous-callable definer functions in inspected `public`/`hr_private`; 132 signed-in-callable functions. All 132 exposed `public` functions have an explicit function search_path. Caller/tenant/authority guard semantics still require source, SQL and authenticated role testing. |
| Supabase Auth/role population | 9 Auth users, 9 active profiles, 1 admin, 1 executive, 3 manager memberships; **0 verified MFA factors, 0 organisations with privileged enforcement enabled**. Source-only proof cannot satisfy real AAL1-denial/AAL2-allow, and no switch may be enabled without tested enrollment and owner approval. |
| Supabase Security Advisor | `rls_enabled_no_policy` INFO (12 tables; check intentional deny-only purpose); `authenticated_security_definer_function_executable` WARN (132; each must guard authority); `auth_leaked_password_protection` WARN (1; remains unresolved/compensating decision required). |

References to Supabase advisor explanations:
- <https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy>
- <https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable>
- <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>

## GitHub/preview evidence and limitations

- PR #63 is **draft, unmerged**, at the above SHA. Its Vercel preview built successfully (`dpl_BgAnNKScLjQKBjUNWYdiZr1Jm4r8`).
- PR #63 self-reports 268/268 Node 22.22.1 source checks and a passing Vite production build for its exact SHA. Those checks have not yet been rerun against this isolated policy fix.
- GitHub Actions **CI**, **Account Security**, **Migration Replay**, **Quality Gate** all report `failure` for PR #63. The CI run's job detail exposed no step results; do not infer an application regression or claim an Actions PASS without usable logs or an equivalent approved independent gate.
- The changed Stage 1 source has targeted fail-closed missing-object compatibility for planning, annual leave, attendance corroboration, volunteer/Support workflows. `support_cases` absent on original production; do not claim those newer flows are live. `Stage 1` source tests inspect fallback paths; authenticated role/browser evidence still missing.
- Owner's longer-lived Stage 2 carry-forward obligation is in draft docs PR #62, **not yet in protected main**; reconcile without overwriting PR #63 and continue maintaining the ledger after each Stage 1 production change.

## Remaining mandatory release acceptance — exact statuses

1. **PASS (prior candidate only):** source suite (268), Vite build, preview shell/browser unauthenticated paths on PR #63 commit `f01633cf...`; after selecting this patch rerun all affected source/build checks on exact merged result.
2. **PASS (read-only only):** original project healthy, unchanged migration ledger, basic RLS table/grant inventory and scoped definer configuration. Not semantic role acceptance.
3. **BLOCKED:** Staff, Manager, Admin/HR, Executive **real-user authenticated** preview journeys and role denial/access, including original password recovery/invite.
4. **BLOCKED:** actual privileged-user TOTP enrollment; verify both denied AAL1 and accepted AAL2 using real approved test identities before enabling existing organisation switch. No user Auth factor may be fabricated.
5. **BLOCKED:** encrypted, usable recoverable export and **actual isolated restore** that accounts for managed Auth/Storage, not just rollback-only SQL. Owner-approved safe method and access required.
6. **BLOCKED:** leaked-password-protection warning resolution through appropriately authorised Supabase settings or explicitly owner-reviewed compensating controls. Do not silently disable security.
7. **BLOCKED by missing unapplied schema:** new Volunteer and Technical Support workflows, personal planning, leave working-day calculations, attendance corroboration/office-code signals — Stage 1 notices/fail-closed scope only. Do not present those as operational.
8. **PENDING:** independent final branch/PR review, reconcile Stage 2 first-read docs PR #62 and Stage 1 source PR #63, current exact-SHA release integration, owner review and explicit production GO. No PR merging or Vercel promotion performed.

### Work handoff (do not redo completed work)

Reconcile the **two-file** TOTP policy fix and its focused tests from the isolated review PR into PR #63 after independent code review; run Stage 1's registered Node source/build tests on that exact integrated HEAD. Do not reactivate the old Google-only first-release gate. Carry PR #62's binding two-stage product/architecture continuity into the normal first read, with attention to post-launch live-data preservation. Then concentrate Work on the genuinely unavailable Auth/Storage backup restore, real identity/MFA and multi-role browser acceptance, leaked-password decision and final owner GO. Do not rerun 25 rollback-only SQL transactions merely to reproduce recorded results; Stage 1 targets the existing 119-migration schema unless separately authorised.
