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
  /** Empty time bucket: occupies a TradingView slot but does not draw a candle. */
  whitespace?: boolean;
};

const INTERVAL_BUCKET_SEC: Record<Exclude<ChartInterval, "ALL">, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3_600,
  "4h": 14_400,
  "1D": 86_400,
};

/** ALL picks the finest step that fits the token's whole life inside CHART_WINDOW_BARS. */
const ALL_BUCKET_STEPS = [60, 300, 900, 3_600, 14_400, 86_400] as const;

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

export function chartSpanSec(bars: ChartBar[], launchedAt?: number, nowSec?: number): number {
  const real = bars.filter((b) => !isWhitespaceBar(b) && b.time > 0);
  const first = real[0]?.time ?? (isValidLaunchTimestamp(launchedAt) ? launchedAt : 0);
  const last = real[real.length - 1]?.time ?? first;
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  if (!(first > 0)) return 0;
  return Math.max(last, now) - first;
}

export function intervalBucketSec(interval: ChartInterval, spanSec?: number): number {
  if (interval !== "ALL") return INTERVAL_BUCKET_SEC[interval];
  const span = spanSec ?? 0;
  if (!(span > 0)) return ALL_BUCKET_STEPS[ALL_BUCKET_STEPS.length - 1]!;
  for (const step of ALL_BUCKET_STEPS) {
    if (span / step <= CHART_WINDOW_BARS) return step;
  }
  return ALL_BUCKET_STEPS[ALL_BUCKET_STEPS.length - 1]!;
}

export function barsForInterval(bars: ChartBar[], interval: ChartInterval, spanSec?: number): ChartBar[] {
  return aggregateBars(bars, intervalBucketSec(interval, spanSec));
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

/** True when the bar came from a real swap (not FX carry / gap fill). */
export function isTradedBar(bar: ChartBar): boolean {
  return !isWhitespaceBar(bar) && bar.volume > 0 && bar.close > 0;
}

/** Every FDV bucket with a price prints on the tape (flat = thin dash, not a gap). */
export function isCandleBar(bar: ChartBar): boolean {
  return !isWhitespaceBar(bar) && bar.close > 0;
}

/** Thin TradingView-style dash when FDV is unchanged in this bucket. */
export function flatFdvCandleOhlc(bar: ChartBar): Pick<ChartBar, "open" | "high" | "low" | "close"> {
  const mid = bar.close || bar.open;
  if (!(mid > 0)) return { open: 0, high: 0, low: 0, close: 0 };
  const half = mid * 0.00025;
  return {
    open: mid,
    high: mid + half,
    low: Math.max(mid - half, 0),
    close: mid,
  };
}

export function chartRenderableCandle(bar: ChartBar): Pick<ChartBar, "open" | "high" | "low" | "close"> {
  if (!(bar.close > 0)) return { open: 0, high: 0, low: 0, close: 0 };
  const mid = bar.close;
  const span = Math.max(bar.high - bar.low, Math.abs(bar.open - bar.close));
  const minMove = mid * 0.00005;
  if (span <= minMove) return flatFdvCandleOhlc(bar);
  return { open: bar.open, high: bar.high, low: bar.low, close: bar.close };
}

export function pickChartBars(house: ChartBar[], geckoMcap: ChartBar[], _interval?: ChartInterval): ChartBar[] {
  if (house.length > 0) return house;
  return geckoMcap;
}

export function isWhitespaceBar(bar: ChartBar): boolean {
  return bar.whitespace === true;
}

function quoteFxAt(fx: ChartBar[], time: number): ChartBar | undefined {
  if (fx.length === 0) return undefined;
  let lo = 0;
  let hi = fx.length - 1;
  if (time < fx[0]!.time) return fx[0];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = fx[mid]!.time;
    if (t === time) return fx[mid];
    if (t < time) lo = mid + 1;
    else hi = mid - 1;
  }
  return fx[Math.max(0, hi)];
}

/** Roll 1m quote FX onto the chart bucket so carry/reprice share one series. */
export function rollQuoteFxBars(fx: ChartBar[], bucketSec: number): ChartBar[] {
  if (!(bucketSec > 0) || fx.length === 0) return fx;
  return aggregateBars(
    fx.filter((bar) => !isWhitespaceBar(bar) && bar.close > 0),
    bucketSec,
  );
}

