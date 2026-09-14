# Internal security review — Hookit launch stack (Ink)

Date: 2026-09-14 · Branch: `cursor/ink-live-addresses-phase2-ad60` · Reviewed at `cfce7fa`, fixes land in the commits listed per finding.

This is an **internal** review performed by the engineering agent, not an independent third-party audit. It is meant to (a) fix what can be fixed before the hard launch, (b) give an external auditor a head start, and (c) record the limitations that were consciously left in place. Every finding that could be reproduced has a Foundry test under `test/audit/`; the tests that start with `test_Fixed_` assert the patched behaviour, the ones that start with `test_Known_` pin down a documented limitation so a silent change in behaviour is noticed.

```bash
forge test --match-path "test/audit/*.t.sol" -vv   # 23 tests
forge test                                          # 301 tests, all green at the time of writing
```

## 1. Scope and method

| Layer | What was done |
| --- | --- |
| Contracts (`src/`) | Line-by-line review split across three independent reviewers: (1) `LaunchFactory` + `MasterLaunchHook` + libraries; (2) fee routing, vaults, airdrop (`FeeSplitLib`, `FeeEscrow`, `FloorVault`, `BuybackVault`, `HolderAirdropVault`, `HktHolderDropVault`, `ProtocolRevenueDistributor`, `HkitBuyback`, `FeeEthRail`); (3) Classic rail (`BondingLaunchFactory`, `BondingMath`, `GraduatedFeeHook`), `HookitSwapRouter`, USD oracle paths (`UniswapV3EthUsdTwapFeed`, Quotrons spot). Attacker checklist: reentrancy via `unlock`/ETH, access control, hook flags vs callbacks, `BeforeSwapDelta` accounting, rounding, cap / anti-snipe bypass, fee manipulation, floor / vest gaming, DoS, front-running, `msg.value`, unchecked math, `hookData` trust, poolId collisions, tick assumptions, privilege. |
| Static analysis | Slither 0.10 on the full `src/` tree (`FOUNDRY_OUT=out-slither`, `--ignore-compile`). 294 raw results, all High classes triaged by hand (section 5). |
| Live testing | Browser end-to-end on Ink mainnet with a Playwright harness that injects an EIP-1193 wallet signing with a funded key: Master launch with dev buy + modules, buy, sell, creator fee claim; Classic launch, buy, sell; multi-pair (`launchMulti` ETH + USDG) launch, buy, sell. Foundry live scripts (`ModuleMatrixInk`, `SmokeDevBuyInk`, `SmokeLaunchMultiInk`, …) for the module matrix. Four bugs found this way (section 4). |
| Web / backend | Manual review of the Next.js API routes (`/api/rpc/ink`, `/api/ipfs/*`, `/api/verify`, `/api/hooks/*`, `/api/token/*`, `/api/launches`), `next.config.ts` security headers, indexer trade attribution. |

Out of scope: Uniswap v4 core, Quotrons contracts, the WalletConnect / wagmi stack, the Linode indexer host, key management.

## 2. Summary

