#!/usr/bin/env bash
# Run the daily fee keeper (load /opt/hookit/.env, use indexer viem).
# Usage: /opt/hookit/deploy/linode/fee-keeper/run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="${HOOKIT_ENV:-${ROOT}/.env}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

cd "${ROOT}/indexer"
if [[ ! -d node_modules/viem ]]; then
  echo "[fee-keeper] installing indexer deps…"
  npm ci 2>/dev/null || npm install
fi

exec npx tsx scripts/fee-keeper.ts
