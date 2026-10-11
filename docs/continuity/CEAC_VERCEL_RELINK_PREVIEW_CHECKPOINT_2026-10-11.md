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

## Admin visual report and capability-authority preview restoration

Owner confirmed the prior preview could sign in, but still looked like the old Administration panel. Source comparison shows the Administration home component is unchanged from the Phase 5 candidate; the visual owner-acceptance claim is **NOT** established. The original preview compatibility path also denied all capability menus on the absent capability_grants.expires_at column, hiding the Phase 5 People & Access destination even for properly authorised Admin.

The database's current public.app_has_capability(text,uuid) RPC is authenticated-executable and anon-inaccessible, and independently checks current identity, privilege assurance, revocation, and organisation/scope. With S3 uninstalled this is the current production authorisation semantics. Instead of inventing expiry information or bypassing RLS, the pre-S3 preview now reads only the signed-in person's unrevoked legacy grants and requires this existing server authoriser to approve each grant/scope. An RPC error anywhere empties all delegated capabilities. The implementation never creates or extends authority. Current production contains active Admin grants including people.manage (aggregate existence checked, no identities accessed), so the permission-backed People & Access navigation should reappear on the next preview.

Five new server-validation cases plus five earlier narrow mismatch tests passed in isolated JS exact-source harness (10/10). **No browser login was automated; owner must verify the actual route.** Admin Overview itself retains much of its prior appearance; separate literal owner-design comparison is still required. Do not mark Phase 5 visually accepted from this fix.

This tagged commit triggers **one** preproduction build from the existing private CEAC project to confirm the candidate compiles. Production main/database remain unchanged.

## Screenshots 05:16–05:19 — People detail and Office Settings pending Phase 6

User supplied authenticated Admin screenshots confirming the complete People & Access directory renders, with an employee-detail error, and Organisation settings renders with an attendance-integrity error. Full Administration Overview layout remains pending owner visual acceptance.

**Read-only Supabase proof:** current production has public.admin_employee_roster_detail(uuid), admin_person_detail(uuid), admin_employment_detail(uuid), and admin_access_invitations(). It does **not** have public.volunteer_change_recommendations (Phase 6 pending migration) or public.attendance_integrity_status() (Phase 6 attendance-integrity pending migration). Existing main production remains at its prior 119 migrations; no speculative migration may be applied.

On draft release candidate only:
- People employee detail treats ONLY exact missing relation errors (42P01/PGRST205) for public.volunteer_change_recommendations as **unavailable**. Existing employee detail RPCs, employment history, protected HR and file authority remain mandatory; no other error is silently swallowed. Employee workspace explains recommendation history/decisions are pending.
- Office Settings treats ONLY exact missing function errors (42883/PGRST202) for attendance_integrity_status() as **unavailable**. Existing office, leave-policy, thresholds, invitations continue loading. Presence-code creation/rotation is disabled and the missing feature is clearly identified. Auth errors and other RPC errors remain fatal.
- Six narrow security-and-compatibility test callbacks passed against exact canonical GitHub files in isolated V8. Not a substitute for real-user browser acceptance or SQL tests.

This document-only [vercel] commit requests **one build** of the exact candidate preview for user verification. It authorises no production deployment, migration, privilege grant, role-change or release acceptance.