function quoteFxPrinted(bar: ChartBar): boolean {
  if (!(bar.close > 0)) return false;
  return bar.volume > 0 || bar.high > bar.low || bar.open !== bar.close;
}

/**
 * Defined/Codex USD: house bars were converted with a single live quote USD.
 * Scale each bar's own OHLC by quoteCloseAtThatTime / liveQuoteUsd so wicks stay.
 */
export function repriceBarsWithQuoteFx(bars: ChartBar[], fx: ChartBar[], liveQuoteUsd: number): ChartBar[] {
  if (!(liveQuoteUsd > 0) || fx.length === 0) return bars;
  return bars.map((bar) => {
    if (isWhitespaceBar(bar) || !(bar.close > 0)) return bar;
    const q = quoteFxAt(fx, bar.time);
    if (!q || !(q.close > 0)) return bar;
    const factor = q.close / liveQuoteUsd;
    return {
      ...bar,
      open: bar.open * factor,
      high: bar.high * factor,
      low: bar.low * factor,
      close: bar.close * factor,
    };
  });
}

/** Each traded bucket opens at the previous bar's close so sparse tapes read continuously. */
export function linkBarOpens(bars: ChartBar[]): ChartBar[] {
  let prevClose: number | undefined;
  const out: ChartBar[] = [];
  for (const bar of bars) {
    if (isWhitespaceBar(bar)) {
      out.push(bar);
      continue;
    }
    if (!(bar.close > 0)) {
      out.push({ ...bar });
      continue;
    }
    if (prevClose === undefined) {
      out.push({ ...bar });
      prevClose = bar.close;
      continue;
    }
    const open = prevClose;
    const lowBase = bar.low > 0 ? bar.low : Math.min(bar.open, bar.close);
    out.push({
      ...bar,
      open,
      high: Math.max(bar.high, open, bar.close),
      low: Math.min(lowBase, open, bar.close),
    });
    prevClose = bar.close;
  }
  return out;
}

