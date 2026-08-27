import { PROTOCOL_SHARE_BPS } from "@/lib/constants";
import type { IndexerTokenSummary } from "@/lib/indexer-client";
import type { TokenPool } from "@/lib/types";
import {
  FEE_BREAKDOWN,
  NATIVE_BURNED,
  NATIVE_SUPPLY,
  NATIVE_TOKEN,
  VOLUME_BY_WINDOW,
  type VolumeSnapshot,
  type VolumeWindow,
} from "@/lib/protocol-stats";

const ETH_USD_FALLBACK = 2500;

export type LiveProtocolKpis = {
  launches: number;
  masterLaunches: number;
  classicLaunches: number;
  liquidityUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  trades24h: number;
  tokensIndexed: number;
  source: "live" | "empty";
};

export function computeLiveProtocolKpis(
  pools: TokenPool[],
  indexerTokens: IndexerTokenSummary[] | null,
): LiveProtocolKpis {
  const launches = pools.length;
  const masterLaunches = pools.filter((p) => p.hookType === "Master").length;
  const classicLaunches = pools.filter((p) => p.hookType === "Classic").length;
  const liquidityUsd = pools.reduce((sum, p) => sum + (p.liquidity || 0), 0);
  const marketCapUsd = pools.reduce((sum, p) => sum + (p.marketCap || 0), 0);

  let volume24hUsd = 0;
  let trades24h = 0;
  if (indexerTokens?.length) {
    for (const t of indexerTokens) {
      const volEth = Number(t.volume24h || 0);
      // Indexer volume24h is quote units (ETH). Convert roughly to USD.
      volume24hUsd += Number.isFinite(volEth) ? volEth * ETH_USD_FALLBACK : 0;
      trades24h += t.trades24h || 0;
    }
  } else {
    volume24hUsd = pools.reduce((sum, p) => sum + (p.volume24h || 0), 0);
  }

  return {
    launches,
    masterLaunches,
    classicLaunches,
    liquidityUsd,
    marketCapUsd,
    volume24hUsd,
    trades24h,
    tokensIndexed: indexerTokens?.length ?? 0,
    source: launches > 0 || (indexerTokens?.length ?? 0) > 0 ? "live" : "empty",
  };
}

/** Overlay live 24h volume onto the mock window table when indexer data exists. */
export function volumeSnapshotForWindow(
  window: VolumeWindow,
  live: LiveProtocolKpis | null,
): VolumeSnapshot {
  const base = VOLUME_BY_WINDOW[window];
  if (!live || live.source !== "live" || window !== "24h") return base;

  const buy = live.volume24hUsd * 0.55;
  const sell = live.volume24hUsd * 0.45;
  const revenue = live.volume24hUsd * (PROTOCOL_SHARE_BPS / 10_000);
  return {
    ...base,
    realVolumeUsd: live.volume24hUsd,
    buyVolumeUsd: buy,
    sellVolumeUsd: sell,
    buySellVolumeUsd: live.volume24hUsd,
    totalVolumeUsd: live.volume24hUsd,
    revenueUsd: revenue,
    buybackUsd: revenue,
    hookEarned: revenue > 0 ? revenue / 4 : 0,
  };
}

export const LIVE_STATS_META = {
  nativeToken: NATIVE_TOKEN,
  nativeSupply: NATIVE_SUPPLY,
  nativeBurned: NATIVE_BURNED,
  feeBreakdown: FEE_BREAKDOWN,
};
