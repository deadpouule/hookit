"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchIndexerHealth, type IndexerHealth } from "@/lib/indexer-client";
import {
  INDEXER_REFETCH_MS,
  INDEXER_STALE_MS,
} from "@/lib/query-cache";

export function useIndexerHealth() {
  return useQuery({
    queryKey: ["indexer-health"],
    queryFn: async (): Promise<IndexerHealth | null> => {
      try {
        return await fetchIndexerHealth();
      } catch {
        return null;
      }
    },
    staleTime: INDEXER_STALE_MS,
    refetchInterval: INDEXER_REFETCH_MS,
    retry: false,
  });
}
