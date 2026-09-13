"use client";

import { useQuery } from "@tanstack/react-query";

import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";

type EthUsdPayload = { ethUsd?: number; launchEthUsd?: number };

async function fetchEthUsdPayload(): Promise<EthUsdPayload> {
  const res = await fetch("/api/eth-usd");
  if (!res.ok) throw new Error("eth-usd");
  const body = (await res.json()) as EthUsdPayload;
  if (!(body.ethUsd && body.ethUsd > 0) && !(body.launchEthUsd && body.launchEthUsd > 0)) {
    throw new Error("eth-usd");
  }
  return body;
}

function useEthUsdQuery() {
  return useQuery({
    queryKey: ["eth-usd"],
    queryFn: fetchEthUsdPayload,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

/** Live ETH/USD for client UI (QuickBuy, swap USD lines). Cached 30s. */
export function useEthUsd(fallback = DEFAULT_LAUNCH_ETH_USD) {
  const { data } = useEthUsdQuery();
  return data?.ethUsd && data.ethUsd > 0 ? data.ethUsd : fallback;
}

/** Factory ETH/USD for ETH-quoted FDV / candles - matches Defined when the oracle is sane. */
export function useLaunchEthUsd(fallback = DEFAULT_LAUNCH_ETH_USD) {
  const { data } = useEthUsdQuery();
  if (data?.launchEthUsd && data.launchEthUsd > 0) return data.launchEthUsd;
  if (data?.ethUsd && data.ethUsd > 0) return data.ethUsd;
  return fallback;
}
