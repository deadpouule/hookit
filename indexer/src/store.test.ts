import assert from "node:assert/strict";
import test from "node:test";

import type { Hex } from "viem";

import { Store, scopeTradesToPool } from "./store.js";
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

test("applyHktPayoutTransfer tracks recipients and wallet transfer count", () => {
  const store = new Store("/tmp/hookit-test-hkt-drop", 57_073);
  const token = "0x665650b1f56f20180cbc668acec8c3c3977bc478" as const;
  store.upsertToken({
    address: token,
    poolId: NVDA,
    quote: "0x0000000000000000000000000000000000000000" as const,
    tokenIsCurrency0: true,
    name: "dogink",
    symbol: "DINK",
    decimals: 18,
    quoteDecimals: 18,
    totalSupply: "1",
    creator: "0x1111111111111111111111111111111111111111" as const,
    launchedAt: 1,
    launchId: 1,
    rail: "master",
    holders: {},
    trades: [],
    candles5m: [],
  });
  store.applyHktDropped(token);
  store.applyHktPayoutTransfer(token, "0x2222222222222222222222222222222222222222" as const);
  store.applyHktPayoutTransfer(token, "0x2222222222222222222222222222222222222222" as const);

  const state = store.data.hktHolderDrop!;
  assert.equal(state.wallets, 2);
  assert.equal(state.byToken[token.toLowerCase()]?.payoutCount, 1);
  assert.equal(Object.keys(state.byToken[token.toLowerCase()]?.recipients ?? {}).length, 1);
});
