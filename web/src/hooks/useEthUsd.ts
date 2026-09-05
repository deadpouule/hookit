"use client";

import { useQuery } from "@tanstack/react-query";

import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";

/** Live ETH/USD for client UI (QuickBuy, swap USD lines). Cached 30s. */
export function useEthUsd(fallback = DEFAULT_LAUNCH_ETH_USD) {
  const { data } = useQuery({
    queryKey: ["eth-usd"],
    queryFn: async (): Promise<number> => {
      const res = await fetch("/api/eth-usd");
      if (!res.ok) throw new Error("eth-usd");
      const body = (await res.json()) as { ethUsd?: number };
      if (!(body.ethUsd && body.ethUsd > 0)) throw new Error("eth-usd");
      return body.ethUsd;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  return data && data > 0 ? data : fallback;
}
