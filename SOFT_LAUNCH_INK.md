# Soft launch prep — Ink mainnet (57073)

Canonical addresses: [`deploy/ink/addresses.json`](deploy/ink/addresses.json).  
Script env template: [`deploy/ink/env.ink.example`](deploy/ink/env.ink.example).

## Status

| Check | Status |
| --- | --- |
| Ink public RPC (`INK_RPC_URL`) | `https://rpc-gel.inkonchain.com` |
| `DeployHookitCore` broadcast (57073) | **Superseded** — current stack is `RedeployHookitInk` block `54712334` |
| `VerifyInkDeploy.s.sol` | Run after syncing `.env` from `deploy/ink/env.ink.example` |
| Custom hook allowlist on factory | Run **`HardenInkSoftLaunch.s.sol`** once if `customHookAllowlistEnabled` is false |
| FeeEthRail ETH bridge | Deferred until a public USDG↔ETH pool exists |
| HookitSwapRouter required in web | Set `NEXT_PUBLIC_HOOKIT_SWAP_ROUTER` |
| Hosted indexer | Linode — `https://indexer.hookit.fun` |
| WalletConnect project ID | Required before public UI |

## Live addresses (57073)

| Contract | Address |
| --- | --- |
| **LaunchFactory** | `0xeb05916ac2356956224c7d9b75c0c8c01503d24c` |
| **BondingLaunchFactory** | `0x0e6504f6e6aa5e3009ec3e5afa52fca1306f8dbe` |
| **HookitSwapRouter** | `0x23dcdc9570ccfe93807da99b395db6a24a79a239` |
| **MasterLaunchHook** | `0xfe09ecab802e3567df96b94d2a4ec294b6272ac8` |
| **GraduatedFeeHook** | `0xfe9be77c9b3349ba1095a150bd29a48fc9a9e088` |
| **Native token (HOOKTEST / HTST)** | `0x9403cc96dbc7a63bbd5af65123653acd6938f688` |
| **ProtocolRevenueDistributor** | `0x302e52f0252360325796b7eb6a03409de40266ac` |
| **HkitBuyback** | `0xaf8fac4edfddc7446e8eb6282eb04163645b6fd9` |
| **BuybackVault** (hook immutable) | `0x7c2cce72da7fd791e7e4bd1e3b8dda4ee4ba53b1` |
| **HolderAirdropVault** (hook immutable) | `0x869c3ff9f449f1f1470f8b257d73bcbaf52ffe77` |
| **FeeEthRail** (distributor.feeRail) | `0xf1fdb0f7debefdc4ff7158f2bc2922722e27fe71` |

`INDEXER_START_BLOCK=54712334`

Prior factory `0xa2366b74…` (11 launches, start block `54547596`) is retired — indexer + www.hookit.fun use the addresses above.

## Post-deploy checklist

```bash
# 1) Sync root .env (see deploy/ink/env.ink.example)
cp deploy/ink/env.ink.example .env   # then add PRIVATE_KEY

# 2) Verify wiring (read-only)
forge script script/VerifyInkDeploy.s.sol --rpc-url $INK_RPC_URL -vv

# 3) Harden soft launch — enable custom-hook allowlist (owner tx, once)
forge script script/HardenInkSoftLaunch.s.sol --rpc-url $INK_RPC_URL --broadcast

# 4) Optional: wire FeeEthRail when USDG/ETH pool exists
FEE_ETH_RAIL=0xf1fdb0f7debefdc4ff7158f2bc2922722e27fe71 \
  forge script script/WireFeeEthRailInk.s.sol --rpc-url $INK_RPC_URL --broadcast

# 5) Dry-run latest bytecode on Ink fork
forge script script/DryRunInk.s.sol --fork-url $INK_RPC_URL --disable-code-size-limit -vv
```

## Flip Vercel / Linode env

**Vercel (UI):** https://hookit.fun / https://hookit-five.vercel.app/

