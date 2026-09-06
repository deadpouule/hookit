import type { ChartInterval } from "@/components/token/TokenCandleChart";
import type { LiveCandle } from "@/lib/token-live";

/** Indexer stores 5m bars — bucket = how many 5m bars merge into one displayed point. */
export const CHART_INTERVAL_BUCKETS: Record<ChartInterval, number> = {
  "5m": 1,
  "1h": 12,
  "6h": 72,
  "1D": 288,
  ALL: 1,
};

/** Visible points after aggregation (ALL keeps full series, capped for SVG perf). */
export const CHART_VISIBLE_BARS: Record<ChartInterval, number> = {
  "5m": 48,
  "1h": 36,
  "6h": 28,
  "1D": 24,
  ALL: 240,
};

export function aggregateCandles(candles: LiveCandle[], bucketSize: number): LiveCandle[] {
  if (bucketSize <= 1 || candles.length === 0) return candles;
  const out: LiveCandle[] = [];
  for (let i = 0; i < candles.length; i += bucketSize) {
    const slice = candles.slice(i, i + bucketSize);
    if (slice.length === 0) continue;
    out.push({
      o: slice[0]!.o,
      h: Math.max(...slice.map((c) => c.h)),
      l: Math.min(...slice.map((c) => c.l)),
      c: slice[slice.length - 1]!.c,
      t: slice[0]!.t ?? slice[slice.length - 1]!.t,
    });
  }
  return out;
}

export function candlesForChartInterval(
  candles: LiveCandle[],
  interval: ChartInterval,
): LiveCandle[] {
  const bucket = CHART_INTERVAL_BUCKETS[interval];
  const aggregated = aggregateCandles(candles, bucket);
  const visible = CHART_VISIBLE_BARS[interval];
  if (interval === "ALL") {
    if (aggregated.length <= visible) return aggregated;
    // Downsample evenly across the full history.
    const step = aggregated.length / visible;
    const out: LiveCandle[] = [];
    for (let i = 0; i < visible; i++) {
      out.push(aggregated[Math.min(aggregated.length - 1, Math.floor(i * step))]!);
    }
    const last = aggregated[aggregated.length - 1]!;
    if (out[out.length - 1] !== last) out[out.length - 1] = last;
    return out;
  }
  return aggregated.slice(-visible);
}
