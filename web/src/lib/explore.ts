import type { PublicClient } from "viem";
import { zeroAddress } from "viem";

import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";
import { getChainDeployment } from "@/lib/contracts/config";
import {
  ethPerTokenFromSqrtPrice,
  stateViewAbi,
} from "@/lib/pool-price";
import {
  buildLaunchMcapQuoteMap,
  buildQuoteUsdMap,
  launchMcapQuoteFromMap,
  marketCapUsdForPool,
  quoteDecimalsForKind,
  quoteUsdFromMap,
  quoteVolumeUsd as quoteVolumeUsdForPool,
  resolveQuoteKind,
} from "@/lib/quote-usd";
import { readLaunchEthUsd } from "@/lib/eth-usd";
import { poolTvlUsd } from "@/lib/pool-tvl";
import { loadSwapsForPools, statsFromSwaps } from "@/lib/swap-index";
import type { TokenPool } from "@/lib/types";

export async function enrichPoolsWithSpotPrices(
  publicClient: PublicClient,
  pools: TokenPool[],
  ethUsd = DEFAULT_LAUNCH_ETH_USD,
  options?: { skipSwapIndex?: boolean; launchEthUsd?: number },
): Promise<TokenPool[]> {
  const launchEthUsd = options?.launchEthUsd ?? (await readLaunchEthUsd(publicClient));
  const [quoteUsdMap, launchMcapQuoteMap] = await Promise.all([
    buildQuoteUsdMap(publicClient, pools, launchEthUsd),
    buildLaunchMcapQuoteMap(publicClient, pools),
  ]);
  const withPool = pools.filter((p) => p.poolId);
  if (withPool.length === 0) {
    // Bonding-only: convert realQuote ETH → USD liquidity.
    return pools.map((pool) => {
      if (pool.rail !== "classic" || pool.bondingPhase !== 0) return pool;
      const quoteEth = pool.liquidity; // currently stored as ETH from realQuote/1e18
      const quoteIsEth = !pool.quoteAddress || pool.quoteAddress === zeroAddress;
      return {
        ...pool,
        liquidity: quoteIsEth ? quoteEth * ethUsd : quoteEth,
      };
    });
  }

  const stateView = getChainDeployment().stateView;

  const results = await publicClient.multicall({
    contracts: withPool.flatMap((p) => [
      {
        address: stateView,
        abi: stateViewAbi,
        functionName: "getSlot0" as const,
        args: [p.poolId!] as const,
      },
      {
        address: stateView,
        abi: stateViewAbi,
        functionName: "getLiquidity" as const,
        args: [p.poolId!] as const,
      },
    ]),
    allowFailure: true,
  });

  const metaByPoolId = new Map<
    string,
    { sqrtPriceX96: bigint; liquidity: bigint; priceEth: number }
  >();
  withPool.forEach((pool, i) => {
    const slot = results[i * 2];
    const liq = results[i * 2 + 1];
    if (slot?.status !== "success" || !slot.result) return;
    const [sqrtPriceX96] = slot.result as readonly [bigint, number, number, number];
    const liveL =
      liq?.status === "success" ? (liq.result as bigint) : BigInt(pool.liquidityRaw ?? "0");
    const price = ethPerTokenFromSqrtPrice(sqrtPriceX96, pool.tokenIsCurrency0 ?? false);
    metaByPoolId.set(pool.poolId!, {
      sqrtPriceX96,
      liquidity: liveL,
      priceEth: price,
    });
  });

  let swapStats = new Map<string, ReturnType<typeof statsFromSwaps>>();
  if (!options?.skipSwapIndex) {
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
  }

  return pools.map((pool) => {
    // Classic bonding (no pool yet): liquidity = quote raised in USD.
    if (pool.rail === "classic" && pool.bondingPhase === 0) {
      const quoteIsEth = !pool.quoteAddress || pool.quoteAddress === zeroAddress;
      const quoteHuman = pool.realQuote ? Number(BigInt(pool.realQuote)) / 1e18 : pool.liquidity;
      return {
        ...pool,
        liquidity: quoteIsEth ? quoteHuman * ethUsd : quoteHuman,
      };
    }

    if (!pool.poolId) return pool;
    const meta = metaByPoolId.get(pool.poolId);
    const priceEth = meta?.priceEth ?? pool.priceEth ?? 0;
    const stats = swapStats.get(pool.poolId.toLowerCase());
    const quoteUsd = quoteUsdFromMap(pool, ethUsd, quoteUsdMap);
    const launchMcapQuoteHuman = launchMcapQuoteFromMap(pool, launchMcapQuoteMap);
    const marketCap =
      priceEth > 0
        ? marketCapUsdForPool(
            priceEth,
            pool,
            resolveQuoteKind(pool.quoteAddress, pool.quoteAsset) === "eth" ? launchEthUsd : ethUsd,
            quoteUsd,
            launchMcapQuoteHuman,
          )
        : pool.marketCap;
    const volume24h = stats
      ? quoteVolumeUsdForPool(stats.volumeQuoteWei, pool, ethUsd, quoteUsd)
      : 0;

    const quoteKind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
    const quoteIsEth = quoteKind === "eth";

    let liquidityUsd = 0;
    if (
      meta &&
      pool.tickLower != null &&
      pool.tickUpper != null &&
      meta.liquidity > BigInt(0)
    ) {
      try {
        liquidityUsd = poolTvlUsd({
          sqrtPriceX96: meta.sqrtPriceX96,
          liquidity: meta.liquidity,
          tickLower: pool.tickLower,
          tickUpper: pool.tickUpper,
          tokenIsCurrency0: pool.tokenIsCurrency0 ?? false,
          quoteIsEth,
          ethUsd,
          quoteUsdPerUnit: quoteUsd,
          quoteDecimals: quoteDecimalsForKind(quoteKind),
        });
      } catch {
        liquidityUsd = 0;
      }
    }
    // Unilateral Hookit seed ≈ FDV until quote depth builds; never show raw L.
    if (liquidityUsd <= 0 && marketCap > 0) liquidityUsd = marketCap;
    // Guard against decimal/math blowups (e.g. treating 18-dec wStock as 6-dec).
    if (marketCap > 0 && liquidityUsd > marketCap * 50) {
      liquidityUsd = marketCap;
    }

    return {
      ...pool,
      priceEth,
      quoteUsd,
      launchMcapQuoteHuman,
      marketCap,
      volume24h,
      change24h: stats?.change24h ?? pool.change24h,
      priceSeries: stats?.series?.length ? stats.series : pool.priceSeries,
      trades24h: stats?.trades ?? 0,
      liquidity: liquidityUsd,
      liquidityRaw: meta?.liquidity?.toString() ?? pool.liquidityRaw,
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
