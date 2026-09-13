"use client";

import { useQuery } from "@tanstack/react-query";

import { normalizeTokenAddress } from "@/lib/dexscreener";
import { geckoOhlcvPath } from "@/lib/geckoterminal";
import type { ChartBar, ChartInterval } from "@/lib/token-chart";

async function fetchBars(
  token: string,
  interval: ChartInterval,
  quoteAddress?: string,
): Promise<{ bars: ChartBar[]; pool: string | null }> {
  const params = new URLSearchParams({
    token,
    interval,
  });
  if (quoteAddress) params.set("quote", quoteAddress);
  const res = await fetch(`/api/geckoterminal/ohlcv?${params.toString()}`, { cache: "no-store" });
  if (res.status === 429 || !res.ok) return { bars: [], pool: null };
  const body = (await res.json()) as { bars?: ChartBar[]; pool?: string | null };
  return { bars: Array.isArray(body.bars) ? body.bars : [], pool: body.pool ?? null };
}

export function useGeckoTerminalBars(
  tokenAddress: string | undefined,
  interval: ChartInterval,
  quoteAddress?: string,
) {
  const normalized = normalizeTokenAddress(tokenAddress);
  const quote = normalizeTokenAddress(quoteAddress);
  const supported = !!geckoOhlcvPath(interval);

  return useQuery({
    queryKey: ["geckoterminal-ohlcv", normalized, interval, quote],
    queryFn: () => fetchBars(normalized!, interval, quote ?? undefined),
    enabled: !!normalized && supported,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
