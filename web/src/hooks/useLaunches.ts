"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, isAddress } from "viem";
import { usePublicClient } from "wagmi";

import {
  getBondingFactoryAddress,
  getLaunchFactoryAddress,
} from "@/lib/contracts/config";
import { shouldFetchLiveLaunches } from "@/lib/live-data";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import {
  fetchBondingLaunchById,
  fetchLaunchById,
  launchToTokenPool,
} from "@/lib/launches";
import { enrichPoolsWithSpotPrices } from "@/lib/explore";
import { readEthUsd, readLaunchEthUsd } from "@/lib/eth-usd";
import {
  LAUNCHES_REFETCH_MS,
  LAUNCHES_STALE_MS,
} from "@/lib/query-cache";
import type { TokenPool } from "@/lib/types";

export function useLaunches(initialPools?: TokenPool[]) {
  const live = shouldFetchLiveLaunches();

  return useQuery({
    queryKey: ["launches"],
    enabled: live,
    initialData: initialPools?.length ? initialPools : undefined,
    queryFn: async (): Promise<TokenPool[]> => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch("/api/launches", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch launches");
        const body = (await res.json()) as { pools?: TokenPool[]; factoryConfigured?: boolean };
        return body.pools ?? [];
      } finally {
        window.clearTimeout(timer);
      }
    },
    staleTime: LAUNCHES_STALE_MS,
    retry: 2,
    refetchInterval: LAUNCHES_REFETCH_MS,
  });
}

export function useLaunchPool(id: string) {
  const factory = getLaunchFactoryAddress();
  const bonding = getBondingFactoryAddress();
  const publicClient = usePublicClient();
  const ready = (!!factory || !!bonding) && !!publicClient && !!id;

  return useQuery({
    queryKey: ["launch-pool", factory, bonding, id, publicClient?.chain?.id],
    enabled: ready,
    staleTime: LAUNCHES_STALE_MS,
    retry: 1,
    queryFn: async (): Promise<TokenPool | null> => {
      try {
        const res = await fetch(`/api/launches/${encodeURIComponent(id)}`);
        if (res.ok) {
          const body = (await res.json()) as { pool?: TokenPool };
          if (body.pool) return body.pool;
        }
      } catch {
        /* fall through to chain */
      }

      if (!publicClient) return null;

      let pool: TokenPool | null = null;
      const enrichOpts = { skipSwapIndex: true };

      if (isAddress(id)) {
        if (factory) {
          const launchId = (await publicClient.readContract({
            address: factory,
            abi: launchFactoryAbi,
            functionName: "tokenLaunchId",
            args: [id as Address],
          })) as bigint;
          if (launchId > BigInt(0)) {
            const launch = await fetchLaunchById(publicClient, factory, launchId);
            if (launch) {
              const ethUsd = await readEthUsd(publicClient);
              const launchEthUsd = await readLaunchEthUsd(publicClient);
              const [enriched] = await enrichPoolsWithSpotPrices(
                publicClient,
                [launchToTokenPool(launch)],
                ethUsd,
                { ...enrichOpts, launchEthUsd },
              );
              pool = enriched ?? null;
            }
          }
        }
        if (!pool && bonding) {
          const launchId = (await publicClient.readContract({
            address: bonding,
            abi: bondingFactoryAbi,
            functionName: "tokenLaunchId",
            args: [id as Address],
          })) as bigint;
          if (launchId > BigInt(0)) {
            pool = await fetchBondingLaunchById(publicClient, bonding, launchId);
          }
        }
      } else if (/^\d+$/.test(id)) {
        if (factory) {
          const launch = await fetchLaunchById(publicClient, factory, BigInt(id));
          if (launch) {
            const ethUsd = await readEthUsd(publicClient);
            const launchEthUsd = await readLaunchEthUsd(publicClient);
            const [enriched] = await enrichPoolsWithSpotPrices(
              publicClient,
              [launchToTokenPool(launch)],
              ethUsd,
              { ...enrichOpts, launchEthUsd },
            );
            pool = enriched ?? null;
          }
        }
        if (!pool && bonding) {
          pool = await fetchBondingLaunchById(publicClient, bonding, BigInt(id));
        }
      }

      return pool;
    },
  });
}
