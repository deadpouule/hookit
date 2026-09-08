# Soft launch prep — Ink mainnet (57073)

Canonical addresses: [`deploy/ink/addresses.json`](deploy/ink/addresses.json).  
Script env template: [`deploy/ink/env.ink.example`](deploy/ink/env.ink.example).

## Status

| Check | Status |
| --- | --- |
| Ink public RPC (`INK_RPC_URL`) | `https://rpc-gel.inkonchain.com` |
| `DeployHookitCore` broadcast (57073) | **Superseded** — current stack is `RedeployHookitInk` block `55311109` |
| `VerifyInkDeploy.s.sol` | Run after syncing `.env` from `deploy/ink/env.ink.example` |
| Custom hook allowlist on factory | Run **`HardenInkSoftLaunch.s.sol`** once if `customHookAllowlistEnabled` is false |
| FeeEthRail ETH bridge | Deferred until a public USDG↔ETH pool exists |
| HookitSwapRouter required in web | Set `NEXT_PUBLIC_HOOKIT_SWAP_ROUTER` |
| Hosted indexer | Linode — `https://indexer.hookit.fun` |
| WalletConnect project ID | Required before public UI |

## Live addresses (57073)

| Contract | Address |
| --- | --- |
| **LaunchFactory** | `0x480bfb88985fb94f4345ed4bb2ec267db9ab9626` |
| **BondingLaunchFactory** | `0x13d6216a92b013daacd36e4f6d78ad9264af1a0c` |
| **HookitSwapRouter** | `0x145a1e9960f309991de920dde8fc2e4902f33325` |
| **MasterLaunchHook** | `0x2d936fcc92cbc7c33eebba0c9787f9256274eac8` |
| **GraduatedFeeHook** | `0x9558f74e81377ee0be24fbad660377b100266088` |
| **Native token (HOOKTEST / HTST)** | `0xd839eeed6c1fc0d0a2a12641256ac14bbae1d7d8` |
| **ProtocolRevenueDistributor** | `0x4149509d2293a61cb199e17227740eebfadd30c6` |
| **HkitBuyback** | `0x3d68cc2c71f3b146295c8d9c1a82b3591f24fccb` |
| **BuybackVault** (hook immutable) | `0x067f28dac32aa69362ef8c70fa3de76541f50bf6` |
| **HolderAirdropVault** (hook immutable) | `0x80c83d9761bca8693ad350f3347ab109103a104c` |
| **FeeEthRail** (distributor.feeRail) | `0xd9d24028a3a2dc0874b5d4f10c2770150a719acb` |

`INDEXER_START_BLOCK=55204587`

Previous factory generations remain indexed for historical tokens. The complete list is in
`deploy/ink/addresses.json`; the UI uses the current addresses above for new launches.

## Post-deploy checklist

```bash
# 1) Sync root .env (see deploy/ink/env.ink.example)
cp deploy/ink/env.ink.example .env   # then add PRIVATE_KEY

# 2) Verify wiring (read-only)
forge script script/VerifyInkDeploy.s.sol --rpc-url $INK_RPC_URL -vv

# 3) Harden soft launch — enable custom-hook allowlist (owner tx, once)
forge script script/HardenInkSoftLaunch.s.sol --rpc-url $INK_RPC_URL --broadcast

# 4) Optional: wire FeeEthRail when USDG/ETH pool exists
FEE_ETH_RAIL=0xd9d24028a3a2dc0874b5d4f10c2770150a719acb \
  forge script script/WireFeeEthRailInk.s.sol --rpc-url $INK_RPC_URL --broadcast

# 5) Dry-run latest bytecode on Ink fork
forge script script/DryRunInk.s.sol --fork-url $INK_RPC_URL --disable-code-size-limit -vv
```

## Flip Vercel / Linode env

**Vercel (UI):** https://hookit.fun / https://hookit-five.vercel.app/

