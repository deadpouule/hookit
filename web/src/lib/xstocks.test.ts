import assert from "node:assert/strict";
import test from "node:test";

import { fallbackStockUsd, marketCapUsdForPool } from "./quote-usd";

const wNFLX = "0x7d87fD6A379714194a797c0bBB8B40c30D250856";
const TOTAL_SUPPLY = 1_000_000_000;

test("wNFLX fallback USD matches on-chain seed (81.94, not 819.4)", () => {
  assert.equal(fallbackStockUsd(wNFLX), 81.94);
});

test("multi-pool RWA FDV uses on-chain spot (quote × supply × quoteUsd)", () => {
  const quotePerToken = 7.248624089544173e-9;
  const quoteUsd = 81.94;
  const mcap = marketCapUsdForPool(
    quotePerToken,
    {
      quoteAddress: wNFLX,
      quoteAsset: "wNFLXx",
      marketCount: 3,
      markets: [],
    },
    2500,
    quoteUsd,
    5_000,
  );
  const expected = quotePerToken * TOTAL_SUPPLY * quoteUsd;
  assert.ok(Math.abs(mcap - expected) < 1, `got ${mcap}, expected ~${expected}`);
  assert.ok(mcap < 1_000, `spot FDV ${mcap} should reflect misaligned pool, not $5k floor`);
});
