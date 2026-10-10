#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <repository-url> <output-directory>" >&2
  exit 64
fi

repository_url="$1"
output_directory="$2"
mirror_directory="$output_directory/ceac-os.git"

mkdir -p "$output_directory"
if [[ -d "$mirror_directory" ]]; then
  git -C "$mirror_directory" remote update --prune
else
  git clone --mirror "$repository_url" "$mirror_directory"
fi

git -C "$mirror_directory" fsck --full
git -C "$mirror_directory" bundle create "$output_directory/ceac-os-all-refs.bundle" --all
git bundle verify "$output_directory/ceac-os-all-refs.bundle"
git -C "$mirror_directory" show-ref > "$output_directory/REFS.txt"
sha256sum "$output_directory/ceac-os-all-refs.bundle" > "$output_directory/CHECKSUMS.sha256"
echo "History-preserving CEAC mirror and bundle created in $output_directory"