| ID | Severity | Title | Status |
| --- | --- | --- | --- |
| C-1 | High | Holder-airdrop / HKT-drop epoch start iterates every listed holder inside `beforeSwap` (permissionless gas griefing, drop stalls) | **Fixed** `cc67b7e` |
| C-2 | High | Batched airdrop payouts use live balances against a total fixed at epoch start (same tokens paid twice, later holders starved) | **Fixed** `cc67b7e` |
| C-3 | High | Mcap-vest high-water mark is a post-swap spot snapshot (same-block pump/dump unlocks vested streams) | **Accepted** (product decision) — UI must present mcap vesting as a soft target |
| C-4 | High | Quotrons wStock spot from a thin pool is the USD oracle for wStock-quoted launches (fake graduation target / launch mcap) | **Fixed (bounded)** `fcc5ead` |
| C-5 | High | Classic graduation opens the pool ~60–65% below the last curve price (sell-before / rebuy-after incentive) | **Fixed** `26bedcf` — virtual reserves derived from the 80/20 split |
| C-6 | High | ERC-20 protocol fees (USDG, wStock) pushed to `HkitBuyback` were unrecoverable | **Fixed** `fcc5ead` |
| C-7 | Medium | Launch-time dev buy paid the creator's own anti-snipe tax (99.5% of a live dev buy lost) | **Fixed** `12beca8` |
| C-8 | Medium | Dev buy above Max Tx reverts the whole launch; UI let users configure it | **Fixed (UI clamp + warning)** `5b957fa` |
| C-9 | Medium | Max-wallet check trusts the recipient in caller-supplied `hookData` | **Fixed (module removed)** `0ae1dc1` |
| C-10 | Medium | Exact-output buys taxed on pre-swap notional: sniper tax under-collected on large buys | **Fixed (mitigated)** `fcc5ead` |
| C-11 | Medium | Floor fill paid in raw quote + auto-burn / HKT drop / deepen credits claim-denominated pots → sell reverts | **Fixed** `aa4eb00` — raw fee converted to claims |
| C-12 | Medium | `launchMulti` demanded dev-buy ETH even when the dev buy is paid in `markets[0]`'s ERC-20 (ETH stranded) | **Fixed** `fcc5ead` |
| C-13 | Medium | Stale / reverting ERC-20 quote feed reverted every swap (sells included) on pools with an mcap vest | **Fixed** `fcc5ead` |
| C-14 | Medium | Classic ERC-20 dev buy reverted with a launch fee, or pulled the quote twice without one | **Fixed** `fcc5ead` |
| C-15 | Medium | `GraduatedFeeHook.sweepHktDrop` permissionless with caller-chosen slippage (sandwich drains the HKT pot) | **Fixed** `fcc5ead` |
| C-16 | Medium | `HkitBuyback.execute` permissionless with caller-chosen slippage | **Fixed** `fcc5ead` |
| C-17 | Medium | Anyone can force the ETH/USD TWAP feed to revert (3% in-tx spot move) and select the stale snapshot fallback | **Fixed (bounded)** `fcc5ead` |
| C-18 | Medium | `FeeEthRail` swaps accept an arbitrary `payer` (any allowance to the rail can be spent by anyone) | **Fixed** `fcc5ead` |
| C-19 | Medium | `HktHolderDropVault` listed as a holder-airdrop recipient; quote claims leak into it forever | **Fixed** `fcc5ead` |
| C-20 | Medium | Owner / operator privileges can move price marks and fee flows (centralisation surface) | **Documented** (section 6) |
| C-21 | Low | Anti-MEV cooldown keyed on `tx.origin` (two-EOA sandwiches pass; ERC-4337 bundlers collide) | **Documented** |
| C-22 | Low | Swap-and-pop on the holder list during a live epoch can skip a holder's payout | **Documented** |
| C-23 | Info | 1 wei "native dust" and stray ETH have no sweep path in `LaunchFactory` | Open |
| C-24 | Info | `FloorVault.redeemFloor` is permissionless and fee-free (intended guaranteed exit) | Documented |
| W-1 | Low | Admin key compared with `===` (timing side channel) | **Fixed** `web` commit |
| W-2 | Low | `/api/rpc/ink` origin check is header-based and spoofable by non-browser clients | **Documented** — add rate limiting |
| W-3 | Info | Indexer attributed trades to the router / hook instead of the wallet | **Fixed** earlier in this branch |
| W-4 | Info | UI hydration error from nested `<button>` in the hook picker | **Fixed** `2df474f` |

No Critical findings (no path to drain seed liquidity, escrowed creator fees or user tokens without a privileged key).

## 3. Contract findings

### C-1 — Epoch start looped over every listed holder inside `beforeSwap` (High, fixed)

`HolderAirdropVault._tryAutoAirdrop` and `HktHolderDropVault.tryPush` computed the total balance of the listed holders with a full loop (`_sumListedBalances` / `_sumListedHkt`) when an epoch started. Listing is permissionless (`LaunchToken._syncHolder` on every transfer; `HktHolderDropVault.syncHolders` for HKT), so anyone could append thousands of 1-wei wallets. Because the hook wraps the call in `try/catch`, an out-of-gas inside it did not revert the swap: it consumed 63/64 of the caller's gas and the swap usually failed on the remainder. Measured: 3,000 dust holders → 17.07M gas per epoch-start swap (baseline 420k); 6,000 holders → a 2.5M-gas swap reverts, a 30M-gas swap succeeds but burns 27.98M and the epoch never advances. The HKT drop vault is shared by **every** Master pool, so one griefer degraded the whole protocol.

