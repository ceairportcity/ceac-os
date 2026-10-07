# CEAC OS — S1 Isolated Browser MFA / Account Security

Date: 7 October 2026  
Status: IMPLEMENTED ON ISOLATED SECURITY BRANCH; FINAL WORKSPACE GATE DEFERRED

## Scope implemented

This tranche deliberately avoids the active Phase 5 shared surfaces and the active S3 `src/lib/supabase.js` change.

It adds:

- self-only TOTP enrollment and management inside Account Security;
- current-session AAL2 step-up before verified-factor changes;
- reusable TOTP challenge and MFA-required screens;
- browser-policy tests that retain the corrected privileged population: Admin, Executive, Unit Manager, work-lane/Sub-team lead, and active capability holder;
- replacement-before-removal for the last verified authenticator on every account, avoiding browser-side privilege guesses for destructive factor removal.

The implementation uses Supabase Auth MFA APIs only. No service-role credential, MFA secret persistence, organisation-table RLS bypass, or new SECURITY DEFINER function is introduced.

## Deliberately not wired yet

The privileged workspace gate is not wired through `src/App.jsx` while Phase 5 PR #136 owns that shared surface.

Current main also has no browser-callable, self-safe contract that exposes `organisations.privileged_mfa_required`. The database helper `app_privileged_aal_allowed()` is intentionally internal and authenticated EXECUTE is revoked.

Therefore this branch does not guess the switch, does not weaken organisation RLS, and does not add another SECURITY DEFINER function while the S2 ceiling is 132.

## Remaining S1 closure

After S3 migration ordering is resolved and Phase 5 releases the shared App surface:

1. add or reconcile a narrow self-security-status contract without increasing privileged exposure casually;
2. resolve active work-lane leadership in the same canonical security context for the privileged workspace gate;
3. wire `decideMfaAccess()` before privileged workspace rendering;
4. use the reusable challenge / required screens here;
5. keep `privileged_mfa_required` OFF until real privileged enrollment and go-live acceptance are complete;
6. re-run exact-head browser, SQL authority, Account Security, Migration Replay and Quality Gate coverage.
