#!/usr/bin/env bash
# Build + restart Hookit indexer only (1 GB Linode — no web, no forge).
# Usage: sudo -u hookit /opt/hookit/deploy/linode/indexer-only/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

if [[ ! -f "${ROOT}/.env" ]]; then
  echo "Missing ${ROOT}/.env — copy deploy/linode/indexer-only/env.example" >&2
  exit 1
fi

if [[ ! -r "${ROOT}/.env" ]]; then
  echo "Cannot read ${ROOT}/.env — run: chown hookit:hookit ${ROOT}/.env && chmod 600 ${ROOT}/.env" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source "${ROOT}/.env"
set +a

DATA="${INDEXER_DATA_DIR:-/var/lib/hookit-indexer}"
mkdir -p "${DATA}"

echo "[indexer] install deps…"
cd "${ROOT}/indexer"
npm ci 2>/dev/null || npm install

echo "[indexer] typecheck…"
npm run typecheck

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files hookit-indexer.service &>/dev/null; then
  echo "[indexer] restart service…"
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    systemctl restart hookit-indexer
    sleep 2
    systemctl status hookit-indexer --no-pager || true
  else
    echo "[indexer] systemctl needs root — run: sudo systemctl restart hookit-indexer"
  fi
else
  echo "[indexer] start manually: cd ${ROOT}/indexer && npm run serve"
fi

echo "[indexer] health…"
curl -sf "http://127.0.0.1:${INDEXER_PORT:-8787}/health" | head -c 400 || echo "(not up yet — check journalctl -u hookit-indexer)"
echo
echo "[indexer] done."
