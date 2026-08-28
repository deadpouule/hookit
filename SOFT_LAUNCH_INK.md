# Soft launch prep — Ink mainnet (57073)

Prep only. Do **not** broadcast until every GO item is checked.

## Status (prep)

| Check | Status |
| --- | --- |
| Alchemy / dedicated Ink RPC | Wired in local `.env` (not committed) |
| `DryRunInk.s.sol` on live Ink fork | Pass (`DRY_RUN_OK`) — Master + Classic + HKIT smoke |
| FeeEthRail ETH bridge | Deferred until a public USDG↔ETH pool exists |
| HookitSwapRouter required in web | Code rejects Ink swaps without `NEXT_PUBLIC_HOOKIT_SWAP_ROUTER` |
| Ink factories deployed | **Not yet** |
| Hosted indexer | **Not yet** |
| WalletConnect project ID | **Set before public UI** |

## Before first broadcast

1. Fund deployer with Ink ETH (gas for full `DeployHookitCore`).
2. Set `OPS_TREASURY` (multisig preferred) in root `.env`.
3. Confirm `INK_RPC_URL` = dedicated Alchemy (or other) endpoint.
4. Optional: `INK_EXPLORER_API_KEY` for `forge verify`.
5. Re-run dry-run:
   ```bash
   forge script script/DryRunInk.s.sol --fork-url $INK_RPC_URL --disable-code-size-limit -vv
   ```
   Expect `DRY_RUN_OK` and note the `WARN: FeeEthRail eth bridge not live` (expected today).

## Deploy day (when you decide to go)

```bash
forge script script/DeployHookitCore.s.sol:DeployHookitCoreScript \
  --rpc-url $INK_RPC_URL --broadcast --verify \
  --etherscan-api-key $INK_EXPLORER_API_KEY
```

Record from logs / broadcast JSON:

- `LaunchFactory`
- `BondingLaunchFactory`
- `HookitSwapRouter`
- `MasterLaunchHook` / `GraduatedFeeHook`
- Deploy **block number** → `INDEXER_START_BLOCK`

Then try `script/WireFeeEthRailInk.s.sol` if `ethBridgeSet()` is still false.

## Flip the stack to Ink (after addresses exist)

### Web (`web/.env.local` / Vercel)

```
NEXT_PUBLIC_HOOKIT_CHAIN=ink
NEXT_PUBLIC_INK_RPC_URL=<alchemy>
NEXT_PUBLIC_LAUNCH_FACTORY=0x…
NEXT_PUBLIC_BONDING_FACTORY=0x…
NEXT_PUBLIC_HOOKIT_SWAP_ROUTER=0x…
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<real>
INDEXER_URL=https://<hosted-indexer>
PINATA_JWT=<optional but recommended>
```

### Indexer

```
HOOKIT_CHAIN=ink
INDEXER_RPC_URL=<alchemy>
LAUNCH_FACTORY=0x…
BONDING_FACTORY=0x…
INDEXER_START_BLOCK=<deploy_block>
INDEXER_DATA_DIR=/var/lib/hookit-indexer   # persistent volume
INDEXER_POLL_MS=4000
```

Keep Base Sepolia env elsewhere for regression; do not mix chain IDs in one store.

## Smoke after flip (private)

1. Launch Master (ETH quote) → swap buy/sell via HookitSwapRouter.
2. Launch Classic → buy on curve → progress toward graduation.
3. Launch wStock quote (e.g. wSPYx) if Quotrons depth looks healthy.
4. `GET /health` — lag low, no `lastPollError`.
5. Token page: chart + recent trades from indexer.
6. Creator fee claim path once fees accrued.

## Soft launch vs hard launch

| Soft | Later |
| --- | --- |
| Small circle / no big announce | Public marketing |
| Deployer or known multisig as owner | Timelock / multisig handoff |
| Custom hooks unrestricted (default) | Consider `customHookAllowlistEnabled` |
| Unaudited disclaimer in UI/docs | External audit |
| Buyback keeper manual / rare | Automated `HkitBuyback.execute` |

## Do not

- Broadcast without funded deployer + `OPS_TREASURY`.
- Point production UI at Ink without `HOOKIT_SWAP_ROUTER`.
- Start indexer without `INDEXER_START_BLOCK` (avoids 80k lookback).
- Commit Alchemy keys or `PRIVATE_KEY`.
