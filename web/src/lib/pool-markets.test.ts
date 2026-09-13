import assert from "node:assert/strict";
import test from "node:test";
import { zeroAddress } from "viem";

import type { IndexerTokenSummary } from "./indexer-client";
import { poolToMarketToken } from "./market-tokens";
import { applyIndexerTokenToPool } from "./pool-markets";
import type { TokenPool } from "./types";

function poolStub(overrides: Partial<TokenPool> = {}): TokenPool {
  return {
    id: "0xabc",
    contractAddress: "0xabc",
    name: "Test",
    ticker: "TST",
    image: "",
    banner: "",
    marketCap: 5_000,
    floorValue: 0,
    liquidity: 0,
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
    quoteUsd: 4_000,
    quoteAsset: "ETH",
    quoteAddress: zeroAddress,
    ...overrides,
  };
}

function summaryStub(overrides: Partial<IndexerTokenSummary> = {}): IndexerTokenSummary {
  return {
    address: "0xabc",
    poolId: "0x1",
    quote: zeroAddress,
    tokenIsCurrency0: true,
    name: "Test",
    symbol: "TST",
    decimals: 18,
    quoteDecimals: 18,
    totalSupply: "0",
    creator: "0x0",
    launchedAt: 0,
    launchId: 1,
    rail: "master",
    metadataURI: null,
    hookModules: null,
    bondingPhase: null,
    tokensSold: null,
    graduationQuote: null,
    realQuote: null,
    graduatedAt: null,
    price: null,
    lastTradeAt: null,
    tradesIndexed: 4,
    holdersIndexed: 2,
    candles5m: 0,
    volume24h: "0",
    trades24h: 0,
    change24h: null,
    ...overrides,
  };
}

test("copies indexer 24h/1h change and volume onto a single-pair pool", () => {
  const pool = applyIndexerTokenToPool(
    poolStub(),
    summaryStub({
      volume24h: (10n ** 18n).toString(),
      trades24h: 4,
      change24h: 12.5,
      change1h: -1.2,
    }),
  );

  assert.equal(pool.change24h, 12.5);
  assert.equal(pool.change1h, -1.2);
  assert.equal(pool.trades24h, 4);
  assert.equal(pool.volume24h, 4_000);
});

test("keeps catalog zeros when indexer has no window yet", () => {
  const pool = applyIndexerTokenToPool(poolStub({ change24h: 0 }), summaryStub());
  assert.equal(pool.change24h, 0);
  assert.equal(pool.change1h, undefined);
  assert.equal(pool.volume24h, undefined);
});

test("maps indexer markets when the catalog pool has none", () => {
  const pool = applyIndexerTokenToPool(
    poolStub(),
    summaryStub({
      marketCount: 2,
      markets: [
        {
          poolId: "0x2",
          quote: "0x2222222222222222222222222222222222222222",
          bps: 6_000,
          tokenIsCurrency0: true,
          tickLower: 0,
          tickUpper: 0,
          liquidity: "0",
        },
        {
          poolId: "0x3",
          quote: "0x3333333333333333333333333333333333333333",
          bps: 4_000,
          tokenIsCurrency0: true,
          tickLower: 0,
          tickUpper: 0,
          liquidity: "0",
        },
      ],
    }),
  );

  assert.equal(pool.marketCount, 2);
  assert.equal(pool.markets?.length, 2);
  assert.equal(pool.markets?.[0]?.bps, 6_000);
});

test("does not overwrite existing markets, still applies stats", () => {
  const existing = [
    {
      quoteAddress: "0x1111111111111111111111111111111111111111" as `0x${string}`,
      quoteAsset: "USDG",
      bps: 10_000,
    },
  ];
  const pool = applyIndexerTokenToPool(
    poolStub({ markets: existing, marketCount: 1 }),
    summaryStub({
      change24h: 3.1,
      markets: [
        {
          poolId: "0x2",
          quote: "0x2222222222222222222222222222222222222222",
          bps: 5_000,
          tokenIsCurrency0: true,
          tickLower: 0,
          tickUpper: 0,
          liquidity: "0",
        },
      ],
      marketCount: 2,
    }),
  );

  assert.equal(pool.change24h, 3.1);
  assert.equal(pool.markets, existing);
  assert.equal(pool.marketCount, 1);
});

test("explore cards use indexer 1h, not a fake 24h fraction", () => {
  const token = poolToMarketToken(poolStub({ change24h: 8, change1h: -2, volume24h: 120 }));
  assert.equal(token.change24h, 8);
  assert.equal(token.change1h, -2);
  assert.equal(token.volume, 120);
});
