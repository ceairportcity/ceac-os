#!/usr/bin/env bash
# Codespaces-only launcher for previously authorised private Level B verification.
# This does NOT authorise production, merge, payment, or public repository access.
set -Eeuo pipefail
if [[ "${CODESPACES:-}" != true ]]; then
  echo "NOT VERIFIED: GitHub Codespaces required for this launcher." >&2
  exit 2
fi
cd "$(git rev-parse --show-toplevel)"
if ! mkdir /tmp/ceac-private-autorun-started.lock 2>/dev/null; then
  echo "CEAC verification was already launched in this Codespace."
  exit 0
fi
cat > /tmp/ceac-private-autorun-execute.sh <<'SCRIPT'
#!/usr/bin/env bash
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 2
log=/tmp/ceac-private-autorun-result.log
summary=/tmp/ceac-private-autorun-summary.md
for attempt in $(seq 1 60); do
  if docker info >/dev/null 2>&1; then break; fi
  sleep 2
done
printf 'CEAC private Codespaces verification started %s\n' "$(date -u +%FT%TZ)" > "$log"
bash scripts/ci/run-independent-release-gate.sh "$PWD" 27 \
  386e59086fa79e1d27b28c42677d2252877cf0e0 \
  827fbe7391467dd13d6e411527416402a252993c >> "$log" 2>&1
rc=$?
evidence="$(grep '^PRIVATE EVIDENCE DIRECTORY: ' "$log" | tail -1 | sed 's/^PRIVATE EVIDENCE DIRECTORY: //' || true)"
{
  printf '### CEAC private Codespaces automated test report (UNREVIEWED)\n\n'
  printf 'Source PR #27: \`386e59086fa79e1d27b28c42677d2252877cf0e0\`. Expected main: \`827fbe7391467dd13d6e411527416402a252993c\`.\n\n'
  printf 'Runner exit: **%s**. This records local technical test results only, NEVER Level C, manual reviewer approval, merge or production cutover.\n\n' "$rc"
  if [[ -n "$evidence" && -d "$evidence" ]]; then
    for f in "$evidence"/*.status; do
      [[ -f "$f" ]] || continue
      key="${f##*/}"; key="${key%.status}"
      printf -- '- %s: %s\n' "$key" "$(cat "$f")"
    done
    if [[ -f "$evidence/SHA256SUMS.txt" ]]; then
      printf '\nLocal evidence-manifest checksum: \`%s\`. Full private logs require independent review/redaction.\n' \
        "$(sha256sum "$evidence/SHA256SUMS.txt" | cut -d' ' -f1)"
    fi
  else
    printf '**NOT VERIFIED**: No complete local evidence directory. Inspect private Codespaces logs.\n'
  fi
  printf '\nNever merge or deploy without the separate owner and reviewer acceptance.\n'
} > "$summary"
cat "$summary" >> "$log"
echo "CEAC_AUTORUN_FINISHED exit=$rc at $(date -u +%FT%TZ)" >> "$log"
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh pr comment 29 --repo ceairportcity/ceac-os --body-file "$summary" >> "$log" 2>&1 ||
    echo "PR comment unavailable; inspect summary inside Codespaces." >> "$log"
else
  echo "GitHub CLI PR comment unavailable; inspect summary inside Codespaces." >> "$log"
fi
exit "$rc"
SCRIPT
chmod 0700 /tmp/ceac-private-autorun-execute.sh
nohup bash /tmp/ceac-private-autorun-execute.sh > /tmp/ceac-private-autorun-console.log 2>&1 < /dev/null &
echo "CEAC private verification started in this Codespace (PID $!)."
echo "Read: /tmp/ceac-private-autorun-result.log"
echo "Summary: /tmp/ceac-private-autorun-summary.md"
