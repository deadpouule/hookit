import type { ChartMetric, ChartWindow, SeriesPoint, VolumeWindow } from "@/lib/protocol-stats";

export type LiveQuoteVolume = {
  quote: string;
  quoteDecimals: number;
  volumeQuote: string;
  buyVolumeQuote: string;
  sellVolumeQuote: string;
};

export type LiveWindowStats = {
  totalVolumeUsd: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  revenueUsd: number;
  buybackUsd: number;
  trades: number;
};

export type LiveBuybackFeed = {
  hash: `0x${string}`;
  spentEth: number;
  hookOut: number;
  usd: number;
  ago: string;
};

export type LiveBurnFeed = {
  hash: `0x${string}`;
  amount: number;
  ago: number;
  agoLabel: string;
};

export type LiveProtocolStatsPayload = {
  source: "live" | "partial" | "empty";
  updatedAt: number;
  ethUsd: number;
  tokensIndexed: number;
  tradesIndexed: number;
  pendingBuybackEth: number;
  nativeToken: string | null;
  burnedTokens: number;
  burnedUsd: number;
  totalBuybacksUsd: number;
  totalBuybacksCount: number;
  totalHookBought: number;
  windows: Record<VolumeWindow, LiveWindowStats>;
  daily: SeriesPoint[];
  hourly: SeriesPoint[];
  latestBuybacks: LiveBuybackFeed[];
  buybackBurns: LiveBurnFeed[];
  indexerOk: boolean;
};

function toCumulative(points: SeriesPoint[]): SeriesPoint[] {
  let buy = 0;
  let burn = 0;
  let revenue = 0;
  return points.map((point) => {
    buy += point.buybackUsd;
    burn += point.burnUsd;
    revenue += point.revenueUsd;
    return {
      label: point.label,
      buybackUsd: buy,
      burnUsd: burn,
      revenueUsd: revenue,
      fdvUsd: point.fdvUsd,
    };
  });
}

export function sliceSeriesForWindow(
  daily: SeriesPoint[],
  hourly: SeriesPoint[],
  window: ChartWindow,
  metric: ChartMetric,
): SeriesPoint[] {
  let base = daily;
  if (window === "1d") base = hourly.slice(-24);
  else if (window === "7d") base = daily.slice(-7);
  else if (window === "30d") base = daily.slice(-30);
  else if (window === "90d") base = daily.slice(-90);

  if (metric === "fdv") return base;
  return toCumulative(base);
}

export function metricValueFromSeries(point: SeriesPoint, metric: ChartMetric): number {
  if (metric === "buybacks") return point.buybackUsd;
  if (metric === "revenue") return point.revenueUsd;
  if (metric === "burns") return point.burnUsd;
  return point.fdvUsd;
}