```
NEXT_PUBLIC_HOOKIT_CHAIN=ink
NEXT_PUBLIC_INK_RPC_URL=https://rpc-gel.inkonchain.com
NEXT_PUBLIC_LAUNCH_FACTORY=0xeb05916ac2356956224c7d9b75c0c8c01503d24c
NEXT_PUBLIC_BONDING_FACTORY=0x0e6504f6e6aa5e3009ec3e5afa52fca1306f8dbe
NEXT_PUBLIC_HOOKIT_SWAP_ROUTER=0x23dcdc9570ccfe93807da99b395db6a24a79a239
NEXT_PUBLIC_PROTOCOL_DISTRIBUTOR=0x302e52f0252360325796b7eb6a03409de40266ac
NEXT_PUBLIC_HKIT_BUYBACK=0xaf8fac4edfddc7446e8eb6282eb04163645b6fd9
NEXT_PUBLIC_NATIVE_TOKEN=0x9403cc96dbc7a63bbd5af65123653acd6938f688
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<real>
INDEXER_URL=https://indexer.hookit.fun
```

**Linode `/opt/hookit/.env`:**

```
LAUNCH_FACTORY=0xeb05916ac2356956224c7d9b75c0c8c01503d24c
BONDING_FACTORY=0x0e6504f6e6aa5e3009ec3e5afa52fca1306f8dbe
INDEXER_START_BLOCK=54712334
INK_RPC_URL=https://rpc-gel.inkonchain.com
INDEXER_DATA_DIR=/var/lib/hookit-indexer
```

After changing factory or start block: delete `hookit-57073.json` store and restart `hookit-indexer`.

## Smoke (private)

```bash
# Classic bonding
BONDING_FACTORY=0x0e6504f6e6aa5e3009ec3e5afa52fca1306f8dbe \
  forge script script/SmokeClassicInk.s.sol --rpc-url $INK_RPC_URL --broadcast

# Master + modules matrix
LAUNCH_FACTORY=0xeb05916ac2356956224c7d9b75c0c8c01503d24c \
  HOOKIT_SWAP_ROUTER=0x23dcdc9570ccfe93807da99b395db6a24a79a239 \
  forge script script/ModuleMatrixInk.s.sol --rpc-url $INK_RPC_URL --broadcast
```

1. Launch Master (ETH) → swap via HookitSwapRouter.
2. Launch Classic → buy on curve.
3. `GET /health` on indexer — low lag, no `lastPollError`.
4. Token page: chart + trades from indexer.

## Soft launch vs hard launch

| Soft (now) | Later |
| --- | --- |
| Small circle / no big announce | Public marketing |
| Deployer or multisig as owner | Timelock handoff |
| Custom Solidity hooks **off** (UI + allowlist) | `setCustomHooksEnabled(true)` after redeploy with hardened factory |
| Unaudited disclaimer in UI | External audit |
| Buyback keeper manual | Automated `HkitBuyback.execute` |

### Bytecode note

Live stack is `RedeployHookitInk` (block `54712334`): custom-hook allowlist on, custom hooks off. Source now includes (need a **new** factory / hook / router / graduated hook — existing tokens stay on old bytecode):

- `MasterLaunchHook` uses `getLiquidity()` (not `getSlot0` protocolFee) for depth / dynamic fees / floor.
- `LaunchFactory.launch()` writes `poolLaunchId` / `poolMarketIndex` (live singles have `poolLaunchId = 0`).
- `HookitSwapRouter.swapExactInCompositeSell` (live router has composite **buy** only).
- Live ETH/USD for FDV (`_ethUsdX18` + deploy `syncEthUsdPrice`).
- `GraduatedFeeHook` sweep impact guard uses **pre-swap** spot.

Until that redeploy: UI blocks custom Solidity hooks (`CUSTOM_SOLIDITY_HOOKS_ENABLED=false`). `HardenInkSoftLaunch.s.sol` already ran on this factory. `FeeEthRail.ethBridgeSet` stays false until a public USDG↔ETH/WETH v4 pool exists (`WireFeeEthRailInk`).

## Do not

- Point production UI at Ink without `NEXT_PUBLIC_HOOKIT_SWAP_ROUTER`.
- Start indexer without `INDEXER_START_BLOCK`.
- Commit `PRIVATE_KEY` or RPC secrets.
- Mix Base Sepolia and Ink env in one store.

## Redeploy (v2 hardened bytecode)

When ready to replace the live stack:

```bash
forge script script/DeployHookitCore.s.sol:DeployHookitCoreScript \
  --rpc-url $INK_RPC_URL --broadcast --verify \
  --etherscan-api-key $INK_EXPLORER_API_KEY
```

Update `deploy/ink/addresses.json`, all env files, indexer start block, and reset the indexer store.
