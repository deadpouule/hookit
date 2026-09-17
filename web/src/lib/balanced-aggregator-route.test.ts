import assert from "node:assert/strict";
import test from "node:test";

import { zeroAddress, type Address } from "viem";

import {
  balancedBuyLegsFromPlan,
  balancedSellLegsFromPlan,
  balancedSellLegsFromRoute,
  canUseBalancedAggregatorBuy,
  isBalancedAggregatorQuote,
  marketIndexForQuote,
  planCanUseBalancedAggregator,
  routeCanUseBalancedAggregator,
  sellPlanCanUseBalancedAggregator,
} from "@/lib/balanced-aggregator-route";
import { STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import type { BestBuyPlan, BestSellPlan, BestSellRoute } from "@/lib/multi-pool-route";
import type { TokenPool } from "@/lib/types";
import { INK_QUOTRON_STOCKS } from "@/lib/xstocks";

const STOCK_A = INK_QUOTRON_STOCKS[0]!.address;
const STOCK_B = INK_QUOTRON_STOCKS[1]!.address;

function poolFor(): TokenPool {
  return {
    ticker: "MLT",
    name: "Multi",
    contractAddress: "0x3333333333333333333333333333333333333333",
    launchId: 7,
    marketCount: 2,
    markets: [
      { quoteAsset: "NVDA", quoteAddress: STOCK_B, bps: 6000 },
      { quoteAsset: "AAPL", quoteAddress: STOCK_A, bps: 4000 },
    ],
    quoteAsset: "USDG",
    quoteAddress: STABLE_QUOTE_ADDRESS,
  };
}

function hookKey(quote: Address): BestBuyPlan["legs"][0]["hookKey"] {
  return {
    currency0: quote,
    currency1: poolFor().contractAddress as Address,
    fee: 0x80_0000,
    tickSpacing: 60,
    hooks: "0x4444444444444444444444444444444444444444",
  };
}

function bridge(quote: Address) {
  return {
    key: {
      currency0: quote,
      currency1: STABLE_QUOTE_ADDRESS,
      fee: 0x80_0000,
      tickSpacing: 60,
      hooks: "0x5555555555555555555555555555555555555555",
    },
    zeroForOne: true,
    amountOut: 100n,
  };
}

test("marketIndexForQuote follows UI markets order, which can differ from factory order", () => {
  const pool = poolFor();
  assert.equal(marketIndexForQuote(pool, STOCK_B), 0);
  assert.equal(marketIndexForQuote(pool, STOCK_A), 1);
  assert.equal(marketIndexForQuote(pool, zeroAddress), null);
});

test("balancedBuyLegsFromPlan uses on-chain marketIndex, not UI bps order", () => {
  const plan: BestBuyPlan = {
    legs: [
      {
        kind: "composite",
        marketQuote: STOCK_A,
        marketIndex: 0,
        hookKey: hookKey(STOCK_A),
        bridge: bridge(STOCK_A),
        amountIn: 60n,
        amountOut: 1_000n,
        routeLabel: "USDG → AAPL → MLT",
      },
      {
        kind: "composite",
        marketQuote: STOCK_B,
        marketIndex: 1,
        hookKey: hookKey(STOCK_B),
        bridge: bridge(STOCK_B),
        amountIn: 40n,
        amountOut: 900n,
        routeLabel: "USDG → NVDA → MLT",
      },
    ],
    amountOut: 1_900n,
    routeLabel: "split",
  };
  const legs = balancedBuyLegsFromPlan(poolFor(), plan, 100);
  assert.equal(legs.length, 2);
  assert.equal(legs[0]?.marketIndex, 0);
  assert.equal(legs[0]?.amountIn, 60n);
  assert.equal(legs[0]?.minAmountOut, 990n);
  assert.equal(legs[1]?.marketIndex, 1);
  assert.equal(planCanUseBalancedAggregator(plan), true);
});

test("balancedBuyLegsFromPlan refuses ETH legs and missing factory indices", () => {
  const ethPlan: BestBuyPlan = {
    legs: [
      {
        kind: "composite",
        marketQuote: zeroAddress,
        marketIndex: 0,
        hookKey: hookKey(zeroAddress),
        bridge: bridge(zeroAddress),
        amountIn: 100n,
        amountOut: 1n,
        routeLabel: "USDG → ETH → MLT",
      },
    ],
    amountOut: 1n,
    routeLabel: "eth",
  };
  assert.equal(balancedBuyLegsFromPlan(poolFor(), ethPlan, 100).length, 0);
  assert.equal(planCanUseBalancedAggregator(ethPlan), false);

  const noIndex: BestBuyPlan = {
    legs: [
      {
        kind: "composite",
        marketQuote: STOCK_A,
        hookKey: hookKey(STOCK_A),
        bridge: bridge(STOCK_A),
        amountIn: 100n,
        amountOut: 1n,
        routeLabel: "USDG → AAPL → MLT",
      },
    ],
    amountOut: 1n,
    routeLabel: "no-index",
  };
  assert.equal(balancedBuyLegsFromPlan(poolFor(), noIndex, 100).length, 0);
});

test("balancedSellLegsFromRoute keeps factory index for Quotrons legs", () => {
  const route: BestSellRoute = {
    kind: "composite",
    marketQuote: STOCK_A,
    marketIndex: 2,
    hookKey: hookKey(STOCK_A),
    bridge: bridge(STOCK_A),
    amountOut: 50n,
    intermediateOut: 10n,
    routeLabel: "MLT → AAPL → USDG",
  };
  const legs = balancedSellLegsFromRoute(poolFor(), route, 7n, 100);
  assert.equal(legs[0]?.marketIndex, 2);
  assert.equal(legs[0]?.amountIn, 7n);
  assert.equal(routeCanUseBalancedAggregator(route), true);
});

test("balancedSellLegsFromPlan splits factory indices across markets", () => {
  const plan: BestSellPlan = {
    legs: [
      {
        kind: "composite",
        marketQuote: STOCK_A,
        marketIndex: 0,
        hookKey: hookKey(STOCK_A),
        bridge: bridge(STOCK_A),
        amountIn: 60n,
        amountOut: 50n,
        intermediateOut: 10n,
        routeLabel: "MLT → AAPL → USDG",
      },
      {
        kind: "composite",
        marketQuote: STOCK_B,
        marketIndex: 1,
        hookKey: hookKey(STOCK_B),
        bridge: bridge(STOCK_B),
        amountIn: 40n,
        amountOut: 30n,
        intermediateOut: 8n,
        routeLabel: "MLT → NVDA → USDG",
      },
    ],
    amountOut: 80n,
    routeLabel: "split",
    bestSingle: {
      kind: "composite",
      marketQuote: STOCK_A,
      marketIndex: 0,
      hookKey: hookKey(STOCK_A),
      bridge: bridge(STOCK_A),
      amountIn: 100n,
      amountOut: 70n,
      intermediateOut: 20n,
      routeLabel: "MLT → AAPL → USDG",
    },
  };
  const legs = balancedSellLegsFromPlan(poolFor(), plan, 100);
  assert.equal(legs.length, 2);
  assert.equal(legs[0]?.marketIndex, 0);
  assert.equal(legs[0]?.amountIn, 60n);
  assert.equal(legs[1]?.marketIndex, 1);
  assert.equal(sellPlanCanUseBalancedAggregator(plan), true);
});

test("canUseBalancedAggregatorBuy accepts USDG only", () => {
  assert.equal(canUseBalancedAggregatorBuy(STABLE_QUOTE_ADDRESS), true);
  assert.equal(canUseBalancedAggregatorBuy(zeroAddress), false);
  assert.equal(isBalancedAggregatorQuote(STOCK_A), true);
  assert.equal(isBalancedAggregatorQuote(zeroAddress), false);
});
