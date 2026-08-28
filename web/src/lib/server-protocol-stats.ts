import {
  type Address,
  formatEther,
  formatUnits,
  parseAbiItem,
} from "viem";

import {
  BASE_FEE_BPS,
  DEFAULT_LAUNCH_ETH_USD,
  FLYWHEEL_SHARE_BPS,
  PROTOCOL_SHARE_BPS,
} from "@/lib/constants";
import {
  DEFAULT_TOTAL_SUPPLY,
  getBondingFactoryAddress,
  getHkitBuybackAddress,
  getLaunchFactoryAddress,
  getNativeTokenAddress,
  getProtocolDistributorAddress,
  STABLE_QUOTE_ADDRESS,
} from "@/lib/contracts/config";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { protocolRevenueDistributorAbi } from "@/lib/contracts/protocol-abi";
import { enrichPoolsWithSpotPrices } from "@/lib/explore";
import { readEthUsd } from "@/lib/eth-usd";
import { formatAge } from "@/lib/format";
import {
  fetchAllBondingLaunches,
  fetchAllLaunches,
  launchToTokenPool,
} from "@/lib/launches";
import { buybackFromProtocolRevenueUsd, protocolRevenueFromVolumeUsd } from "@/lib/protocol-fees";
import type { SeriesPoint, VolumeWindow } from "@/lib/protocol-stats";
import type {
  LiveBurnFeed,
  LiveBuybackFeed,
  LiveProtocolStatsPayload,
  LiveQuoteVolume,
  LiveWindowStats,
} from "@/lib/protocol-stats-live";
import { createServerPublicClient } from "@/lib/server-rpc";

export type {
  LiveBurnFeed,
  LiveBuybackFeed,
  LiveProtocolStatsPayload,
  LiveQuoteVolume,
  LiveWindowStats,
} from "@/lib/protocol-stats-live";
export { metricValueFromSeries, sliceSeriesForWindow } from "@/lib/protocol-stats-live";

type IndexerProtocolStats = {
  tokensIndexed: number;
  tradesIndexed: number;
  windows: Record<VolumeWindow, { trades: number; quotes: LiveQuoteVolume[] }>;
  daily: Array<{ dayStart: number; label: string; trades: number; quotes: LiveQuoteVolume[] }>;
  hourly: Array<{ dayStart: number; label: string; trades: number; quotes: LiveQuoteVolume[] }>;
  recentTrades: Array<{
    txHash: `0x${string}`;
    timestamp: number;
    side: "buy" | "sell";
    quoteAmount: string;
    quote: string;
    quoteDecimals: number;
  }>;
};

const buybackBurnedEvent = parseAbiItem(
  "event BuybackBurned(uint256 ethIn, uint256 tokensBurned, address indexed caller)",
);

function quoteVolumeToUsd(quotes: LiveQuoteVolume[], ethUsd: number): {
  total: number;
  buy: number;
  sell: number;
} {
  let total = 0;
  let buy = 0;
  let sell = 0;
  const stable = STABLE_QUOTE_ADDRESS.toLowerCase();

  for (const row of quotes) {
    const amount = Number(formatUnits(BigInt(row.volumeQuote || "0"), row.quoteDecimals));
    const buyAmt = Number(formatUnits(BigInt(row.buyVolumeQuote || "0"), row.quoteDecimals));
    const sellAmt = Number(formatUnits(BigInt(row.sellVolumeQuote || "0"), row.quoteDecimals));
    const isStable =
      row.quote.toLowerCase() === stable ||
      (row.quoteDecimals === 6 && row.quote.toLowerCase() !== "0x0000000000000000000000000000000000000000");

    if (isStable) {
      total += amount;
      buy += buyAmt;
      sell += sellAmt;
    } else {
      total += amount * ethUsd;
      buy += buyAmt * ethUsd;
      sell += sellAmt * ethUsd;
    }
  }

  return { total, buy, sell };
}

function windowFromRollup(
  rollup: { trades: number; quotes: LiveQuoteVolume[] },
  ethUsd: number,
): LiveWindowStats {
  const { total, buy, sell } = quoteVolumeToUsd(rollup.quotes, ethUsd);
  const revenueUsd = protocolRevenueFromVolumeUsd(total);
  const buybackUsd = buybackFromProtocolRevenueUsd(revenueUsd);
  return {
    totalVolumeUsd: total,
    buyVolumeUsd: buy,
    sellVolumeUsd: sell,
    revenueUsd,
    buybackUsd,
    trades: rollup.trades,
  };
}

