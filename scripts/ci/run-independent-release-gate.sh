#!/usr/bin/env bash
# Independent CEAC acceptance on an isolated, disposable host.
# Requires an existing authorized PRIVATE git clone. Never connects to production.
set -Eeuo pipefail
umask 077

if [[ $# -ne 4 ]]; then
  echo "Usage: $0 /path/to/private-clone PR_NUMBER EXACT_PR_SHA EXPECTED_MAIN_SHA" >&2
  exit 2
fi
repo="$1"; pr="$2"; expected="$3"; expected_main="$4"
[[ "$pr" =~ ^[0-9]+$ && "$expected" =~ ^[0-9a-f]{40}$ && "$expected_main" =~ ^[0-9a-f]{40}$ ]] || exit 2
for tool in git node npm npx docker supabase psql curl sha256sum; do
  command -v "$tool" >/dev/null || { echo "NOT VERIFIED: missing $tool" >&2; exit 2; }
done
docker info >/dev/null 2>&1 || { echo "NOT VERIFIED: Docker unavailable" >&2; exit 2; }
[[ "$(supabase --version)" == "2.117.0" ]] || { echo "NOT VERIFIED: require reviewed Supabase CLI v2.117.0" >&2; exit 2; }
node -e 'const v=process.versions.node.split(".").map(Number);if(v[0]!==22||v[1]<12)process.exit(1)' || exit 2

# Fail closed if a live Supabase/PostgreSQL connection was inherited.
for key in DATABASE_URL SUPABASE_DB_URL SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_ID SUPABASE_DB_PASSWORD SUPABASE_SERVICE_ROLE_KEY VITE_SUPABASE_URL PGHOST PGPORT; do
  if printenv "$key" >/dev/null 2>&1; then
    echo "NOT VERIFIED: live/unknown environment variable $key is set" >&2
    exit 2
  fi
done

origin="$(git -C "$repo" config --get remote.origin.url)"
case "$origin" in
  https://github.com/ceairportcity/ceac-os|https://github.com/ceairportcity/ceac-os.git|git@github.com:ceairportcity/ceac-os.git) ;;
  *) echo "NOT VERIFIED: unexpected private-repository origin" >&2; exit 2 ;;
esac
export GIT_TERMINAL_PROMPT=0
git -C "$repo" fetch --no-tags origin "refs/pull/$pr/head" refs/heads/main >/dev/null
actual="$(git -C "$repo" rev-parse FETCH_HEAD)"
# FETCH_HEAD can refer to main when fetching multiple refs: compare named fetch ref instead.
git -C "$repo" fetch --no-tags origin "refs/pull/$pr/head" >/dev/null
actual="$(git -C "$repo" rev-parse FETCH_HEAD)"
main="$(git -C "$repo" ls-remote origin refs/heads/main | cut -f1)"
[[ "$actual" == "$expected" && "$main" == "$expected_main" ]] ||
  { echo "STALE: expected PR/main SHAs do not match remote" >&2; exit 3; }

scratch="$(mktemp -d /tmp/ceac-gate-work.XXXXXXXX)"
evidence="$(mktemp -d /tmp/ceac-gate-evidence.XXXXXXXX)"
work="$scratch/work"
running_db=0; vite_pid=""
cleanup() {
  if [[ -d "$evidence" ]]; then
    printf 'ended_utc=%s\n' "$(date -u +%FT%TZ)" >> "$evidence/manifest.txt"
    (cd "$evidence" && find . -type f ! -name SHA256SUMS.txt -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS.txt) || true
  fi
  if [[ -n "$vite_pid" ]]; then kill "$vite_pid" >/dev/null 2>&1 || true; fi
  if [[ "$running_db" == 1 ]]; then (cd "$work" && supabase stop --no-backup >/dev/null 2>&1) || true; fi
  git -C "$repo" worktree remove --force "$work" >/dev/null 2>&1 || true
  rm -rf -- "$scratch"
  echo "PRIVATE EVIDENCE DIRECTORY: $evidence"
}
trap cleanup EXIT
git -C "$repo" worktree add --detach "$work" "$expected" >/dev/null
cd "$work"
[[ "$(git rev-parse HEAD)" == "$expected" ]] || exit 3

printf 'repository=ceairportcity/ceac-os\npr=%s\nsource_sha=%s\nexpected_main=%s\nnode=%s\nnpm=%s\nsupabase_cli=%s\nstarted_utc=%s\n' \
  "$pr" "$expected" "$expected_main" "$(node --version)" "$(npm --version)" "$(supabase --version)" "$(date -u +%FT%TZ)" > "$evidence/manifest.txt"
for name in hygiene supply_chain visual_source docs dependencies unit_tests audit build playwright_setup migration_replay sql_security account_security browser_1 browser_2 browser_3 browser_4; do
  printf 'NOT_VERIFIED\n' > "$evidence/$name.status"
done
failed=0
gate() {
  local name="$1"; shift
  printf 'RUNNING\n' > "$evidence/$name.status"
  if "$@" > "$evidence/$name.log" 2>&1; then
    printf 'PASS\n' > "$evidence/$name.status"
    echo "PASS $name"
  else
    printf 'FAIL\n' > "$evidence/$name.status"
    echo "FAIL $name: $evidence/$name.log" >&2
    failed=1
    return 1
  fi
}
hygiene() { git diff --check "$expected_main...$expected"; }
docs() {
  VERIFICATION_BASE_SHA="$expected_main" VERIFICATION_HEAD_SHA="$expected" node scripts/ci/check-documentation.mjs
}
gate hygiene hygiene || true
gate supply_chain node scripts/ci/check-github-actions-pinning.mjs || true
gate visual_source node scripts/ci/check-visual-fidelity-contract.mjs || true
gate docs docs || true
if ! gate dependencies npm ci; then exit 1; fi
gate unit_tests node --test tests/integration-runtime.test.mjs tests/onboarding-foundation.test.mjs tests/attendance.test.mjs tests/mfa-foundation.test.mjs || true
gate audit npm audit --audit-level=high || true
gate build npm run build || true
if ! gate playwright_setup bash -c 'npm install --no-save --package-lock=false @playwright/test@1.55.0 && npx playwright install --with-deps chromium'; then exit 1; fi

# Migrations and service credentials below are strictly local to the disposable host.
export ROLE_FIXTURE_PASSWORD='Local-role-fixture-2026!'
export SUPABASE_URL=http://127.0.0.1:54321
export VITE_SUPABASE_URL=http://127.0.0.1:54321
stop_database() {
  if [[ "$running_db" == 1 ]]; then
    supabase stop --no-backup || return 1
    running_db=0
  fi
}
fresh_database() {
  # Called by a gate in an 'if' condition: every required step MUST check
  # its own return code because bash errexit is suppressed in that context.
  stop_database || return 1
  if [[ ! -f supabase/config.toml ]]; then supabase init || return 1; fi
  local holding="$scratch/migrations"
  mkdir -p "$holding" || return 1
  mv supabase/migrations/*.sql "$holding/" || return 1
  running_db=1
  if ! supabase start; then
    mv "$holding/"*.sql supabase/migrations/ || true
    return 1
  fi
  mv "$holding/"*.sql supabase/migrations/ || return 1
  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 \
    -f supabase/replay/legacy-live-artifacts.sql || return 1
  supabase migration up --local || return 1
  supabase migration list --local || return 1
  local secrets="$scratch/local-only.env"
  supabase status -o env > "$secrets" || return 1
  set -a
  source "$secrets" || { set +a; return 1; }
  set +a
  rm -f "$secrets" || return 1
  [[ "$API_URL" == 'http://127.0.0.1:54321' ]] || return 1
  export SUPABASE_URL="$API_URL" VITE_SUPABASE_URL="$API_URL"
  export SUPABASE_ANON_KEY="$ANON_KEY" VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
  export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
}
seed_roles() {
  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 <<'SQL'
insert into public.organisations(id,name,short_code)
values('10000000-0000-4000-8000-000000000010','CEAC Quality Test','CEACQ');
insert into public.units(id,org_id,name,code) values
('20000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000010','Test Unit A','TSTA'),
('20000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000010','Test Unit B','TSTB');
alter table public.pending_invitations alter column invited_by drop not null;
SQL
  [[ "$?" == 0 ]] || return 1
  node scripts/seed-role-fixtures.mjs || return 1
}
seed_account() {
  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 <<'SQL'
insert into public.organisations(id,name,short_code)
values('10000000-0000-4000-8000-000000000001','CEAC Test','CEACT');
insert into public.units(id,org_id,name,code)
values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Test Unit','TST');
alter table public.pending_invitations alter column invited_by drop not null;
insert into public.pending_invitations(id,org_id,email,full_name,unit_id,role,invited_by,expires_at)
values('40000000-0000-4000-8000-000000000001',
'10000000-0000-4000-8000-000000000001',
'manager@ceac.local.test','Test Manager',
'20000000-0000-4000-8000-000000000001','staff',null,now()+interval '1 day');
SQL
}
account_flow() {
  fresh_database && seed_account && node scripts/test-account-security.mjs
}
gate migration_replay fresh_database || true
if [[ "$running_db" == 1 ]]; then gate sql_security bash scripts/ci/run-sql-security-gates.sh || true; fi
gate account_security account_flow || true

browser_shard() {
  local shard="$1"
  fresh_database && seed_roles || return 1
  rm -rf -- test-artifacts || return 1
  npm run dev -- --host 127.0.0.1 > "$evidence/vite_$shard.log" 2>&1 &
  vite_pid="$!"
  local ready=0
  for i in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
  done
  if [[ "$ready" != 1 ]]; then
    kill "$vite_pid" >/dev/null 2>&1 || true
    wait "$vite_pid" >/dev/null 2>&1 || true
    vite_pid=""
    return 1
  fi
  local rc=0
  npx playwright test "--shard=$shard/4" || rc="$?"
  if [[ -d test-artifacts ]]; then
    mkdir -p "$evidence/browser_artifacts_$shard"
    cp -a test-artifacts/. "$evidence/browser_artifacts_$shard/" || rc=1
  fi
  kill "$vite_pid" >/dev/null 2>&1 || true
  wait "$vite_pid" >/dev/null 2>&1 || true
  vite_pid=""
  return "$rc"
}
for shard in 1 2 3 4; do
  gate "browser_$shard" browser_shard "$shard" || true
done
# Do not distribute private logs unless reviewed for sensitive values.
if grep -lE '^(FAIL|NOT_VERIFIED)$' "$evidence"/*.status >/dev/null; then
  echo 'RELEASE NOT VERIFIED: inspect private evidence and obtain separate visual/real-user review.' >&2
  exit 1
fi
echo 'LOCAL TECHNICAL GATES PASS; production roles, visual owner acceptance, reviewer and deployment remain NOT VERIFIED.'
