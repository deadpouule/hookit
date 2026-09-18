#!/usr/bin/env bash
# Full Ink smoke: module matrix, kitchen sink, dyn-fee vest, launchMulti, classic, arb.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a && source .env && set +a

RPC="${INK_RPC_URL:-https://rpc-gel.inkonchain.com}"
BUY_WEI="${SMOKE_BUY_WEI:-0.00008ether}"
MATRIX_BUY="${MATRIX_BUY_WEI:-0.00005ether}"
MULTI_BUY="${MULTI_BUY_WEI:-0.00008ether}"
CLASSIC_BUY="${CLASSIC_BUY_WEI:-0.00008ether}"
DYN_SMALL="${DYNFEE_SMALL_WEI:-0.00005ether}"
DYN_LARGE="${DYNFEE_LARGE_WEI:-0.00012ether}"

run() {
  echo "=== $* ==="
  forge script "$1" --rpc-url "$RPC" --broadcast -vv "${@:2}"
}

echo "[smoke] deployer $(cast wallet address --private-key "$PRIVATE_KEY")"
echo "[smoke] balance $(cast balance "$(cast wallet address --private-key "$PRIVATE_KEY")" --rpc-url "$RPC")"

run script/ModuleMatrixInk.s.sol
sleep 3
run script/SmokeKitchenSinkInk.s.sol
sleep 3
run script/SmokeDynFeeVestInk.s.sol
sleep 3
MULTI_PHASE=launch MULTI_BUY_WEI="$MULTI_BUY" run script/SmokeLaunchMultiInk.s.sol
sleep 3
CLASSIC_PHASE=launch CLASSIC_BUY_WEI="$CLASSIC_BUY" run script/SmokeClassicInk.s.sol

MULTI_ID=$(cast call "$LAUNCH_FACTORY" "launchCount()(uint256)" --rpc-url "$RPC")
echo "[smoke] launchCount=$MULTI_ID — set ARB_LAUNCH_ID to launchMulti id manually if not last"

echo "[smoke] sell passes (next block) — set MATRIX_LAUNCH_IDS / SMOKE_LAUNCH_ID from logs"
echo "[smoke] arb: ARB_LAUNCH_ID=<multi> forge script script/SmokeArbInk.s.sol --broadcast"
echo "[smoke] aggregator: swap via BalancedAggregator on UI (no arb keeper)"
echo "[smoke] done"
