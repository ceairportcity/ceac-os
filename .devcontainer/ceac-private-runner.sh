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
  # A Codespace may still be checked out at yesterday's commit while PR44
  # has advanced. Verify an isolated exact-current-HEAD worktree instead;
  # NEVER modify, reset, merge or force-update the user's working tree.
  expected_pr="$(git ls-remote origin refs/pull/44/head | awk '{print $1}')"
  expected_main="$(git ls-remote origin refs/heads/main | awk '{print $1}')"
  if [[ "$expected_pr" =~ ^[0-9a-f]{40}$ && "$expected_main" =~ ^[0-9a-f]{40}$ ]]; then
    printf 'PR44_TEST_SHA=%s MAIN_SHA=%s\n' "$expected_pr" "$expected_main" >> "$log"
    verify_checkout="$(mktemp -d /tmp/ceac-exact-head.XXXXXXXX)"
    if git fetch --no-tags origin refs/pull/44/head >> "$log" 2>&1 &&
       [[ "$(git rev-parse FETCH_HEAD)" == "$expected_pr" ]] &&
       git worktree add --detach "$verify_checkout/source" "$expected_pr" >> "$log" 2>&1; then
      # Execute the gate from the VERIFIED candidate itself; never reuse a
      # stale runner script from an old Codespace checkout.
      bash "$verify_checkout/source/scripts/ci/run-independent-release-gate.sh" "$PWD" 44 \
        "$expected_pr" "$expected_main" >> "$log" 2>&1
      rc=$?
    else
      echo 'NOT VERIFIED: cannot prepare isolated exact PR44 HEAD test runner' >> "$log"
      rc=2
    fi
    git worktree remove --force "$verify_checkout/source" >/dev/null 2>&1 || true
    rm -rf -- "$verify_checkout"
  else
    echo 'NOT VERIFIED: cannot resolve exact private PR44/main refs' >> "$log"
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
