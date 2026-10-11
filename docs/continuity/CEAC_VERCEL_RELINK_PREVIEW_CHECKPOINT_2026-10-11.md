# CEAC existing-project Vercel relink — preview smoke checkpoint

Date: 2026-10-11. Source: private draft PR #43, preflight SHA `fc2e26867a57257bbade8a27caa7d8b5fc286210`.

- Existing project ID: `prj_bAv4ggX6umjp54UjjLqqGm7bBcIB`. **No new project.**
- Vercel connection now independently lists project `ceac-os`, old production deployment and Git-triggered non-main preview attempts from private `ceairportcity/ceac-os`.
- Baseline production deployment `dpl_2P6xxmtxYM2zFRzRoU2ZbnbFw54f` is **READY** at canonical `main` `827fbe7391467dd13d6e411527416402a252993c` (old namespace attribution is historic, not an instruction to reconnect old repo).
- Non-main preview commits are normally intentionally **CANCELED** by `vercel.json` / `scripts/vercel/ignore-build.mjs`, which returns 0 unless the commit message contains the reviewed `[vercel]` tag.
- This document is a bounded **preview build only** checkpoint. Its commit message explicitly opts in to the existing preview pipeline once. This is NOT a production release, test-suite acceptance, database migration, backup drill, MFA activation, or owner merge authorisation.
- Follow-up evidence must include exact preview deployment ID, build READY/ERROR and matched Git SHA; all other security, recovery and privacy gates remain mandatory.

## October 11 authentication-preview migration compatibility checkpoint

The product owner reported that the draft-preview login displayed `column capability_grants.expires_at does not exist`.
Read-only production SQL verified the original production table still has no `expires_at`; Security S3 `20261007083250_118_capability_delegation_expiry.sql` remains unapproved/unapplied.
The unchanged production Vercel deployment `827fbe7391467dd13d6e411527416402a252993c` does not query that field.

Candidate-only fix introduced `src/lib/capabilitySchemaCompatibility.js`:
- exact missing-column SQL error (`42703`, `capability_grants.expires_at`) is recognised;
- account identity can load but `capability_grants` and `capabilities` become empty (fail closed, not unexpired by assumption);
- visible in-app warning states that delegated functions in the preview are unavailable until independently approved migration;
- unrelated failures continue to throw; unchanged database/RLS and MFA code.
The five exact-source isolated regression callbacks all pass in the available JavaScript harness; Node suite/real-user authentication is still outstanding.
The existing Vercel preview opt-in is being exercised again for one isolated preproduction build. This is not a release or authorisation to migrate live SQL.
