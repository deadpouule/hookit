"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, isAddress } from "viem";
import { usePublicClient } from "wagmi";

import { getLaunchFactoryAddress } from "@/lib/contracts/config";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import {
  fetchAllLaunches,
  fetchLaunchById,
  launchToTokenPool,
  type OnChainLaunch,
} from "@/lib/launches";
import type { TokenPool } from "@/lib/types";

export function useLaunches() {
  const factory = getLaunchFactoryAddress();
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["launches", factory],
    enabled: !!factory && !!publicClient,
    queryFn: async () => {
      if (!factory || !publicClient) return [];
      const launches = await fetchAllLaunches(publicClient, factory);
      return launches.map(launchToTokenPool);
    },
    refetchInterval: 15_000,
  });
}

export function useLaunchPool(id: string) {
  const factory = getLaunchFactoryAddress();
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["launch-pool", factory, id],
    enabled: !!factory && !!publicClient && !!id,
    queryFn: async (): Promise<TokenPool | null> => {
      if (!factory || !publicClient) return null;

      let launch: OnChainLaunch | null = null;

      if (isAddress(id)) {
        const launchId = (await publicClient.readContract({
          address: factory,
          abi: launchFactoryAbi,
          functionName: "tokenLaunchId",
          args: [id as Address],
        })) as bigint;
        launch = await fetchLaunchById(publicClient, factory, launchId);
      } else if (/^\d+$/.test(id)) {
        launch = await fetchLaunchById(publicClient, factory, BigInt(id));
      }

      return launch ? launchToTokenPool(launch) : null;
    },
  });
}
