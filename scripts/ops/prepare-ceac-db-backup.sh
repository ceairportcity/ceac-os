#!/usr/bin/env bash
# CEAC OS: encrypted, read-only logical backup preparation.
# This does NOT authorise migrations or establish tested restore capability.
set -Eeuo pipefail
umask 077

fail() { printf 'BACKUP NOT VERIFIED: %s\n' "$*" >&2; exit 1; }
for bin in supabase git gpg tar sha256sum mktemp date; do
  command -v "$bin" >/dev/null 2>&1 || fail "missing required command: $bin"
done
: "${CEAC_BACKUP_DIR:?Set a private backup directory outside the repository}"
: "${CEAC_BACKUP_PASSPHRASE_FILE:?Set the path to an existing private passphrase file outside the repository}"
: "${CEAC_EXPECTED_SHA:?Provide the exact approved Git commit SHA}"
[[ "$CEAC_EXPECTED_SHA" =~ ^[a-f0-9]{40}$ ]] || fail 'invalid expected SHA'
[[ "$CEAC_BACKUP_DIR" = /* && "$CEAC_BACKUP_PASSPHRASE_FILE" = /* ]] || fail 'paths must be absolute'
[[ -s "$CEAC_BACKUP_PASSPHRASE_FILE" ]] || fail 'missing backup encryption passphrase'
repo="$(git rev-parse --show-toplevel)" || fail 'must be run within the private CEAC checkout'
cd "$repo"
[[ "$(git rev-parse HEAD)" == "$CEAC_EXPECTED_SHA" ]] || fail 'source does not match approved exact commit'
origin="$(git remote get-url origin)"
case "$origin" in
  https://github.com/ceairportcity/ceac-os|https://github.com/ceairportcity/ceac-os.git|git@github.com:ceairportcity/ceac-os.git) ;;
  *) fail 'repository origin is not the private CEAC canonical repository' ;;
esac
[[ -r supabase/.temp/project-ref ]] || fail 'Supabase CLI must already be securely linked to the intended project'
[[ "$(cat supabase/.temp/project-ref)" == efjljhftsesssumtshvp ]] || fail 'linked Supabase project is not CEAC production'
# Never chmod or repurpose an existing location (especially /, /tmp, or a shared folder).
[[ ! -e "$CEAC_BACKUP_DIR" ]] || fail 'select a fresh, dedicated backup directory that does not yet exist'
mkdir -m 700 -- "$CEAC_BACKUP_DIR"
out="$(cd "$CEAC_BACKUP_DIR" && pwd -P)"
key="$(cd "$(dirname "$CEAC_BACKUP_PASSPHRASE_FILE")" && pwd -P)/$(basename "$CEAC_BACKUP_PASSPHRASE_FILE")"
case "$out/" in "$repo/"*) fail 'backup destination is inside Git working tree';; esac
case "$key" in "$repo/"*) fail 'passphrase file is inside Git working tree';; esac
case "$key" in "$out/"*) fail 'encryption passphrase must not reside in the backup destination';; esac
scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$out/ceac-pre-migration-$stamp-${CEAC_EXPECTED_SHA:0:12}.tar.gpg"
[[ ! -e "$archive" ]] || fail 'destination already exists'

# Official Supabase logical-export components. Only --linked reads are performed.
supabase db dump --linked --role-only -f "$scratch/roles.sql"
supabase db dump --linked -f "$scratch/schema.sql"
supabase db dump --linked --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes -f "$scratch/data.sql"
supabase db dump --linked --schema supabase_migrations -f "$scratch/history-schema.sql"
supabase db dump --linked --schema supabase_migrations --use-copy --data-only -f "$scratch/history-data.sql"
for f in roles.sql schema.sql data.sql history-schema.sql history-data.sql; do
  [[ -s "$scratch/$f" ]] || fail "empty dump: $f"
done
printf 'repo=%s\nsource_sha=%s\nlinked_project=%s\ncreated_utc=%s\nrestore_status=NOT_TESTED\nstorage_object_blobs=NOT_INCLUDED\nmanaged_auth_storage_customisations=VERIFY_SEPARATELY\n' \
  'ceairportcity/ceac-os' "$CEAC_EXPECTED_SHA" efjljhftsesssumtshvp "$stamp" > "$scratch/manifest.txt"
( cd "$scratch" && tar -czf - roles.sql schema.sql data.sql history-schema.sql history-data.sql manifest.txt ) |
  gpg --batch --yes --pinentry-mode loopback --passphrase-file "$key" --symmetric --cipher-algo AES256 --output "$archive"
[[ -s "$archive" ]] || fail 'encrypted archive missing'
gpg --batch --quiet --yes --pinentry-mode loopback --passphrase-file "$key" --decrypt "$archive" | tar -tzf - >/dev/null || fail 'decryption/integrity check failed'
( cd "$out" && sha256sum "$(basename "$archive")" > "$(basename "$archive").sha256" )
printf 'ENCRYPTED_LOGICAL_EXPORT_CREATED: %s\nNOT RELEASE-READY: restore test, auth/storage review, and owner approval still required.\n' "$archive"
