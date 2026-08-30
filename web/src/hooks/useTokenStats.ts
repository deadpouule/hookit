"use client";

import { useQuery } from "@tanstack/react-query";
import { zeroAddress } from "viem";

import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";
import { fetchIndexerToken, fetchIndexerTrades, type IndexerTokenSummary } from "@/lib/indexer-client";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import type { DevBuyInfo } from "@/lib/token-dev-buy";
import {
  activityFromTrades,
  emptyTokenWindowStats,
  mapWindowVolumes,
  quoteVolToUsd,
  type StatsWindow,
  type TokenWindowStats,
} from "@/lib/token-window-stats";
import type { TokenPool } from "@/lib/types";

export type TokenDeskStats = {
  change5m: number;
  change1h: number;
  change6h: number;
  change24h: number;
  windows: Record<
    StatsWindow,
    {
      txns: number;
      volumeUsd: number;
      buyCount: number;
      sellCount: number;
      buyVolumeUsd: number;
      sellVolumeUsd: number;
      buyPct: number;
    }
  >;
  devBuy: DevBuyInfo;
  quoteDecimals: number;
};

function resolveEthUsd(pool: TokenPool): number {
  if (pool.priceEth && pool.priceEth > 0 && pool.marketCap > 0) {
    const implied = pool.marketCap / (pool.priceEth * TOTAL_SUPPLY);
    if (implied > 100 && implied < 1_000_000) return implied;
  }
  return DEFAULT_LAUNCH_ETH_USD;
}

function mapIndexerWindows(
  summary: IndexerTokenSummary,
  pool: TokenPool,
  ethUsd: number,
): TokenDeskStats {
  const isEth = !pool.quoteAddress || pool.quoteAddress === zeroAddress || pool.quoteAsset === "ETH";
  const qd = summary.quoteDecimals || (isEth ? 18 : 6);

  const rawWindows: TokenWindowStats = summary.windows
    ? {
        "5m": summary.windows["5m"],
        "1h": summary.windows["1h"],
        "6h": summary.windows["6h"],
        "24h": summary.windows["24h"],
      }
    : {
        ...emptyTokenWindowStats(),
        "24h": {
          txns: summary.trades24h ?? summary.tradesIndexed ?? 0,
          volumeQuote: summary.volume24h ?? "0",
          buyCount: summary.buyCount24h ?? 0,
          sellCount: summary.sellCount24h ?? 0,
          buyVolumeQuote: summary.buyVolume24h ?? "0",
          sellVolumeQuote: summary.sellVolume24h ?? "0",
          buyPct: summary.buyPct24h ?? 50,
        },
      };

  return {
    change5m: summary.change5m ?? 0,
    change1h: summary.change1h ?? 0,
    change6h: summary.change6h ?? 0,
    change24h: summary.change24h ?? pool.change24h ?? 0,
    windows: mapWindowVolumes(rawWindows, qd, isEth, ethUsd),
    devBuy: summary.devBuyCompleted
      ? {
          completed: true,
          quoteSpent: summary.devBuyQuoteSpent ?? undefined,
          tokensReceived: summary.devBuyTokensReceived ?? undefined,
          txHash: (summary.devBuyTxHash as `0x${string}` | null) ?? undefined,
          timestamp: summary.devBuyAt ?? undefined,
        }
      : { completed: false },
    quoteDecimals: qd,
  };
}

function fallbackFromPool(pool: TokenPool, ethUsd: number): TokenDeskStats {
  const isEth = !pool.quoteAddress || pool.quoteAddress === zeroAddress || pool.quoteAsset === "ETH";
  const qd = isEth ? 18 : 6;
  const volUsd = pool.volume24h ?? 0;
  const txns = pool.trades24h ?? 0;
  const change24h = pool.change24h ?? 0;

  const empty = emptyTokenWindowStats();
  const windows = mapWindowVolumes(
    {
      ...empty,
      "24h": {
        ...empty["24h"],
        txns,
        volumeQuote: isEth
          ? String(Math.round((volUsd / ethUsd) * 10 ** qd))
          : String(Math.round(volUsd * 10 ** qd)),
        buyPct: 50,
      },
    },
    qd,
    isEth,
    ethUsd,
  );

  if (windows["24h"].volumeUsd <= 0 && volUsd > 0) {
    windows["24h"].volumeUsd = volUsd;
  }
  if (windows["24h"].txns <= 0 && txns > 0) {
    windows["24h"].txns = txns;
  }

  return {
    change5m: 0,
    change1h: change24h * 0.08,
    change6h: change24h * 0.55,
    change24h,
    windows,
    devBuy: { completed: false },
    quoteDecimals: qd,
  };
}

export function useTokenStats(pool: TokenPool) {
  const address = pool.contractAddress ?? pool.address;
  const ethUsd = resolveEthUsd(pool);

  return useQuery({
    queryKey: ["token-desk-stats", address],
    enabled: !!address,
    refetchInterval: 25_000,
    retry: 1,
    queryFn: async (): Promise<TokenDeskStats> => {
      let base = fallbackFromPool(pool, ethUsd);

      try {
        const summary = await fetchIndexerToken(address);
        base = mapIndexerWindows(summary, pool, ethUsd);

        if (!summary.windows) {
          try {
            const { trades } = await fetchIndexerTrades(address, 500);
            if (trades.length > 0) {
              const computed = activityFromTrades(trades);
              const isEth =
                !pool.quoteAddress || pool.quoteAddress === zeroAddress || pool.quoteAsset === "ETH";
              const qd = summary.quoteDecimals || (isEth ? 18 : 6);
              base.windows = mapWindowVolumes(computed, qd, isEth, ethUsd);
            }
          } catch {
            /* trades optional */
          }
        }
      } catch {
        try {
          const { trades } = await fetchIndexerTrades(address, 500);
          if (trades.length > 0) {
            const isEth =
              !pool.quoteAddress || pool.quoteAddress === zeroAddress || pool.quoteAsset === "ETH";
            const qd = isEth ? 18 : 6;
            const computed = activityFromTrades(trades);
            base.windows = mapWindowVolumes(computed, qd, isEth, ethUsd);
          }
        } catch {
          /* indexer optional */
        }
      }

      if (!base.devBuy.completed) {
        try {
          const res = await fetch(`/api/token/${address}/dev-buy`, { cache: "no-store" });
          if (res.ok) {
            const body = (await res.json()) as { devBuy?: DevBuyInfo };
            if (body.devBuy?.completed) base.devBuy = body.devBuy;
          }
        } catch {
          /* on-chain fallback optional */
        }
      }

      return base;
    },
  });
}