/** After the last trade, mark USD from quote FX only where the quote printed. */
export function carryQuoteFxBars(
  bars: ChartBar[],
  fx: ChartBar[],
  liveQuoteUsd: number,
  bucketSec: number,
  nowSec: number,
): ChartBar[] {
  if (!(liveQuoteUsd > 0) || !(bucketSec > 0) || fx.length === 0) return bars;
  const rolledFx = rollQuoteFxBars(fx, bucketSec);
  const real = bars.filter((b) => !isWhitespaceBar(b) && b.close > 0);
  const lastTraded = [...real].reverse().find((b) => b.volume > 0);
  const last = lastTraded ?? real[real.length - 1];
  if (!last) return bars;
  const lastFx = quoteFxAt(rolledFx, last.time);
  if (!lastFx || !(lastFx.close > 0)) return bars;
  const end = Math.floor(nowSec / bucketSec) * bucketSec;
  const extra: ChartBar[] = [];
  let prevClose = last.close;
  let prevFxClose = lastFx.close;
  for (const q of rolledFx) {
    if (q.time <= last.time || q.time > end) continue;
    if (!quoteFxPrinted(q)) continue;
    const close = prevClose * (q.close / prevFxClose);
    const open = prevClose;
    const ratioHigh = q.close > 0 ? q.high / q.close : 1;
    const ratioLow = q.close > 0 ? (q.low > 0 ? q.low : q.close) / q.close : 1;
    const high = Math.max(open, close, open * ratioHigh, close * ratioHigh);
    const low = Math.min(open, close, open * ratioLow, close * ratioLow);
    extra.push({ time: q.time, open, high, low, close, volume: 0 });
    prevClose = close;
    prevFxClose = q.close;
  }
  if (extra.length === 0) return bars;
  const byTime = new Map(real.map((bar) => [bar.time, bar]));
  for (const bar of extra) byTime.set(bar.time, bar);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** Carry-forward gap fills have no volume and a flat OHLC. */
export function isSyntheticBar(bar: ChartBar): boolean {
  if (isWhitespaceBar(bar)) return true;
  return !(bar.volume > 0) && bar.open === bar.close && bar.high === bar.close && bar.low === bar.close;
}

/**
 * Drop DexScreener-style empty buckets (0 volume, flat, same close as previous)
 * so 1m / 5m / ALL only show real prints — Tsunami: one buy → one candle.
 */
export function dropCarryForwardBars(bars: ChartBar[]): ChartBar[] {
  if (bars.length <= 1) return bars;
  const out: ChartBar[] = [];
  for (const bar of bars) {
    const prev = out[out.length - 1];
    if (prev && isSyntheticBar(bar) && bar.close === prev.close) continue;
    out.push(bar);
  }
  return out;
}

/** Single-print dojis get a small body so 1m / 5m look like a candle, not a plus. */
export function visibleCandleOhlc(bar: ChartBar): Pick<ChartBar, "open" | "high" | "low" | "close"> {
  const mid = bar.close || bar.open;
  const span = Math.max(bar.high - bar.low, 0);
  const minSpan = mid > 0 ? mid * 0.006 : 0;
  if (span >= minSpan) {
    return { open: bar.open, high: bar.high, low: bar.low, close: bar.close };
  }
  const half = minSpan / 2;
  const up = bar.close >= bar.open;
  return {
    open: up ? Math.max(mid - half, 0) : mid + half,
    high: mid + half,
    low: Math.max(mid - half, 0),
    close: up ? mid + half : Math.max(mid - half, 0),
  };
}

export function pinLiveMcap(bars: ChartBar[], liveMcap?: number): ChartBar[] {
  if (!(liveMcap && liveMcap > 0) || bars.length === 0) return bars;
  const next = bars.map((b) => ({ ...b }));
  let pinAt = -1;
  for (let i = next.length - 1; i >= 0; i--) {
    if (!isWhitespaceBar(next[i]!) && !isSyntheticBar(next[i]!)) {
      pinAt = i;
      break;
    }
  }
  if (pinAt < 0) {
    for (let i = next.length - 1; i >= 0; i--) {
      if (!isWhitespaceBar(next[i]!)) {
        pinAt = i;
        break;
      }
    }
  }
  if (pinAt < 0) return next;
  const target = next[pinAt]!;
  target.close = liveMcap;
  target.high = Math.max(target.high, liveMcap);
  target.low = Math.min(target.low, liveMcap);
  for (let i = pinAt + 1; i < next.length; i++) {
    if (isWhitespaceBar(next[i]!)) continue;
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
  if (hover && !isWhitespaceBar(hover)) return hover;
  for (let i = bars.length - 1; i >= 0; i--) {
    if (!isWhitespaceBar(bars[i]!) && !isSyntheticBar(bars[i]!)) return bars[i]!;
  }
  for (let i = bars.length - 1; i >= 0; i--) {
    if (!isWhitespaceBar(bars[i]!)) return bars[i]!;
  }
  return null;
}

/** Last bar that is neither whitespace nor a synthetic carry — anchors auto-fit. */
export function chartFitAnchorIndex(bars: ChartBar[]): number {
  if (bars.length === 0) return 0;
  for (let i = bars.length - 1; i >= 0; i--) {
    const bar = bars[i]!;
    if (isWhitespaceBar(bar)) continue;
    if (!isSyntheticBar(bar)) return i;
  }
  for (let i = bars.length - 1; i >= 0; i--) {
    if (!isWhitespaceBar(bars[i]!)) return i;
  }
  return bars.length - 1;
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

/** TradingView / Defined Codex: the opening window is always 72 bars. */
export const CHART_WINDOW_BARS = 72;
/** @deprecated Defined does not shrink the window on young tokens. Kept for callers. */
export const CHART_MIN_WINDOW_BARS = 72;
/** TV default `rightOffset` — room for the last-value tag after the last candle. */
export const CHART_RIGHT_OFFSET = 5;
export const CHART_MIN_BAR_SPACING = 1;
/** Cap candle width — TradingView rarely exceeds ~32px even on young tokens. */
export const CHART_MAX_BAR_SPACING = 32;
/** Defined "auto" — hug a quiet tape so 2–4 prints stay fat, like Codex 5m. */
export const CHART_MIN_VISIBLE_BARS = 16;
/** Empty slots to the left of the first print so the first candle is not glued. */
export const CHART_FIT_PAD_BARS = 8;

/**
 * Bars in the opening window. Defined (TradingView `timeframe`) always uses 72
 * slots, even on a token that is only a few hours old — empty time stays empty.
 */
export function chartWindowBars(_bucketSec?: number, _launchedAt?: number, _nowSec?: number): number {
  return CHART_WINDOW_BARS;
}

/**
 * Defined Codex "auto" range: last 72 slots at TradingView pitch, or zoom in
 * when the visible window only has a handful of prints (fat 1h/5m candles).
 * Pass the first real index inside the last 72 so a quiet 5m does not stay
 * squeezed at 10px — scroll left for earlier session.
 */
export function chartFitWindowBars(tapeLength: number, anchorIndex = 0): number {
  if (tapeLength <= 0) return CHART_WINDOW_BARS;
  const idx = Math.min(Math.max(anchorIndex, 0), tapeLength - 1);
  const fromFirst = tapeLength - idx;
  const padded = Math.max(CHART_MIN_VISIBLE_BARS, fromFirst + CHART_FIT_PAD_BARS);
  return Math.min(padded, CHART_WINDOW_BARS);
}

/** First real candle to pin Defined auto-zoom. Sparse 15m/5m tapes zoom to the
 * latest prints instead of squeezing the whole session into 1px specks. */
export function chartFitFirstRealIndex(bars: ChartBar[]): number {
  if (bars.length === 0) return 0;
  const last = bars.length - 1;
  const start72 = Math.max(0, last - CHART_WINDOW_BARS + 1);
  let reals = 0;
  let first72 = -1;
  let lastReal = -1;
  for (let i = start72; i <= last; i++) {
    if (isWhitespaceBar(bars[i]!)) continue;
    if (first72 < 0) first72 = i;
    lastReal = i;
    reals++;
  }
  if (lastReal < 0) return start72;
  if (reals <= 6) {
    for (let i = last; i >= start72; i--) {
      const bar = bars[i]!;
      if (!isWhitespaceBar(bar) && bar.volume > 0) return i;
    }
    return lastReal;
  }
  return first72;
}

/** Inclusive logical indexes for the pane, falling back to the last 72 slots. */
export function visibleBarSlice(
  barCount: number,
  from?: number,
  to?: number,
): { start: number; end: number } {
  if (barCount <= 0) return { start: 0, end: -1 };
  const last = barCount - 1;
  const start = Math.max(0, Math.floor(from ?? Math.max(0, last - CHART_WINDOW_BARS + 1)));
  const end = Math.min(last, Math.ceil(to ?? last));
  return { start, end: Math.max(start, end) };
}

/** Raw high/low of real candles in the visible logical range. */
export function visibleExtremes(
  bars: ChartBar[],
  from?: number,
  to?: number,
): { ath: number; atl: number } | null {
  const { start, end } = visibleBarSlice(bars.length, from, to);
  let ath = -Infinity;
  let atl = Infinity;
  for (let i = start; i <= end; i++) {
    const bar = bars[i];
    if (!bar || isWhitespaceBar(bar) || !(bar.high > 0) || !(bar.low > 0)) continue;
    ath = Math.max(ath, bar.high);
    atl = Math.min(atl, bar.low);
  }
  if (!(ath > 0) || !(atl > 0)) return null;
  return { ath, atl };
}

/** High/low of traded candles in the visible logical range (TV auto-scale). */
export function visiblePriceBand(
  bars: ChartBar[],
  from?: number,
  to?: number,
): { minValue: number; maxValue: number } | null {
  const { start, end } = visibleBarSlice(bars.length, from, to);
  let ath = -Infinity;
  let atl = Infinity;
  for (let i = start; i <= end; i++) {
    const bar = bars[i];
    if (!bar || !isTradedBar(bar)) continue;
    ath = Math.max(ath, bar.high);
    atl = Math.min(atl, bar.low);
  }
  if (!(ath > 0) || !(atl > 0)) {
    const ext = visibleExtremes(bars, from, to);
    if (!ext) return null;
    return chartPriceBand(ext.atl, ext.ath);
  }
  return chartPriceBand(atl, ath);
}

/** Peak volume in the visible logical range so off-screen prints don't dwarf the pane. */
export function visibleVolumePeak(bars: ChartBar[], from?: number, to?: number): number {
  const { start, end } = visibleBarSlice(bars.length, from, to);
  let hi = 0;
  for (let i = start; i <= end; i++) {
    const bar = bars[i];
    if (!bar || isWhitespaceBar(bar) || !(bar.volume > 0)) continue;
    hi = Math.max(hi, bar.volume);
  }
  return hi;
}

/**
 * Visible window: stretch 72 bars (+ right offset) across the pane, same as
 * Defined's Codex chart. Candle pitch = pane width / 77, last bar pinned right.
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

/** TradingView pane: headroom above/below the FDV series (no volume dock). */
export const CHART_SCALE_MARGIN_TOP = 0.12;
export const CHART_SCALE_MARGIN_BOTTOM = 0.08;
export const CHART_VOLUME_MARGIN_TOP = 0.84;
export const CHART_VOLUME_SMA_PERIOD = 20;

/** TradingView default Volume SMA (period 20) for the Defined overlay. */
export function volumeSma(
  bars: ChartBar[],
  period = CHART_VOLUME_SMA_PERIOD,
): { time: number; value: number }[] {
  if (period <= 0 || bars.length === 0) return [];
  const out: { time: number; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i]!.volume;
    if (i >= period) sum -= bars[i - period]!.volume;
    const n = Math.min(i + 1, period);
    out.push({ time: bars[i]!.time, value: sum / n });
  }
  return out;
}

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
  const span = hi0 - lo0;
  const pad = span > 0 ? span * 0.1 : mid * 0.02;
  if (span > 0) {
    return { minValue: Math.max(lo0 - pad, 0), maxValue: hi0 + pad };
  }
  const half = pad / 2;
  return { minValue: Math.max(mid - half, 0), maxValue: mid + half };
}

/**
 * Right-axis label. FDV stays compact USD; price uses the TradingView
 * subscript form (0.0₃85495) so the fallback reads like the Advanced Chart.
 */
export function formatChartAxis(value: number, scale: ChartScale): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (scale === "mcap") return formatCompactUsd(value);
  return formatTvPrice(value);
}

