import {
  getBondingFactoryAddress,
  getLaunchFactoryAddress,
} from "@/lib/contracts/config";
import { enrichPoolsWithSpotPrices } from "@/lib/explore";
import { readEthUsd } from "@/lib/eth-usd";
import {
  fetchAllBondingLaunches,
  fetchAllLaunches,
  launchToTokenPool,
} from "@/lib/launches";
import { createServerPublicClient } from "@/lib/server-rpc";
import type { PublicClient } from "viem";

export const revalidate = 12;

export async function GET() {
  const factory = getLaunchFactoryAddress();
  const bonding = getBondingFactoryAddress();
  if (!factory && !bonding) {
    return Response.json({ pools: [], factoryConfigured: false, ethUsd: 0 });
  }

  try {
    const client = createServerPublicClient() as PublicClient;
    const ethUsd = await readEthUsd(client);

    const [masterRaw, classicPools] = await Promise.all([
      factory ? fetchAllLaunches(client, factory) : Promise.resolve([]),
      bonding ? fetchAllBondingLaunches(client, bonding) : Promise.resolve([]),
    ]);

    const masterPools = await enrichPoolsWithSpotPrices(
      client,
      masterRaw.map(launchToTokenPool),
      ethUsd,
    );

    // Spot-enrich graduated classic pools that already have a poolId.
    const classicGraduated = classicPools.filter((p) => !!p.poolId);
    const classicBonding = classicPools.filter((p) => !p.poolId);
    const classicWithSpot = await enrichPoolsWithSpotPrices(client, classicGraduated, ethUsd);

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
