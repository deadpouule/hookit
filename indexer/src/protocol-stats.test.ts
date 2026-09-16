import assert from "node:assert/strict";
import test from "node:test";

import type { Address, Hex } from "viem";

import { buildProtocolStats } from "./protocol-stats.js";
import { Store } from "./store.js";
import type { TokenRow } from "./config.js";

const TOKEN = "0x665650b1f56f20180cbc668acec8c3c3977bc478" as Address;

function seedToken(store: Store) {
  const row: TokenRow = {
    address: TOKEN,
    poolId: "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex,
    quote: "0x0000000000000000000000000000000000000000" as Address,
    tokenIsCurrency0: true,
    name: "dogink",
    symbol: "DINK",
    decimals: 18,
    quoteDecimals: 18,
    totalSupply: "1000000000000000000000000000",
    creator: "0x1111111111111111111111111111111111111111" as Address,
    launchedAt: 1_700_000_000,
    launchId: 1,
    rail: "master",
    holders: {},
    trades: [],
    candles5m: [],
  };
  store.upsertToken(row);
}

test("buildProtocolStats ranks $HKT holder drops by payout epochs", () => {
  const store = new Store("/tmp/hookit-test-protocol-stats", 57_073);
  seedToken(store);
  store.applyHktDropped(TOKEN);
  store.applyHktPayoutTransfer(TOKEN, "0x2222222222222222222222222222222222222222" as Address);
  store.applyHktPayoutTransfer(TOKEN, "0x3333333333333333333333333333333333333333" as Address);

  const stats = buildProtocolStats(store);
  assert.equal(stats.hktHolderDrop.tokensSent, 1);
  assert.equal(stats.hktHolderDrop.wallets, 2);
  assert.equal(stats.hktHolderDrop.topTokens.length, 1);
  assert.equal(stats.hktHolderDrop.topTokens[0]?.ticker, "DINK");
  assert.equal(stats.hktHolderDrop.topTokens[0]?.wallets, 2);
  assert.equal(stats.hktHolderDrop.topTokens[0]?.payouts, 1);
});
