#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('${ROOT_DIR}/package.json').version")"
RELEASE_DIR="${ROOT_DIR}/release"
STAGING_PARENT="$(mktemp -d)"
STAGING_NAME="lutrafin-${VERSION}"
STAGING_DIR="${STAGING_PARENT}/${STAGING_NAME}"
ZIP_PATH="${RELEASE_DIR}/lutrafin-${VERSION}-docker.zip"

cleanup() {
  rm -rf "${STAGING_PARENT}"
}
trap cleanup EXIT

require_file() {
  if [[ ! -e "${ROOT_DIR}/$1" ]]; then
    echo "Missing required release file: $1" >&2
    exit 1
  fi
}

command -v zip >/dev/null 2>&1 || {
  echo "zip is required to create the release archive." >&2
  exit 1
}

for path in \
  Dockerfile \
  docker-compose.yml \
  package.json \
  package-lock.json \
  svelte.config.js \
  vite.config.ts \
  tsconfig.json \
  drizzle.config.ts \
  .dockerignore \
  .env.example \
  LICENSE \
  README.md \
  SECURITY.md \
  CONTRIBUTING.md \
  THIRD_PARTY_NOTICES.md \
  RELEASE_CHECKLIST.md \
  src \
  tests; do
  require_file "${path}"
done

rm -rf "${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}" "${STAGING_DIR}/secrets"

copy_path() {
  local source="$1"
  local target="${STAGING_DIR}/${source}"
  mkdir -p "$(dirname "${target}")"
  cp -R "${ROOT_DIR}/${source}" "${target}"
}

for path in \
  Dockerfile \
  docker-compose.yml \
  package.json \
  package-lock.json \
  svelte.config.js \
  vite.config.ts \
  tsconfig.json \
  drizzle.config.ts \
  .dockerignore \
  .env.example \
  LICENSE \
  README.md \
  SECURITY.md \
  CONTRIBUTING.md \
  THIRD_PARTY_NOTICES.md \
  RELEASE_CHECKLIST.md \
  src \
  tests; do
  copy_path "${path}"
done

cp "${ROOT_DIR}/.env.example" "${STAGING_DIR}/.env"
cat >"${STAGING_DIR}/secrets/jellyfin_token.txt" <<'EOF'
replace-with-read-only-jellyfin-token
EOF
cat >"${STAGING_DIR}/secrets/tmdb_api_token.txt" <<'EOF'
replace-with-tmdb-api-token
EOF
cat >"${STAGING_DIR}/secrets/admin_password.txt" <<'EOF'
replace-with-strong-admin-password
EOF
chmod 600 "${STAGING_DIR}/secrets/"*.txt

cat >"${STAGING_DIR}/RELEASE_INSTALL.md" <<'EOF'
# Lutrafin Docker Release Install

1. Edit `.env` and set at least `APP_BASE_URL`, `JELLYFIN_URL` and `ADMIN_USERNAME`.
2. Replace the placeholder values in `secrets/*.txt`.
3. Start Lutrafin:

```sh
docker compose up -d
```

4. Open the URL configured in `APP_BASE_URL`.

If you changed application source files locally and need to force a rebuild, run `docker compose up -d --build` instead.

Do not commit or publish the generated `.env` or `secrets/*.txt` after filling in real values.
EOF

find "${STAGING_DIR}" -name '.DS_Store' -delete
find "${STAGING_DIR}" -name 'node_modules' -type d -prune -exec rm -rf '{}' +
find "${STAGING_DIR}" -name '.svelte-kit' -type d -prune -exec rm -rf '{}' +
find "${STAGING_DIR}" -name 'build' -type d -prune -exec rm -rf '{}' +

(
  cd "${STAGING_PARENT}"
  zip -qr "${ZIP_PATH}" "${STAGING_NAME}"
)

echo "Created ${ZIP_PATH}"
