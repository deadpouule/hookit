import { zeroAddress, type Address } from "viem";

import { poolQuoteLabel } from "@/lib/payment-assets";
import type { TokenPool, TokenPoolMarket } from "@/lib/types";

/** True when this launch has more than one quote pool. */
export function isMultiPool(pool: Pick<TokenPool, "marketCount" | "markets">): boolean {
  if (pool.marketCount != null && pool.marketCount > 1) return true;
  return (pool.markets?.length ?? 0) > 1;
}

export function poolMarkets(pool: TokenPool): TokenPoolMarket[] {
  if (pool.markets?.length) return pool.markets;
  return [
    {
      poolId: pool.poolId,
      quoteAddress: (pool.quoteAddress ?? zeroAddress) as Address,
      quoteAsset: pool.quoteAsset,
      bps: 10_000,
    },
  ];
}

/** Re-point primary quote/pool fields to a selected multi-market leg (swap + pricing). */
export function poolWithMarket(pool: TokenPool, marketIndex: number): TokenPool {
  const markets = poolMarkets(pool);
  const market = markets[Math.min(Math.max(0, marketIndex), markets.length - 1)];
  if (!market) return pool;
  return {
    ...pool,
    quoteAddress: market.quoteAddress,
    quoteAsset: market.quoteAsset ?? poolQuoteLabel({ quoteAddress: market.quoteAddress } as TokenPool),
    poolId: market.poolId ?? pool.poolId,
    markets,
    marketCount: markets.length,
  };
}

export function marketLegLabel(market: TokenPoolMarket): string {
  return (
    market.quoteAsset ??
    poolQuoteLabel({ quoteAddress: market.quoteAddress } as TokenPool)
  );
}

export function marketSharePct(market: TokenPoolMarket): string {
  return `${(market.bps / 100).toFixed(0)}%`;
}
