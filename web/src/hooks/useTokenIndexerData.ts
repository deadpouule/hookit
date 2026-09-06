"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchIndexerCandles,
  fetchIndexerHolders,
  fetchIndexerToken,
  fetchIndexerTrades,
  type IndexerCandle,
  type IndexerHolder,
  type IndexerTokenSummary,
  type IndexerTrade,
} from "@/lib/indexer-client";
import {
  INDEXER_REFETCH_MS,
  INDEXER_STALE_MS,
} from "@/lib/query-cache";

export type TokenIndexerBundle = {
  summary: IndexerTokenSummary | null;
  trades: IndexerTrade[];
  holders: IndexerHolder[];
  candles: IndexerCandle[];
};

type TokenIndexerOptions = {
  poolId?: string | null;
  tradesLimit?: number;
  holdersLimit?: number;
  candlesLimit?: number;
  enabled?: boolean;
};

export function useTokenIndexerData(
  address: string | null | undefined,
  opts?: TokenIndexerOptions,
) {
  const tradesLimit = opts?.tradesLimit ?? 80;
  const holdersLimit = opts?.holdersLimit ?? 20;
  const candlesLimit = opts?.candlesLimit ?? 200;
  const poolId = opts?.poolId ?? undefined;

  return useQuery({
    queryKey: ["indexer-token-bundle", address, poolId, tradesLimit, holdersLimit, candlesLimit],
    enabled: !!address && opts?.enabled !== false,
    queryFn: async (): Promise<TokenIndexerBundle> => {
      if (!address) {
        return { summary: null, trades: [], holders: [], candles: [] };
      }
      const [summary, tradesRes, holdersRes, candlesRes] = await Promise.all([
        fetchIndexerToken(address, poolId).catch(() => null),
        fetchIndexerTrades(address, tradesLimit, 0, poolId).catch(() => ({
          trades: [] as IndexerTrade[],
        })),
        fetchIndexerHolders(address, holdersLimit).catch(() => ({ holders: [] as IndexerHolder[] })),
        fetchIndexerCandles(address, candlesLimit, poolId).catch(() => ({
          candles: [] as IndexerCandle[],
        })),
      ]);
      return {
        summary,
        trades: tradesRes.trades,
        holders: holdersRes.holders,
        candles: candlesRes.candles,
      };
    },
    staleTime: INDEXER_STALE_MS,
    refetchInterval: INDEXER_REFETCH_MS,
    retry: false,
  });
}
