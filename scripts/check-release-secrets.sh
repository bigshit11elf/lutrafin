#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('${ROOT_DIR}/package.json').version")"
ZIP_PATH="${ROOT_DIR}/release/lutrafin-${VERSION}-docker.zip"

if [[ ! -f "${ZIP_PATH}" ]]; then
  echo "Missing release archive: ${ZIP_PATH}" >&2
  exit 1
fi

if unzip -Z1 "${ZIP_PATH}" | grep -E '(^|/)\.env$|(^|/)secrets/.*\.txt$'; then
  echo "Release archive contains forbidden secret files." >&2
  exit 1
fi

unzip -Z1 "${ZIP_PATH}" | grep -q 'scripts/create-release-zip.sh'
