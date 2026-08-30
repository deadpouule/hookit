import { isAddress, type Address } from "viem";

import {
  getBondingFactoryAddress,
  getLaunchFactoryAddress,
} from "@/lib/contracts/config";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { readEthUsd } from "@/lib/eth-usd";
import { enrichPoolsWithSpotPrices } from "@/lib/explore";
import {
  fetchBondingLaunchById,
  fetchLaunchById,
  launchToTokenPool,
} from "@/lib/launches";
import { createServerPublicClient } from "@/lib/server-rpc";
import { fetchDevBuyOnChain } from "@/lib/token-dev-buy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ address: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { address: raw } = await ctx.params;
  if (!isAddress(raw)) {
    return Response.json({ error: "invalid address" }, { status: 400 });
  }
  const address = raw as Address;

  const factory = getLaunchFactoryAddress();
  const bonding = getBondingFactoryAddress();
  if (!factory && !bonding) {
    return Response.json({ error: "factory not configured" }, { status: 503 });
  }

  try {
    const client = createServerPublicClient();
    let pool = null;

    if (factory) {
      const launchId = (await client.readContract({
        address: factory,
        abi: launchFactoryAbi,
        functionName: "tokenLaunchId",
        args: [address],
      })) as bigint;
      if (launchId > BigInt(0)) {
        const launch = await fetchLaunchById(client, factory, launchId);
        if (launch) {
          const ethUsd = await readEthUsd(client);
          const [enriched] = await enrichPoolsWithSpotPrices(
            client,
            [launchToTokenPool(launch)],
            ethUsd,
          );
          pool = enriched ?? launchToTokenPool(launch);
        }
      }
    }

    if (!pool && bonding) {
      const launchId = (await client.readContract({
        address: bonding,
        abi: bondingFactoryAbi,
        functionName: "tokenLaunchId",
        args: [address],
      })) as bigint;
      if (launchId > BigInt(0)) {
        pool = await fetchBondingLaunchById(client, bonding, launchId);
      }
    }

    if (!pool) {
      return Response.json({ error: "token not found" }, { status: 404 });
    }

    const devBuy = await fetchDevBuyOnChain(client, pool);
    return Response.json({ devBuy, creator: pool.creator ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "dev-buy fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
