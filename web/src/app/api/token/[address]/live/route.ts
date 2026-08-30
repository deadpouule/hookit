import { isAddress, type Address } from "viem";

import {
  getBondingFactoryAddress,
  getLaunchFactoryAddress,
} from "@/lib/contracts/config";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { readEthUsd, readLaunchEthUsd } from "@/lib/eth-usd";
import {
  fetchBondingLaunchById,
  fetchLaunchById,
  launchToTokenPool,
} from "@/lib/launches";
import { enrichPoolsWithSpotPrices } from "@/lib/explore";
import { createServerPublicClient } from "@/lib/server-rpc";
import { buildSparseLive, fetchOnChainLive } from "@/lib/token-onchain-live";
import type { PublicClient } from "viem";

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
    const client = createServerPublicClient() as PublicClient;
    const ethUsd = await readEthUsd(client);
    const launchEthUsd = await readLaunchEthUsd(client);

    let pool = null as Awaited<ReturnType<typeof fetchBondingLaunchById>>;

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
          const [enriched] = await enrichPoolsWithSpotPrices(
            client,
            [launchToTokenPool(launch)],
            ethUsd,
            { launchEthUsd },
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

    const payload = await fetchOnChainLive(client, pool, ethUsd);
    return Response.json({
      ...payload,
      pool: {
        marketCap: pool.marketCap,
        volume24h: pool.volume24h,
        priceEth: pool.priceEth,
        quoteUsd: pool.quoteUsd,
        change24h: pool.change24h,
        liquidity: pool.liquidity,
      },
      fallback: buildSparseLive(pool, ethUsd),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "live fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