Fix: both vaults keep `listedTotal` as a running sum of the balances they observe on sync (`_track`), so the epoch starts in O(1). Payouts stay batched at 48 holders per swap. Measured after the fix: 6,000 dust holders → 1.04M gas for the epoch-start swap (485k baseline + one payout batch).

Residual: a large dust list still makes each epoch take `holders / 48` swaps to complete, adding ~150–500k gas to those swaps. Acceptable degradation, not a DoS.

Tests: `test_Fixed_H2_*` (AuditFactoryHook), `test_V2_HktDrop_EpochStartIsBoundedWithThousandsOfHolders` (AuditFeesVaults).

### C-2 — Batches paid on live balances against a frozen total (High, fixed)

Each 48-holder batch read `balanceOf` at payout time while `pending.totalBal` was fixed at epoch start. An attacker with one wallet in batch 1 and one in batch 2 moved the same tokens between the batches and was paid twice; the `remainingPot` cap then starved honest holders at the end of the list. Reproduced on both vaults (attacker ≈ 2× fair share, every honest batch-2 holder paid 0).

Fix: lazy epoch snapshot. The first time a listed holder's balance changes during a live epoch, the pre-move balance is frozen (`_snapBal`, keyed on an `epochGeneration` counter shared by every quote payout that overlaps). Payouts use `min(live, frozen)`, and `min(live, tracked)` for holders that did not move. A wallet listed mid-epoch has a frozen balance of 0 and is paid next epoch. Holders who sell mid-epoch are paid on what they still hold. The pot can therefore never be over-distributed; leftovers roll into the next epoch.

Tests: `test_V1_HktDrop_NoDoubleCountAcrossBatches`, `test_V1_HktDrop_SnapshotSemantics`, `test_V1b_HolderAirdrop_NoDoubleCountAcrossBatches`.

### C-3 — Mcap-vest high-water mark is a spot snapshot (High, accepted)

`MasterLaunchHook._observeFdv` runs in `afterSwap`, reads the post-swap `sqrtPriceX96`, converts `totalSupply × price` to USD and writes a **monotonic** high-water mark into `BuybackVault` and `HolderAirdropVault`. Cliff / step unlocks depend only on that mark. PoC: a creator with a `$10M` cliff buys 80 ETH exact-in in one swap (mark → `$21.6M`, stream 100% vested), sells back the next block with exact-output sells and claims. Net cost 1.04 ETH, mostly the 1% base fee of which 60% returns to the creator. `LaunchFactory.setEthUsdPrice` (owner) and the vaults' `observeFdv` (operator) can set the mark directly.

Product decision (2026-09-14): kept as is. A robust fix changes the module's semantics (observe the pre-swap price, require N consecutive observations above the threshold separated by a minimum time, or gate on a TWAP), and the creator paying ~1 ETH of fees to unlock their own stream early was judged an acceptable trade-off for a creator-side module. The UI must keep presenting mcap vesting as a soft target, not a guarantee to buyers.

Recommendation: (1) observe in `beforeSwap` (pre-trade price) and require the mark to hold across ≥ N observations at least T seconds apart before it becomes effective; (2) remove `setEthUsdPrice`'s effect on existing marks or cap per-observation growth; (3) surface `highWaterFdvUsd` and its age in the UI.

Test: `test_Known_H1_McapVestUnlockedBySpotPumpRoundTrip`.

### C-4 — Quotrons wStock spot as USD oracle (High, bounded)

`LaunchFactoryLib.quoteUsdX18` and `BondingLaunchFactory._quoteUsdX18` preferred the live Quotrons pool `sqrtPriceX96` for wStock quotes. Those pools are thin; on a fork of Ink a 20k USDG buy moved `wAAPLx` > 2× in the same tx, halving the Classic graduation target and the Master launch mcap, and a wStock-quoted Classic token then "graduated" for 0.001 wAAPLx with the attacker holding ~80% of supply.

Fix: the live spot is only trusted when it is within `QUOTRON_SPOT_MAX_DEVIATION_BPS` (20%) of the listing snapshot stored in `quoteConfigs[token].usdPriceX18`; outside the band the snapshot is used. Manipulation is therefore bounded to ±20% of a value only the owner can set. The deploy scripts already seed the snapshots from `QuotronStockQuotes.listings()`; keep them refreshed (`setQuote`) when equities move.

