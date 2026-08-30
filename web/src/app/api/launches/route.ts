import {
  getBondingFactoryAddress,
  getLaunchFactoryAddress,
} from "@/lib/contracts/config";
import { enrichPoolsWithSpotPrices } from "@/lib/explore";
import { readEthUsd, readLaunchEthUsd } from "@/lib/eth-usd";
import {
  fetchAllBondingLaunches,
  fetchAllLaunches,
  launchToTokenPool,
} from "@/lib/launches";
import { createServerPublicClient } from "@/lib/server-rpc";
import { isIndexerConfigured } from "@/lib/live-data";
import type { PublicClient } from "viem";

export const revalidate = 12;

const API_TIMEOUT_MS = 15_000;

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

export async function GET() {
  const factory = getLaunchFactoryAddress();
  const bonding = getBondingFactoryAddress();
  if (!factory && !bonding) {
    return Response.json({ pools: [], factoryConfigured: false, ethUsd: 0 });
  }

  try {
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

    // Spot-enrich graduated classic pools that already have a poolId.
    const classicGraduated = classicPools.filter((p) => !!p.poolId);
    const classicBonding = classicPools.filter((p) => !p.poolId);
    const classicWithSpot = await enrichPoolsWithSpotPrices(client, classicGraduated, ethUsd, {
      skipSwapIndex: isIndexerConfigured(),
      launchEthUsd,
    });

    const pools = [...masterPools, ...classicWithSpot, ...classicBonding].sort(
      (a, b) => (b.launchedAt ?? 0) - (a.launchedAt ?? 0),
    );

    return Response.json({
      pools,
      factoryConfigured: true,
      ethUsd,
      rails: {
        master: !!factory,
        classic: !!bonding,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load launches";
    return Response.json(
      { error: message, pools: [], factoryConfigured: true },
      { status: 502 },
    );
  }
}
