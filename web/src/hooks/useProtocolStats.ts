"use client";

import { useQuery } from "@tanstack/react-query";

import type { LiveProtocolStatsPayload } from "@/lib/protocol-stats-live";
import {
  PROTOCOL_STATS_REFETCH_MS,
  PROTOCOL_STATS_STALE_MS,
} from "@/lib/query-cache";

export function useProtocolStats() {
  return useQuery({
    queryKey: ["protocol-stats"],
    queryFn: async (): Promise<LiveProtocolStatsPayload> => {
      const res = await fetch("/api/protocol-stats");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load protocol stats");
      }
      return res.json() as Promise<LiveProtocolStatsPayload>;
    },
    staleTime: PROTOCOL_STATS_STALE_MS,
    refetchInterval: PROTOCOL_STATS_REFETCH_MS,
    retry: 1,
  });
}
