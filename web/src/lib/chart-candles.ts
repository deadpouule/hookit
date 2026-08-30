import type { ChartInterval } from "@/components/token/TokenCandleChart";
import type { LiveCandle } from "@/lib/token-live";

/** Indexer stores 5m bars — bucket = how many 5m bars merge into one displayed bar. */
export const CHART_INTERVAL_BUCKETS: Record<ChartInterval, number> = {
  "1m": 1,
  "5m": 1,
  "15m": 3,
  "1h": 12,
  "4h": 48,
  "1D": 288,
};

export const CHART_VISIBLE_BARS: Record<ChartInterval, number> = {
  "1m": 60,
  "5m": 48,
  "15m": 40,
  "1h": 36,
  "4h": 28,
  "1D": 21,
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
  return aggregated.slice(-visible);
}
