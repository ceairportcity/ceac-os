# CEAC OS — Go-live authenticated SECURITY DEFINER reconciliation

**Date:** 10 October 2026
**Scope:** draft release-integration PR #27 only; not production authorisation.

## Evidence and cause

The Phase 6C attendance review approved 136 browser-callable `public` SECURITY DEFINER functions, with an explicit 136-signature allowlist and separate actor/organisation, RLS, fixed-search-path and MFA checks.

The later go-live annual leave migration `20261007180500_go_live_annual_leave_policy.sql` deliberately defines `public.workforce_request_leave(text,date,date,text)` as a **SECURITY INVOKER** wrapper. It delegates to `private.workforce_request_leave_impl(text,date,date,text)`, a SECURITY DEFINER function deliberately held in the unexposed `private` schema. The public wrapper grants execution to `authenticated` and `service_role`, but not `anon`. This retains the public product RPC without a directly callable public definer.

This reduces the approved authenticated public-definer surface by **one**, from 136 to **135**, without removing a staff leave action or adding an authority bypass. The exact-signature allowlist in `supabase/tests/security_definer_surface_gate.sql` already requires 135 signatures, with `workforce_request_leave` removed from the **definer** list but still available as an invoker facade. Comparing the Phase 6 and go-live allowlists confirms this is the sole difference.

The independent SQL/RLS Quality Gate replay on the combined migration-parity release candidate measured **135** callable public definers, confirming the smaller surface. The older Platform Kernel and MFA security tests still expected 136 and failed before the exact 135 allowlist ran.

## Corrective action

- Align `platform_kernel_gate.sql` to require **exactly 135** and retain no-anonymous-definer, fixed-search-path, authority and RLS invariants.
- Align `privileged_mfa_aal2_gate.sql` to require **exactly 135** while preserving all real AAL2 verified-factor and role-boundary tests.
- Tighten `admin_hr_security_gate.sql` upper bound to **135**.
- **Do not change** the previously reviewed 135 exact-signature allowlist, grants, SQL migration bodies or privileged function implementations.
- Keep the earlier 136 Phase 6C review as valid historical evidence for that earlier product stage. This memo documents the later go-live delta only.

## Release conditions

Required: passing exact-head CI, Migration Replay, Account Security, SQL/RLS and browser acceptance on PR #27, migration parity with production, protected main and separately authorised Vercel cutover. Production database migration and deployment remain unapproved. No live Supabase database changes are part of this review.
