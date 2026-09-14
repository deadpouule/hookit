import type { PublicClient } from "viem";

import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";
import { getChainDeployment } from "@/lib/contracts/config";
import {
  quotePerTokenFromSqrtPrice,
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

/** Drop slot0 blowups (inverted tick / bad decimals) that render as $115e12M cards. */
const MAX_SANE_MARKET_CAP_USD = 50_000_000_000;

function saneMarketCap(value: number, fallback = 0): number {
  if (!Number.isFinite(value) || value < 0 || value > MAX_SANE_MARKET_CAP_USD) return fallback;
  return value;
}

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
  const isBonding = (pool: TokenPool) => pool.rail === "classic" && pool.bondingPhase === 0;

  // Classic bonding (no v4 pool yet): price from the curve, mcap = price × supply,
  // liquidity = quote raised, all in USD so explore/token pages read them like Master pools.
  const enrichBonding = (pool: TokenPool): TokenPool => {
    const quoteKind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
    const quoteUsd =
      quoteKind === "eth" ? launchEthUsd : quoteUsdFromMap(pool, ethUsd, quoteUsdMap);
    const quoteDecimals = quoteDecimalsForKind(quoteKind);
    const raisedHuman = pool.realQuote
      ? Number(BigInt(pool.realQuote)) / 10 ** quoteDecimals
      : pool.liquidity;
    const priceEth = pool.priceEth ?? 0;
    const marketCap = saneMarketCap(
      priceEth > 0 ? marketCapUsdForPool(priceEth, pool, launchEthUsd, quoteUsd) : pool.marketCap,
      0,
    );
    return {
      ...pool,
      quoteUsd,
      marketCap,
      liquidity: raisedHuman * quoteUsd,
    };
  };

  const withPool = pools.filter((p) => p.poolId);
  if (withPool.length === 0) {
    return pools.map((pool) => (isBonding(pool) ? enrichBonding(pool) : pool));
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
    const quoteKind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
    const price = quotePerTokenFromSqrtPrice(
      sqrtPriceX96,
      pool.tokenIsCurrency0 ?? false,
      18,
      quoteDecimalsForKind(quoteKind),
    );
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
        const quoteKind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
        swapStats.set(
          id,
          statsFromSwaps(
            swaps.get(id) ?? [],
            pool.tokenIsCurrency0 ?? false,
            quoteDecimalsForKind(quoteKind),
          ),
        );
      }
    } catch {
      swapStats = new Map();
    }
  }

  return pools.map((pool) => {
    if (isBonding(pool)) return enrichBonding(pool);

    if (!pool.poolId) return pool;
    const meta = metaByPoolId.get(pool.poolId);
    const priceEth = meta?.priceEth ?? pool.priceEth ?? 0;
    const stats = swapStats.get(pool.poolId.toLowerCase());
    const quoteKind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
    let quoteUsd = quoteUsdFromMap(pool, ethUsd, quoteUsdMap);
    if (quoteKind === "eth") quoteUsd = launchEthUsd;
    const launchMcapQuoteHuman = launchMcapQuoteFromMap(pool, launchMcapQuoteMap);
    const marketCap = saneMarketCap(
      priceEth > 0
        ? marketCapUsdForPool(
            priceEth,
            pool,
            quoteKind === "eth" ? launchEthUsd : ethUsd,
            quoteUsd,
            launchMcapQuoteHuman,
          )
        : pool.marketCap,
      0,
    );
    const volume24h = stats
      ? quoteVolumeUsdForPool(stats.volumeQuoteWei, pool, quoteKind === "eth" ? launchEthUsd : ethUsd, quoteUsd)
      : 0;

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
          ethUsd: quoteIsEth ? quoteUsd : ethUsd,
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

    const markets =
      pool.markets?.map((m) => ({
        ...m,
        launchMcapQuoteHuman: launchMcapQuoteFromMap(
          { quoteAddress: m.quoteAddress },
          launchMcapQuoteMap,
        ),
      })) ?? pool.markets;

    return {
      ...pool,
      priceEth,
      quoteUsd,
      launchMcapQuoteHuman,
      markets,
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
