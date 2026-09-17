import { type Address, zeroAddress } from "viem";

import type { BalancedRouteLeg } from "@/lib/contracts/balanced-aggregator-abi";
import { STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import type { BestBuyPlan, BestSellPlan, BestSellRoute } from "@/lib/multi-pool-route";
import { poolMarkets } from "@/lib/pool-active-market";
import type { TokenPool } from "@/lib/types";
import { INK_QUOTRON_STOCKS } from "@/lib/xstocks";

/** True when BalancedAggregator can swap this market quote (USDG or a Quotrons wStock). */
export function isBalancedAggregatorQuote(quote: Address): boolean {
  const key = quote.toLowerCase();
  if (key === STABLE_QUOTE_ADDRESS.toLowerCase()) return true;
  return INK_QUOTRON_STOCKS.some((s) => s.address.toLowerCase() === key);
}

/**
 * UI `pool.markets` is sorted by bps in the indexer, not factory order.
 * Do not use this for execution; prefer on-chain `marketIndex` from `loadMarketLegs`.
 */
export function marketIndexForQuote(pool: TokenPool, quote: Address): number | null {
  const markets = poolMarkets(pool);
  const key = quote.toLowerCase();
  const ix = markets.findIndex((m) => (m.quoteAddress ?? zeroAddress).toLowerCase() === key);
  return ix >= 0 ? ix : null;
}

function executionMarketIndex(leg: { marketIndex?: number; marketQuote: Address }): number | null {
  if (leg.marketIndex == null || !Number.isInteger(leg.marketIndex) || leg.marketIndex < 0) {
    return null;
  }
  if (!isBalancedAggregatorQuote(leg.marketQuote)) return null;
  return leg.marketIndex;
}

export function balancedBuyLegsFromPlan(
  pool: TokenPool,
  plan: BestBuyPlan,
  slippageBps: number,
): BalancedRouteLeg[] {
  void pool;
  const legs: BalancedRouteLeg[] = [];
  for (const leg of plan.legs) {
    const marketIndex = executionMarketIndex(leg);
    if (marketIndex == null) return [];
    const minOut = (leg.amountOut * BigInt(10_000 - slippageBps)) / BigInt(10_000) || BigInt(1);
    legs.push({
      marketIndex,
      amountIn: leg.amountIn,
      minAmountOut: minOut,
    });
  }
  return legs;
}

export function balancedSellLegsFromRoute(
  pool: TokenPool,
  route: BestSellRoute,
  amountIn: bigint,
  slippageBps: number,
): BalancedRouteLeg[] {
  return balancedSellLegsFromPlan(pool, {
    legs: [{ ...route, amountIn }],
    amountOut: route.amountOut,
    routeLabel: route.routeLabel,
    bestSingle: { ...route, amountIn },
  }, slippageBps);
}

export function balancedSellLegsFromPlan(
  pool: TokenPool,
  plan: BestSellPlan,
  slippageBps: number,
): BalancedRouteLeg[] {
  void pool;
  const legs: BalancedRouteLeg[] = [];
  for (const leg of plan.legs) {
    const marketIndex = executionMarketIndex(leg);
    if (marketIndex == null) return [];
    const minOut = (leg.amountOut * BigInt(10_000 - slippageBps)) / BigInt(10_000) || BigInt(1);
    legs.push({
      marketIndex,
      amountIn: leg.amountIn,
      minAmountOut: minOut,
    });
  }
  return legs;
}

export function canUseBalancedAggregatorBuy(paymentAddress: Address): boolean {
  return paymentAddress.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase();
}

export function canUseBalancedAggregatorSell(receiveAddress: Address): boolean {
  return receiveAddress.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase();
}

export function planCanUseBalancedAggregator(plan: BestBuyPlan): boolean {
  return (
    plan.legs.length > 0 &&
    plan.legs.every((leg) => executionMarketIndex(leg) != null)
  );
}

export function routeCanUseBalancedAggregator(route: BestSellRoute): boolean {
  return executionMarketIndex(route) != null;
}

export function sellPlanCanUseBalancedAggregator(plan: BestSellPlan): boolean {
  return (
    plan.legs.length > 0 &&
    plan.legs.every((leg) => executionMarketIndex(leg) != null)
  );
}

export function balancedDeadlineSec(offsetSec = 600): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + offsetSec);
}

export function balancedMinTotalOut(legs: BalancedRouteLeg[]): bigint {
  return legs.reduce((sum, leg) => sum + leg.minAmountOut, BigInt(0));
}
