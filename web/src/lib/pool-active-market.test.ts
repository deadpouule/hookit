import assert from "node:assert/strict";
import test from "node:test";
import { zeroAddress } from "viem";

import { poolWithMarket } from "./pool-active-market";
import type { TokenPool } from "./types";

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
    poolId: "0x9099c66af7a57c85309ef02f4b35a04ca0c8b1d3dc4d5c89704a6edcf1a15a21",
    priceEth: 1.98e-9,
    ...overrides,
  };
}

test("poolWithMarket keeps ETH spot when the selected leg is already primary", () => {
  const next = poolWithMarket(poolStub(), 0);
  assert.equal(next.quoteUsd, 2527.56);
  assert.equal(next.marketCap, 5011);
  assert.equal(next.liquidity, 5011);
  assert.equal(next.priceEth, 1.98e-9);
});

test("poolWithMarket drops spot when switching to another quote pool", () => {
  const next = poolWithMarket(
    poolStub({
      marketCount: 2,
      markets: [
        {
          quoteAddress: "0x1111111111111111111111111111111111111111",
          quoteAsset: "wNVDAx",
          bps: 5_000,
          poolId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        {
          quoteAddress: "0x2222222222222222222222222222222222222222",
          quoteAsset: "wNFLXx",
          bps: 5_000,
          poolId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      ],
    }),
    1,
  );
  assert.equal(next.quoteUsd, undefined);
  assert.equal(next.marketCap, 0);
  assert.equal(next.quoteAsset, "wNFLXx");
});
