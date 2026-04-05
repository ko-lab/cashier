#!/usr/bin/env bash
set -euo pipefail

cd /workspace

pnpm config set store-dir /pnpm/store >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

APP_ROLE="${APP_ROLE:-backend}"

if [ "$APP_ROLE" = "backend" ]; then
  exec pnpm --filter @spacier/backend start
fi

if [ "$APP_ROLE" = "frontend" ]; then
  : "${VITE_API_URL:=/rpc}"
  : "${VITE_IBAN:=BE29893944052464}"
  : "${VITE_IBAN_NAME:=KO-LAB VZW}"
  : "${VITE_APP_VERSION:=${COMMIT_SHA:-dev}}"

  export VITE_API_URL VITE_IBAN VITE_IBAN_NAME VITE_APP_VERSION

  pnpm --filter @spacier/frontend build
  exec pnpm --filter @spacier/frontend start --host 0.0.0.0 --port 4173
fi

echo "Unknown APP_ROLE: $APP_ROLE"
exit 1
