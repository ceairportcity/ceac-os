#!/usr/bin/env bash
# Set up disposable LOCAL testing dependencies only, never production Supabase.
set -Eeuo pipefail
umask 077

echo "Checking Codespaces runtime"
node -e 'const v=process.versions.node.split(".").map(Number); if(v[0]!==22||v[1]<12)process.exit(1)'
command -v docker >/dev/null || { echo "ERROR: Docker-in-Docker feature did not install" >&2; exit 1; }
sudo apt-get update -qq
if ! command -v psql >/dev/null; then
  sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-client
fi
sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates curl tar

version="2.117.0"
release="https://github.com/supabase/cli/releases/download/v$version"
asset="supabase_$version""_linux_amd64.tar.gz"
download="$(mktemp -d)"
trap 'rm -rf -- "$download"' EXIT
curl --fail --location --silent --show-error --retry 2 \
  -o "$download/$asset" "$release/$asset"
curl --fail --location --silent --show-error --retry 2 \
  -o "$download/checksums.txt" "$release/checksums.txt"
(
  cd "$download"
  awk -v asset="$asset" '$2 == asset {print}' checksums.txt > checked-asset.sha256
  [[ -s checked-asset.sha256 ]] || { echo "ERROR: pinned Supabase asset has no checksum" >&2; exit 1; }
  sha256sum --check checked-asset.sha256
  tar -xzf "$asset" supabase
  sudo install -m 0755 supabase /usr/local/bin/supabase
)
[[ "$(supabase --version)" == "$version" ]] || { echo "ERROR: Supabase CLI version mismatch" >&2; exit 1; }
echo "CEAC testing prerequisites installed: $(node --version); Supabase $(supabase --version)"
if docker info >/dev/null 2>&1; then
  echo "Docker reachable"
else
  echo "Docker not yet reachable: reopen terminal or investigate Docker-in-Docker; do not skip DB gates."
fi
