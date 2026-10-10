#!/usr/bin/env bash
# Idempotent CEAC Codespaces launcher: recovers if the old one-shot lock
# was left behind by a terminated postCreateCommand process.
set -Eeuo pipefail
umask 077
[[ "${CODESPACES:-}" == true ]] || {
  echo "NOT VERIFIED: launcher may run only inside GitHub Codespaces" >&2
  exit 2
}
cd "$(git rev-parse --show-toplevel)"
# Always guard concurrently-running postStart and postAttach lifecycle hooks.
command -v flock >/dev/null || { echo "NOT VERIFIED: flock unavailable" >&2; exit 2; }
exec 9>/tmp/ceac-private-autorun-launch.flock
flock -w 10 9
if [[ -f /tmp/ceac-private-autorun-exit-code &&
      -f /tmp/ceac-private-autorun-summary.md ]]; then
  echo "CEAC verification has a recorded result; avoiding duplicate execution."
  exit 0
fi
pidfile=/tmp/ceac-private-autorun-worker.pid
if [[ -s "$pidfile" ]]; then
  oldpid="$(cat "$pidfile")"
  if [[ "$oldpid" =~ ^[0-9]+$ ]] &&
     kill -0 "$oldpid" 2>/dev/null &&
     ps -p "$oldpid" -o args= | grep -Fq 'ceac-private-runner.sh'; then
    echo "CEAC verification is already running (PID $oldpid)."
    exit 0
  fi
fi
# A directory-only old lock is insufficient evidence that tests started.
# Do not delete it: ignore it and supervise a new uniquely tracked worker.
if [[ -d /tmp/ceac-private-autorun-started.lock ]]; then
  echo "Recovering from a stale old-version Codespaces launcher lock."
fi
nohup bash .devcontainer/ceac-private-runner.sh \
  > /tmp/ceac-private-autorun-console.log 2>&1 < /dev/null 9>&- &
pid=$!
printf '%s\n' "$pid" > "$pidfile"
sleep 1
if ! kill -0 "$pid" 2>/dev/null; then
  echo "NOT VERIFIED: Codespaces worker stopped before bootstrap; logs retained" >&2
  rm -f "$pidfile"
  exit 1
fi
echo "CEAC local verification worker started (PID $pid); no terminal commands required."
