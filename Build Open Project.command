#!/bin/bash
# Build locally on Apple silicon; no application hosting is used.
set -euo pipefail
cd "$(cd -- "$(dirname -- "$0")" && pwd)"

if [[ "$(uname -s)" != Darwin || "$(uname -m)" != arm64 ]]; then
  echo 'This builder requires an Apple silicon Mac (M1–M4 and later).'
  exit 1
fi

work_directory=$(mktemp -d "${TMPDIR:-/tmp}/open-project-build.XXXXXX")
trap 'rm -rf -- "$work_directory"' EXIT
trap 'echo "Build stopped. The error above explains the failed step; your saved projects were not deleted."' ERR

# Keep a pinned, checksum-verified Node runtime private to this build.
# This also works when Node is missing or the installed Node uses Rosetta.
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 && process.arch === "arm64" ? 0 : 1)'; then
  echo 'Preparing the official Apple silicon Node runtime…'
  curl --proto '=https' --tlsv1.2 -fL --retry 2 \
    https://nodejs.org/dist/v24.19.0/node-v24.19.0-darwin-arm64.tar.gz \
    -o "$work_directory/node.tar.gz"
  printf '%s  %s\n' \
    8294b7aa9b03997481c06babf1e8b270c859358f27da57a11509afe537ac381d \
    "$work_directory/node.tar.gz" | shasum -a 256 -c -
  tar -xzf "$work_directory/node.tar.gz" -C "$work_directory"
  export PATH="$work_directory/node-v24.19.0-darwin-arm64/bin:$PATH"
fi

echo 'Installing dependencies and building Open Project…'
npm ci
npm test
npm run build:desktop
npm run package:mac:arm64

app_path="$PWD/mac-release/Open Project-darwin-arm64/Open Project.app"
archive_path="$PWD/mac-release/Open-Project-M4-local.zip"
codesign --verify --deep --strict --verbose=2 "$app_path"
ditto -c -k --sequesterRsrc --keepParent "$app_path" "$archive_path"
ditto -x -k "$archive_path" "$work_directory/extracted"
extracted_app="$work_directory/extracted/Open Project.app"
codesign --verify --deep --strict --verbose=2 "$extracted_app"
npm run smoke:mac -- arm64 "$extracted_app"

echo "Built and checked: $app_path"
echo "Local ZIP: $archive_path"
echo 'Opening the app. You can drag this exact app into Applications later.'
open -a "$app_path"
open -R "$app_path"
