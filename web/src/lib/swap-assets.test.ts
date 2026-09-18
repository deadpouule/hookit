import assert from "node:assert/strict";
import test from "node:test";
import { zeroAddress } from "viem";

import { STABLE_QUOTE_ADDRESS } from "./contracts/config";
import { swapPickerQuoteAssets } from "./swap-assets";
import type { TokenPool } from "./types";
import { INK_QUOTRON_STOCKS } from "./xstocks";

function poolStub(overrides: Partial<TokenPool> = {}): TokenPool {
  return {
    id: "0xabc",
    contractAddress: "0xabc",
    name: "HOOKTEST",
    ticker: "HTEST",
    image: "",
    banner: "",
    marketCap: 5011,
    floorValue: 0,
    liquidity: 5011,
    change24h: 0,
    hooks: {
      antiSnipe: false,
      backedFloor: false,
      antiMev: false,
      customHook: false,
    },
    address: "0xabc",
    hookType: "Master",
    bannerGradient: "",
    quoteUsd: 2527.56,
    quoteAsset: "ETH",
    quoteAddress: zeroAddress,
    ...overrides,
  };
}

test("ETH-quoted singles list USDG then ETH", () => {
  const keys = swapPickerQuoteAssets(poolStub()).map((a) => a.key);
  assert.deepEqual(keys, ["stable-usdg", "native-eth"]);
});

test("multi-pair lists USDG then each stock, not ETH", () => {
  const aapl = INK_QUOTRON_STOCKS[0]!;
  const amzn = INK_QUOTRON_STOCKS[1]!;
  const keys = swapPickerQuoteAssets(
    poolStub({
      quoteAsset: "wAAPLx",
      quoteAddress: aapl.address,
      marketCount: 2,
      markets: [
        { quoteAddress: aapl.address, quoteAsset: "wAAPLx", bps: 5_000, poolId: "0xaaa" },
        { quoteAddress: amzn.address, quoteAsset: "wAMZNx", bps: 5_000, poolId: "0xbbb" },
      ],
    }),
  ).map((a) => a.symbol);
  assert.ok(keys.includes("USDG") || keys.includes("USDC"));
  assert.ok(keys.includes("wAAPLx"));
  assert.ok(keys.includes("wAMZNx"));
  assert.ok(!keys.includes("ETH"));
});

test("USDG always has its pairing logo", () => {
  const usdg = swapPickerQuoteAssets(poolStub())[0];
  assert.equal(usdg?.address?.toLowerCase(), STABLE_QUOTE_ADDRESS.toLowerCase());
  assert.equal(usdg?.imageUrl, "/pairing/usdg.png");
});
