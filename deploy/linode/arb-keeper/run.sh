#!/usr/bin/env bash
# Multi-pair arb keeper — loads /opt/hookit/.env then runs indexer/scripts/arb-keeper.ts
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="${HOOKIT_ENV:-${ROOT}/.env}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  set +u
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set -u
  set +a
fi

cd "${ROOT}/indexer"
if [[ ! -d node_modules/viem ]]; then
  echo "[arb-keeper] installing indexer deps…"
  npm ci 2>/dev/null || npm install
fi

exec npx tsx scripts/arb-keeper.ts
