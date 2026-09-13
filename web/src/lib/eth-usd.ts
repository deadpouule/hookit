import { formatEther } from "viem";
import type { PublicClient } from "viem";

import { CHAINLINK_ETH_USD, chainlinkAggregatorAbi, getLaunchFactoryAddress } from "@/lib/contracts/config";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";

/** Factory vs live: reject the $4000 deploy seed, keep ~2% Defined-matching factory prints. */
const LAUNCH_ETH_USD_MAX_RATIO = 1.15;

async function readLiveEthUsd(client: PublicClient): Promise<number> {
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
  return 0;
}

async function readFactoryEthUsd(client: PublicClient): Promise<number> {
  const factory = getLaunchFactoryAddress();
  if (!factory) return 0;
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
  return 0;
}

/** ETH/USD for ETH-quoted launch FDV — match Defined (~factory oracle), not the $4000 seed. */
export async function readLaunchEthUsd(client: PublicClient): Promise<number> {
  const [live, factoryUsd] = await Promise.all([readLiveEthUsd(client), readFactoryEthUsd(client)]);
  if (factoryUsd > 0 && live > 0) {
    const ratio = factoryUsd / live;
    if (ratio <= LAUNCH_ETH_USD_MAX_RATIO && ratio >= 1 / LAUNCH_ETH_USD_MAX_RATIO) return factoryUsd;
    return live;
  }
  if (live > 0) return live;
  if (factoryUsd > 0) return factoryUsd;
  return DEFAULT_LAUNCH_ETH_USD;
}

/** Live ETH/USD (Ink WETH/USDt0 TWAP) - for volumes / implied rates, not launch FDV display. */
export async function readEthUsd(client: PublicClient): Promise<number> {
  const live = await readLiveEthUsd(client);
  return live > 0 ? live : DEFAULT_LAUNCH_ETH_USD;
}
