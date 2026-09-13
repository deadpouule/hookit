"use client";

import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { type Address, isAddress } from "viem";
import { usePublicClient } from "wagmi";

import {
  getBondingFactoryAddress,
  getLaunchFactoryAddress,
} from "@/lib/contracts/config";
import { shouldFetchLiveLaunches } from "@/lib/live-data";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import {
  fetchBondingLaunchById,
  fetchLaunchById,
  fetchLaunchByNumericId,
  launchToTokenPool,
  resolveMasterLaunch,
} from "@/lib/launches";
import { enrichPoolsWithSpotPrices } from "@/lib/explore";
import { readEthUsd, readLaunchEthUsd } from "@/lib/eth-usd";
import {
  LAUNCHES_REFETCH_MS,
  LAUNCHES_STALE_MS,
} from "@/lib/query-cache";
import { mergeLaunchCatalog } from "@/lib/token-identity";
import type { TokenPool } from "@/lib/types";

export function useLaunches(initialPools?: TokenPool[]) {
  const live = shouldFetchLiveLaunches();
  const queryClient = useQueryClient();

  const factory = getLaunchFactoryAddress();
  const bonding = getBondingFactoryAddress();

  return useQuery({
    queryKey: ["launches", factory, bonding],
    enabled: live,
    initialData: initialPools?.length ? initialPools : undefined,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<TokenPool[]> => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch("/api/launches", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch launches");
        const body = (await res.json()) as { pools?: TokenPool[]; factoryConfigured?: boolean };
        const next = body.pools ?? [];
        const prev =
          queryClient.getQueryData<TokenPool[]>(["launches"]) ??
          (initialPools?.length ? initialPools : undefined);
        return mergeLaunchCatalog(prev, next);
      } finally {
        window.clearTimeout(timer);
      }
    },
    staleTime: LAUNCHES_STALE_MS,
    retry: 2,
    refetchInterval: LAUNCHES_REFETCH_MS,
  });
}

export function useLaunchPool(id: string, initialPool?: TokenPool | null) {
  const factory = getLaunchFactoryAddress();
  const bonding = getBondingFactoryAddress();
  const publicClient = usePublicClient();
  const hasFactories = !!factory || !!bonding;

  return useQuery({
    queryKey: ["launch-pool", factory, bonding, id, publicClient?.chain?.id],
    enabled: hasFactories && !!id,
    initialData: initialPool ?? undefined,
    placeholderData: initialPool ?? undefined,
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
        const resolved = await resolveMasterLaunch(publicClient, id as Address);
        if (resolved) {
          const launch = await fetchLaunchById(publicClient, resolved.factory, resolved.launchId);
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
        const launch = await fetchLaunchByNumericId(publicClient, BigInt(id));
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
        if (!pool && bonding) {
          pool = await fetchBondingLaunchById(publicClient, bonding, BigInt(id));
        }
      }

      return pool;
    },
  });
}
