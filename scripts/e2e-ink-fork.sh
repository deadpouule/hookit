#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORK_RPC="${FORK_RPC_URL:-http://127.0.0.1:8545}"
FORK_UPSTREAM="${INK_FORK_UPSTREAM_RPC:-https://rpc-gel.inkonchain.com}"
WEB_URL="${FORK_WEB_URL:-http://127.0.0.1:3000}"
INDEXER_URL="${FORK_INDEXER_URL:-http://127.0.0.1:8787}"
POOL_MANAGER="0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32"
LAUNCH_FACTORY="0x480bFB88985fb94f4345ED4BB2Ec267DB9Ab9626"
BONDING_FACTORY="0x13d6216A92B013dAAcD36E4f6D78Ad9264Af1a0C"
E2E_ACCOUNT="0x100000000000000000000000000000000000E2E1"
ANVIL_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/hookit-e2e.XXXXXX")"

PIDS=()
cleanup() {
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  rm -rf "$RUN_DIR"
}
trap cleanup EXIT INT TERM

wait_http() {
  local url="$1"
  for _ in $(seq 1 120); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

wait_rpc() {
  local url="$1"
  for _ in $(seq 1 120); do
    if cast block-number --rpc-url "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  echo "Timed out waiting for JSON-RPC at $url" >&2
  return 1
}

cd "$ROOT"

anvil \
  --fork-url "$FORK_UPSTREAM" \
  --chain-id 57073 \
  --host 127.0.0.1 \
  --port 8545 \
  --auto-impersonate \
  >"$RUN_DIR/anvil.log" 2>&1 &
PIDS+=("$!")
wait_rpc "$FORK_RPC"

ROUTER_OUTPUT="$(
  forge create \
    --broadcast \
    --rpc-url "$FORK_RPC" \
    --private-key "$ANVIL_KEY" \
    src/HookitSwapRouter.sol:HookitSwapRouter \
    --constructor-args "$POOL_MANAGER"
)"
HOOKIT_ROUTER="$(printf '%s\n' "$ROUTER_OUTPUT" | awk '/Deployed to:/ {print $3}')"
if [[ -z "$HOOKIT_ROUTER" ]]; then
  echo "Could not read deployed HookitSwapRouter address" >&2
  exit 1
fi

START_BLOCK="$(cast block-number --rpc-url "$FORK_RPC")"
# Never use the common 0xf39f… Anvil account for wallet E2E on a mainnet fork:
# that address can already have EIP-7702 delegation code in forked state.
cast rpc --rpc-url "$FORK_RPC" \
  anvil_setBalance "$E2E_ACCOUNT" 0x56bc75e2d63100000 >/dev/null
if [[ "$(cast code "$E2E_ACCOUNT" --rpc-url "$FORK_RPC")" != "0x" ]]; then
  echo "E2E account unexpectedly has code on the selected fork" >&2
  exit 1
fi

HOOKIT_CHAIN=ink \
INK_RPC_URL="$FORK_RPC" \
INK_RPC_URL_BACKUP="$FORK_RPC" \
INDEXER_RPC_URLS="$FORK_RPC" \
LAUNCH_FACTORY="$LAUNCH_FACTORY" \
BONDING_FACTORY="$BONDING_FACTORY" \
INDEXER_START_BLOCK="$START_BLOCK" \
INDEXER_CONFIRMATIONS=0 \
INDEXER_POLL_MS=500 \
INDEXER_CHUNK=100 \
INDEXER_PORT=8787 \
INDEXER_DATA_DIR="$RUN_DIR/indexer" \
npm --prefix "$ROOT/indexer" run serve >"$RUN_DIR/indexer.log" 2>&1 &
PIDS+=("$!")
wait_http "$INDEXER_URL/health"

NEXT_PUBLIC_HOOKIT_CHAIN=ink \
INK_RPC_URL="$FORK_RPC" \
INK_RPC_URL_BACKUP="$FORK_RPC" \
NEXT_PUBLIC_HOOKIT_SWAP_ROUTER="$HOOKIT_ROUTER" \
INDEXER_URL="$INDEXER_URL" \
npm --prefix "$ROOT/web" run dev -- --hostname 127.0.0.1 --port 3000 \
  >"$RUN_DIR/web.log" 2>&1 &
PIDS+=("$!")
wait_http "$WEB_URL/launch/custom"

FORK_E2E=1 \
FORK_RPC_URL="$FORK_RPC" \
FORK_INDEXER_URL="$INDEXER_URL" \
FORK_E2E_ACCOUNT="$E2E_ACCOUNT" \
SMOKE_BASE_URL="$WEB_URL" \
"$ROOT/web/node_modules/.bin/playwright" test \
  --config="$ROOT/web/playwright.config.ts" \
  "$ROOT/web/e2e/fork-wallet.spec.ts" \
  --project=desktop \
  --reporter=list

echo "Hookit Ink fork E2E passed."
