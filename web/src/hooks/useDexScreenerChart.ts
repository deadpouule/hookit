"use client";

import { useQuery } from "@tanstack/react-query";

import type { DexScreenerChartTarget } from "@/lib/dexscreener";
import { normalizeTokenAddress } from "@/lib/dexscreener";

async function fetchDexScreenerChart(token: string): Promise<DexScreenerChartTarget> {
  const res = await fetch(`/api/dexscreener/chart?token=${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Could not resolve DexScreener chart");
  }
  return res.json() as Promise<DexScreenerChartTarget>;
}

export function useDexScreenerChart(tokenAddress: string | undefined) {
  const normalized = normalizeTokenAddress(tokenAddress);

  return useQuery({
    queryKey: ["dexscreener-chart", normalized],
    queryFn: () => fetchDexScreenerChart(normalized!),
    enabled: !!normalized,
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data?.pair ? false : 30_000),
  });
}
