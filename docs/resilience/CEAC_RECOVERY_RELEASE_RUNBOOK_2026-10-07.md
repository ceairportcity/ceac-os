# CEAC recovery release runbook

Date: 7 October 2026

## Create an accepted release package

From a clean checkout of the exact accepted SHA using Node 22:

```sh
npm ci
npm run resilience:verify
npm run recovery:release
```

The command builds CEAC and creates `recovery-output/ceac-recovery-<sha>/` plus a deterministic-metadata `.tar.gz`. It contains the production `dist`, a Git bundle with history reachable from the accepted commit, package/lock files, Vercel serving configuration, tracked Supabase migrations/replay material, recovery tooling, standby container material, runbooks, a release manifest and SHA-256 inventory.

The GitHub workflow `CEAC Recovery Release` performs the same process for an explicitly supplied accepted SHA and publishes an Actions artifact. Never treat an unaccepted branch build as production recovery media.

## Integrity verification

```sh
cd ceac-recovery-<sha>
sha256sum -c CHECKSUMS.sha256
git bundle verify ceac-source.bundle
```

Confirm `RECOVERY_MANIFEST.json.sourceCommit` equals the accepted production SHA and the artifact was copied to the approved independent backup location.

## What it restores

- exact accepted frontend files;
- source history reachable from the release commit;
- reproducible dependency/build inputs;
- tracked database migration definitions and replay material;
- provider-neutral static serving assets and instructions.

## What it does not restore

It deliberately excludes credentials, passwords, environment values, tokens, private keys, live Supabase rows, Auth users/sessions, private Storage objects, provider ownership and DNS. Those require separate approved encrypted backups and secret-management procedures.

## Recovery verification

Serve the prebuilt `dist` over HTTPS with SPA fallback and no-cache headers for `index.html` and `sw.js`. Supply the public Supabase URL and publishable key through the authorised deployment environment, never the bundle. Verify sign-in, role boundaries, RLS-dependent reads, service-worker update behaviour, mobile layout and the displayed source SHA before any cutover.
