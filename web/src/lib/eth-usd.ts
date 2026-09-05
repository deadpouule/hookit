import { formatEther } from "viem";
import type { PublicClient } from "viem";

import { CHAINLINK_ETH_USD, chainlinkAggregatorAbi, getLaunchFactoryAddress } from "@/lib/contracts/config";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";

/** ETH/USD stored on LaunchFactory — same oracle used to seed launch FDV (~$5k). */
export async function readLaunchEthUsd(client: PublicClient): Promise<number> {
  const factory = getLaunchFactoryAddress();
  if (factory) {
    try {
      const x18 = (await client.readContract({
        address: factory,
        abi: launchFactoryAbi,
        functionName: "ethUsdPriceX18",
      })) as bigint;
      const asNumber = Number(formatEther(x18));
      if (asNumber > 0) return asNumber;
    } catch {
      // old factory without the getter
    }
  }
  return DEFAULT_LAUNCH_ETH_USD;
}

/** Live ETH/USD (Chainlink) — for volumes / implied rates, not launch FDV display. */
export async function readEthUsd(client: PublicClient): Promise<number> {
  try {
    const result = (await client.readContract({
      address: CHAINLINK_ETH_USD,
      abi: chainlinkAggregatorAbi,
      functionName: "latestRoundData",
    })) as readonly [bigint, bigint, bigint, bigint, bigint];
    const answer = Number(result[1]) / 1e8;
    if (answer > 0) return answer;
  } catch {
    // feed unavailable
  }

  return DEFAULT_LAUNCH_ETH_USD;
}
