"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";

import { STATE_VIEW_ADDRESS, stateViewAbi, ethPerTokenFromSqrtPrice } from "@/lib/pool-price";

export type PricePoint = { ts: number; priceEth: number };

export function usePoolSpotPrice(poolId?: `0x${string}`) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["pool-price", poolId],
    enabled: !!poolId && !!publicClient,
    refetchInterval: 12_000,
    queryFn: async () => {
      if (!poolId || !publicClient) return null;

      const slot0 = (await publicClient.readContract({
        address: STATE_VIEW_ADDRESS,
        abi: stateViewAbi,
        functionName: "getSlot0",
        args: [poolId],
      })) as readonly [bigint, number, number, number];

      const [sqrtPriceX96] = slot0;
      return ethPerTokenFromSqrtPrice(sqrtPriceX96, false);
    },
  });
}

/** Client-side price history (polls pool slot0 until a subgraph exists). */
export function usePriceHistory(poolId?: `0x${string}`, spotPrice?: number | null) {
  const [history, setHistory] = useState<PricePoint[]>([]);

  useEffect(() => {
    if (!poolId) {
      setHistory([]);
      return;
    }
    if (spotPrice == null || spotPrice <= 0) return;

    setHistory((prev) => {
      const last = prev[prev.length - 1];
      const now = Date.now();
      if (last && now - last.ts < 10_000 && Math.abs(last.priceEth - spotPrice) / spotPrice < 0.0001) {
        return prev;
      }
      const next = [...prev, { ts: now, priceEth: spotPrice }];
      return next.slice(-120);
    });
  }, [poolId, spotPrice]);

  return history;
}
