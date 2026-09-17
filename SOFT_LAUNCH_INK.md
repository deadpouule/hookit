# Soft launch prep — Ink mainnet (57073)

Canonical **UI** addresses live in [`web/src/lib/contracts/config.ts`](web/src/lib/contracts/config.ts) (they win over stale Vercel env).  
Last forge sync dump: [`deploy/ink/addresses.json`](deploy/ink/addresses.json) — may trail a newer factory cutover.  
Script env template: [`deploy/ink/env.ink.example`](deploy/ink/env.ink.example).  
Protocol docs: [hookit.fun/docs](https://www.hookit.fun/docs).

## Status

| Check | Status |
| --- | --- |
| Ink public RPC (`INK_RPC_URL`) | `https://rpc-gel.inkonchain.com` |
| `DeployHookitCore` broadcast (57073) | **Superseded** — current stack is `RedeployHookitInk` block `56151088` |
| `VerifyInkDeploy.s.sol` | **VERIFY_INK_OK** on factory `0x54027828…` (block `56151088`) |
| Custom hook allowlist on factory | Run **`HardenInkSoftLaunch.s.sol`** once if `customHookAllowlistEnabled` is false |
| FeeEthRail ETH bridge | v3 WETH/USDG LP `0x5A56…343e46` (fee 1%) — **needs matching v4 pool** on PoolManager for `setEthBridge` |
| HookitSwapRouter required in web | Set `NEXT_PUBLIC_HOOKIT_SWAP_ROUTER` |
| Hosted indexer | Linode — `https://indexer.hookit.fun` |
| WalletConnect project ID | Required before public UI |

## Live addresses the UI uses (57073)

From `web/src/lib/contracts/config.ts`:

| Contract | Address |
| --- | --- |
| **LaunchFactory** | `0x54027828C6475d8FEeAB4fd81A7F79963bD7ed37` |
| **LaunchFactoryQuery** | `0x0e86Fe01653B0b49F9e65F3832e3dAedC21cD8f3` |
| **BondingLaunchFactory** | `0x4536B2fa48E6f81CdA1296AE87f288d20df610a4` |
| **HookitSwapRouter** | `0xf94e301607344B1B10ED1FE1A5099e92Cb76F362` |
| **BalancedAggregator** | `0x5Be5e0c91B8c3cfEF969c82e02776C6e3F92Bc98` |
| **V4ClaimsRedeemer** | `0x85065220eA534d999203BAC08eE506067B98Eaf5` |
| **ProtocolRevenueDistributor** | `0x91Ef75507E7154FBC09c2a6BF45Af3fdd25EB815` |
| **HkitBuyback** | `0x72b798F9AB2545D476424a8870Ab13F59AEE669b` |
| **Native token** | `0xF91BAaB0043bE02c5a1774ed837eaFEA3b283f38` |

Previous factory generations stay on-chain. `deploy/ink/addresses.json` lists older stacks. Do not point new launches at them. This cutover **wipes** the hosted indexer so the public catalogue starts empty on factory `0x54027828…`.

`INDEXER_START_BLOCK=56151088`

## Post-deploy checklist

```bash
# 1) Sync root .env (see deploy/ink/env.ink.example)
cp deploy/ink/env.ink.example .env   # then add PRIVATE_KEY

# 2) Verify wiring (read-only)
forge script script/VerifyInkDeploy.s.sol --rpc-url $INK_RPC_URL -vv

# 3) Harden soft launch — enable custom-hook allowlist (owner tx, once)
forge script script/HardenInkSoftLaunch.s.sol --rpc-url $INK_RPC_URL --broadcast

# 4) Wire FeeEthRail when a **v4** USDG/ETH or WETH/USDG pool exists (v3 LP alone is not enough)
FEE_ETH_RAIL=0x75Aa6B3E66B289132CDEc80a27A5a14f0c9403ff \
  forge script script/WireFeeEthRailInk.s.sol:WireFeeEthRailInk --rpc-url $INK_RPC_URL --broadcast
# Optional explicit v4 key (e.g. WETH/USDG fee 10000 spacing 200):
# ETH_BRIDGE_FEE=10000 ETH_BRIDGE_TICK_SPACING=200 ETH_BRIDGE_USE_WETH=true \
#   FEE_ETH_RAIL=0x6de... forge script script/WireFeeEthRailInk.s.sol:WireFeeEthRailInk --rpc-url $INK_RPC_URL --broadcast

# 5) Dry-run latest bytecode on Ink fork
forge script script/DryRunInk.s.sol --fork-url $INK_RPC_URL --disable-code-size-limit -vv
```

## Flip Vercel / Linode env

**Vercel (UI):** https://www.hookit.fun

On Ink the UI **ignores** stale `NEXT_PUBLIC_LAUNCH_FACTORY` and uses `web/src/lib/contracts/config.ts`. Still set these so other tools stay aligned:

```
NEXT_PUBLIC_HOOKIT_CHAIN=ink
NEXT_PUBLIC_INK_RPC_URL=https://rpc-gel.inkonchain.com
NEXT_PUBLIC_LAUNCH_FACTORY=0x54027828C6475d8FEeAB4fd81A7F79963bD7ed37
NEXT_PUBLIC_LAUNCH_FACTORY_QUERY=0x0e86Fe01653B0b49F9e65F3832e3dAedC21cD8f3
NEXT_PUBLIC_BONDING_FACTORY=0x4536B2fa48E6f81CdA1296AE87f288d20df610a4
NEXT_PUBLIC_HOOKIT_SWAP_ROUTER=0xf94e301607344B1B10ED1FE1A5099e92Cb76F362
NEXT_PUBLIC_BALANCED_AGGREGATOR=0x5Be5e0c91B8c3cfEF969c82e02776C6e3F92Bc98
NEXT_PUBLIC_CLAIMS_REDEEMER=0x85065220eA534d999203BAC08eE506067B98Eaf5
NEXT_PUBLIC_PROTOCOL_DISTRIBUTOR=0x91Ef75507E7154FBC09c2a6BF45Af3fdd25EB815
NEXT_PUBLIC_HKIT_BUYBACK=0x72b798F9AB2545D476424a8870Ab13F59AEE669b
NEXT_PUBLIC_NATIVE_TOKEN=0xF91BAaB0043bE02c5a1774ed837eaFEA3b283f38
NEXT_PUBLIC_DEV_BUY_SNIPE_EXEMPT=1
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<real>
INDEXER_URL=https://indexer.hookit.fun
```

**Linode `/opt/hookit/.env`:** watch only the current pair, then **wipe** the store so Explore starts empty:

```
LAUNCH_FACTORY=0x54027828C6475d8FEeAB4fd81A7F79963bD7ed37
BONDING_FACTORY=0x4536B2fa48E6f81CdA1296AE87f288d20df610a4
DISTRIBUTOR=0x91Ef75507E7154FBC09c2a6BF45Af3fdd25EB815
HKIT_BUYBACK=0x72b798F9AB2545D476424a8870Ab13F59AEE669b
HOOKIT_SWAP_ROUTER=0xf94e301607344B1B10ED1FE1A5099e92Cb76F362
BALANCED_AGGREGATOR=0x5Be5e0c91B8c3cfEF969c82e02776C6e3F92Bc98
MULTI_PAIR_ARB_EXECUTOR=0xF5D87eaE49A40723C15196A71F1d9b506eF5bA50
INDEXER_START_BLOCK=56151088
INK_RPC_URL=https://rpc-gel.inkonchain.com
INDEXER_DATA_DIR=/var/lib/hookit-indexer
```

Wipe (backup first, then delete — do **not** keep `hookit-57073.json` if the site must start from zero):

```bash
systemctl stop hookit-indexer
cp /var/lib/hookit-indexer/hookit-57073.json /root/hookit-57073.before-56151088.json
rm -f /var/lib/hookit-indexer/hookit-57073.json \
  /var/lib/hookit-indexer/hookit-57073.json.tmp
systemctl start hookit-indexer
curl -s https://indexer.hookit.fun/health | jq .
```

`/health` should show `tokens: 0`, `launchFactory: 0x54027828…`, `startBlock: 56151088`.

## Smoke (private)

```bash
# Classic bonding
BONDING_FACTORY=0x4536B2fa48E6f81CdA1296AE87f288d20df610a4 \
  forge script script/SmokeClassicInk.s.sol --rpc-url $INK_RPC_URL --broadcast

# Master + modules matrix (launch + first buy)
LAUNCH_FACTORY=0x54027828C6475d8FEeAB4fd81A7F79963bD7ed37 \
  HOOKIT_SWAP_ROUTER=0xf94e301607344B1B10ED1FE1A5099e92Cb76F362 \
  forge script script/ModuleMatrixInk.s.sol --rpc-url $INK_RPC_URL --broadcast --slow

# Sell everything bought above (ids printed by the launch phase)
MATRIX_PHASE=sell MATRIX_LAUNCH_IDS=5,6,7,8,9 \
  LAUNCH_FACTORY=0x54027828C6475d8FEeAB4fd81A7F79963bD7ed37 \
  HOOKIT_SWAP_ROUTER=0xf94e301607344B1B10ED1FE1A5099e92Cb76F362 \
  forge script script/ModuleMatrixInk.s.sol --rpc-url $INK_RPC_URL --broadcast --slow \
  --gas-estimate-multiplier 250
```

```bash
# Master launch carrying a dev buy in the launch tx (emits DevBuyExecuted), then sell it back
LAUNCH_FACTORY=0x54027828C6475d8FEeAB4fd81A7F79963bD7ed37 \
  HOOKIT_SWAP_ROUTER=0xf94e301607344B1B10ED1FE1A5099e92Cb76F362 \
  forge script script/SmokeDevBuyInk.s.sol --rpc-url $INK_RPC_URL --broadcast --slow
DEVBUY_PHASE=sell DEVBUY_LAUNCH_ID=<id> LAUNCH_FACTORY=... HOOKIT_SWAP_ROUTER=... \
  forge script script/SmokeDevBuyInk.s.sol --rpc-url $INK_RPC_URL --broadcast --slow \
  --gas-estimate-multiplier 250
```

Keep `--gas-estimate-multiplier 250` on the sell phases: forge simulates the whole script in one
warm EVM, so its per-tx estimate misses the cold-storage cost of `afterSwap` (floor defense,
burn, airdrop). The default 130 % limit ran out of gas on-chain on every module sell
(452k limit vs 386k–524k actually used) while the dry run passed. `--slow` waits for each
receipt so a public RPC never rejects the next nonce.

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
| Unaudited disclaimer in UI | External audit — start from [`audit/INTERNAL_SECURITY_REVIEW.md`](audit/INTERNAL_SECURITY_REVIEW.md) |
| Live stack includes the internal review bytecode (C-5 / C-9 / C-11, vault snapshot, Max Wallet removed) | External audit + timelock before a loud public launch |
| Daily fee keeper on Linode (`hookit-fee-keeper.timer`) | Same; tune TWAP / Gelato later |

### Bytecode note

Live stack is `RedeployHookitInk` (block `56151088`): custom-hook allowlist on, custom hooks off. It includes:

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

Run `scripts/sync-ink-deploy.mjs`, update Vercel/Linode env, wipe the indexer store for a clean catalogue, and restart services.
