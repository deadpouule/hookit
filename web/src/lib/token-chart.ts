import { formatCompactUsd, isValidLaunchTimestamp } from "@/lib/format";
import type { LiveCandle } from "@/lib/token-live";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import { formatTvPrice } from "@/lib/tv-chart";

/** Native resolution is 1m - same as Sentry's subgraph resample. */
export const NATIVE_CANDLE_SEC = 60;

export const CHART_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D", "ALL"] as const;
export type ChartInterval = (typeof CHART_TIMEFRAMES)[number];
export type ChartScale = "mcap" | "price";
export type ChartStyle = "candles" | "line";
export type ChartTick = { t: number; price: number; volume?: number };

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
  ALL: 60,
};

function finitePos(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/** Keep only candles that came from real swaps (drop the fake spot placeholder). */
export function withCandleTimes(candles: LiveCandle[], _nowSec?: number): LiveCandle[] {
  return candles.filter((c) => c.t != null && c.t > 0);
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

export function liveCandlesToBars(candles: LiveCandle[], _nowSec?: number, _liveMcap?: number): ChartBar[] {
  const timed = withCandleTimes(candles)
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

  return mergeBars(timed);
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

export function pickChartBars(house: ChartBar[], geckoMcap: ChartBar[], _interval?: ChartInterval): ChartBar[] {
  const houseReal = house.filter((b) => b.volume > 0 || b.high !== b.low).length;
  if (house.length >= 8 || houseReal >= 4) return house;
  if (geckoMcap.length >= 8) return geckoMcap;
  if (house.length > 0) return house;
  return geckoMcap;
}

/** Carry-forward gap fills have no volume and a flat OHLC. */
export function isSyntheticBar(bar: ChartBar): boolean {
  return !(bar.volume > 0) && bar.open === bar.close && bar.high === bar.close && bar.low === bar.close;
}

export function pinLiveMcap(bars: ChartBar[], liveMcap?: number): ChartBar[] {
  if (!(liveMcap && liveMcap > 0) || bars.length === 0) return bars;
  const next = bars.map((b) => ({ ...b }));
  let pinAt = next.length - 1;
  for (let i = next.length - 1; i >= 0; i--) {
    if (!isSyntheticBar(next[i]!)) {
      pinAt = i;
      break;
    }
  }
  const target = next[pinAt]!;
  target.close = liveMcap;
  target.high = Math.max(target.high, liveMcap);
  target.low = Math.min(target.low, liveMcap);
  for (let i = pinAt + 1; i < next.length; i++) {
    next[i] = {
      ...next[i]!,
      open: liveMcap,
      high: liveMcap,
      low: liveMcap,
      close: liveMcap,
      volume: 0,
    };
  }
  return next;
}

export function chartHudBar(bars: ChartBar[], hover: ChartBar | null): ChartBar | null {
  if (hover) return hover;
  for (let i = bars.length - 1; i >= 0; i--) {
    if (!isSyntheticBar(bars[i]!)) return bars[i]!;
  }
  return bars[bars.length - 1] ?? null;
}

export function intervalBucketSec(interval: ChartInterval): number {
  return INTERVAL_BUCKET_SEC[interval];
}

/** Bucket every swap into OHLC - this is Sentry's subgraph path, not a spot placeholder. */
export function ticksToBars(ticks: ChartTick[], bucketSec = NATIVE_CANDLE_SEC): ChartBar[] {
  if (!(bucketSec > 0) || ticks.length === 0) return [];
  const sorted = ticks
    .filter((tick) => tick.t > 0 && Number.isFinite(tick.price) && tick.price > 0)
    .sort((a, b) => a.t - b.t);
  const out: ChartBar[] = [];
  for (const tick of sorted) {
    const time = Math.floor(tick.t / bucketSec) * bucketSec;
    const volume = tick.volume != null && Number.isFinite(tick.volume) && tick.volume > 0 ? tick.volume : 0;
    const last = out[out.length - 1];
    if (!last || last.time !== time) {
      out.push({
        time,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume,
      });
    } else {
      last.high = Math.max(last.high, tick.price);
      last.low = Math.min(last.low, tick.price);
      last.close = tick.price;
      last.volume += volume;
    }
  }
  return out;
}

/** TradingView `timeframe`: the opening window is 72 bars … */
export const CHART_WINDOW_BARS = 72;
/** … or the token's whole life when younger, never fewer than 20 bars. */
export const CHART_MIN_WINDOW_BARS = 20;
/** Empty bars kept between the last candle and the right axis. */
export const CHART_RIGHT_OFFSET = 5;
export const CHART_MIN_BAR_SPACING = 4;
export const CHART_MAX_BAR_SPACING = 40;

/**
 * Bars in the opening window, same rule as the Advanced Charts desk: 72, or
 * the token's age when it is younger than that, floored at 20 so a first buy
 * on a fresh token draws one wide candle instead of a sliver.
 */
export function chartWindowBars(bucketSec: number, launchedAt?: number, nowSec = Math.floor(Date.now() / 1000)): number {
  if (!(bucketSec > 0) || !isValidLaunchTimestamp(launchedAt)) return CHART_WINDOW_BARS;
  const ageBars = Math.ceil((nowSec - launchedAt) / bucketSec);
  if (ageBars <= 0 || ageBars >= CHART_WINDOW_BARS) return CHART_WINDOW_BARS;
  return Math.max(ageBars, CHART_MIN_WINDOW_BARS);
}

/**
 * Visible window. The opening window is stretched across the pane (TradingView
 * `timeframe`), so candle pitch follows the window, not a fixed pixel count.
 */
export function chartVisibleLogicalRange(
  barCount: number,
  paneWidthPx = 720,
  windowBars = CHART_WINDOW_BARS,
  rightOffset = CHART_RIGHT_OFFSET,
): { from: number; to: number; barSpacing: number } | null {
  if (barCount <= 0) return null;
  const width = Math.max(paneWidthPx, CHART_MIN_BAR_SPACING * 12);
  const slots = Math.max(windowBars, 1) + rightOffset;
  const barSpacing = Math.min(Math.max(width / slots, CHART_MIN_BAR_SPACING), CHART_MAX_BAR_SPACING);
  const visible = Math.max(Math.floor(width / barSpacing), 12);
  const to = barCount - 1 + rightOffset + 0.5;
  return { from: to - visible, to, barSpacing };
}

/** TradingView pane margins: 10% above the high, 8% below the low. */
export const CHART_SCALE_MARGIN_TOP = 0.1;
export const CHART_SCALE_MARGIN_BOTTOM = 0.08;

/**
 * Price pane geometry: hug the visible high/low so one trade fills the pane
 * (the pane margins above add the only breathing room). A flat window gets a
 * small floor so the candle stays visible without inventing a trend.
 */
export function chartPriceBand(
  minValue: number,
  maxValue: number,
): { minValue: number; maxValue: number } | null {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return null;
  const lo0 = Math.min(minValue, maxValue);
  const hi0 = Math.max(minValue, maxValue);
  const mid = (lo0 + hi0) / 2;
  if (!(mid > 0)) return null;
  const floorSpan = mid * 0.004;
  const span = hi0 - lo0;
  if (span >= floorSpan) return { minValue: lo0, maxValue: hi0 };
  return { minValue: Math.max(mid - floorSpan / 2, 0), maxValue: mid + floorSpan / 2 };
}

/**
 * Right-axis label. Market cap stays compact USD; price uses the TradingView
 * subscript form (0.0₃85495) so the fallback reads like the Advanced Chart.
 */
export function formatChartAxis(value: number, scale: ChartScale): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (scale === "mcap") return formatCompactUsd(value);
  return formatTvPrice(value);
}

/**
 * Carry the last close across empty time buckets so a few swaps still draw a
 * full tape (DexScreener / Defined style) instead of one lonely spike.
 */
export function fillEmptyBars(
  bars: ChartBar[],
  bucketSec: number,
  nowSec?: number,
  maxBars = 2_000,
): ChartBar[] {
  if (bars.length === 0 || !(bucketSec > 0)) return bars;
  const sorted = mergeBars(
    [...bars]
      .map((b) => ({ ...b, time: Math.floor(b.time / bucketSec) * bucketSec }))
      .sort((a, b) => a.time - b.time),
  );
  const last = sorted[sorted.length - 1]!;
  const end = Math.floor((nowSec && nowSec > last.time ? nowSec : last.time) / bucketSec) * bucketSec;
  const span = Math.floor((end - sorted[0]!.time) / bucketSec) + 1;
  const start =
    span > maxBars ? end - (Math.max(maxBars, 1) - 1) * bucketSec : sorted[0]!.time;
  const byTime = new Map(sorted.map((bar) => [bar.time, bar]));
  const out: ChartBar[] = [];
  let prev = sorted.find((bar) => bar.time <= start) ?? sorted[0]!;
  for (let time = start; time <= end; time += bucketSec) {
    const real = byTime.get(time);
    if (real) {
      out.push({ ...real });
      prev = real;
      continue;
    }
    out.push({
      time,
      open: prev.close,
      high: prev.close,
      low: prev.close,
      close: prev.close,
      volume: 0,
    });
  }
  return out;
}

/**
 * Union two series that describe the same trades (indexer candles + recent swap ticks).
 * Same-time bars widen high/low and keep the larger volume instead of summing it, so a
 * trade present in both sources is not counted twice.
 */
export function mergeChartSeries(left: ChartBar[], right: ChartBar[]): ChartBar[] {
  const byTime = new Map<number, ChartBar>();
  for (const bar of mergeBars([...left].sort((a, b) => a.time - b.time))) {
    byTime.set(bar.time, { ...bar });
  }
  for (const bar of mergeBars([...right].sort((a, b) => a.time - b.time))) {
    const prev = byTime.get(bar.time);
    if (!prev) {
      byTime.set(bar.time, { ...bar });
      continue;
    }
    prev.high = Math.max(prev.high, bar.high);
    prev.low = Math.min(prev.low, bar.low);
    prev.volume = Math.max(prev.volume, bar.volume);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

export function seedLaunchBars(launchedAt: number | undefined, marketCap: number): ChartBar[] {
  if (!(marketCap > 0) || !isValidLaunchTimestamp(launchedAt)) return [];
  return [
    {
      time: launchedAt,
      open: marketCap,
      high: marketCap,
      low: marketCap,
      close: marketCap,
      volume: 0,
    },
  ];
}

export function formatChartUsd(value: number, scale: ChartScale): string {
  if (!Number.isFinite(value) || value <= 0) return "·";
  if (scale === "mcap") return formatCompactUsd(value);
  return formatTvPrice(value);
}

/** Signed % from a single bar's open → close - Stonk OHLC legend. */
export function barChangePct(bar: ChartBar): number {
  if (!(bar.open > 0) || !Number.isFinite(bar.close)) return 0;
  return ((bar.close - bar.open) / bar.open) * 100;
}

export function chartRangeSignature(bars: ChartBar[], interval?: ChartInterval): string {
  return `${interval ?? ""}:${bars[0]?.time ?? 0}:${bars.length}:${bars[bars.length - 1]?.time ?? 0}`;
}