Residual: the ±20% band is still gameable in the attacker's favour by up to 20% on the graduation target. A Chainlink-style feed per stock (`usdFeed`) removes it entirely.

Test: `test_Fixed_B4_QuotronSpotOnlyTrustedInsideBand`.

### C-5 — Graduation price discontinuity (High, fixed)

With the original virtual reserves (`VIRTUAL_QUOTE_START_ETH` = 1 ETH, virtual token = curve supply) the last curve buyers paid ~`(1 + 4.2) / 154M` while the seeded v4 pool opens at `4.2 / 354M`, i.e. ~35–40% of the curve price. PoC: a holder who sells on the curve right before graduation and re-buys in the pool more than doubles the position; every late curve buyer is instantly underwater.

Fix (`26bedcf`): `BondingMath.virtualReserves` derives both reserves from the 80/20 split and the raise `R` so that the curve sells exactly `S_c` when `R` has been collected **and** the terminal curve price equals the LP price. With `S_l = S − S_c`: `V = R·S_l / (2S_c − S)`, `T = S_c·(1 + V/R)`; for the 80/20 split that is `V = R/3` (1.4 ETH) and `T = 4/3·S_c`. Terminal price `(V+R)/(T−S_c) = R/S_l` exactly; the pool now opens within the last trade's price impact of the curve (1.5% on a 0.1 ETH closing buy in the test), the LP receives exactly 20% of supply + the raise, and the sell-before / rebuy-after round trip loses fees instead of doubling. Start price moves from `1.25/S` to `1.3125/S` ETH per token, the curve multiple from 27× to 16×. The wizard's curve mirror (`web/src/lib/dev-buy-launch.ts:initialBondingVirtualState`) and the graduation docs were updated.

Tests: `test_Fixed_B1_PoolOpensAtTerminalCurvePrice`, `test_Fixed_B1_CurveSellsExactlyEightyPercentAtTarget`, `test_Fixed_B1_SellBeforeGraduationRebuyAfterDoesNotProfit`, `web/src/lib/bonding-curve.test.ts`.

### C-6 — ERC-20 flywheel fees stuck in `HkitBuyback` (High, fixed)

`ProtocolRevenueDistributor` forwards the 80% flywheel share of ERC-20 fees (USDG, wStock) to `buybackExecutor`, which on Ink is `HkitBuyback`. That contract only knew how to swap ETH; the ERC-20s were unrecoverable. Fix: owner `sweep(currency, to, amount)` on `HkitBuyback`. Test: `test_V3_Erc20ProtocolFees_RecoverableFromHkitBuyback`.

### C-7 / C-8 — Launch-time dev buy vs protection modules (Medium, fixed)

Found live: a 0.0003 ETH dev buy on an anti-snipe launch returned 761 tokens instead of ~150k because the factory-routed dev buy paid the creator's own 98% sniper tax. `MasterLaunchHook` now exempts `sender == factory` from the snipe tax (`12beca8`, `test/LaunchDevBuy.t.sol`). Max Tx still binds the dev buy (it is a normal swap for the hook) and a dev buy above the cap reverts the whole launch; the wizard now clamps the dev buy to the active cap and warns (`5b957fa`, `web/src/lib/dev-buy-launch.ts`). Set `NEXT_PUBLIC_DEV_BUY_SNIPE_EXEMPT=1` once the patched hook is the live one so the UI stops warning about the tax.

### C-9 — Max wallet trusts `hookData` (Medium, fixed by removal)

`SupplyCapLib.checkMaxWalletBeforeBuy` reads the recipient from caller-supplied `hookData`. Any router or direct `PoolManager` call can pass an empty address and receive tokens on `msg.sender`; PoC ends with one wallet at 10× the cap. Transfers between wallets are also unrestricted. The module was therefore a courtesy check for well-behaved routers (the Hookit UI), not a guarantee, and a real per-wallet cap could only live in `LaunchToken.transfer/transferFrom` (making the token non-standard). Product decision (2026-09-14): remove the module (`0ae1dc1`). `SupplyCapLib` keeps Max Tx only, the hook no longer reads a recipient from `hookData`, bit 4 and bits 55–70 of the bitmask stay reserved so older packed values decode unchanged, and `LaunchFactory` reverts `ModuleRemoved` on launches that still set them. Wizard, builder, badges, docs, swap card and the explorer filters no longer know the module; the per-trade cap is Max Tx. Test: `test_Fixed_M0_MaxWalletModuleRemoved`, `testLegacyMaxWalletBitsRejected`, `testBuyWithoutHookDataSucceeds`.