/**
 * TradingView time scale: every bucket in the 72-bar window occupies a slot.
 * Empty buckets are whitespace so lightweight-charts does not pack sparse
 * prints into adjacent candles (the 5m "dots" bug).
 */
export function definedWhitespaceTape(
  bars: ChartBar[],
  bucketSec: number,
  nowSec?: number,
  windowBars = CHART_WINDOW_BARS,
  maxBars = 8_000,
): ChartBar[] {
  if (bars.length === 0 || !(bucketSec > 0)) return bars;
  const sorted = mergeBars(
    [...bars]
      .filter((bar) => !isWhitespaceBar(bar))
      .map((b) => ({ ...b, time: Math.floor(b.time / bucketSec) * bucketSec, whitespace: false }))
      .sort((a, b) => a.time - b.time),
  );
  if (sorted.length === 0) return [];
  const last = sorted[sorted.length - 1]!;
  const end = Math.floor((nowSec && nowSec > last.time ? nowSec : last.time) / bucketSec) * bucketSec;
  const minStart = end - (Math.max(windowBars, 1) - 1) * bucketSec;
  let start = Math.min(sorted[0]!.time, minStart);
  const span = Math.floor((end - start) / bucketSec) + 1;
  if (span > maxBars) start = end - (Math.max(maxBars, 1) - 1) * bucketSec;
  const byTime = new Map(sorted.map((bar) => [bar.time, bar]));
  const out: ChartBar[] = [];
  for (let time = start; time <= end; time += bucketSec) {
    const real = byTime.get(time);
    if (real) {
      out.push({ ...real, whitespace: false });
      continue;
    }
    out.push({
      time,
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
      whitespace: true,
    });
  }
  return out;
}

