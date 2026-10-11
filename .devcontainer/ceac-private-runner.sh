#!/usr/bin/env bash
# Private GitHub Codespaces Level B runner. Never touches CEAC production.
# It cannot declare release acceptance, merge, deploy, or change billing.
set -uo pipefail
umask 077
cd "$(git rev-parse --show-toplevel)" || exit 2
log=/tmp/ceac-private-autorun-result.log
summary=/tmp/ceac-private-autorun-summary.md
status=/tmp/ceac-private-autorun-exit-code
started=/tmp/ceac-private-autorun-worker-started
printf 'Codespaces CEAC runner started %s\n' "$(date -u +%FT%TZ)" > "$started"
printf 'Private CEAC PR #44 exact-head verification started %s\n' "$(date -u +%FT%TZ)" > "$log"
rc=2
# Wait for postCreateCommand to complete, not for a global or production DB.
for attempt in $(seq 1 90); do
  if command -v supabase >/dev/null 2>&1 &&
     [[ "$(supabase --version 2>/dev/null)" == "2.117.0" ]] &&
     command -v psql >/dev/null 2>&1 &&
     docker info >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
if ! command -v supabase >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo 'NOT VERIFIED: local Docker/Supabase setup did not become ready.' >> "$log"
else
  # Every new Codespace verifies the live release PR44 HEAD; the independent
  # gate rechecks the remote before worktree creation and rejects SHA drift.
  expected_pr="$(git ls-remote origin refs/pull/44/head | awk '{print $1}')"
  expected_main="$(git ls-remote origin refs/heads/main | awk '{print $1}')"
  # The Codespace itself must boot from the current candidate commit;
  # never let stale verification scripts certify a newer PR.
  local_head="$(git rev-parse HEAD)"
  if [[ "$expected_pr" =~ ^[0-9a-f]{40}$ && "$expected_main" =~ ^[0-9a-f]{40}$ && "$local_head" == "$expected_pr" ]]; then
    printf 'PR44_TEST_SHA=%s MAIN_SHA=%s\n' "$expected_pr" "$expected_main" >> "$log"
    bash scripts/ci/run-independent-release-gate.sh "$PWD" 44 \
      "$expected_pr" "$expected_main" >> "$log" 2>&1
    rc=$?
  else
    echo "NOT VERIFIED: Codespace checkout is not exact live PR44 HEAD (or refs unavailable)" >> "$log"
    rc=2
  fi
fi
evidence="$(grep '^PRIVATE EVIDENCE DIRECTORY: ' "$log" | tail -1 | sed 's/^PRIVATE EVIDENCE DIRECTORY: //' || true)"
{
  printf '### Independent private CEAC Codespaces verification — not release acceptance\n\n'
  printf 'Target PR: #44; tested candidate SHA: %s; expected main SHA: %s.\n\n' "${expected_pr:-UNRESOLVED}" "${expected_main:-UNRESOLVED}"
  printf 'Technical runner exit code: **%s**. No merge, Level C, second review, or production authorization is implied.\n\n' "$rc"
  if [[ -n "$evidence" && -d "$evidence" ]]; then
    for result in "$evidence"/*.status; do
      [[ -f "$result" ]] || continue
      name="${result##*/}"; name="${name%.status}"
      printf -- '- %s: %s\n' "$name" "$(cat "$result")"
    done
    if [[ -f "$evidence/SHA256SUMS.txt" ]]; then
      printf '\nPrivate evidence SHA256 manifest checksum: \`%s\`. Full private logs need redacted reviewer inspection.\n' \
        "$(sha256sum "$evidence/SHA256SUMS.txt" | cut -d' ' -f1)"
    fi
  else
    printf '**NOT VERIFIED:** no complete evidence directory was produced. Inspect the private runner log.\n'
  fi
  printf '\nCEAC release remains NO-GO until every mandatory verification and independent acceptance is recorded.\n'
} > "$summary"
cat "$summary" >> "$log"
echo "$rc" > "$status"
# An absent/unresolved SHA must never mark a future checkout as verified.
printf '%s\n' "${expected_pr:-UNRESOLVED}" > /tmp/ceac-private-autorun-tested-head
echo "CEAC_AUTORUN_FINISHED exit=$rc at $(date -u +%FT%TZ)" >> "$log"
# Best effort: never print credentials or upload raw logs.
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh pr comment 44 --repo ceairportcity/ceac-os --body-file "$summary" >> "$log" 2>&1 ||
    echo 'PR comment permission unavailable; summary preserved in Codespace.' >> "$log"
else
  echo 'GitHub PR comment permission unavailable; summary preserved in Codespace.' >> "$log"
fi
exit "$rc"