```
NEXT_PUBLIC_HOOKIT_CHAIN=ink
NEXT_PUBLIC_INK_RPC_URL=https://rpc-gel.inkonchain.com
NEXT_PUBLIC_LAUNCH_FACTORY=0x480bfb88985fb94f4345ed4bb2ec267db9ab9626
NEXT_PUBLIC_BONDING_FACTORY=0x13d6216a92b013daacd36e4f6d78ad9264af1a0c
NEXT_PUBLIC_HOOKIT_SWAP_ROUTER=0x145a1e9960f309991de920dde8fc2e4902f33325
NEXT_PUBLIC_PROTOCOL_DISTRIBUTOR=0x4149509d2293a61cb199e17227740eebfadd30c6
NEXT_PUBLIC_HKIT_BUYBACK=0x3d68cc2c71f3b146295c8d9c1a82b3591f24fccb
NEXT_PUBLIC_NATIVE_TOKEN=0xd839eeed6c1fc0d0a2a12641256ac14bbae1d7d8
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<real>
INDEXER_URL=https://indexer.hookit.fun
```

**Linode `/opt/hookit/.env`:**

```
LAUNCH_FACTORY=0x480bfb88985fb94f4345ed4bb2ec267db9ab9626
BONDING_FACTORY=0x13d6216a92b013daacd36e4f6d78ad9264af1a0c
INDEXER_START_BLOCK=55204587
INK_RPC_URL=https://rpc-gel.inkonchain.com
INDEXER_DATA_DIR=/var/lib/hookit-indexer
```

After changing factory addresses, retain the existing `hookit-57073.json` store and restart
`hookit-indexer`; deleting it would discard historical generations.

## Smoke (private)

```bash
# Classic bonding
BONDING_FACTORY=0x13d6216a92b013daacd36e4f6d78ad9264af1a0c \
  forge script script/SmokeClassicInk.s.sol --rpc-url $INK_RPC_URL --broadcast

# Master + modules matrix
LAUNCH_FACTORY=0x480bfb88985fb94f4345ed4bb2ec267db9ab9626 \
  HOOKIT_SWAP_ROUTER=0x145a1e9960f309991de920dde8fc2e4902f33325 \
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
| Custom Solidity hooks **off** (UI + allowlist) | `setCustomHooksEnabled(true)` after audit |
| Unaudited disclaimer in UI | External audit |
| Daily fee keeper on Linode (`hookit-fee-keeper.timer`) | Same; tune TWAP / Gelato later |

### Bytecode note

Live stack is `RedeployHookitInk` (block `55311109`): custom-hook allowlist on, custom hooks off. It includes:

- `MasterLaunchHook` uses `getLiquidity()` (not `getSlot0` protocolFee) for depth / dynamic fees / floor.
- `LaunchFactory.launch()` writes `poolLaunchId` / `poolMarketIndex`.
- `HookitSwapRouter.swapExactInCompositeSell`.
- Live ETH/USD for FDV (`_ethUsdX18` + deploy `syncEthUsdPrice`).
- `GraduatedFeeHook` sweep impact guard uses **pre-swap** spot.

The UI still blocks custom Solidity hooks (`CUSTOM_SOLIDITY_HOOKS_ENABLED=false`) for the soft launch.
`HardenInkSoftLaunch.s.sol` already ran on this factory. `FeeEthRail.ethBridgeSet` stays false until a
public USDG↔ETH/WETH v4 pool exists (`WireFeeEthRailInk`).

## Do not

- Point production UI at Ink without `NEXT_PUBLIC_HOOKIT_SWAP_ROUTER`.
- Start indexer without `INDEXER_START_BLOCK`.
- Commit `PRIVATE_KEY` or RPC secrets.
- Mix Base Sepolia and Ink env in one store.

## Future redeploy

When ready to replace the live stack:

```bash
SKIP_FAIR_LAUNCH=true forge script script/RedeployHookitInk.s.sol:RedeployHookitInkScript \
  --rpc-url $INK_RPC_URL --broadcast --verify \
  --etherscan-api-key $INK_EXPLORER_API_KEY
```

Run `scripts/sync-ink-deploy.mjs`, update Vercel/Linode env, retain the historical indexer store, and restart services.