/**
 * FDV time series: after the first print, empty buckets carry the last FDV as a
 * flat slot (drawn as a thin dash) instead of whitespace gaps.
 */
export function carryFdvTape(bars: ChartBar[]): ChartBar[] {
  let prevClose = 0;
  const out: ChartBar[] = [];
  for (const bar of bars) {
    if (!isWhitespaceBar(bar) && bar.close > 0) {
      prevClose = bar.close;
      out.push({ ...bar, whitespace: false });
      continue;
    }
    if (isWhitespaceBar(bar) && prevClose > 0) {
      out.push({
        time: bar.time,
        open: prevClose,
        high: prevClose,
        low: prevClose,
        close: prevClose,
        volume: 0,
      });
      continue;
    }
    out.push(bar);
  }
  return out;
}

/** Whitespace tape with continuous FDV carry between prints. */
export function definedFdvTape(
  bars: ChartBar[],
  bucketSec: number,
  nowSec?: number,
  windowBars = CHART_WINDOW_BARS,
): ChartBar[] {
  return carryFdvTape(definedWhitespaceTape(bars, bucketSec, nowSec, windowBars));
}

/**
 * Snap ticks onto the selected timeframe bucket. Unlike a sparse "find previous
 * bar" walk, a 1m print in an empty 5m slot becomes its own candle so 1m/5m
 * keep intra-period wicks when rolled up.
 */