function bucketToSeriesPoint(
  bucket: { label: string; quotes: LiveQuoteVolume[] },
  ethUsd: number,
): SeriesPoint {
  const { total } = quoteVolumeToUsd(bucket.quotes, ethUsd);
  const buybackUsd = buybackFromProtocolRevenueUsd(protocolRevenueFromVolumeUsd(total));
  const burnUsd = buybackUsd * 0.92;
  const revenueUsd = protocolRevenueFromVolumeUsd(total);
  const fdvUsd = 0;
  return {
    label: bucket.label,
    buybackUsd: Math.round(buybackUsd),
    burnUsd: Math.round(burnUsd),
    revenueUsd: Math.round(revenueUsd),
    fdvUsd,
  };
}

async function fetchIndexerProtocolStats(): Promise<IndexerProtocolStats | null> {
  const base = process.env.INDEXER_URL?.trim();
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/v1/protocol/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as IndexerProtocolStats;
  } catch {
    return null;
  }
}

async function fetchOnChainBuybacks(ethUsd: number, nativeDecimals = 18) {
  const buybackAddr = getHkitBuybackAddress();
  const client = createServerPublicClient();
  const feeds: LiveBuybackFeed[] = [];
  const burns: LiveBurnFeed[] = [];
  let totalHookBought = 0;
  let totalBuybacksUsd = 0;
  let pendingBuybackEth = 0;
  let nativeToken: string | null = null;
  let burnedTokens = 0;
  let burnedUsd = 0;

  const distributor = getProtocolDistributorAddress();
  if (distributor) {
    try {
      const [pending, token] = await Promise.all([
        client.readContract({
          address: distributor,
          abi: protocolRevenueDistributorAbi,
          functionName: "buybackEth",
        }),
        client.readContract({
          address: distributor,
          abi: protocolRevenueDistributorAbi,
          functionName: "nativeToken",
        }),
      ]);
      pendingBuybackEth = Number(formatEther(pending as bigint));
      nativeToken = token as string;
    } catch {
      /* not deployed */
    }
  }

  const nativeAddr = getNativeTokenAddress() ?? (nativeToken as Address | undefined);
  if (nativeAddr) {
    try {
      const [symbol, decimals, totalSupply] = await Promise.all([
        client.readContract({ address: nativeAddr, abi: erc20Abi, functionName: "symbol" }),
        client.readContract({ address: nativeAddr, abi: erc20Abi, functionName: "decimals" }),
        client.readContract({ address: nativeAddr, abi: erc20Abi, functionName: "totalSupply" }),
      ]);
      nativeToken = symbol as string;
      const dec = Number(decimals);
      const supply = totalSupply as bigint;
      const burnedRaw = DEFAULT_TOTAL_SUPPLY > supply ? DEFAULT_TOTAL_SUPPLY - supply : 0n;
      burnedTokens = Number(formatUnits(burnedRaw, dec));
    } catch {
      /* ignore */
    }
  }

  if (buybackAddr) {
    try {
      const latest = await client.getBlockNumber();
      const from = latest > 2_000_000n ? latest - 2_000_000n : 0n;
      const logs = await client.getLogs({
        address: buybackAddr,
        event: buybackBurnedEvent,
        fromBlock: from,
        toBlock: latest,
      });

      for (const log of logs.slice(-50).reverse()) {
        const ethIn = log.args.ethIn ?? 0n;
        const tokensBurned = log.args.tokensBurned ?? 0n;
        const eth = Number(formatEther(ethIn));
        const tokens = Number(formatUnits(tokensBurned, nativeDecimals));
        const usd = eth * ethUsd;
        totalHookBought += tokens;
        totalBuybacksUsd += usd;

        let agoLabel = "recently";
        try {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          const ageSec = Math.max(0, Math.floor(Date.now() / 1000) - Number(block.timestamp));
          agoLabel = `${formatAge(ageSec)} ago`;
        } catch {
          /* ignore */
        }

        feeds.push({
          hash: log.transactionHash!,
          spentEth: eth,
          hookOut: tokens,
          usd,
          ago: agoLabel,
        });
        burns.push({
          hash: log.transactionHash!,
          amount: tokens,
          ago: 0,
          agoLabel,
        });
      }
    } catch {
      /* ignore */
    }
  }

  return {
    feeds,
    burns,
    totalHookBought,
    totalBuybacksUsd,
    totalBuybacksCount: feeds.length,
    pendingBuybackEth,
    nativeToken,
    burnedTokens,
    burnedUsd,
  };
}

