import { unstable_cache } from "next/cache";
import { cache } from "react";
import { type Address, isAddress, type PublicClient } from "viem";

import {
  getBondingFactoryAddress,
  getLaunchFactoryAddress,
} from "@/lib/contracts/config";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { enrichPoolsWithSpotPrices } from "@/lib/explore";
import { readEthUsd, readLaunchEthUsd } from "@/lib/eth-usd";
import {
  fetchAllBondingLaunches,
  fetchAllLaunches,
  fetchBondingLaunchById,
  fetchLaunchById,
  launchToTokenPool,
} from "@/lib/launches";
import { isIndexerConfigured } from "@/lib/live-data";
import { enrichPoolsWithIndexerMarkets } from "@/lib/pool-markets";
import { getDetailPool } from "@/lib/pools";
import { createServerPublicClient } from "@/lib/server-rpc";
import type { TokenPool } from "@/lib/types";

export const LAUNCHES_REVALIDATE_SEC = 12;

const API_TIMEOUT_MS = 25_000;

export type LaunchesResponse = {
  pools: TokenPool[];
  factoryConfigured: boolean;
  ethUsd: number;
  rails?: { master: boolean; classic: boolean };
  error?: string;
};

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function findPoolById(pools: TokenPool[], id: string): TokenPool | null {
  const needle = id.toLowerCase();
  return (
    pools.find(
      (p) =>
        p.id.toLowerCase() === needle ||
        p.contractAddress?.toLowerCase() === needle ||
        (p.launchId != null && String(p.launchId) === id),
    ) ?? null
  );
}

async function loadLaunchesResponseImpl(): Promise<LaunchesResponse> {
  const factory = getLaunchFactoryAddress();
  const bonding = getBondingFactoryAddress();
  if (!factory && !bonding) {
    return { pools: [], factoryConfigured: false, ethUsd: 0 };
  }

  const client = createServerPublicClient() as PublicClient;
  const ethUsd = await withTimeout(readEthUsd(client), API_TIMEOUT_MS, "readEthUsd");
  const launchEthUsd = await withTimeout(readLaunchEthUsd(client), API_TIMEOUT_MS, "readLaunchEthUsd");

  const [masterRaw, classicPools] = await withTimeout(
    Promise.all([
      factory ? fetchAllLaunches(client, factory) : Promise.resolve([]),
      bonding ? fetchAllBondingLaunches(client, bonding) : Promise.resolve([]),
    ]),
    API_TIMEOUT_MS,
    "fetchLaunches",
  );

  const masterPools = await enrichPoolsWithSpotPrices(
    client,
    masterRaw.map(launchToTokenPool),
    ethUsd,
    { skipSwapIndex: isIndexerConfigured(), launchEthUsd },
  );

  const classicGraduated = classicPools.filter((p) => !!p.poolId);
  const classicBonding = classicPools.filter((p) => !p.poolId);
  const classicWithSpot = await enrichPoolsWithSpotPrices(client, classicGraduated, ethUsd, {
    skipSwapIndex: isIndexerConfigured(),
    launchEthUsd,
  });

  const pools = [...masterPools, ...classicWithSpot, ...classicBonding].sort(
    (a, b) => (b.launchedAt ?? 0) - (a.launchedAt ?? 0),
  );

  const withMarkets = isIndexerConfigured() ? await enrichPoolsWithIndexerMarkets(pools) : pools;

  return {
    pools: withMarkets,
    factoryConfigured: true,
    ethUsd,
    rails: {
      master: !!factory,
      classic: !!bonding,
    },
  };
}

const getCachedLaunchesResponse = unstable_cache(
  loadLaunchesResponseImpl,
  ["hookit-launches"],
  { revalidate: LAUNCHES_REVALIDATE_SEC },
);

/** Full catalog — cached across requests (12s) and deduped within a render. */
export const loadLaunchesResponse = cache(async (): Promise<LaunchesResponse> =>
  getCachedLaunchesResponse(),
);

async function loadLaunchPoolByIdImpl(id: string): Promise<TokenPool | null> {
  const needle = id.trim();
  if (!needle) return null;

  const demo = getDetailPool(needle);
  if (demo && !isAddress(needle)) return demo;

  const factory = getLaunchFactoryAddress();
  const bonding = getBondingFactoryAddress();
  if (!factory && !bonding) return demo ?? null;

  const client = createServerPublicClient() as PublicClient;
  const ethUsd = await withTimeout(readEthUsd(client), API_TIMEOUT_MS, "readEthUsd");
  const launchEthUsd = await withTimeout(readLaunchEthUsd(client), API_TIMEOUT_MS, "readLaunchEthUsd");
  const enrichOpts = { skipSwapIndex: isIndexerConfigured(), launchEthUsd };

  let pool: TokenPool | null = null;

  if (isAddress(needle)) {
    const token = needle as Address;
    if (factory) {
      const launchId = (await client.readContract({
        address: factory,
        abi: launchFactoryAbi,
        functionName: "tokenLaunchId",
        args: [token],
      })) as bigint;
      if (launchId > BigInt(0)) {
        const launch = await fetchLaunchById(client, factory, launchId);
        if (launch) {
          const [enriched] = await enrichPoolsWithSpotPrices(
            client,
            [launchToTokenPool(launch)],
            ethUsd,
            enrichOpts,
          );
          pool = enriched ?? null;
        }
      }
    }
    if (!pool && bonding) {
      const launchId = (await client.readContract({
        address: bonding,
        abi: bondingFactoryAbi,
        functionName: "tokenLaunchId",
        args: [token],
      })) as bigint;
      if (launchId > BigInt(0)) {
        pool = await fetchBondingLaunchById(client, bonding, launchId);
      }
    }
  } else if (/^\d+$/.test(needle)) {
    const launchId = BigInt(needle);
    if (factory) {
      const launch = await fetchLaunchById(client, factory, launchId);
      if (launch) {
        const [enriched] = await enrichPoolsWithSpotPrices(
          client,
          [launchToTokenPool(launch)],
          ethUsd,
          enrichOpts,
        );
        pool = enriched ?? null;
      }
    }
    if (!pool && bonding) {
      pool = await fetchBondingLaunchById(client, bonding, launchId);
    }
  }

  if (!pool) return demo ?? null;

  if (isIndexerConfigured()) {
    const [withMarkets] = await enrichPoolsWithIndexerMarkets([pool]);
    return withMarkets ?? pool;
  }
  return pool;
}

const getCachedLaunchPoolById = unstable_cache(
  loadLaunchPoolByIdImpl,
  ["hookit-launch-pool"],
  { revalidate: LAUNCHES_REVALIDATE_SEC },
);

/** Single launch lookup — O(1) RPC instead of reloading the full catalog. */
export async function loadLaunchPoolById(id: string): Promise<TokenPool | null> {
  return getCachedLaunchPoolById(id.trim().toLowerCase());
}
