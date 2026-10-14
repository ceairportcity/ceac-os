# CEAC OS two-stage release decision — owner amendment, 14 October 2026

## Binding owner intent and Stage 1 purpose

Stage 1 is the practical launch of CEAC OS for real staff onboarding, operational use, feedback and controlled refinement. It uses the **existing** production Supabase project `efjljhftsesssumtshvp`, the approved existing email/password sign-in, the existing private GitHub repository and the original Vercel project. The Stage 1 code candidate targets the unchanged 119-migration production schema.

The product owner explicitly clarifies that **Google Workspace/Google OAuth, universal MFA/TOTP/AAL2, and newly enforced privileged TOTP are Stage 2 implementation and acceptance work**. Stage 1 is not blocked solely because zero TOTP factors are enrolled, the existing privileged MFA enforcement switch is off, the new TOTP/AMR server helper has not been applied, or the later Google migration is unapplied. Preserve optional MFA functionality and its corrective code; do not activate new enforcement on the Stage 1 production database. Existing authentication, authorization, RLS, privacy, role separation, HR protection and session controls remain in force and may not be weakened.

This amendment supersedes the prior sentence stating that the Stage 2 deferral did not waive **privileged MFA** for Stage 1, and any derivative Stage 1 checklist demanding genuine TOTP enrollment or AAL1-denial/AAL2-allowance as a launch gate. It does **not** claim that disabled MFA has no risk: privileged-account compromise risk must be plainly disclosed and owner-accepted, with strong unique passwords, least-privilege accounts, access monitoring and immediate account disablement where supported. No fictitious security test PASS may be recorded.

## Stage 1 release closure

Reuse the existing exact-commit application build, 275 source tests, dependency audit, Vercel preview and real Staff/Manager/Admin/Executive browser acceptance when their evidence is still applicable. Verify the exact release SHA, existing password sign-in, activation/recovery, role denials and protected-data access, production environment configuration, compatibility with the unchanged 119 migrations, and an eligible rollback deployment. Do not rerun unaffected suites merely to repeat previous evidence.

Recovery remains an operational risk requiring an explicit, truthful decision: obtain the best authorised encrypted recoverable export available, inventory separately managed Auth, Storage and configuration, establish and test what can be restored without touching production, and clearly state what remains unprotected. A logical database export alone must never be called a complete recovery. If the prior complete-recovery gate cannot be satisfied, request an explicit, informed owner decision on the residual recovery risk rather than quietly marking it PASS or initiating a replacement production project.

Assess the Supabase leaked-password warning separately; enable the native protection if authorised and available. If unavailable, document the warning and compensating measures for explicit owner risk acceptance; do not falsely claim equivalent protection. Never bypass an independently confirmed critical vulnerability or disable existing security checks.

After evidence reconciliation and owner acceptance of any residual risks, obtain explicit **production promotion GO**, then merge/promote through the existing authorised GitHub/Vercel route, verify production sign-in and role journeys, and retain a tested rollback path. This document is a scope decision, **not** a production deployment authorisation.

## Stage 2 — future ownership and security cutover

Stage 2 moves the **latest live CEAC application and data** to a CE Airport City-owned Supabase project, with Google Workspace/OAuth and universal TOTP/AAL2. The prior document described that destination as already created; its existence, ownership, project ID, access and readiness must be verified rather than assumed. Create it only if needed and separately authorised.

Preserve all approved Stage 2 code, SQL and acceptance work without applying it to Stage 1. Track every intervening production schema, data, Auth, Storage, RLS and application change so the eventual cutover includes post-launch operational improvements. Rehearse complete migration, identity mapping, recovery and role security on an isolated target; switch production only after independent acceptance and explicit owner approval.

## Permanent guardrails

- Do not apply `20261012172718_google_oauth_aal2_enforcement.sql` or other Stage 2 migrations to Stage 1 production.
- Preserve the original production database, Auth identities, private repository, original Vercel project and live data.
- Do not represent a rollback-only SQL test as an isolated data restore.
- Keep Stage 1 feature limitations truthful, including unapplied Volunteer/Technical Support schema.
- No production merge, migration, authentication mutation, MFA switch or domain promotion without explicit release authorisation.
- Reconcile earlier release checklists and PR #63 descriptions to this owner clarification without erasing historical findings or claiming tests that were not performed.
