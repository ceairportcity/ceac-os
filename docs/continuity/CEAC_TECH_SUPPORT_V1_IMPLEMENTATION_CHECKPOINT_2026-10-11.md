# CEAC OS — Technical Support v1 implementation checkpoint (11 October 2026)

**Status: SOURCE IMPLEMENTED IN DRAFT PR #42; SECURITY/MIGRATION/UI RELEASE NO-GO.**

Canonical private repository: `ceairportcity/ceac-os`.
Directly verified parent: draft PR #41 `fe01e8cd3db77156282081a5d9f0d9729ae0e28f`.
Reviewed source SHA before this documentation-only checkpoint:
`7af4c5e4da9e17b9e70a02578b7a1869295a3e12`.
Production `main` remains `827fbe7391467dd13d6e411527416402a252993c` at reconciliation.

## Implemented code in this draft
- `src/screens/TechnicalHelp.jsx`: signed-in user's own support request submission and RLS-scoped history.
- `src/screens/TechnicalSupport.jsx`: six locked workspaces, queue, case actions, restricted history, improvement grouping, plainly unverified system-health states, safety-conscious guides.
- `src/lib/technicalSupport.js`: pure category and triage rules with no normal employee scoring.
- `src/experience-v2/shell/navigation.js` and `src/App.jsx`: lazy, capability-gated navigation and self-service assistance; no Admin/Executive/Volunteer screen rewrite.
- `src/role-styles/technical-support.css`: dedicated scoped role styling.
- `tests/technical-support-v1.test.mjs`: focused future CI test suite.
- `supabase/proposals/technical_support_v1_backend.sql` and `technical_support_v1_gate.sql`: **proposals only**, not migrations.

## Executed verification, without exaggeration
- PR #42 remains stacked after PR #41 and originated from exact parent HEAD.
- Three test bodies from the actual GitHub unit test were executed against the exact GitHub module blob (SHA `74000e2596ee3d200f71dedd7e5f46e4a4c1e788`) in isolated V8 after adapting the Node test harness: **3/3 passed**. This is NOT an executed `node --test` command in a checked-out repository.
- Thirty read-only source-contract and lightweight delimiter checks across eight exact GitHub files at `7af4c5e4da9e17b9e70a02578b7a1869295a3e12`: **30/30 passed**. These are structural checks, **not JSX compilation**, SQL migration execution, browser tests or Level B.
- Exact source change set relative to PR #41 was 8 files before adding the proposal gate and this checkpoint.
- The existing Executive CSS from PR #40 was unchanged; no production database or Vercel files/settings were modified in this stage.

## Actual prerequisites before accepting this support implementation
1. Reconcile PR #14 Security S3 `20261007083250_118_capability_delegation_expiry.sql` against the integrated application ancestry and existing 10 unapplied migrations. It is currently separate and was not silently copied into the new candidate.
2. Produce a canonical migration through the Supabase CLI **only after** S3 history and other pending versions are reconciled. Review the SQL proposal for PostgreSQL validity, migrations, business authority, tenant safety, cross-org references and membership grant/expiry behaviour.
3. Validate SQL migration and the candidate regression gate in an isolated disposable database. Add actual authenticated adversarial tests: reporter isolation, active support membership PLUS unexpired support capability, no support access to payroll/protected HR, service-only operations, profile deactivation, historical audit immutability and no self-grant.
4. Complete the still-unimplemented support work: approved access-request/approval/execution lifecycle, secure membership administration/transition, private support-case evidence, verified provider status/health, backup readiness, support-safe technical change history, reliable invitation handling and monthly leadership summary. Do not describe the six visible source workspaces as full operational acceptance before these capabilities are proven.
5. Run `npm ci`, `npm run build`, Node suite, 44 core authenticated browser cases, 31 visual-fidelity cases, full Level A/B SQL/security tests, AAL2 MFA UI tests, and desktop/tablet/phone **literal Level C** comparisons against approved references on the final exact application SHA.
6. Complete real privileged-user TOTP setup, owner-approved staff invitation delivery, fully encrypted production dump plus **restored** nonproduction copy including required Auth/Storage assets, and human security/owner approval.
7. Resolve Vercel existing-team 403 and private GitHub App namespace access without making the repository public, changing the project, paying for new infrastructure or changing live domains. Preserve the existing READY production deployment and rollback.
8. Only after all mandatory evidence, independent review and an explicit owner go-live decision may a normal PR merge, approved production migrations, controlled deployment and real-role smoke tests occur.

## Safety statement
**No production data writes, hosted schema changes, RLS/MFA weakening, live role changes, public-repo workaround, Vercel cutover, production merge or paid upgrade occurred.** Backups and restores were not run. A successfully opened draft PR or static test cannot meet release approval.