### C-10 — Exact-output buys under-taxed during the snipe window (Medium, mitigated)

Fees are computed on the pre-swap spot notional. An exact-output buy that moves the price pays the sniper tax on a fraction of the quote it really spends: PoC 51% configured → 23.4% effective on a 40%-of-supply exact-output buy. Fix: while `snipeBps > 0`, exact-output buys revert `ExactOutputDuringSnipe`. The UI only sends exact-input buys, so nothing user-facing changes; the docs mention the restriction. The same pre-swap-notional property applies to the dynamic hook tax (bounded by `maxTaxBps`, much smaller magnitude) and slightly overcharges exact-input sells; a fee computed from the realised `BalanceDelta` in `afterSwap` would remove both. Test: `test_Fixed_M1_ExactOutputBuysRejectedWhileSnipeTaxIsLive`.

### C-11 — Floor fill paid in raw quote + claim-denominated module pots (Medium, fixed)

When `FloorVault` holds raw quote (operator `deposit`) `drawForFloor` pays the hook raw ETH; `FeeSplitLib` routes the cuts raw but still credits `pendingAutoBurn` / `pendingHktDrop` / `pendingDeepenLps`, and `_afterSwap` then settles ERC-6909 claims the hook does not hold → the user's sell reverts. Only reachable when an operator tops the vault up with raw quote on a pool that packs auto-burn, HKT drop or deepen LPs. Fix (`aa4eb00`): `_floorFill` now measures the claims the vault paid and, when they do not cover the fee, settles the raw shortfall into the `PoolManager` and mints the equivalent ERC-6909 claims to the hook (`settle` + `mint`, net-zero delta inside the unlock), then always splits the fee from claims. The module pots are thus backed by claims on every path and the seller is still paid the remainder raw. `FloorVault.deposit` with raw quote is a supported operator path again. Test: `test_Fixed_M2_FloorFillRawPathSettlesAutoBurn`.

### C-12 — `launchMulti` ETH strand (Medium, fixed)

`collectLaunchFee` required `devBuyQuoteIn` in ETH whenever *any* market was native, while the dev buy is executed against `markets[0]`. With `[ERC-20, ETH]` the ERC-20 was pulled **and** the ETH kept, with no sweep. Fix: the ETH term is only required when `markets[0].quote` is native. Test: `test_Fixed_M3_LaunchMultiErc20DevBuyNeedsNoEth`.

### C-13 — Stale ERC-20 quote feed blocked swaps (Medium, fixed)

`_observeFdv` called `quoteUsdPriceX18` without `try/catch` for ERC-20 quotes; a stale round reverted buys and sells on every pool with a vest plan. FDV observation is telemetry and is now best-effort. Test: `test_Fixed_M4_StaleQuoteFeedDoesNotBlockSwapsOnVestPools`.

### C-14 — Classic ERC-20 dev buy (Medium, fixed)

`launch()` pulled the ERC-20 dev buy with `transferFrom`, then called `_executeBuy(..., devBuyFromLaunch = nativeQuote)` which, for ERC-20 quotes, ran `_pullQuote` again: revert `NativeMismatch` when a launch fee was sent, a second full pull when `launchFee == 0`. Fix: the flag is `true` for every launch-time dev buy. Tests: `test_Fixed_B2_*`.

### C-15 / C-16 — Permissionless swaps with caller-chosen slippage (Medium, fixed)

`GraduatedFeeHook.sweepHktDrop(key, minTokensOut)` and `HkitBuyback.execute(ethAmount, minTokensOut)` were callable by anyone with `minTokensOut = 0`; a pump → sweep → dump sandwich extracted more than half of the HKT pot in the PoC. Both are now operator-gated (`onlyOperator`; `HkitBuyback` gains `setOperator`). No off-chain caller depended on them being open (`sweepQuote`, the permissionless no-conversion path the UI uses, is unchanged). Test: `test_Fixed_B3_SweepHktDropIsOperatorOnly`, `test_V3_*`.

### C-17 — Selectable ETH/USD fallback (Medium, bounded)

