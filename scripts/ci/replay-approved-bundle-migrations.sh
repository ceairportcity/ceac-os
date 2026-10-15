#!/usr/bin/env bash
# Rehearse the OWNER-APPROVED current one-bundle release, NOT the deferred
# Google-only OAuth/universal AAL2 Stage 2. The independent Migration Replay
# job still replays every SQL file, including this preserved Stage 2 migration.
set -Eeuo pipefail
deferred="supabase/migrations/20261012172718_google_oauth_aal2_enforcement.sql"
if [[ ! -f "$deferred" ]]; then
  echo "FAIL: required preserved Google/AAL2 Stage 2 migration is missing" >&2
  exit 1
fi
hold_dir="$(mktemp -d)"
restore_deferred() {
  if [[ -f "$hold_dir/deferred_stage2.sql" ]]; then
    mv "$hold_dir/deferred_stage2.sql" "$deferred"
  fi
  rmdir "$hold_dir" 2>/dev/null || true
}
trap restore_deferred EXIT
mv "$deferred" "$hold_dir/deferred_stage2.sql"
echo "CEAC current bundle: replay approved migrations without deferred Google/AAL2"
supabase migration up --local
applied="$(psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -Atqc "select count(*) from supabase_migrations.schema_migrations where version='20261012172718'")"
if [[ "$applied" != "0" ]]; then
  echo "FAIL: deferred Stage 2 Google/AAL2 migration is applied in current-release fixture" >&2
  exit 1
fi
echo "PASS: deferred Google/AAL2 migration unapplied in isolated current-release fixture"
