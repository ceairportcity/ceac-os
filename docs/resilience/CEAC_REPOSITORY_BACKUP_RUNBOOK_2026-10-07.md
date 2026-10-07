# CEAC repository backup runbook

Date: 7 October 2026

A source ZIP is not a repository backup. CEAC disaster recovery preserves Git objects, refs, tags and history.

Run from a trusted machine that can read the canonical repository and write to approved encrypted backup storage:

```sh
bash scripts/resilience/create-repository-backup.sh <canonical-repository-url> <backup-directory>
```

The output contains a bare mirror, an all-refs Git bundle, a ref inventory and SHA-256 checksum. Store it independently of GitHub with restricted access. Repeat after accepted releases and test restoration quarterly:

```sh
sha256sum -c CHECKSUMS.sha256
git bundle verify ceac-os-all-refs.bundle
git clone ceac-os-all-refs.bundle ceac-os-restored
```

After restore, confirm accepted release SHAs, tags, important product/security branches, migrations, design locks and continuity records. GitHub remains canonical during normal operation; the mirror is disaster recovery only.
