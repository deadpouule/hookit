import { formatCompactUsd } from "@/lib/format";
import type { LiveCandle } from "@/lib/token-live";
import { TOTAL_SUPPLY } from "@/lib/token-live";

export const NATIVE_CANDLE_SEC = 300;

export const CHART_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D", "ALL"] as const;
export type ChartInterval = (typeof CHART_TIMEFRAMES)[number];
export type ChartScale = "mcap" | "price";
export type ChartStyle = "candles" | "line";

export type ChartBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const INTERVAL_BUCKET_SEC: Record<ChartInterval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3_600,
  "4h": 14_400,
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

function mergeBars(bars: ChartBar[]): ChartBar[] {
  const deduped: ChartBar[] = [];
  for (const bar of bars) {
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
  return deduped;
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

  const deduped = mergeBars(timed);

  if (liveMcap && liveMcap > 0 && deduped.length > 0) {
    const last = deduped[deduped.length - 1]!;
    last.close = liveMcap;
    last.high = Math.max(last.high, liveMcap);
    last.low = Math.min(last.low, liveMcap);
  }

  return deduped;
}

export function aggregateBars(bars: ChartBar[], bucketSec: number): ChartBar[] {
  if (!(bucketSec > 0) || bars.length === 0) return bars;
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
  const nativeSec = bars.length >= 2 ? Math.min(...bars.slice(1).map((b, i) => b.time - bars[i]!.time)) : NATIVE_CANDLE_SEC;
  const bucket = INTERVAL_BUCKET_SEC[interval];
  if (bucket <= nativeSec) return bars;
  return aggregateBars(bars, bucket);
}

export function hasChartVolume(bars: ChartBar[]): boolean {
  return bars.some((b) => b.volume > 0);
}

/** GeckoTerminal OHLCV is token USD price; indexer candles are market cap. */
export function priceBarsToMcap(bars: ChartBar[], supply = TOTAL_SUPPLY): ChartBar[] {
  if (!(supply > 0)) return bars;
  return bars.map((b) => ({
    ...b,
    open: b.open * supply,
    high: b.high * supply,
    low: b.low * supply,
    close: b.close * supply,
  }));
}

export function scaleBars(bars: ChartBar[], scale: ChartScale, supply = TOTAL_SUPPLY): ChartBar[] {
  if (scale === "mcap" || !(supply > 0)) return bars;
  return bars.map((b) => ({
    ...b,
    open: b.open / supply,
    high: b.high / supply,
    low: b.low / supply,
    close: b.close / supply,
  }));
}

export function pinLiveMcap(bars: ChartBar[], liveMcap?: number): ChartBar[] {
  if (!(liveMcap && liveMcap > 0) || bars.length === 0) return bars;
  const next = bars.map((b) => ({ ...b }));
  const last = next[next.length - 1]!;
  last.close = liveMcap;
  last.high = Math.max(last.high, liveMcap);
  last.low = Math.min(last.low, liveMcap);
  return next;
}

export function pickChartBars(indexer: ChartBar[], geckoMcap: ChartBar[], interval: ChartInterval): ChartBar[] {
  if (interval === "ALL") return indexer.length ? indexer : geckoMcap;
  if (interval === "1m") return geckoMcap.length ? geckoMcap : indexer;
  if (geckoMcap.length >= 8) return geckoMcap;
  return indexer.length ? indexer : geckoMcap;
}

export function formatChartUsd(value: number, scale: ChartScale): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (scale === "mcap") return formatCompactUsd(value);
  if (value >= 1) return formatCompactUsd(value);
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  if (value >= 0.0001) return `$${value.toFixed(6)}`;
  if (value >= 1e-8) return `$${value.toFixed(8)}`;
  return `$${value.toExponential(2).replace("e+", "e")}`;
}

export function chartRangeSignature(bars: ChartBar[]): string {
  return `${bars[0]?.time ?? 0}:${bars.length}:${bars[bars.length - 1]?.time ?? 0}`;
}
