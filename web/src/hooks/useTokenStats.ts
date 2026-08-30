"use client";

import { useQuery } from "@tanstack/react-query";
import { zeroAddress } from "viem";

import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";
import { fetchIndexerToken, type IndexerTokenSummary } from "@/lib/indexer-client";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import type { DevBuyInfo } from "@/lib/token-dev-buy";
import type { TokenPool } from "@/lib/types";

export type TokenDeskStats = {
  txns: number;
  volume24hUsd: number;
  change5m: number;
  change1h: number;
  change6h: number;
  change24h: number;
  buyCount: number;
  sellCount: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  buyPct: number;
  devBuy: DevBuyInfo;
  quoteDecimals: number;
};

function quoteVolToUsd(raw: string, decimals: number, isEth: boolean, ethUsd: number) {
  const n = Number(raw);
  if (!(n > 0)) return 0;
  if (isEth) return (n / 10 ** decimals) * ethUsd;
  return n / 10 ** decimals;
}

function mapIndexer(summary: IndexerTokenSummary, pool: TokenPool, ethUsd: number): TokenDeskStats {
  const isEth = !pool.quoteAddress || pool.quoteAddress === zeroAddress || pool.quoteAsset === "ETH";
  const qd = summary.quoteDecimals || (isEth ? 18 : 6);
  const volUsd = quoteVolToUsd(summary.volume24h, qd, isEth, ethUsd);
  const buyVolUsd = quoteVolToUsd(summary.buyVolume24h ?? "0", qd, isEth, ethUsd);
  const sellVolUsd = quoteVolToUsd(summary.sellVolume24h ?? "0", qd, isEth, ethUsd);

  return {
    txns: summary.trades24h ?? summary.tradesIndexed ?? 0,
    volume24hUsd: volUsd,
    change5m: summary.change5m ?? 0,
    change1h: summary.change1h ?? 0,
    change6h: summary.change6h ?? 0,
    change24h: summary.change24h ?? pool.change24h ?? 0,
    buyCount: summary.buyCount24h ?? 0,
    sellCount: summary.sellCount24h ?? 0,
    buyVolumeUsd: buyVolUsd,
    sellVolumeUsd: sellVolUsd,
    buyPct: summary.buyPct24h ?? 50,
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

function resolveEthUsd(pool: TokenPool): number {
  if (pool.priceEth && pool.priceEth > 0 && pool.marketCap > 0) {
    const implied = pool.marketCap / (pool.priceEth * TOTAL_SUPPLY);
    if (implied > 100 && implied < 1_000_000) return implied;
  }
  return DEFAULT_LAUNCH_ETH_USD;
}

export function useTokenStats(pool: TokenPool) {
  const address = pool.contractAddress ?? pool.address;
  const ethUsd = resolveEthUsd(pool);
  const isEth = !pool.quoteAddress || pool.quoteAddress === zeroAddress || pool.quoteAsset === "ETH";

  return useQuery({
    queryKey: ["token-desk-stats", address],
    enabled: !!address,
    refetchInterval: 25_000,
    retry: 1,
    queryFn: async (): Promise<TokenDeskStats> => {
      let base: TokenDeskStats = {
        txns: pool.trades24h ?? 0,
        volume24hUsd: pool.volume24h ?? 0,
        change5m: 0,
        change1h: (pool.change24h ?? 0) * 0.08,
        change6h: (pool.change24h ?? 0) * 0.55,
        change24h: pool.change24h ?? 0,
        buyCount: 0,
        sellCount: 0,
        buyVolumeUsd: 0,
        sellVolumeUsd: 0,
        buyPct: 50,
        devBuy: { completed: false },
        quoteDecimals: isEth ? 18 : 6,
      };

      try {
        const summary = await fetchIndexerToken(address);
        base = mapIndexer(summary, pool, ethUsd);
      } catch {
        /* indexer optional */
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

      if (base.volume24hUsd <= 0 && pool.volume24h && pool.volume24h > 0) {
        base.volume24hUsd = pool.volume24h;
      }
      if (base.txns <= 0 && pool.trades24h) base.txns = pool.trades24h;

      return base;
    },
  });
}
