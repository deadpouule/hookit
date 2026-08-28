import { PROTOCOL_SHARE_BPS } from "@/lib/constants";
import type { IndexerTokenSummary } from "@/lib/indexer-client";
import type { TokenPool } from "@/lib/types";
import {
  FEE_BREAKDOWN,
  NATIVE_BURNED,
  NATIVE_SUPPLY,
  NATIVE_TOKEN,
  type VolumeSnapshot,
  type VolumeWindow,
} from "@/lib/protocol-stats";

const ETH_USD_FALLBACK = 2500;

export type LiveProtocolKpis = {
  launches: number;
  masterLaunches: number;
  classicLaunches: number;
  graduated: number;
  liquidityUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  volume24hEth: number;
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
  const graduated = pools.filter((p) => p.bondingPhase !== 0).length;
  const liquidityUsd = pools.reduce((sum, p) => sum + (p.liquidity || 0), 0);
  const marketCapUsd = pools.reduce((sum, p) => sum + (p.marketCap || 0), 0);

  let volume24hUsd = 0;
  let volume24hEth = 0;
  let trades24h = 0;
  if (indexerTokens?.length) {
    for (const t of indexerTokens) {
      const volEth = Number(t.volume24h || 0);
      if (Number.isFinite(volEth)) {
        volume24hEth += volEth;
        volume24hUsd += volEth * ETH_USD_FALLBACK;
      }
      trades24h += t.trades24h || 0;
    }
  } else {
    volume24hUsd = pools.reduce((sum, p) => sum + (p.volume24h || 0), 0);
    volume24hEth = volume24hUsd / ETH_USD_FALLBACK;
  }

  return {
    launches,
    masterLaunches,
    classicLaunches,
    graduated,
    liquidityUsd,
    marketCapUsd,
    volume24hUsd,
    volume24hEth,
    trades24h,
    tokensIndexed: indexerTokens?.length ?? 0,
    source: launches > 0 || (indexerTokens?.length ?? 0) > 0 ? "live" : "empty",
  };
}

/** Live volume windows — non-24h stay empty until indexer rollups exist. */
export function volumeSnapshotForWindow(
  window: VolumeWindow,
  live: LiveProtocolKpis | null,
): VolumeSnapshot {
  const empty: VolumeSnapshot = {
    realVolumeUsd: 0,
    buyVolumeUsd: 0,
    sellVolumeUsd: 0,
    buySellVolumeUsd: 0,
    totalVolumeUsd: 0,
    revenueUsd: 0,
    buybackUsd: 0,
    hookEarned: 0,
  };
  if (!live || live.source !== "live" || window !== "24h") return empty;

  const buy = live.volume24hUsd * 0.55;
  const sell = live.volume24hUsd * 0.45;
  const revenue = live.volume24hUsd * (PROTOCOL_SHARE_BPS / 10_000);
  return {
    realVolumeUsd: live.volume24hUsd,
    buyVolumeUsd: buy,
    sellVolumeUsd: sell,
    buySellVolumeUsd: live.volume24hUsd,
    totalVolumeUsd: live.volume24hUsd,
    revenueUsd: revenue,
    buybackUsd: revenue,
    hookEarned: 0,
  };
}

export const LIVE_STATS_META = {
  nativeToken: NATIVE_TOKEN,
  nativeSupply: NATIVE_SUPPLY,
  nativeBurned: NATIVE_BURNED,
  feeBreakdown: FEE_BREAKDOWN,
};
