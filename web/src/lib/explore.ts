import type { PublicClient } from "viem";

import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";
import {
  STATE_VIEW_ADDRESS,
  ethPerTokenFromSqrtPrice,
  marketCapUsd,
  stateViewAbi,
} from "@/lib/pool-price";
import { loadSwapsForPools, quoteVolumeUsd, statsFromSwaps } from "@/lib/swap-index";
import type { TokenPool } from "@/lib/types";

export async function enrichPoolsWithSpotPrices(
  publicClient: PublicClient,
  pools: TokenPool[],
  ethUsd = DEFAULT_LAUNCH_ETH_USD,
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
    const price = ethPerTokenFromSqrtPrice(sqrtPriceX96, pool.tokenIsCurrency0 ?? false);
    if (price > 0) priceByPoolId.set(pool.poolId!, price);
  });

  let swapStats = new Map<string, ReturnType<typeof statsFromSwaps>>();
  try {
    const swaps = await loadSwapsForPools(
      publicClient,
      withPool.map((p) => p.poolId!),
    );
    for (const pool of withPool) {
      const id = pool.poolId!.toLowerCase();
      swapStats.set(id, statsFromSwaps(swaps.get(id) ?? [], pool.tokenIsCurrency0 ?? false));
    }
  } catch {
    swapStats = new Map();
  }

  return pools.map((pool) => {
    if (!pool.poolId) return pool;
    const priceEth = priceByPoolId.get(pool.poolId) ?? pool.priceEth ?? 0;
    const stats = swapStats.get(pool.poolId.toLowerCase());
    const quoteIsEth = (pool.quoteAsset ?? "ETH") === "ETH";
    const marketCap =
      priceEth > 0
        ? quoteIsEth
          ? marketCapUsd(priceEth, ethUsd)
          : priceEth * 1_000_000_000
        : pool.marketCap;
    const volume24h = stats
      ? quoteVolumeUsd(stats.volumeQuoteWei, quoteIsEth, ethUsd)
      : 0;
    return {
      ...pool,
      priceEth,
      marketCap,
      volume24h,
      change24h: stats?.change24h ?? pool.change24h,
      priceSeries: stats?.series?.length ? stats.series : pool.priceSeries,
      trades24h: stats?.trades ?? 0,
    };
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
