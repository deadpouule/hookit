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
  type OnChainLaunch,
} from "@/lib/launches";
import { enrichPoolsWithSpotPrices } from "@/lib/explore";
import { readEthUsd } from "@/lib/eth-usd";
import type { TokenPool } from "@/lib/types";

export function useLaunches() {
  const live = shouldFetchLiveLaunches();

  return useQuery({
    queryKey: ["launches", getLaunchFactoryAddress(), getBondingFactoryAddress()],
    enabled: live,
    queryFn: async (): Promise<TokenPool[]> => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const res = await fetch("/api/launches", { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch launches");
        const body = (await res.json()) as { pools?: TokenPool[] };
        return body.pools ?? [];
      } finally {
        window.clearTimeout(timer);
      }
    },
    retry: 1,
    refetchInterval: 15_000,
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
    retry: 1,
    queryFn: async (): Promise<TokenPool | null> => {
      const needle = id.toLowerCase();

      // Fast path: server API (avoids browser RPC + 50k-block getLogs scan).
      try {
        const res = await fetch("/api/launches", { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as { pools?: TokenPool[] };
          const fromApi =
            body.pools?.find(
              (p) =>
                p.id.toLowerCase() === needle ||
                p.contractAddress?.toLowerCase() === needle ||
                (p.launchId != null && String(p.launchId) === id),
            ) ?? null;
          if (fromApi) return fromApi;
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
              const [enriched] = await enrichPoolsWithSpotPrices(
                publicClient,
                [launchToTokenPool(launch)],
                ethUsd,
                enrichOpts,
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
            const [enriched] = await enrichPoolsWithSpotPrices(
              publicClient,
              [launchToTokenPool(launch)],
              ethUsd,
              enrichOpts,
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
