import assert from "node:assert/strict";
import test from "node:test";

import type { Hex } from "viem";

import { scopeTradesToPool } from "./store.js";
import type { IndexedTrade } from "./config.js";

const NVDA = "0x0e5d80af0cf88fbf428ca238fc86cd6e3178a042bf92d52aec17610211710b40" as Hex;
const NFLX = "0xab5342d3c072a91ee8599f415fc277ce0eacab6dda8d78b9c8ed827af55c2584" as Hex;
const TX = "0x1111111111111111111111111111111111111111111111111111111111111111" as Hex;

function trade(poolId: Hex, price: string): IndexedTrade {
  return {
    id: `${poolId}-${price}`,
    txHash: TX,
    logIndex: 0,
    blockNumber: 1,
    timestamp: 1,
    side: "buy",
    quoteAmount: "1",
    tokenAmount: "1",
    price,
    sqrtPriceX96: "1",
    poolId,
  };
}

test("scopeTradesToPool: multi-pair without poolId stays on the primary leg", () => {
  const trades = [trade(NVDA, "2e-8"), trade(NFLX, "7e-9")];
  const scoped = scopeTradesToPool(trades, NVDA, 3);
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0]?.poolId, NVDA);
});

test("scopeTradesToPool: explicit poolId selects that market", () => {
  const trades = [trade(NVDA, "2e-8"), trade(NFLX, "7e-9")];
  const scoped = scopeTradesToPool(trades, NVDA, 3, NFLX);
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0]?.poolId, NFLX);
});

test("scopeTradesToPool: single-pair keeps every trade", () => {
  const trades = [trade(NVDA, "2e-8")];
  const scoped = scopeTradesToPool(trades, NVDA, 1);
  assert.equal(scoped.length, 1);
});
