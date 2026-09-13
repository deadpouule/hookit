# Soft launch prep — Ink mainnet (57073)

Canonical **UI** addresses live in [`web/src/lib/contracts/config.ts`](web/src/lib/contracts/config.ts) (they win over stale Vercel env).  
Last forge sync dump: [`deploy/ink/addresses.json`](deploy/ink/addresses.json) — may trail a newer factory cutover.  
Script env template: [`deploy/ink/env.ink.example`](deploy/ink/env.ink.example).  
Protocol docs: [hookit.fun/docs](https://www.hookit.fun/docs).

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

## Live addresses the UI uses (57073)

From `web/src/lib/contracts/config.ts`:

| Contract | Address |
| --- | --- |
| **LaunchFactory** | `0xdca9ccee27dc12256818deff316ba4b972b087a7` |
| **LaunchFactoryQuery** | `0xeb76e32818331fc4cbaf1033d4949c9ee1d851f0` |
| **BondingLaunchFactory** | `0xfeecd83d9ad44f6db03c531e78f1bc6d807315d3` |
| **HookitSwapRouter** | `0x6889635f39c472802abde7db791f2ea48090091a` |
| **V4ClaimsRedeemer** | `0xb497aa20c231a234f24fe28f412b8637608661fb` |
| **ProtocolRevenueDistributor** | `0x2f904d2c2dc5dc536f41cf99bcf0ac6034187179` |
| **HkitBuyback** | `0xa52e86ee01695d9f4883c48eff2972cf4be1c941` |
| **Native token** | `0x964ce443c5e111ea1b87a70166c6894af3eddb08` |

Previous factory generations stay on-chain for historical tokens. `deploy/ink/addresses.json` lists older stacks. Do not point new launches at them.

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

**Vercel (UI):** https://www.hookit.fun

On Ink the UI **ignores** stale `NEXT_PUBLIC_LAUNCH_FACTORY` and uses `web/src/lib/contracts/config.ts`. Still set these so other tools stay aligned:

```
NEXT_PUBLIC_HOOKIT_CHAIN=ink
NEXT_PUBLIC_INK_RPC_URL=https://rpc-gel.inkonchain.com
NEXT_PUBLIC_LAUNCH_FACTORY=0xdca9ccee27dc12256818deff316ba4b972b087a7
NEXT_PUBLIC_LAUNCH_FACTORY_QUERY=0xeb76e32818331fc4cbaf1033d4949c9ee1d851f0
NEXT_PUBLIC_BONDING_FACTORY=0xfeecd83d9ad44f6db03c531e78f1bc6d807315d3
NEXT_PUBLIC_HOOKIT_SWAP_ROUTER=0x6889635f39c472802abde7db791f2ea48090091a
NEXT_PUBLIC_PROTOCOL_DISTRIBUTOR=0x2f904d2c2dc5dc536f41cf99bcf0ac6034187179
NEXT_PUBLIC_HKIT_BUYBACK=0xa52e86ee01695d9f4883c48eff2972cf4be1c941
NEXT_PUBLIC_NATIVE_TOKEN=0x964ce443c5e111ea1b87a70166c6894af3eddb08
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<real>
INDEXER_URL=https://indexer.hookit.fun
```

**Linode `/opt/hookit/.env`:** keep historical factories in the indexer store. Point *new* polls at the current pair:

```
LAUNCH_FACTORY=0xdca9ccee27dc12256818deff316ba4b972b087a7
BONDING_FACTORY=0xfeecd83d9ad44f6db03c531e78f1bc6d807315d3
INDEXER_START_BLOCK=55566276
INK_RPC_URL=https://rpc-gel.inkonchain.com
INDEXER_DATA_DIR=/var/lib/hookit-indexer
```

After changing factory addresses, retain the existing `hookit-57073.json` store and restart
`hookit-indexer`; deleting it would discard historical generations.

## Smoke (private)

```bash
# Classic bonding
BONDING_FACTORY=0xfeecd83d9ad44f6db03c531e78f1bc6d807315d3 \
  forge script script/SmokeClassicInk.s.sol --rpc-url $INK_RPC_URL --broadcast

# Master + modules matrix
LAUNCH_FACTORY=0xdca9ccee27dc12256818deff316ba4b972b087a7 \
  HOOKIT_SWAP_ROUTER=0x6889635f39c472802abde7db791f2ea48090091a \
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
