import { formatEther, type Address } from "viem";
import type { PublicClient } from "viem";

import { getLaunchFactoryAddress } from "@/lib/contracts/config";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import { floorVaultAbi } from "@/lib/contracts/swap-abi";
import { fetchAllLaunches, launchToTokenPool } from "@/lib/launches";
import { createServerPublicClient } from "@/lib/server-rpc";

export const revalidate = 12;

export async function GET() {
  const factory = getLaunchFactoryAddress();
  if (!factory) {
    return Response.json({ vault: null, floors: [], totalEth: 0 });
  }

  try {
    const client = createServerPublicClient() as PublicClient;
    const masterHook = (await client.readContract({
      address: factory,
      abi: launchFactoryAbi,
      functionName: "masterHook",
    })) as Address;
    const vault = (await client.readContract({
      address: masterHook,
      abi: masterLaunchHookAbi,
      functionName: "floorVault",
    })) as Address;

    const launches = await fetchAllLaunches(client, factory);
    const floors = launches.map(launchToTokenPool).filter((p) => p.hooks.backedFloor && p.contractAddress);

    const reserves = floors.length
      ? await client.multicall({
          contracts: floors.flatMap((p) => [
            {
              address: vault,
              abi: floorVaultAbi,
              functionName: "reserve" as const,
              args: [p.contractAddress as Address] as const,
            },
            {
              address: vault,
              abi: floorVaultAbi,
              functionName: "floorPriceX18" as const,
              args: [p.contractAddress as Address] as const,
            },
          ]),
          allowFailure: true,
        })
      : [];

    const rows = floors.map((pool, i) => {
      const reserveWei = reserves[i * 2]?.status === "success" ? (reserves[i * 2].result as bigint) : BigInt(0);
      const floorX18 = reserves[i * 2 + 1]?.status === "success" ? (reserves[i * 2 + 1].result as bigint) : BigInt(0);
      return {
        token: pool.contractAddress,
        name: pool.name,
        ticker: pool.ticker,
        creator: pool.creator,
        reserveEth: Number(formatEther(reserveWei)),
        floorPriceEth: Number(formatEther(floorX18)),
      };
    });

    const totalEth = rows.reduce((sum, r) => sum + r.reserveEth, 0);
    return Response.json({ vault, floors: rows, totalEth });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load floors";
    return Response.json({ error: message, floors: [], totalEth: 0 }, { status: 502 });
  }
}