async function fallbackVolumeFromLaunches(ethUsd: number): Promise<LiveWindowStats | null> {
  const factory = getLaunchFactoryAddress();
  const bonding = getBondingFactoryAddress();
  if (!factory && !bonding) return null;

  try {
    const client = createServerPublicClient();
    const [masterRaw, classicPools] = await Promise.all([
      factory ? fetchAllLaunches(client, factory) : Promise.resolve([]),
      bonding ? fetchAllBondingLaunches(client, bonding) : Promise.resolve([]),
    ]);
    const masterPools = await enrichPoolsWithSpotPrices(
      client,
      masterRaw.map(launchToTokenPool),
      ethUsd,
    );
    const pools = [...masterPools, ...classicPools];
    const totalVolumeUsd = pools.reduce((sum, pool) => sum + (pool.volume24h || 0), 0);
    if (totalVolumeUsd <= 0) return null;

    const revenueUsd = protocolRevenueFromVolumeUsd(totalVolumeUsd);
    const buybackUsd = buybackFromProtocolRevenueUsd(revenueUsd);
    return {
      totalVolumeUsd,
      buyVolumeUsd: totalVolumeUsd * 0.55,
      sellVolumeUsd: totalVolumeUsd * 0.45,
      revenueUsd,
      buybackUsd,
      trades: 0,
    };
  } catch {
    return null;
  }
}

function emptyWindows(): Record<VolumeWindow, LiveWindowStats> {
  const empty: LiveWindowStats = {
    totalVolumeUsd: 0,
    buyVolumeUsd: 0,
    sellVolumeUsd: 0,
    revenueUsd: 0,
    buybackUsd: 0,
    trades: 0,
  };
  return { "24h": { ...empty }, "7d": { ...empty }, "30d": { ...empty }, all: { ...empty } };
}

export async function loadLiveProtocolStats(): Promise<LiveProtocolStatsPayload> {
  const client = createServerPublicClient();
  let ethUsd = DEFAULT_LAUNCH_ETH_USD;
  try {
    ethUsd = await readEthUsd(client);
  } catch {
    /* fallback */
  }

  const [indexer, onChain] = await Promise.all([
    fetchIndexerProtocolStats(),
    fetchOnChainBuybacks(ethUsd),
  ]);

  const daily: SeriesPoint[] = [];
  const hourly: SeriesPoint[] = [];
  const windows = emptyWindows();
  let tokensIndexed = 0;
  let tradesIndexed = 0;
  let source: LiveProtocolStatsPayload["source"] = "empty";

  if (indexer) {
    source = "live";
    tokensIndexed = indexer.tokensIndexed;
    tradesIndexed = indexer.tradesIndexed;
    for (const key of ["24h", "7d", "30d", "all"] as const) {
      windows[key] = windowFromRollup(indexer.windows[key], ethUsd);
    }
    for (const bucket of indexer.daily) {
      daily.push(bucketToSeriesPoint(bucket, ethUsd));
    }
    for (const bucket of indexer.hourly) {
      hourly.push(bucketToSeriesPoint(bucket, ethUsd));
    }
  } else {
    const fallback = await fallbackVolumeFromLaunches(ethUsd);
    if (fallback) {
      source = "partial";
      windows["24h"] = fallback;
    }
  }

  if (onChain.burnedTokens > 0 && onChain.totalBuybacksUsd > 0 && onChain.totalHookBought > 0) {
    onChain.burnedUsd = onChain.burnedTokens * (onChain.totalBuybacksUsd / onChain.totalHookBought);
  }

  if (onChain.totalBuybacksUsd > 0) {
    source = source === "empty" ? "partial" : "live";
    windows.all.buybackUsd = Math.max(windows.all.buybackUsd, onChain.totalBuybacksUsd);
    windows.all.revenueUsd = Math.max(
      windows.all.revenueUsd,
      onChain.totalBuybacksUsd / (FLYWHEEL_SHARE_BPS / 10_000),
    );
  }

  if (onChain.burnedUsd > 0) {
    source = source === "empty" ? "partial" : "live";
  }

  return {
    source,
    updatedAt: Math.floor(Date.now() / 1000),
    ethUsd,
    tokensIndexed,
    tradesIndexed,
    pendingBuybackEth: onChain.pendingBuybackEth,
    nativeToken: onChain.nativeToken,
    burnedTokens: onChain.burnedTokens,
    burnedUsd: onChain.burnedUsd,
    totalBuybacksUsd: Math.max(windows.all.buybackUsd, onChain.totalBuybacksUsd),
    totalBuybacksCount: onChain.totalBuybacksCount,
    totalHookBought: onChain.totalHookBought,
    windows,
    daily,
    hourly,
    latestBuybacks: onChain.feeds,
    buybackBurns: onChain.burns,
    indexerOk: !!indexer,
  };
}

export const LIVE_FEE_META = {
  baseFeeBps: BASE_FEE_BPS,
  protocolShareBps: PROTOCOL_SHARE_BPS,
  flywheelShareBps: FLYWHEEL_SHARE_BPS,
};
