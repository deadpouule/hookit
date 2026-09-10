import type { LiveCandle } from "@/lib/token-live";

export const NATIVE_CANDLE_SEC = 300;

export type ChartInterval = "5m" | "1h" | "6h" | "1D" | "ALL";

export type ChartBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const INTERVAL_BUCKET_SEC: Record<ChartInterval, number> = {
  "5m": 300,
  "1h": 3_600,
  "6h": 21_600,
  "1D": 86_400,
  ALL: 300,
};

function finitePos(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/** Fill missing unix timestamps so synthetic / on-chain fallbacks still plot. */
export function withCandleTimes(candles: LiveCandle[], nowSec: number): LiveCandle[] {
  const lastIdx = candles.length - 1;
  return candles.map((c, i) => {
    if (c.t != null && c.t > 0) return c;
    return { ...c, t: nowSec - (lastIdx - i) * NATIVE_CANDLE_SEC };
  });
}

export function liveCandlesToBars(candles: LiveCandle[], nowSec: number, liveMcap?: number): ChartBar[] {
  const timed = withCandleTimes(candles, nowSec)
    .filter((c) => finitePos(c.c) || finitePos(c.o))
    .map((c) => {
      const open = finitePos(c.o) ? c.o : c.c;
      const close = finitePos(c.c) ? c.c : open;
      const high = Math.max(c.h || 0, open, close);
      const low = Math.min(c.l > 0 ? c.l : open, open, close);
      return {
        time: c.t!,
        open,
        high: high > 0 ? high : close,
        low: low > 0 ? low : close,
        close,
        volume: c.v != null && Number.isFinite(c.v) && c.v > 0 ? c.v : 0,
      } satisfies ChartBar;
    })
    .sort((a, b) => a.time - b.time);

  const deduped: ChartBar[] = [];
  for (const bar of timed) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.time === bar.time) {
      prev.high = Math.max(prev.high, bar.high);
      prev.low = Math.min(prev.low, bar.low);
      prev.close = bar.close;
      prev.volume += bar.volume;
      continue;
    }
    deduped.push({ ...bar });
  }

  if (liveMcap && liveMcap > 0 && deduped.length > 0) {
    const last = deduped[deduped.length - 1]!;
    last.close = liveMcap;
    last.high = Math.max(last.high, liveMcap);
    last.low = Math.min(last.low, liveMcap);
  }

  return deduped;
}

export function aggregateBars(bars: ChartBar[], bucketSec: number): ChartBar[] {
  if (bucketSec <= NATIVE_CANDLE_SEC) return bars;
  const out: ChartBar[] = [];
  for (const bar of bars) {
    const bucket = Math.floor(bar.time / bucketSec) * bucketSec;
    const last = out[out.length - 1];
    if (!last || last.time !== bucket) {
      out.push({
        time: bucket,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      });
    } else {
      last.high = Math.max(last.high, bar.high);
      last.low = Math.min(last.low, bar.low);
      last.close = bar.close;
      last.volume += bar.volume;
    }
  }
  return out;
}

export function barsForInterval(bars: ChartBar[], interval: ChartInterval): ChartBar[] {
  return aggregateBars(bars, INTERVAL_BUCKET_SEC[interval]);
}

export function hasChartVolume(bars: ChartBar[]): boolean {
  return bars.some((b) => b.volume > 0);
}
