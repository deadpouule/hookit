# Hookit

Permissionless Uniswap v4 launchpad: token creation, concentrated unilateral liquidity, and live trading in a single transaction. There is no external bonding curve and no migration step.

Primary target: **Base Sepolia (chain ID 84532)**.

## Design

1. **Atomic launch.** `LaunchFactory.launch` deploys a fixed-supply `LaunchToken`, initializes a Uniswap v4 pool, and mints a 100% token / 0 quote position over `[t0, t_max]`. Buys (quote → token) are live from block 0.
2. **Permanent LP lock.** `MasterLaunchHook.beforeRemoveLiquidity` reverts any burn of the initial launch range (`liquidityDelta < 0`). Fee pokes (`liquidityDelta == 0`) are allowed.
3. **Hybrid hooks.** Default pools bind the mined singleton `MasterLaunchHook`. `LaunchParams.customHook` can point at an arbitrary v4 hook (treat as unverified).
4. **Quote-only fees.** The hook takes 1% base + optional creator tax + decaying anti-snipe tax exclusively in the quote asset via `BEFORE_SWAP_RETURNS_DELTA`. During the swap the hook mints ERC-6909 claims on the PoolManager (the manager has no inventory in `beforeSwap`), transfers those claims to `FeeEscrow` / the distributor / `FloorVault`, and those contracts redeem to native/ERC-20 on `claim`, `distribute`, or `redeemFloor`.
   - 70% of (base + snipe) → creator `FeeEscrow`
   - 30% → `ProtocolRevenueDistributor`
   - Creator tax → 100% creator
   - Optional `floorAllocationBps` of the 70/30 pool → that token’s `FloorVault`

   **Unilateral range.** Quote is sorted as currency0 when it is native ETH. The launch position is then `[minUsableTick, startingTick]` with the pool initialized *strictly above* the range so the position is 100% token1 / 0 ETH. Buys are `zeroForOne` and walk price down into the range. If the launch token sorts as currency0, the range is `[startingTick, maxUsableTick]` with price initialized below it.
5. **Protocol flywheel.** Of protocol revenue: 20% ops treasury, 80% native-token `FloorVault` (or TWAP buyback+burn mode).
6. **Backed floor.** `P_floor = FloorVault / circulatingSupply`. Withdrawals round down so **ΔP_floor ≥ 0**. Sells at or below the floor are filled from the vault with custom accounting. Anyone may `redeemFloor`.

### Hook flags (CREATE2)

`MasterLaunchHook` must be mined so the address encodes:

| Flag | Bit |
| --- | --- |
| `BEFORE_INITIALIZE` | 13 |
| `BEFORE_ADD_LIQUIDITY` | 11 |
| `BEFORE_REMOVE_LIQUIDITY` | 9 |
| `BEFORE_SWAP` | 7 |
| `AFTER_SWAP` | 6 |
| `BEFORE_SWAP_RETURNS_DELTA` | 3 |

Mask: `0x2AC8`.

### Bitmask (`uint256` per `PoolId`)

| Bits | Field |
| --- | --- |
| 0 | anti-snipe |
| 1 | backed floor |
| 2 | anti-MEV cooldown |
| 3 | max tx |
| 4 | max wallet |
| 5 | dynamic fees |
| 6 | buyback vesting |
| 7–22 | `creatorTaxBps` |
| 23–38 | `antiSnipeDurationSeconds` |
| 39–54 | `maxTxBps` |
| 55–70 | `maxWalletBps` |
| 71–94 | `floorAllocationBps` |
| 95–110 | `initialSnipeTaxBps` |

## Tooling

```bash
forge install
cp .env.example .env
```

RPC defaults to `https://sepolia.base.org`. EVM: **cancun** (TSTORE/TLOAD). Solc: **0.8.26**.

### Tests

```bash
forge test -vv
FOUNDRY_PROFILE=intense forge test --match-contract BackedFloorInvariant
forge snapshot --match-contract MasterLaunchHookTest --snap .forge-snapshots
```

Fork tests (`ForkBaseSepolia`) fork live Base Sepolia Uniswap v4 (`PoolManager` at `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408`) and skip if the RPC is unreachable. `BackedFloorInvariant.testFuzz_ratchetNeverDecreases` is configured for 10,000 fuzz runs.

Swap-path gas (local v4-core deploy):

| Path | Gas |
| --- | --- |
| Standard buy | ~1.73M |
| Anti-snipe buy | ~1.76M |
| Floor-fill sell | ~1.92M |

### Mine + deploy (Base Sepolia)

```bash
# 1. Deploy vaults first (or use DeployBaseSepolia which mines in-place)
forge script script/MineHookAddress.s.sol:MineHookAddressScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL -vv

forge script script/DeployBaseSepolia.s.sol:DeployBaseSepoliaScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  --chain 84532
```

Uniswap v4 on Base Sepolia:

| Contract | Address |
| --- | --- |
| PoolManager | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` |
| PositionManager | `0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80` |
| PoolSwapTest | `0x8b5bcc363dde2614281ad875bad385e0a785d3b9` |

## Layout

```
src/          protocol contracts, interfaces, libraries
web/          Next.js front-end (Launch Studio + Explore)
script/       CREATE2 miner + Base Sepolia deploy
test/         unit, invariant (ΔP_floor ≥ 0), fork
```

### Front-end (`web/`)

```bash
cd web && npm install && npm run dev
```

Pages: `/explore`, `/launch`, `/floor`. Stack: Next.js App Router, Tailwind v4, shadcn/ui, Framer Motion, Lucide.

## Security notes

This is unaudited reference implementation. Custom hooks are untrusted. Anti-MEV uses transient storage (same tx) plus a per-origin block guard. Floor fills currently trigger when *spot is already at or below* `P_floor`; a swap that *crosses* the floor in one tick still trades on the curve until the next swap.