`UniswapV3EthUsdTwapFeed` reverts when spot deviates > 3% from the TWAP; both factories caught that and fell back to `ethUsdPriceX18`, the last synced snapshot, with no age check, so anyone moving v3 spot in-tx could choose between the live and an arbitrarily old price. Fix: `ethUsdSyncedAt` is recorded on every write (constructor, `setEthUsdPrice`, `syncEthUsdPrice`) and the fallback reverts `StalePrice` once the snapshot is older than `USD_SNAPSHOT_MAX_AGE` (24h). `syncEthUsdPrice` is permissionless, so a keeper (the existing fee keeper is a good host) should call it daily. Test: `test_Fixed_B5_SnapshotFallbackExpires`.

### C-18 — `FeeEthRail` arbitrary payer (Medium, fixed)

`stockToUsdg` / `usdgToEth` settled from a caller-supplied `payer`; any allowance granted to the rail could be spent by a third party with the output sent to themselves. Fix: `payer == msg.sender` (`PayerMismatch`). The only caller, `ProtocolRevenueDistributor`, already passes itself. Test: `test_V4_FeeEthRail_PayerMustBeCaller`.

### C-19 — HKT drop vault listed as an airdrop holder (Medium, fixed)

`_hktDropBuy` delivers launched tokens to `HktHolderDropVault`, which registered it as a holder; each epoch it received quote claims it cannot spend. Fix: excluded in `_beforeInitialize` alongside the other infra addresses. Tests: `test_Fixed_L1_*`, `test_V5_*`.

### C-21 / C-22 — Low

- Anti-MEV keys on `tx.origin` (`MasterLaunchHook._antiMev`): a sandwich whose two legs come from two EOAs is not blocked, an aggregator touching the pool twice in one tx is, and all users of one ERC-4337 bundler share a single origin. Design limitation; document or key on (sender, recipient) direction.
- `_removeHolder` swaps the last holder into the freed slot. During a live epoch that can move an unpaid holder before the cursor (missed this epoch) — the snapshot fix already prevents a joiner from being paid. Low impact; a per-epoch frozen list or tombstoning would remove it.

## 4. Live-testing findings (browser + on-chain)

| # | Found how | Issue | Fix |
| --- | --- | --- | --- |
| 1 | Master launch with Anti-Snipe + dev buy | Dev buy taxed 98% by its own snipe module (C-7) | `12beca8` hook + `test/LaunchDevBuy.t.sol` |
| 2 | Max Tx 0.1% + 0.01 ETH dev buy | Launch tx reverted `MaxTxExceeded` inside the dev buy (C-8) | `5b957fa` UI clamp + warning |
| 3 | Hook picker | Nested `<button>` → React hydration error | `2df474f` |
| 4 | Creator fee claim | Balance stale ~10s after the receipt (RPC lag) | `d0551c5` optimistic update |
| 5 | Token page RPC | `eth_getLogs` > 10k blocks → 502 from public Ink RPC | `web/src/lib/log-range.ts` chunking |
| 6 | Indexer | Trades attributed to the router / hook address | `tx.from` attribution + hook-internal swap filter |
| 7 | Classic explore | `$0` mcap / liquidity for bonding-phase tokens | `bondingCurvePrice` enrichment |

All flows re-tested after the fixes on Ink mainnet: Master (dev buy, buy, sell, claim), Classic (launch, buy, sell), multi-pair (ETH + USDG).

## 5. Slither triage

294 results. High-impact classes and verdicts:

