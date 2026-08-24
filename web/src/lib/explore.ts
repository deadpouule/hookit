import type { PublicClient } from "viem";

import {
  STATE_VIEW_ADDRESS,
  ethPerTokenFromSqrtPrice,
  marketCapUsd,
  stateViewAbi,
} from "@/lib/pool-price";
import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";
import type { TokenPool } from "@/lib/types";

export async function enrichPoolsWithSpotPrices(
  publicClient: PublicClient,
  pools: TokenPool[],
): Promise<TokenPool[]> {
  const withPool = pools.filter((p) => p.poolId);
  if (withPool.length === 0) return pools;

  const results = await publicClient.multicall({
    contracts: withPool.map((p) => ({
      address: STATE_VIEW_ADDRESS,
      abi: stateViewAbi,
      functionName: "getSlot0" as const,
      args: [p.poolId!],
    })),
  });

  const priceByPoolId = new Map<string, number>();
  withPool.forEach((pool, i) => {
    const row = results[i];
    if (row.status !== "success" || !row.result) return;
    const [sqrtPriceX96] = row.result as readonly [bigint, number, number, number];
    const priceEth = ethPerTokenFromSqrtPrice(sqrtPriceX96, false);
    if (priceEth > 0) priceByPoolId.set(pool.poolId!, priceEth);
  });

  return pools.map((pool) => {
    if (!pool.poolId) return pool;
    const priceEth = priceByPoolId.get(pool.poolId) ?? pool.priceEth ?? 0;
    const marketCap =
      priceEth > 0 ? marketCapUsd(priceEth, DEFAULT_LAUNCH_ETH_USD) : pool.marketCap;
    return { ...pool, priceEth, marketCap };
  });
}

export function exploreStats(pools: TokenPool[]) {
  const customCount = pools.filter((p) => p.hooks.customHook).length;
  const masterCount = pools.length - customCount;
  const totalLiquidity = pools.reduce((sum, p) => sum + p.liquidity, 0);

  return {
    totalPools: pools.length,
    customCount,
    masterCount,
    totalLiquidity,
  };
}
