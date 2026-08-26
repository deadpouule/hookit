# Hookit

Permissionless Uniswap v4 launchpad on **Ink mainnet (57073)** with two rails:

1. **Master (Hookit)** — atomic launch into a v4 pool with `MasterLaunchHook` modules (anti-snipe, floor, anti-MEV, LP donate, auto-burn, …).
2. **Classic (bonding)** — constant-product curve → graduate at **4.2 ETH** (or USDG/wStock equivalent) into a fee=0 v4 pool + `GraduatedFeeHook` + permanent `LiquidityLocker`.

There is no Hookit-seeded ETH/USDG LP. Protocol fees keep **ETH as ETH** for the buyback pot; **wStock** fees convert to **USDG** on Quotrons and are sent to the buyback wallet (`distributeToBuyback`). See `QuotronsInk.sol` / `FeeEthRail.stockToUsdg`.

## Design

1. **Master atomic launch.** `LaunchFactory.launch` deploys `LaunchToken`, initializes a Uniswap v4 pool, mints a locked unilateral position. Buys are live from block 0.
2. **Classic bonding → graduate.** `BondingLaunchFactory` sells on a CPMM until 4.2 ETH-equiv is raised (or curve supply sold), then seeds full-range LP into the locker. Steady fees match Master: 1% base + creator tax, hard-capped at **10%** total.
3. **Permanent LP lock.** Master reverts remove of the launch range; Classic LP is held by `LiquidityLocker` with no withdraw.
4. **Hybrid hooks.** Default Master pools use the mined singleton. Optional `customHook` (allowlist can be enabled by owner). Classic uses `GraduatedFeeHook` (fee take + sweep).
5. **Quote-only fees / flywheel.** 70% creator / 30% protocol of the base pool; protocol 20% ops / 80% HKIT buyback. HKIT is fair-launched as launch #1.
6. **Backed floor.** Vault-backed `P_floor`; sells that sit at or would **cross** the floor are filled from the vault.
7. **Ink.** Chain ID 57073, native ETH, Uniswap v4 PoolManager — see [Ink docs](https://docs.inkonchain.com/).

### Hook flags (Master)

`BEFORE_INITIALIZE | BEFORE_ADD_LIQUIDITY | BEFORE_REMOVE_LIQUIDITY | BEFORE_SWAP | AFTER_SWAP | BEFORE_SWAP_RETURNS_DELTA`

### GraduatedFeeHook flags

`BEFORE_INITIALIZE | AFTER_SWAP | AFTER_SWAP_RETURNS_DELTA`

## Tooling

```bash
forge install
cp .env.example .env
```

RPC defaults to `https://sepolia.base.org` for tests; set `INK_RPC_URL` for Ink deploys. EVM: **cancun** (TSTORE/TLOAD). Solc: **0.8.26**.

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

### Mine + deploy

**Base Sepolia (integration / CI)**

```bash
forge script script/DeployHookitCore.s.sol:DeployHookitCoreScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

**Ink mainnet (production)** — deploys Master + Classic (`BondingLaunchFactory` / `GraduatedFeeHook`) + fair-launches HKIT:

```bash
forge script script/DeployHookitCore.s.sol:DeployHookitCoreScript \
  --rpc-url $INK_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $INK_EXPLORER_API_KEY
```

Fork dry-run (no broadcast to real Ink):

```bash
forge script script/DryRunInk.s.sol:DryRunInkScript \
  --fork-url $INK_RPC_URL \
  --disable-code-size-limit -vv
```

Smoke launch + swap (Base Sepolia only):

```bash
forge script script/DeployBaseSepolia.s.sol:DeployBaseSepoliaScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast
```

Uniswap v4 on **Ink mainnet**:

| Contract | Address |
| --- | --- |
| PoolManager | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| PositionManager | `0x1b35d13a2E2528f192637F14B05f0Dc0e7dEB566` |
| Universal Router | `0x112908daC86e20e7241B0927479Ea3Bf935d1fa0` |
| USDG (stable quote) | `0xe343167631d89B6Ffc58B88d6b7fB0228795491D` |

### Composite buy (deferred)

Pools are quoted in **ETH**, **USDG**, or **Quotrons wrapped equities** (`wAAPLx`, `wNVDAx`, …). Composite buys (`swapExactInComposite`) route payment → quote on an allowed bridge (zero-hook **or** Quotrons stock hook), then quote → launch token on the Hookit pool.

When paying USDG for a wStock-quoted launch, leg 1 uses the Quotrons wStock/USDG market (dynamic fee `0x800000`); leg 2 swaps on the Hookit pool.

Protocol fees: **ETH** → 20% ops / 80% `buybackEth` (HKIT buyback). **wStock** → Quotrons swap to **USDG**, then 20% ops / 80% sent to `buybackExecutor` as USDG. Direct **USDG** fees split the same way. No USDG→ETH hop required.

Production stock pairs use **[Quotrons wrapped xStocks](https://quotrons.cash/integration/xstocks-manifest.json)** on Ink (not raw Backed xStocks, not Coinbase B20). `DeployHookitCore` seeds 8 majors via `QuotronStockQuotes`. **wStock USD for FDV / graduation is read live from the Quotrons V4 pool `sqrtPriceX96`** (USDG ≈ $1); hardcoded / xStocks API snapshots are fallback only. ETH/USD still comes from Chainlink (`syncEthUsdPrice`). Base Sepolia tests use `MockQuoteToken` stand-ins (`DeploySepoliaStockQuotes.s.sol`).

Uniswap v4 on **Base Sepolia** (testnet):

| Contract | Address |
| --- | --- |
| PoolManager | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` |
| PositionManager | `0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80` |
| PoolSwapTest | `0x8b5bcc363dde2614281ad875bad385e0a785d3b9` |

## Layout

```
src/          protocol contracts, interfaces, libraries
web/          Next.js front-end (Launch Studio + Explore)
script/       CREATE2 miner + chain-aware deploy (Ink / Base Sepolia)
test/         unit, invariant (ΔP_floor ≥ 0), fork
```

### Front-end (`web/`)

```bash
cd web && npm install && npm run dev
```

Pages: `/explore`, `/launch`, `/floor`. Stack: Next.js App Router, Tailwind v4, shadcn/ui, Framer Motion, Lucide.

### Indexer (`indexer/`)

House indexer (Pons-grade charts / recent trades / holders) — not The Graph. See `indexer/README.md`.

```bash
cd indexer && npm install && npm run serve
```

Front proxies via `/api/indexer/*` when `INDEXER_URL` points at the service.

## Security notes

This is unaudited reference implementation. Custom hooks are untrusted. Anti-MEV uses transient storage (same tx) plus a per-origin block guard. Floor fills currently trigger when *spot is already at or below* `P_floor`; a swap that *crosses* the floor in one tick still trades on the curve until the next swap.
