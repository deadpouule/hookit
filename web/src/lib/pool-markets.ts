import { fetchIndexerTokens } from "@/lib/indexer-client";
import { poolQuoteLabel } from "@/lib/payment-assets";
import type { TokenPool, TokenPoolMarket } from "@/lib/types";

/** Merge indexer market legs when on-chain reads are unavailable. */
export async function enrichPoolsWithIndexerMarkets(pools: TokenPool[]): Promise<TokenPool[]> {
  try {
    const { tokens } = await fetchIndexerTokens();
    const byAddress = new Map(tokens.map((token) => [token.address.toLowerCase(), token]));

    return pools.map((pool) => {
      const address = (pool.contractAddress ?? pool.id).toLowerCase();
      const summary = byAddress.get(address);
      if (!summary) return pool;

      if (!summary.markets?.length) {
        if (summary.marketCount && summary.marketCount > 1 && !pool.marketCount) {
          return { ...pool, marketCount: summary.marketCount };
        }
        return pool;
      }

      const markets: TokenPoolMarket[] = summary.markets.map((market) => {
        const quoteAddress = market.quote as `0x${string}`;
        return {
          quoteAddress,
          quoteAsset: poolQuoteLabel({ quoteAddress } as TokenPool),
          bps: market.bps,
          poolId: market.poolId as `0x${string}`,
        };
      });

      return {
        ...pool,
        marketCount: summary.marketCount ?? markets.length,
        markets: pool.markets?.length ? pool.markets : markets,
      };
    });
  } catch {
    return pools;
  }
}
