import assert from "node:assert/strict";
import { test } from "node:test";

import { bondingCurvePrice, bondingRowFromResult, bondingToTokenPool } from "@/lib/launches";

// BondingLaunchFactory.launches(2) on Ink right after the HKCLS smoke buy (0.001 ETH).
const HKCLS_ROW = [
  "0xC8332b2eebF180202949d52CA05C4b09b8f08B78",
  "0x67B436693b7f8ebAD6b1B1Caf88C2E197d961614",
  "0x0000000000000000000000000000000000000000",
  0,
  0,
  1_000_000_000_000_000_000_000_000_000n,
  800_000_000_000_000_000_000_000_000n,
  792_015_113_022_994_212_735_181n,
  991_000_000_000_000n,
  1_000_991_000_000_000_000n,
  799_207_984_886_977_005_787_264_819n,
  4_200_000_000_000_000_000n,
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  1_789_408_396n,
  0n,
] as const;

test("bonding curve spot price comes from the virtual reserves", () => {
  const row = bondingRowFromResult([...HKCLS_ROW]);
  assert.ok(row);
  const price = bondingCurvePrice(row, 18);
  assert.ok(Math.abs(price - 1.2524787e-9) < 1e-15, String(price));
  // 6-decimal quote (USDG) scales the quote side only.
  assert.ok(Math.abs(bondingCurvePrice(row, 6) - price * 1e12) < 1e-6);
  assert.equal(bondingCurvePrice({ virtualQuote: 0n, virtualToken: 1n }, 18), 0);
  assert.equal(bondingCurvePrice({ virtualQuote: 1n, virtualToken: 0n }, 18), 0);
});

test("bonding pools expose the curve price so mcap and volume can be priced", () => {
  const row = bondingRowFromResult([...HKCLS_ROW]);
  assert.ok(row);
  const pool = bondingToTokenPool(2n, row, { name: "Hooktest Classic", symbol: "HKCLS" });
  assert.equal(pool.rail, "classic");
  assert.equal(pool.bondingPhase, 0);
  assert.ok(pool.priceEth > 0);
  assert.ok(Math.abs(pool.priceEth - 1.2524787e-9) < 1e-15);
  assert.equal(pool.poolId, undefined);

  const graduated = bondingToTokenPool(
    2n,
    { ...row, phase: 1, poolId: `0x${"1".repeat(64)}` as `0x${string}` },
    { name: "Hooktest Classic", symbol: "HKCLS" },
  );
  assert.equal(graduated.priceEth, 0);
});
