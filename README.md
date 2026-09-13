# hookit

Permissionless Uniswap v4 launchpad on **Ink (57073)**. Live app: [hookit.fun](https://www.hookit.fun). Full protocol write-up (schemas, flywheel, formulas, hook logos): **[/docs](https://www.hookit.fun/docs)**.

Two rails:

1. **Master** — `LaunchFactory` + `MasterLaunchHook`. Token, v4 pool, and locked in-range LP in one tx. Optional modules (anti-snipe, floor, Deepen LPs, burns, airdrop, dynamic fees, …).
2. **Classic** — `BondingLaunchFactory` CPMM until **4.2 ETH-eq**, then a fee=0 v4 pool + `GraduatedFeeHook` + permanent locker.

Fees are **quote-only**. The 1% base always splits **60% creator / 10% $HKT holders / 30% protocol**. Optional hook tax (capped so base + tax ≤ 10%) funds modules only. Protocol’s 30% then splits 20% ops / 80% native-token buyback. ETH stays ETH; wStock fees convert to USDG on Quotrons.

## Design

1. **Atomic Master launch.** Buys live from block 0. Launch LP cannot be removed.
2. **Classic bonding → graduate.** 80% sold on the curve; 20% seeds full-range LP.
3. **Hybrid hooks.** Shared `MasterLaunchHook` bitmask. Custom Solidity hooks are **off** for the Ink soft launch.
4. **Flywheel.** 10% of the 1% base buys the launched token for live $HKT holders. Protocol 80% buybacks the native token.
5. **Backed floor.** `P_floor = V_quote / S_circ`. Ratchet never decreases. Redeem burns tokens for quote.
6. **Quotes.** ETH, USDG, and Quotrons wrapped xStocks. No Hookit-seeded ETH/USDG LP.

### Hook flags (Master)

`BEFORE_INITIALIZE | BEFORE_ADD_LIQUIDITY | BEFORE_REMOVE_LIQUIDITY | BEFORE_SWAP | AFTER_SWAP | BEFORE_SWAP_RETURNS_DELTA`

### GraduatedFeeHook flags

`BEFORE_INITIALIZE | AFTER_SWAP | AFTER_SWAP_RETURNS_DELTA`

## Tooling

```bash
forge install
cp .env.example .env
```

RPC defaults to `https://sepolia.base.org` for tests; set `INK_RPC_URL` for Ink. EVM: **cancun**. Solc: **0.8.26**.

```bash
forge test -vv
FOUNDRY_PROFILE=intense forge test --match-contract BackedFloorInvariant
cd web && npm run test:unit
```

Fork tests (`ForkBaseSepolia`) skip if the RPC is down.

**Ink mainnet deploy** (do not point prod at a dry-run):

```bash
forge script script/DeployHookitCore.s.sol:DeployHookitCoreScript \
  --rpc-url $INK_RPC_URL --broadcast --verify \
  --etherscan-api-key $INK_EXPLORER_API_KEY
```

Live UI factories are hardcoded in `web/src/lib/contracts/config.ts` so Vercel env cannot silently hit an old vault. Soft-launch runbook: `SOFT_LAUNCH_INK.md`. Last forge sync: `deploy/ink/addresses.json` (may trail the UI cutover).

Uniswap v4 on **Ink**:

| Contract | Address |
| --- | --- |
| PoolManager | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| PositionManager | `0x1b35d13a2E2528f192637F14B05f0Dc0e7dEB566` |
| Universal Router | `0x112908daC86e20e7241B0927479Ea3Bf935d1fa0` |
| USDG | `0xe343167631d89B6Ffc58B88d6b7fB0228795491D` |

## Layout

```
src/          protocol contracts
web/          Next.js (marketplace, wizard, /docs)
indexer/      house indexer (charts / trades / holders)
script/       CREATE2 + Ink / Base Sepolia deploys
test/         unit, invariant, fork
```

```bash
cd web && npm install && npm run dev
cd indexer && npm install && npm run serve
```

Self-host: `deploy/linode/README.md`.

## Security

Unaudited reference implementation. Custom hooks (when enabled) are untrusted. Anti-MEV is same-tx TSTORE plus a per-origin block lock. Floor fills help when spot is already on the floor path — a single swap that crosses many ticks can still trade on the curve until the next one.
