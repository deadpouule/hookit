import {
  fetchIndexerTokens,
  fetchIndexerTrades,
  statsFromIndexerTrades,
  type IndexerTokenSummary,
} from "@/lib/indexer-client";
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

function scopeSummaryToPrimaryPool(
  summary: IndexerTokenSummary,
  trades: { quoteAmount: string; price: string; timestamp: number }[],
): IndexerTokenSummary {
  const stats = statsFromIndexerTrades(trades);
  return {
    ...summary,
    change24h: stats.change ?? summary.change24h,
    volume24h: stats.volumeWei > 0n ? stats.volumeWei.toString() : summary.volume24h,
    trades24h: stats.trades > 0 ? stats.trades : summary.trades24h,
  };
}

/** Merge indexer market legs and 24h stats when on-chain swap index is skipped. */
export async function enrichPoolsWithIndexerMarkets(pools: TokenPool[]): Promise<TokenPool[]> {
  try {
    const { tokens } = await fetchIndexerTokens();
    const byAddress = new Map(tokens.map((token) => [token.address.toLowerCase(), token]));

    return Promise.all(
      pools.map(async (pool) => {
        const address = (pool.contractAddress ?? pool.id).toLowerCase();
        const summary = byAddress.get(address);
        if (!summary) return pool;
        let scoped = summary;
        const primaryPoolId = pool.poolId ?? summary.poolId;
        if ((summary.marketCount ?? pool.marketCount ?? 1) > 1 && primaryPoolId) {
          try {
            const { trades } = await fetchIndexerTrades(summary.address, 2_000, 0, primaryPoolId);
            scoped = scopeSummaryToPrimaryPool(summary, trades);
          } catch {
            scoped = summary;
          }
        }
        return applyIndexerTokenToPool(pool, scoped);
      }),
    );
  } catch {
    return pools;
  }
}
