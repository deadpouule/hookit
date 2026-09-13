import assert from "node:assert/strict";
import test from "node:test";

import { fallbackStockUsd } from "./quote-usd";
import { marketCapUsdForPool } from "./quote-usd";
import { TOTAL_SUPPLY } from "./token-live";

const wNFLX = "0x7d87fD6A379714194a797c0bBB8B40c30D250856";

test("wNFLX fallback USD matches on-chain seed (81.94, not 819.4)", () => {
  assert.equal(fallbackStockUsd(wNFLX), 81.94);
});

test("multi-pool NFLX leg mcap uses stock USD oracle not launch anchor", () => {
  const quotePerToken = 7.248624089544173e-9;
  const mcap = marketCapUsdForPool(
    quotePerToken,
    {
      quoteAddress: wNFLX,
      quoteAsset: "wNFLXx",
      marketCount: 3,
      markets: [],
    },
    2500,
    81.94,
    5000,
  );
  assert.ok(mcap > 500 && mcap < 700, `expected ~594 USD mcap, got ${mcap}`);
  assert.ok(mcap < TOTAL_SUPPLY * 0.01, "should not use 10x NFLX price");
});
