# Soft launch prep — Ink mainnet (57073)

Prep only. Do **not** broadcast until every GO item is checked.

## Status (prep)

| Check | Status |
| --- | --- |
| Ink public RPC (`INK_RPC_URL`) | Use `https://rpc-gel.inkonchain.com` — no Alchemy required |
| `DryRunInk.s.sol` on live Ink fork | Pass (`DRY_RUN_OK`) — Master + Classic + HKIT smoke |
| FeeEthRail ETH bridge | Deferred until a public USDG↔ETH pool exists |
| HookitSwapRouter required in web | Code rejects Ink swaps without `NEXT_PUBLIC_HOOKIT_SWAP_ROUTER` |
| Ink factories deployed | **Not yet** |
| Hosted indexer | **Linode 1 GB** — [deploy/linode/indexer-only/README.md](deploy/linode/indexer-only/README.md) |
| WalletConnect project ID | **Set before public UI** |

## Before first broadcast

1. Fund deployer with Ink ETH (gas for full `DeployHookitCore`).
2. Set `OPS_TREASURY` (multisig preferred) in root `.env`.
3. Set `PRIVATE_KEY` in root `.env` (never commit).
4. Native token branding defaults to **HOOKTEST** / **HTST** (override `NATIVE_TOKEN_NAME`, `NATIVE_TOKEN_SYMBOL`, `NATIVE_TOKEN_URI`).
5. Confirm `INK_RPC_URL=https://rpc-gel.inkonchain.com` (public Gelato RPC). Optional `INDEXER_RPC_URL` only if the indexer node needs a different endpoint.
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

**Production UI:** Linode self-host ([deploy/linode/README.md](deploy/linode/README.md)) or Vercel — indexer must be reachable via `INDEXER_URL`.

### Linode (recommended — web + indexer + custom hook forge)

See **`deploy/linode/README.md`**. Quick path:

```bash
./deploy/linode/bootstrap.sh          # once, as root
cp deploy/linode/env.production.example /opt/hookit/.env
sudo -u hookit ./deploy/linode/deploy.sh
```

### Vercel (UI only — point INDEXER_URL at Linode)

**Production UI:** https://hookit-five.vercel.app/

```
NEXT_PUBLIC_HOOKIT_CHAIN=ink
NEXT_PUBLIC_INK_RPC_URL=https://rpc-gel.inkonchain.com
NEXT_PUBLIC_LAUNCH_FACTORY=0x…
NEXT_PUBLIC_BONDING_FACTORY=0x…
NEXT_PUBLIC_HOOKIT_SWAP_ROUTER=0x…
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<real>
INDEXER_URL=http://127.0.0.1:8787   # local house indexer (see indexer/README.md)
PINATA_JWT=<optional but recommended>
```

### Local web (`web/.env.local`)

### Indexer

```
HOOKIT_CHAIN=ink
INK_RPC_URL=https://rpc-gel.inkonchain.com
# INDEXER_RPC_URL=   # optional override; defaults to INK_RPC_URL
LAUNCH_FACTORY=0x…   # from repo root .env or paste deploy address
BONDING_FACTORY=0x…
INDEXER_START_BLOCK=<deploy_block>
INDEXER_DATA_DIR=/var/lib/hookit-indexer
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
- Commit `PRIVATE_KEY` or RPC secrets.
