# CEAC OS Stage 1 email release preview checkpoint — 14 October 2026

This documentation-only checkpoint requests one Vercel Preview build of the
exact Stage 1 application tree at parent commit
`498b258401f5a049dc911e1386305d27377d803b`.

Verified before requesting the preview:

- Stage 1 retains the original production Supabase project and email/password
  sign-in, activation and account-recovery flows.
- The Stage 2 Google OAuth and universal AAL2 implementation remains preserved
  but is not activated by Stage 1.
- The applied privileged-only TOTP/AAL2 switch has a matching fail-closed client
  gate and remains off until real privileged users enroll and acceptance passes.
- Compatibility handling for the existing 119-migration production schema is
  exact-object allowlisted; permission, tenant, network and unrelated database
  errors still fail.
- Node 22.22.1 source verification passed 266/266 tests.
- Node 22.22.1 Vite production build passed.
- Production Supabase, GitHub main and the owner-facing production deployment
  were not changed.

This preview is for authenticated browser and role acceptance only. It grants
no approval to merge, promote, change production configuration, enable the MFA
enforcement switch, or deploy to production.
