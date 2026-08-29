#!/usr/bin/env bash
# House indexer — polls Ink via INK_RPC_URL and serves :8787 (Pons-style).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/indexer"
if [[ ! -d node_modules ]]; then
  npm install
fi
exec npm run serve