export function applyTicksToBuckets(bars: ChartBar[], ticks: ChartTick[], bucketSec: number): ChartBar[] {
  if (!(bucketSec > 0)) return bars.map((b) => ({ ...b }));
  const byTime = new Map<number, ChartBar>();
  for (const bar of bars) {
    if (isWhitespaceBar(bar)) continue;
    const time = Math.floor(bar.time / bucketSec) * bucketSec;
    const prev = byTime.get(time);
    if (!prev) {
      byTime.set(time, { ...bar, time, whitespace: false });
      continue;
    }
    prev.high = Math.max(prev.high, bar.high);
    prev.low = Math.min(prev.low, bar.low);
    prev.close = bar.close;
    prev.volume = Math.max(prev.volume, bar.volume);
  }
  const sorted = ticks
    .filter((tick) => tick.t > 0 && Number.isFinite(tick.price) && tick.price > 0)
    .sort((a, b) => a.t - b.t);
  for (const tick of sorted) {
    const time = Math.floor(tick.t / bucketSec) * bucketSec;
    const volume = tick.volume != null && Number.isFinite(tick.volume) && tick.volume > 0 ? tick.volume : 0;
    const prev = byTime.get(time);
    if (!prev) {
      byTime.set(time, {
        time,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume,
        whitespace: false,
      });
      continue;
    }
    prev.high = Math.max(prev.high, tick.price);
    prev.low = Math.min(prev.low, tick.price);
    prev.close = tick.price;
    if (volume > prev.volume) prev.volume = volume;
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/**
 * TradingView current bar: the in-progress bucket always exists at the live
 * price so 1m/5m keep a candle on the right edge.
 */
export function ensureCurrentBar(
  bars: ChartBar[],
  bucketSec: number,
  nowSec: number,
  liveValue?: number,
): ChartBar[] {
  if (bars.length === 0 || !(bucketSec > 0)) return bars;
  const cur = Math.floor(nowSec / bucketSec) * bucketSec;
  const last = [...bars].reverse().find((b) => !isWhitespaceBar(b));
  if (last && last.time === cur) return bars;
  const px = liveValue && liveValue > 0 ? liveValue : last?.close;
  if (!(px && px > 0)) return bars;
  const open = last?.close && last.close > 0 ? last.close : px;
  return [
    ...bars,
    {
      time: cur,
      open,
      high: Math.max(open, px),
      low: Math.min(open, px),
      close: px,
      volume: 0,
    },
  ].sort((a, b) => a.time - b.time);
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

export function chartRangeSignature(bars: ChartBar[], interval?: ChartInterval, windowBars?: number): string {
  return `${interval ?? ""}:${windowBars ?? ""}:${bars[0]?.time ?? 0}:${bars.length}:${bars[bars.length - 1]?.time ?? 0}`;
}

export type ChartTrade = { t: number; side: "buy" | "sell" };

/** Snap on-chain swaps onto the candle they belong to (Defined buy/sell dots). */
export function tradesOnBars(trades: ChartTrade[], bars: ChartBar[], max = 80): ChartTrade[] {
  if (trades.length === 0 || bars.length === 0) return [];
  const out: ChartTrade[] = [];
  for (const trade of trades) {
    if (!(trade.t > 0)) continue;
    let time = bars[bars.length - 1]!.time;
    for (let i = 0; i < bars.length; i++) {
      const nxt = bars[i + 1];
      if (trade.t >= bars[i]!.time && (!nxt || trade.t < nxt.time)) {
        time = bars[i]!.time;
        break;
      }
    }
    out.push({ t: time, side: trade.side });
  }
  return out.length > max ? out.slice(out.length - max) : out;
}