| Detector | Hits | Verdict |
| --- | --- | --- |
| `arbitrary-send-erc20` | 4 | `CurrencySettler.settle/settleWithBuffer`, `LaunchFactoryLib._settleDelta`, `LaunchDevBuyLib.pullQuoteToken`: the `payer` is always the calling contract or `msg.sender` of the launch (`FeeEthRail`'s caller-supplied payer, the one real instance, is fixed in C-18). |
| `arbitrary-send-eth` | 1 | `ProtocolRevenueDistributor._routeFlywheel` sends to `buybackExecutor` / `nativeFloorVault`, both owner-set — accepted (see section 6). |
| `reentrancy-eth` | 5 | `BondingLaunchFactory._executeBuy/sell/_graduate` and `MasterLaunchHook._afterSwap`: state is written before the external transfers, the bonding factory's ETH recipients are `msg.sender` after the curve state is final, and hook re-entry is short-circuited by the `_inFeeAction` transient flag plus the `nonReentrant` vaults — not exploitable. |
| `encode-packed-collision` | 2 | `LaunchTokenDeployLib.deploy` / `BondingLaunchFactory.launch` salt: the variable-length inputs are `string`s that are hashed alone or with fixed-width types only — no ambiguity. |
| `unchecked-transfer` | 10 | `CurrencySettler`, `LaunchFactoryLib._settleDelta`, `LiquidityLocker.seed`, `EthUsdgBridgeSeeder.seed`: the transferred tokens are `LaunchToken` (reverts on failure) or the return value is checked one frame up — false positive. |

Medium classes (`unused-return` 72, `incorrect-equality` 26, `uninitialized-local` 22, `reentrancy-no-eth` 15, `divide-before-multiply` 3, `write-after-write` 1) were sampled; the `divide-before-multiply` hits are in `FixedPointMath` tick math with explicit rounding intent, `incorrect-equality` are `== 0` guards. Nothing actionable beyond the findings above.

## 6. Privileged roles

| Role | Where | Powers | Notes |
| --- | --- | --- | --- |
| `LaunchFactory` owner | `Owned` | `setLaunchFee`, `setTreasury`, custom-hook toggles / allowlist, `setEthUsdPrice` / `setEthUsdFeed`, `setQuote` (allow quotes, decimals, snapshot price, feed) | `setEthUsdPrice` moves FDV for every vest plan (C-3). Cannot touch liquidity or user tokens. |
| `MasterLaunchHook` owner | `Owned` | `setFactory`, `setAirdropVault`, `setHktDropVault`, `setArbExecutor` + `setArbActive` | The arb executor's swaps bypass anti-MEV, anti-snipe, hook tax, max-tx and the floor intercept: a fee-free privileged trader on every pool. Keep it a dedicated, monitored key. |
| Vault operators (`FloorVault`, `FeeEscrow`, `BuybackVault`, `HolderAirdropVault`, `HktHolderDropVault`, distributor) | `setOperator` by each owner | `FloorVault.deposit/drawForFloor/setQuote`, `observeFdv` (sets the vest mark directly), `configurePlan`, `configureEpoch`, `setExcluded`, `FeeEscrow.credit*`, `notify*`, `sweep` | The hook is the intended operator. Adding an EOA gives it C-3 and fee-routing power. |
| `HkitBuyback` owner / operators | new `setOperator`, `sweep` | Run buybacks, recover ERC-20 fees | |
| `GraduatedFeeHook` operators | `setOperator` | `sweepWithConversion`, `sweepHktDrop` (now gated) | |
| `ProtocolRevenueDistributor` owner | `Owned` | `setOpsTreasury`, `setFlywheelMode`, `setFeeRail`, `setBuybackExecutor`, `setNativeToken` | Controls the 30% protocol share destination. |
| Creator | per launch | Chooses modules at launch; receives 60% of the base fee (escrow or vested) | No post-launch parameter changes; cannot remove seed liquidity. |
| Anyone | | `syncHolder(s)`, `redeemFloor`, `airdrop(token, holders[])` after epoch, `distribute*`, `claim`, `sweepQuote`, `syncEthUsdPrice` | |

Rug vectors: no owner path removes seed LP (`LiquidityLocker` holds it, hook blocks the seed range) or pulls user tokens. Material centralisation risks: price-mark control (C-3), the arb executor, and pointing `setAirdropVault` / `setHktDropVault` / `setBuybackExecutor` at arbitrary contracts. Recommendation before the hard launch: multisig + timelock on the three owners, and publish the operator lists.

## 7. Checked and found correct

- `BaseHook` callbacks are `onlyPoolManager`; `prepareLaunch` is `onlyFactory`; `_beforeInitialize` requires `sender == factory` and a prepared state; all `unlockCallback`s check `msg.sender == poolManager`.
- Hook permission flags match the implemented callbacks; the pool is created with the dynamic-fee flag and the LP fee override is `0`, so all fee accrues through the hook.
- `BeforeSwapDelta` sign / placement is correct for exact-in and exact-out on both sides; `_floorFill` settles what it takes; no ETH is left in the hook on the normal path.
- Reentrancy: vault entry points are `nonReentrant`, the `_inFeeAction` transient flag short-circuits nested hook calls from `_autoBurn` / `_hktDropBuy` / `_deepenLp` and is reset on every path, `FloorVault.drawForFloor` never unlocks.
- Fee bounds: total fee clamped to 100%, `applyBps` rounds down; `checkMaxTx` uses post-fee tokens for buys and pre-fee for sells.
- Pool key / poolId collisions: fresh CREATE2 token per launch, `configs[id]` written once under `onlyFactory`, factory reverts on an existing poolId.
- `LaunchToken`: fixed supply, no mint / owner, holder tracking is best-effort and cannot block transfers.
- `LiquidityLocker`: no withdraw; hook additionally blocks removal of the seed range.
- Bonding math: `buyQuoteIn` / `quoteInForTokensOut` are consistent (`virtualToken − tokensSold` tracks the curve, `virtualReserves` pins the sell-out point to the raise), partial fills refund the unused quote, graduation seeds the pool inside the same tx so nobody trades between curve close and pool open.
- `HookitSwapRouter`: exact-in only, slippage limit honoured, native refunds, `hookData` carries the recipient (no longer read by the hook since C-9's removal; harmless).
- Web: `/api/rpc/ink` method allowlist, 128 kB body and 25-item batch limits; `/api/hooks/*` and `/api/verify` gated by `HOOKIT_ADMIN_KEY`; IPFS upload size-limited and JWT-server-side; CSP / HSTS / frame headers set in `next.config.ts`.

## 8. Web / backend notes

- **W-1 (fixed)** `adminAuthorized` compared the key with `===`; now `timingSafeEqual`.
- **W-2 (open)** `/api/rpc/ink` accepts requests whose `Origin` / `Sec-Fetch-Site` headers look same-origin. Browsers enforce that; scripts can forge it, so the proxy can be used as a free Ink RPC relay. Add a per-IP rate limit (Vercel edge middleware or upstream) and keep the method allowlist tight.
- `/api/hooks/deploy` runs `forge` on the server with the admin key and the deployer key from env: keep it disabled in production (custom hooks are off until an external audit) or move it to an isolated worker.
- IPFS upload: size limit and MIME check present; consider a per-IP cap, the Pinata JWT is spent on every call.

## 9. Deployment implications

The following contracts changed bytecode and must be redeployed together (the hook, the two factories and the vaults reference each other by address): `MasterLaunchHook`, `LaunchFactory`, `BondingLaunchFactory`, `GraduatedFeeHook`, `HolderAirdropVault`, `HktHolderDropVault`, `HkitBuyback`, `FeeEthRail`, plus the `LaunchFactoryLib` external library. Sizes after the changes: hook 22,239 B, `LaunchFactory` 21,750 B, `BondingLaunchFactory` 22,564 B (limit 24,576 B).

After the redeploy:

1. Grant operators: `HkitBuyback.setOperator(keeper)`; `GraduatedFeeHook.setOperator(keeper)` if the keeper sweeps HKT drops.
2. Refresh wStock snapshots (`setQuote`) and schedule `syncEthUsdPrice()` daily on both factories (the 24h fallback window depends on it).
3. Set `NEXT_PUBLIC_DEV_BUY_SNIPE_EXEMPT=1` on Vercel so the wizard stops warning about the snipe tax on dev buys.
4. Update `web/src/lib/contracts/config.ts`, `deploy/ink/addresses.json`, `deploy/ink/env.ink.example`, `SOFT_LAUNCH_INK.md`, and re-run `VerifyInkDeploy.s.sol` + `web/scripts/smoke-onchain.mjs`.
5. Existing tokens stay on the previous generation; the UI keeps reading them.

Operating rule while C-3 stays accepted: present mcap vesting as a soft target in the UI and docs, never as a buyer guarantee. C-5, C-9 and C-11 are closed in this branch (`26bedcf`, `0ae1dc1`, `aa4eb00`); the Classic curve, the module list and the floor-fill path all changed bytecode, so they are part of the same redeploy.

## 10. Recommended scope for the external audit

Priority order: `MasterLaunchHook` swap path and `FeeSplitLib` accounting; the two vaults' new snapshot logic (`_track`, `_payableBalance`, `epochGeneration`); `BondingLaunchFactory` graduation and the USD oracle band; `LaunchFactory.launchMulti`; privileged-role review with the multisig / timelock plan. Provide the auditor with this document, `test/audit/`, and `slither` output (`FOUNDRY_OUT=out-slither forge build --build-info && slither . --ignore-compile`).
