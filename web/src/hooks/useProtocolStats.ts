"use client";

import { useQuery } from "@tanstack/react-query";

import type { LiveProtocolStatsPayload } from "@/lib/protocol-stats-live";

export function useProtocolStats() {
  return useQuery({
    queryKey: ["protocol-stats"],
    queryFn: async (): Promise<LiveProtocolStatsPayload> => {
      const res = await fetch("/api/protocol-stats", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load protocol stats");
      }
      return res.json() as Promise<LiveProtocolStatsPayload>;
    },
    refetchInterval: 15_000,
    staleTime: 0,
    retry: 1,
  });
}
