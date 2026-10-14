# CEAC OS two-stage release decision — 14 October 2026

## Binding release sequence

Stage 1 uses the existing production Supabase project `efjljhftsesssumtshvp`, the existing email/password authentication path, and the current private GitHub/Vercel infrastructure.

Stage 2 moves to the already-created CE Airport City-owned Supabase project and introduces Google OAuth with universal TOTP/AAL2 only after a separately verified release.

This decision supersedes the earlier requirement to include Google OAuth in Stage 1. It does not waive privileged MFA, privacy, RLS, recovery, backup, role-access, or functional acceptance requirements.

## Repository guardrails

- Preserve the Google OAuth, universal AAL2, and migration implementation for Stage 2.
- Do not apply `20261012172718_google_oauth_aal2_enforcement.sql` to the original production project for Stage 1.
- Do not merge or deploy Stage 1 without explicit product-owner GO.
- Do not treat rollback-only migration checks as restored-data acceptance.
- Stage 1 must target the 119-migration production schema unless a separately rehearsed, reviewed, and approved non-Google migration set is later authorised.
