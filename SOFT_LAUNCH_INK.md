# Soft launch prep — Ink mainnet (57073)

Canonical **UI** addresses live in [`web/src/lib/contracts/config.ts`](web/src/lib/contracts/config.ts) (they win over stale Vercel env).  
Last forge sync dump: [`deploy/ink/addresses.json`](deploy/ink/addresses.json) — may trail a newer factory cutover.  
Script env template: [`deploy/ink/env.ink.example`](deploy/ink/env.ink.example).  
Protocol docs: [hookit.fun/docs](https://www.hookit.fun/docs).

## Status

| Check | Status |
| --- | --- |
| Ink public RPC (`INK_RPC_URL`) | `https://rpc-gel.inkonchain.com` |
| `DeployHookitCore` broadcast (57073) | **Superseded** — current stack is `RedeployHookitInk` block `55929992` |
| `VerifyInkDeploy.s.sol` | **VERIFY_INK_OK** on factory `0x5709Aa29…` (block `55929992`) |
| Custom hook allowlist on factory | Run **`HardenInkSoftLaunch.s.sol`** once if `customHookAllowlistEnabled` is false |
| FeeEthRail ETH bridge | Deferred until a public USDG↔ETH pool exists |
| HookitSwapRouter required in web | Set `NEXT_PUBLIC_HOOKIT_SWAP_ROUTER` |
| Hosted indexer | Linode — `https://indexer.hookit.fun` |
| WalletConnect project ID | Required before public UI |

## Live addresses the UI uses (57073)

From `web/src/lib/contracts/config.ts`:

| Contract | Address |
| --- | --- |
| **LaunchFactory** | `0x5709Aa29ED27FF098e76378999C9B0CDE42b83E0` |
| **LaunchFactoryQuery** | `0x58B038697b27aE16efaEbb200c6bA86D28fa42D9` |
| **BondingLaunchFactory** | `0xa629619D516BE82308dbdB12A4ca324c44ea9c67` |
| **HookitSwapRouter** | `0x718dAb9d61eEEE18c11399598254F2CC59f95dA9` |
| **V4ClaimsRedeemer** | `0xd95458005acd7AA90823543F43b30f3a4B7aF057` |
| **ProtocolRevenueDistributor** | `0xCc6F74989f8400751Eb77421E0bDCC280b58A608` |
| **HkitBuyback** | `0xa3820E552D6C61650cE8B9b76306385271fDC736` |
| **Native token** | `0x964ce443c5e111ea1b87a70166c6894af3eddb08` |

Previous factory generations stay on-chain. `deploy/ink/addresses.json` lists older stacks. Do not point new launches at them. This cutover **wipes** the hosted indexer so the public catalogue starts empty on factory `0x5709Aa29…`.

`INDEXER_START_BLOCK=55929992`

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
NEXT_PUBLIC_LAUNCH_FACTORY=0x5709Aa29ED27FF098e76378999C9B0CDE42b83E0
NEXT_PUBLIC_LAUNCH_FACTORY_QUERY=0x58B038697b27aE16efaEbb200c6bA86D28fa42D9
NEXT_PUBLIC_BONDING_FACTORY=0xa629619D516BE82308dbdB12A4ca324c44ea9c67
NEXT_PUBLIC_HOOKIT_SWAP_ROUTER=0x718dAb9d61eEEE18c11399598254F2CC59f95dA9
NEXT_PUBLIC_PROTOCOL_DISTRIBUTOR=0xCc6F74989f8400751Eb77421E0bDCC280b58A608
NEXT_PUBLIC_HKIT_BUYBACK=0xa3820E552D6C61650cE8B9b76306385271fDC736
NEXT_PUBLIC_NATIVE_TOKEN=0x964ce443c5e111ea1b87a70166c6894af3eddb08
NEXT_PUBLIC_DEV_BUY_SNIPE_EXEMPT=1
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<real>
INDEXER_URL=https://indexer.hookit.fun
```

**Linode `/opt/hookit/.env`:** watch only the current pair, then **wipe** the store so Explore starts empty:

```
LAUNCH_FACTORY=0x5709Aa29ED27FF098e76378999C9B0CDE42b83E0
BONDING_FACTORY=0xa629619D516BE82308dbdB12A4ca324c44ea9c67
DISTRIBUTOR=0xCc6F74989f8400751Eb77421E0bDCC280b58A608
HKIT_BUYBACK=0xa3820E552D6C61650cE8B9b76306385271fDC736
HOOKIT_SWAP_ROUTER=0x718dAb9d61eEEE18c11399598254F2CC59f95dA9
MULTI_PAIR_ARB_EXECUTOR=0x3B726f9F906E225CbDdBa777844317a5793eC0d5
INDEXER_START_BLOCK=55929992
INK_RPC_URL=https://rpc-gel.inkonchain.com
INDEXER_DATA_DIR=/var/lib/hookit-indexer
```

Wipe (backup first, then delete — do **not** keep `hookit-57073.json` if the site must start from zero):

```bash
systemctl stop hookit-indexer
cp /var/lib/hookit-indexer/hookit-57073.json /root/hookit-57073.before-55929992.json
rm -f /var/lib/hookit-indexer/hookit-57073.json \
  /var/lib/hookit-indexer/hookit-57073.json.tmp
systemctl start hookit-indexer
curl -s https://indexer.hookit.fun/health | jq .
```

`/health` should show `tokens: 0`, `launchFactory: 0x5709aa29…`, `startBlock: 55929992`.

## Smoke (private)

```bash
# Classic bonding
BONDING_FACTORY=0xa629619D516BE82308dbdB12A4ca324c44ea9c67 \
  forge script script/SmokeClassicInk.s.sol --rpc-url $INK_RPC_URL --broadcast

# Master + modules matrix (launch + first buy)
LAUNCH_FACTORY=0x5709Aa29ED27FF098e76378999C9B0CDE42b83E0 \
  HOOKIT_SWAP_ROUTER=0x718dAb9d61eEEE18c11399598254F2CC59f95dA9 \
  forge script script/ModuleMatrixInk.s.sol --rpc-url $INK_RPC_URL --broadcast --slow

# Sell everything bought above (ids printed by the launch phase)
MATRIX_PHASE=sell MATRIX_LAUNCH_IDS=5,6,7,8,9 \
  LAUNCH_FACTORY=0x5709Aa29ED27FF098e76378999C9B0CDE42b83E0 \
  HOOKIT_SWAP_ROUTER=0x718dAb9d61eEEE18c11399598254F2CC59f95dA9 \
  forge script script/ModuleMatrixInk.s.sol --rpc-url $INK_RPC_URL --broadcast --slow \
  --gas-estimate-multiplier 250
```

```bash
# Master launch carrying a dev buy in the launch tx (emits DevBuyExecuted), then sell it back
LAUNCH_FACTORY=0x5709Aa29ED27FF098e76378999C9B0CDE42b83E0 \
  HOOKIT_SWAP_ROUTER=0x718dAb9d61eEEE18c11399598254F2CC59f95dA9 \
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

Live stack is `RedeployHookitInk` (block `55929992`): custom-hook allowlist on, custom hooks off. It includes:

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
