import assert from "node:assert/strict";
import test from "node:test";

import {
  fallbackStockUsd,
  floorMasterFdvUsd,
  marketCapUsdForPool,
  marketCapUsdFromLaunchAnchor,
} from "./quote-usd";
import { TARGET_LAUNCH_MCAP_USD } from "./constants";

const wNFLX = "0x7d87fD6A379714194a797c0bBB8B40c30D250856";

test("wNFLX fallback USD matches on-chain seed (81.94, not 819.4)", () => {
  assert.equal(fallbackStockUsd(wNFLX), 81.94);
});

test("floorMasterFdvUsd never returns below launch target", () => {
  assert.equal(floorMasterFdvUsd(594), TARGET_LAUNCH_MCAP_USD);
  assert.equal(floorMasterFdvUsd(6_200), 6_200);
});

test("multi-pool RWA uses launch anchor with $5k floor", () => {
  const quotePerToken = 7.248624089544173e-9;
  const anchored = marketCapUsdFromLaunchAnchor(quotePerToken, 5_000);
  assert.ok(anchored < TARGET_LAUNCH_MCAP_USD, `raw anchor ${anchored} below floor`);
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
    5_000,
  );
  assert.equal(mcap, TARGET_LAUNCH_MCAP_USD);
});
