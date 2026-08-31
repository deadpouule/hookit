# Soft launch prep — Ink mainnet (57073)

Canonical addresses: [`deploy/ink/addresses.json`](deploy/ink/addresses.json).  
Script env template: [`deploy/ink/env.ink.example`](deploy/ink/env.ink.example).

## Status

| Check | Status |
| --- | --- |
| Ink public RPC (`INK_RPC_URL`) | `https://rpc-gel.inkonchain.com` |
| `DeployHookitCore` broadcast (57073) | **Live** — block `54547596` |
| `VerifyInkDeploy.s.sol` | Run after syncing `.env` from `deploy/ink/env.ink.example` |
| Custom hook allowlist on factory | Run **`HardenInkSoftLaunch.s.sol`** once if `customHookAllowlistEnabled` is false |
| FeeEthRail ETH bridge | Deferred until a public USDG↔ETH pool exists |
| HookitSwapRouter required in web | Set `NEXT_PUBLIC_HOOKIT_SWAP_ROUTER` |
| Hosted indexer | Linode — `https://indexer.hookit.fun` |
| WalletConnect project ID | Required before public UI |

## Live addresses (57073)

| Contract | Address |
| --- | --- |
| **LaunchFactory** | `0xa2366b74e2bdc6d80f7b32b6382c28d4ff9a74c2` |
| **BondingLaunchFactory** | `0x2003af38d2f995fb78cfa9feadcd2b05c903fb80` |
| **HookitSwapRouter** | `0xe76b7f77ddcdcd892f6b808387a784997f3d8af2` |
| **MasterLaunchHook** | `0xa33c80507b82816f84cce80f2aa0f6d5cd5beac8` |
| **GraduatedFeeHook** | `0x82bfc49342a5fac13ad78d44d9bf64ff57a72088` |
| **Native token (HOOKTEST / HTST)** | `0x9E6D824deE12B586955116A8881f3186194Ee468` |
| **ProtocolRevenueDistributor** | `0x436ad54eb2c36f58ce856e26fe42e1b0fe9c0bf1` |
| **HkitBuyback** | `0xeccad668aa9601c2c8373561dfb0976bc6eb680c` |

`INDEXER_START_BLOCK=54547596`

## Post-deploy checklist

```bash
# 1) Sync root .env (see deploy/ink/env.ink.example)
cp deploy/ink/env.ink.example .env   # then add PRIVATE_KEY

# 2) Verify wiring (read-only)
forge script script/VerifyInkDeploy.s.sol --rpc-url $INK_RPC_URL -vv

# 3) Harden soft launch — enable custom-hook allowlist (owner tx, once)
forge script script/HardenInkSoftLaunch.s.sol --rpc-url $INK_RPC_URL --broadcast

# 4) Optional: wire FeeEthRail when USDG/ETH pool exists
FEE_ETH_RAIL=0x903df3daed1062eb2abec4a0a4098d9152228c0a \
  forge script script/WireFeeEthRailInk.s.sol --rpc-url $INK_RPC_URL --broadcast

# 5) Dry-run latest bytecode on Ink fork
forge script script/DryRunInk.s.sol --fork-url $INK_RPC_URL --disable-code-size-limit -vv
```

## Flip Vercel / Linode env

**Vercel (UI):** https://hookit.fun / https://hookit-five.vercel.app/

```
NEXT_PUBLIC_HOOKIT_CHAIN=ink
NEXT_PUBLIC_INK_RPC_URL=https://rpc-gel.inkonchain.com
NEXT_PUBLIC_LAUNCH_FACTORY=0xa2366b74e2bdc6d80f7b32b6382c28d4ff9a74c2
NEXT_PUBLIC_BONDING_FACTORY=0x2003af38d2f995fb78cfa9feadcd2b05c903fb80
NEXT_PUBLIC_HOOKIT_SWAP_ROUTER=0xe76b7f77ddcdcd892f6b808387a784997f3d8af2
NEXT_PUBLIC_PROTOCOL_DISTRIBUTOR=0x436ad54eb2c36f58ce856e26fe42e1b0fe9c0bf1
NEXT_PUBLIC_HKIT_BUYBACK=0xeccad668aa9601c2c8373561dfb0976bc6eb680c
NEXT_PUBLIC_NATIVE_TOKEN=0x9E6D824deE12B586955116A8881f3186194Ee468
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<real>
INDEXER_URL=https://indexer.hookit.fun
```

**Linode `/opt/hookit/.env`:**

```
LAUNCH_FACTORY=0xa2366b74e2bdc6d80f7b32b6382c28d4ff9a74c2
BONDING_FACTORY=0x2003af38d2f995fb78cfa9feadcd2b05c903fb80
INDEXER_START_BLOCK=54547596
INK_RPC_URL=https://rpc-gel.inkonchain.com
INDEXER_DATA_DIR=/var/lib/hookit-indexer
```

After changing factory or start block: delete `hookit-57073.json` store and restart `hookit-indexer`.

## Smoke (private)

```bash
# Classic bonding
BONDING_FACTORY=0x2003af38d2f995fb78cfa9feadcd2b05c903fb80 \
  forge script script/SmokeClassicInk.s.sol --rpc-url $INK_RPC_URL --broadcast

# Master + modules matrix
LAUNCH_FACTORY=0xa2366b74e2bdc6d80f7b32b6382c28d4ff9a74c2 \
  HOOKIT_SWAP_ROUTER=0xe76b7f77ddcdcd892f6b808387a784997f3d8af2 \
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

The live Ink deploy predates repo hardening (`customHooksEnabled`, max-wallet pre-swap, required `hookData`). For those fixes on-chain, run a **fresh** `DeployHookitCore` (new addresses — update indexer + Vercel). Until then:

- UI blocks custom Solidity hooks (`CUSTOM_SOLIDITY_HOOKS_ENABLED=false`).
- Run `HardenInkSoftLaunch.s.sol` so the factory rejects non-allowlisted custom hooks.

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
