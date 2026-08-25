import { getLaunchFactoryAddress } from "@/lib/contracts/config";
import { enrichPoolsWithSpotPrices } from "@/lib/explore";
import { readEthUsd } from "@/lib/eth-usd";
import { fetchAllLaunches, launchToTokenPool } from "@/lib/launches";
import { createServerPublicClient } from "@/lib/server-rpc";
import type { PublicClient } from "viem";

export const revalidate = 12;

export async function GET() {
  const factory = getLaunchFactoryAddress();
  if (!factory) {
    return Response.json({ pools: [], factoryConfigured: false, ethUsd: 0 });
  }

  try {
    const client = createServerPublicClient() as PublicClient;
    const [launches, ethUsd] = await Promise.all([
      fetchAllLaunches(client, factory),
      readEthUsd(client),
    ]);
    const pools = await enrichPoolsWithSpotPrices(
      client,
      launches.map(launchToTokenPool),
      ethUsd,
    );
    return Response.json({ pools, factoryConfigured: true, ethUsd });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load launches";
    return Response.json({ error: message, pools: [], factoryConfigured: true }, { status: 502 });
  }
}
