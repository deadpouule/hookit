import { fetchIndexerTokens, type IndexerTokenSummary } from "@/lib/indexer-client";
import { poolQuoteLabel } from "@/lib/payment-assets";
import { quoteVolumeUsd } from "@/lib/quote-usd";
import type { TokenPool, TokenPoolMarket } from "@/lib/types";

function indexerVolumeUsd(summary: IndexerTokenSummary, pool: TokenPool): number {
  if (!summary.volume24h || summary.volume24h === "0") return 0;
  try {
    const quoteUsd = pool.quoteUsd ?? 0;
    return quoteVolumeUsd(BigInt(summary.volume24h), pool, quoteUsd, quoteUsd);
  } catch {
    return 0;
  }
}

function finiteOr<T extends number | undefined>(value: number | null | undefined, fallback: T): number | T {
  return value != null && Number.isFinite(value) ? value : fallback;
}

/** Copy indexer 24h/1h change, volume, and market legs onto a catalog pool. */
export function applyIndexerTokenToPool(pool: TokenPool, summary: IndexerTokenSummary): TokenPool {
  const volumeUsd = indexerVolumeUsd(summary, pool);
  const next: TokenPool = {
    ...pool,
    change24h: finiteOr(summary.change24h, pool.change24h),
    change1h: finiteOr(summary.change1h, pool.change1h),
    volume24h: volumeUsd > 0 ? volumeUsd : pool.volume24h,
    trades24h: summary.trades24h ?? pool.trades24h,
  };

  if (summary.markets?.length && !pool.markets?.length) {
    const markets: TokenPoolMarket[] = summary.markets.map((market) => {
      const quoteAddress = market.quote as `0x${string}`;
      return {
        quoteAddress,
        quoteAsset: poolQuoteLabel({ quoteAddress } as TokenPool),
        bps: market.bps,
        poolId: market.poolId as `0x${string}`,
      };
    });
    next.markets = markets;
    next.marketCount = summary.marketCount ?? markets.length;
    return next;
  }

  if (summary.marketCount && summary.marketCount > 1 && !pool.marketCount) {
    next.marketCount = summary.marketCount;
  }
  return next;
}

/** Merge indexer market legs and 24h stats when on-chain swap index is skipped. */
export async function enrichPoolsWithIndexerMarkets(pools: TokenPool[]): Promise<TokenPool[]> {
  try {
    const { tokens } = await fetchIndexerTokens();
    const byAddress = new Map(tokens.map((token) => [token.address.toLowerCase(), token]));

    return pools.map((pool) => {
      const address = (pool.contractAddress ?? pool.id).toLowerCase();
      const summary = byAddress.get(address);
      return summary ? applyIndexerTokenToPool(pool, summary) : pool;
    });
  } catch {
    return pools;
  }
}
