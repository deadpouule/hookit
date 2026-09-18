import { formatCompactUsd, isValidLaunchTimestamp } from "@/lib/format";
import type { LiveCandle } from "@/lib/token-live";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import { formatTvPrice } from "@/lib/tv-chart";

/** Native resolution is 1m - same as Sentry's subgraph resample. */
export const NATIVE_CANDLE_SEC = 60;

export const CHART_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "D"] as const;
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

export interface RawTrade {
  timestamp: number; // unix seconds
  priceUsd: number;
  volumeUsd: number;
}

export interface OhlcBar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Strict bucket discretization + AllonSol forward-fill.
 * Quiet windows copy the previous close as a flat doji (O=H=L=C, volume=0).
 */
export function buildContinuousOhlcv(
  trades: RawTrade[],
  intervalSeconds: number,
  startTime: number,
  endTime: number,
  fallbackPrice: number,
): OhlcBar[] {
  if (!(intervalSeconds > 0)) return [];
  const buckets = new Map<number, RawTrade[]>();
  for (const trade of trades) {
    if (!(trade.timestamp > 0) || !(trade.priceUsd > 0)) continue;
    const bTime = Math.floor(trade.timestamp / intervalSeconds) * intervalSeconds;
    const list = buckets.get(bTime);
    if (list) list.push(trade);
    else buckets.set(bTime, [trade]);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => a.timestamp - b.timestamp);
  }
  const result: OhlcBar[] = [];
  const startBucket = Math.floor(startTime / intervalSeconds) * intervalSeconds;
  const endBucket = Math.floor(endTime / intervalSeconds) * intervalSeconds;
  let lastClose = fallbackPrice;
  for (let t = startBucket; t <= endBucket; t += intervalSeconds) {
    const bucketTrades = buckets.get(t);
    if (bucketTrades && bucketTrades.length > 0) {
      const open = bucketTrades[0]!.priceUsd;
      let high = open;
      let low = open;
      let volume = 0;
      for (const tr of bucketTrades) {
        if (tr.priceUsd > high) high = tr.priceUsd;
        if (tr.priceUsd < low) low = tr.priceUsd;
        volume += tr.volumeUsd > 0 ? tr.volumeUsd : 0;
      }
      const close = bucketTrades[bucketTrades.length - 1]!.priceUsd;
      lastClose = close;
      result.push({ time: t, open, high, low, close, volume });
    } else {
      result.push({
        time: t,
        open: lastClose,
        high: lastClose,
        low: lastClose,
        close: lastClose,
        volume: 0,
      });
    }
  }
  return result;
}

const INTERVAL_BUCKET_SEC: Record<ChartInterval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3_600,
  "4h": 14_400,
  D: 86_400,
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

export function chartSpanSec(bars: ChartBar[], launchedAt?: number, nowSec?: number): number {
  const real = bars.filter((b) => !isWhitespaceBar(b) && b.time > 0);
  const firstTrade = real[0]?.time ?? 0;
  const launch = isValidLaunchTimestamp(launchedAt) ? launchedAt : 0;
  const first =
    firstTrade > 0 && launch > 0 ? Math.min(firstTrade, launch) : firstTrade || launch;
  const last = real[real.length - 1]?.time ?? first;
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  if (!(first > 0)) return 0;
  return Math.max(last, now) - first;
}

export function intervalBucketSec(interval: ChartInterval, _spanSec?: number): number {
  return INTERVAL_BUCKET_SEC[interval];
}

export function barsForInterval(bars: ChartBar[], interval: ChartInterval, _spanSec?: number): ChartBar[] {
  return aggregateBars(bars, intervalBucketSec(interval));
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

/** True when the bar came from a real swap (volume metadata only — not used for FDV plot). */
export function isTradedBar(bar: ChartBar): boolean {
  return !isWhitespaceBar(bar) && bar.volume > 0 && bar.close > 0;
}

/** Every FDV bucket with a price prints on the tape (flat = thin dash, not a gap). */
export function isCandleBar(bar: ChartBar): boolean {
  return !isWhitespaceBar(bar) && bar.close > 0;
}

const FDV_STEP_EPS = 0.00005;

/** FDV moved vs the previous plotted bucket — mcap/time, not volume. */
export function fdvStepBar(bar: ChartBar, prevClose?: number): boolean {
  if (!isCandleBar(bar)) return false;
  if (!(prevClose !== undefined && prevClose > 0)) return true;
  const mid = bar.close;
  return Math.abs(bar.close - prevClose) / mid > FDV_STEP_EPS;
}

/** Flat bucket: natural doji, no invented 0.012% body floor. */
export function flatFdvCandleOhlc(bar: ChartBar): Pick<ChartBar, "open" | "high" | "low" | "close"> {
  const mid = bar.close || bar.open;
  if (!(mid > 0)) return { open: 0, high: 0, low: 0, close: 0 };
  return { open: mid, high: mid, low: mid, close: mid };
}

/** Small doji for a flat print that still had swap volume — visible but not a fat block. */
export function tradeFlatCandleOhlc(bar: ChartBar): Pick<ChartBar, "open" | "high" | "low" | "close"> {
  const mid = bar.close || bar.open;
  if (!(mid > 0)) return { open: 0, high: 0, low: 0, close: 0 };
  const half = mid * 0.00035;
  const up = bar.close >= bar.open;
  return {
    open: up ? Math.max(mid - half, 0) : mid + half,
    high: mid + half,
    low: Math.max(mid - half, 0),
    close: up ? mid + half : Math.max(mid - half, 0),
  };
}

/** FDV open → close move in this bucket (mcap/time), ignoring wick noise. */
export function fdvCloseMoved(bar: ChartBar): boolean {
  const mid = bar.close || bar.open;
  if (!(mid > 0)) return false;
  return Math.abs(bar.close - bar.open) / mid > FDV_STEP_EPS;
}

export function chartRenderableCandle(
  bar: ChartBar,
  _prevClose?: number,
): Pick<ChartBar, "open" | "high" | "low" | "close"> {
  if (!(bar.close > 0)) return { open: 0, high: 0, low: 0, close: 0 };
  const high = Math.max(bar.high || 0, bar.open, bar.close);
  const lowBase = bar.low > 0 ? bar.low : Math.min(bar.open, bar.close);
  const low = Math.min(lowBase, bar.open, bar.close);
  const hasBody = bar.open !== bar.close || high > low;
  // Quiet minutes stay a true doji dash. A live open→close move (even with
  // volume=0) must keep its body so a sell from 5.13k to 5.07k draws red.
  if (!isTradedBar(bar) && !hasBody) {
    const px = bar.close || bar.open;
    return { open: px, high: px, low: px, close: px };
  }
  return {
    open: bar.open,
    high,
    low,
    close: bar.close,
  };
}

/** Candle mode: every FDV bucket prints (flat carry = thin dash, trades = wicks). */
export function candlePlotBar(bar: ChartBar, _prevClose?: number): boolean {
  return isCandleBar(bar);
}

export function candleSeriesData(
  bars: ChartBar[],
): Array<{ time: number; open?: number; high?: number; low?: number; close?: number }> {
  return bars.map((bar) => {
    if (!candlePlotBar(bar)) return { time: bar.time };
    const ohlc = chartRenderableCandle(bar);
    return { time: bar.time, open: ohlc.open, high: ohlc.high, low: ohlc.low, close: ohlc.close };
  });
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

/** Nearest preceding 1m (or rolled) quote FX bar, or undefined if older than maxAge. */
export const QUOTE_FX_MAX_AGE_SEC = 5 * 60;

export function getQuoteFxBar(
  fx: ChartBar[],
  timestampSec: number,
  maxAgeSec = QUOTE_FX_MAX_AGE_SEC,
): ChartBar | undefined {
  if (fx.length === 0 || !(timestampSec > 0)) return undefined;
  if (timestampSec < fx[0]!.time) return undefined;
  const bar = quoteFxAt(fx, timestampSec);
  if (!bar || !(bar.close > 0) || bar.time > timestampSec) return undefined;
  if (maxAgeSec > 0 && timestampSec - bar.time > maxAgeSec) return undefined;
  return bar;
}

/** True when quote FX has a real range (ETH / wStock). USDG ~$1 is still marked, just tiny. */
export function isVolatileQuoteFx(fx: ChartBar[]): boolean {
  let min = Infinity;
  let max = -Infinity;
  for (const bar of fx) {
    if (isWhitespaceBar(bar) || !(bar.close > 0)) continue;
    max = Math.max(max, bar.high > 0 ? bar.high : bar.close);
    min = Math.min(min, bar.low > 0 ? bar.low : bar.close);
  }
  if (!(min > 0) || !(max > 0)) return false;
  const mid = (min + max) / 2;
  const span = (max - min) / mid;
  if (Math.abs(mid - 1) <= 0.02 && span < 0.015) return false;
  return span > 0.0003;
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

/** Each real bar opens at the previous real close so gaps do not become isolated spikes. */
export function linkBarOpens(bars: ChartBar[], _bucketSec?: number): ChartBar[] {
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

function lastRealIndex(bars: ChartBar[]): number {
  for (let i = bars.length - 1; i >= 0; i--) {
    if (!isWhitespaceBar(bars[i]!) && bars[i]!.close > 0) return i;
  }
  return -1;
}

function prevRealClose(bars: ChartBar[], before: number): number | undefined {
  for (let i = before - 1; i >= 0; i--) {
    if (!isWhitespaceBar(bars[i]!) && bars[i]!.close > 0) return bars[i]!.close;
  }
  return undefined;
}

function liveConnectedBar(bar: ChartBar, open: number, live: number): ChartBar {
  const high = Math.max(bar.high || 0, open, live, bar.open || 0);
  const lowBase = bar.low > 0 ? bar.low : Math.min(open, live);
  return {
    ...bar,
    open,
    high,
    low: Math.min(lowBase, open, live),
    close: live,
  };
}

/**
 * Live FDV belongs on the current bar only. The trailing quiet plateau stays at
 * the last trade close so a drop from 5.13k to 5.07k is one red candle, not a
 * dashed line that jumps the whole tape.
 */
export function pinLiveMcap(bars: ChartBar[], liveMcap?: number): ChartBar[] {
  if (!(liveMcap && liveMcap > 0) || bars.length === 0) return bars;
  const lastIdx = lastRealIndex(bars);
  if (lastIdx < 0) return bars;
  const last = bars[lastIdx]!;
  const open = prevRealClose(bars, lastIdx) ?? last.open;
  const next = bars.map((b) => ({ ...b }));
  next[lastIdx] = liveConnectedBar(last, open, liveMcap);
  return next;
}

/**
 * First print on a one-trade tape (Hooktest): open at launch / curve start so a
 * lone $40 buy is a tall green candle instead of a flat dash.
 */
export function openFirstTradeFromLaunch(
  bars: ChartBar[],
  launchMcap?: number,
  firstSide?: "buy" | "sell",
): ChartBar[] {
  if (bars.length === 0) return bars;
  let firstIdx = bars.findIndex((b) => isTradedBar(b));
  if (firstIdx < 0) firstIdx = bars.findIndex((b) => !isWhitespaceBar(b) && b.close > 0);
  if (firstIdx < 0) return bars;
  const first = bars[firstIdx]!;
  if (!(first.close > 0) || first.open !== first.close) return bars;

  const close = first.close;
  const side =
    firstSide ??
    (launchMcap && launchMcap > 0 && launchMcap < close
      ? "buy"
      : launchMcap && launchMcap > close
        ? "sell"
        : undefined);

  let open = 0;
  if (launchMcap && launchMcap > 0) {
    const rel = Math.abs(launchMcap - close) / close;
    if (rel > FDV_STEP_EPS) {
      if (side === "buy" && launchMcap < close) open = launchMcap;
      else if (side === "sell" && launchMcap > close) open = launchMcap;
      else if (!side) open = launchMcap;
    }
  }
  const singlePrint = bars.filter((b) => isTradedBar(b)).length <= 1;
  if (!(open > 0) && singlePrint && side === "buy") {
    const inferred = first.volume > 0 && first.volume < close ? close - first.volume : close * 0.35;
    open = inferred > 0 && inferred < close ? inferred : close * 0.35;
  } else if (!(open > 0) && singlePrint && side === "sell") {
    const inferred = first.volume > 0 ? close + first.volume : close / 0.65;
    open = inferred > close ? inferred : close / 0.65;
  }
  if (!(open > 0) || open === close) return bars;

  const next = bars.map((b) => ({ ...b }));
  next[firstIdx] = {
    ...first,
    open,
    high: Math.max(first.high, open, close),
    low: Math.min(first.low > 0 ? first.low : Math.min(open, close), open, close),
    close,
  };
  return next;
}

export const VOLUME_UP = "rgba(16, 185, 129, 0.5)";
export const VOLUME_DOWN = "rgba(239, 68, 68, 0.5)";

export function volumeHistogramData(
  bars: ChartBar[],
): Array<{ time: number; value: number; color: string }> {
  return bars.map((bar) => ({
    time: bar.time,
    value: isWhitespaceBar(bar) || !(bar.volume > 0) ? 0 : bar.volume,
    color: bar.close >= bar.open ? VOLUME_UP : VOLUME_DOWN,
  }));
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
/** Room for the last-value tag after the last candle. */
export const CHART_RIGHT_OFFSET = 8;
/** Adjacent dojis at this pitch visually join into a flat staircase step. */
export const CHART_BAR_SPACING = 9;
export const CHART_MIN_BAR_SPACING = 0.5;
/** Lightweight Charts price precision for micro-caps ($0.0000000816). */
export const CHART_PRICE_DECIMALS = 9;
export const CHART_PRICE_MIN_MOVE = 1e-9;
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
export function chartWindowBars(bucketSec?: number, _launchedAt?: number, _nowSec?: number): number {
  if (bucketSec === 60) return 360;
  if (bucketSec === 300) return 120;
  return CHART_WINDOW_BARS;
}

/**
 * Defined Codex "auto" range: last 72 slots at TradingView pitch, or zoom in
 * when the visible window only has a handful of prints (fat 1h/5m candles).
 * Pass the first real index inside the last 72 so a quiet 5m does not stay
 * squeezed at 10px — scroll left for earlier session.
 */
export function chartFitWindowBars(
  tapeLength: number,
  anchorIndex = 0,
  maxWindow = CHART_WINDOW_BARS,
): number {
  if (tapeLength <= 0) return maxWindow;
  const idx = Math.min(Math.max(anchorIndex, 0), tapeLength - 1);
  const fromFirst = tapeLength - idx;
  const padded = Math.max(CHART_MIN_VISIBLE_BARS, fromFirst + CHART_FIT_PAD_BARS);
  return Math.min(padded, Math.max(maxWindow, 1));
}

/** First real candle to pin Defined auto-zoom. Sparse 15m/5m tapes zoom to the
 * latest prints instead of squeezing the whole session into 1px specks. */
export function chartFitFirstRealIndex(bars: ChartBar[], windowBars = CHART_WINDOW_BARS): number {
  if (bars.length === 0) return 0;
  const last = bars.length - 1;
  const traded: number[] = [];
  for (let i = 0; i <= last; i++) {
    if (!isWhitespaceBar(bars[i]!) && bars[i]!.volume > 0) traded.push(i);
  }
  if (traded.length > 0 && traded.length <= 16) return traded[0]!;
  const start = Math.max(0, last - Math.max(windowBars, 1) + 1);
  let reals = 0;
  let first = -1;
  let lastReal = -1;
  for (let i = start; i <= last; i++) {
    if (isWhitespaceBar(bars[i]!)) continue;
    if (first < 0) first = i;
    lastReal = i;
    reals++;
  }
  if (lastReal < 0) return start;
  if (reals <= 6) return traded[traded.length - 1] ?? lastReal;
  return first;
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
    if (!bar || !isCandleBar(bar) || !(bar.high > 0) || !(bar.low > 0)) continue;
    ath = Math.max(ath, bar.high);
    atl = Math.min(atl, bar.low);
  }
  if (!(ath > 0) || !(atl > 0)) return null;
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
  anchorIndex?: number,
): { from: number; to: number; barSpacing: number } | null {
  if (barCount <= 0) return null;
  const width = Math.max(paneWidthPx, CHART_BAR_SPACING * 12);
  const barSpacing = CHART_BAR_SPACING;
  void windowBars;
  const visible = Math.max(Math.floor(width / barSpacing), 12);
  const pin =
    anchorIndex != null ? Math.min(Math.max(anchorIndex, 0), barCount - 1) : barCount - 1;
  const to = pin + rightOffset + 0.5;
  return { from: to - visible, to, barSpacing };
}

/** TradingView pane: 20% headroom so micro-moves do not crush against the rails. */
export const CHART_SCALE_MARGIN_TOP = 0.2;
export const CHART_SCALE_MARGIN_BOTTOM = 0.2;
export const CHART_VOLUME_MARGIN_TOP = 0.8;
export const CHART_VOLUME_SMA_PERIOD = 20;

export interface SmaPoint {
  time: number;
  value: number;
}

/** TradingView default Volume SMA (period 20) for the Defined overlay. */
export function calculateVolumeSma(
  bars: Array<{ time: number; volume: number }>,
  period = CHART_VOLUME_SMA_PERIOD,
): SmaPoint[] {
  if (period <= 0 || bars.length === 0) return [];
  const result: SmaPoint[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i]!.volume;
    if (i >= period) sum -= bars[i - period]!.volume;
    const count = Math.min(i + 1, period);
    const avg = sum / count;
    result.push({
      time: bars[i]!.time,
      value: Number(avg.toFixed(2)),
    });
  }
  return result;
}

export function volumeSma(
  bars: ChartBar[],
  period = CHART_VOLUME_SMA_PERIOD,
): SmaPoint[] {
  return calculateVolumeSma(bars, period);
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
  const pad = span > 0 ? span * 0.18 : mid * 0.04;
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
  const firstBucket = Math.floor(sorted[0]!.time / bucketSec) * bucketSec;
  const bucketsFromFirst = Math.floor((end - firstBucket) / bucketSec) + 1;
  // Young tokens: don't stretch pre-launch empties across hours — keep a tight tape.
  let start =
    bucketsFromFirst <= CHART_MIN_VISIBLE_BARS && firstBucket > minStart
      ? Math.max(minStart, firstBucket - CHART_FIT_PAD_BARS * bucketSec)
      : Math.min(firstBucket, minStart);
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
  const lastIdx = lastRealIndex(bars);
  const last = lastIdx >= 0 ? bars[lastIdx] : undefined;
  const live = liveValue && liveValue > 0 ? liveValue : last?.close;
  if (!(live && live > 0)) return bars;

  if (last && last.time === cur) {
    const open = prevRealClose(bars, lastIdx) ?? last.open;
    const next = bars.map((b) => ({ ...b }));
    next[lastIdx] = liveConnectedBar(last, open, live);
    return next;
  }

  const open = last?.close && last.close > 0 ? last.close : live;
  return [
    ...bars,
    {
      time: cur,
      open,
      high: Math.max(open, live),
      low: Math.min(open, live),
      close: live,
      volume: 0,
    },
  ].sort((a, b) => a.time - b.time);
}

/**
 * Carry the last close across empty time buckets so a few swaps still draw a
 * full tape (DexScreener / Defined style) instead of one lonely spike.
 */
function quotePriceInQuote(bar: ChartBar, fx: ChartBar[], maxAgeSec: number): number {
  const q = getQuoteFxBar(fx, bar.time, maxAgeSec);
  if (!q || !(q.close > 0) || !(bar.close > 0)) return 0;
  return bar.close / q.close;
}

function markQuietBarFromQuoteFx(
  time: number,
  lastPriceInQuote: number,
  fxBar: ChartBar,
): ChartBar {
  const open = lastPriceInQuote * fxBar.open;
  const close = lastPriceInQuote * fxBar.close;
  const highRaw = fxBar.high > 0 ? fxBar.high : Math.max(fxBar.open, fxBar.close);
  const lowRaw = fxBar.low > 0 ? fxBar.low : Math.min(fxBar.open, fxBar.close);
  return {
    time,
    open,
    high: lastPriceInQuote * highRaw,
    low: lastPriceInQuote * lowRaw,
    close,
    volume: 0,
  };
}

export function fillEmptyBars(
  bars: ChartBar[],
  bucketSec: number,
  nowSec?: number,
  maxBars = 2_000,
  fx?: ChartBar[],
): ChartBar[] {
  if (bars.length === 0 || !(bucketSec > 0)) return bars;
  const sorted = mergeBars(
    [...bars]
      .filter((b) => !isWhitespaceBar(b) && b.close > 0 && b.time > 0)
      .map((b) => ({ ...b, time: Math.floor(b.time / bucketSec) * bucketSec, whitespace: false }))
      .sort((a, b) => a.time - b.time),
  );
  if (sorted.length === 0) return [];
  const last = sorted[sorted.length - 1]!;
  const end = Math.floor((nowSec && nowSec > last.time ? nowSec : last.time) / bucketSec) * bucketSec;
  const span = Math.floor((end - sorted[0]!.time) / bucketSec) + 1;
  const start =
    span > maxBars ? end - (Math.max(maxBars, 1) - 1) * bucketSec : sorted[0]!.time;
  const byTime = new Map(sorted.map((bar) => [bar.time, bar]));
  const quoteFx = fx && fx.length > 0 ? fx : undefined;
  const fxMaxAge = Math.max(QUOTE_FX_MAX_AGE_SEC, bucketSec);
  const out: ChartBar[] = [];
  let prev = sorted.find((bar) => bar.time <= start) ?? sorted[0]!;
  let lastPriceInQuote = quoteFx ? quotePriceInQuote(prev, quoteFx, fxMaxAge) : 0;
  for (let time = start; time <= end; time += bucketSec) {
    const real = byTime.get(time);
    if (real) {
      out.push({ ...real });
      prev = real;
      if (quoteFx) {
        const px = quotePriceInQuote(real, quoteFx, fxMaxAge);
        if (px > 0) lastPriceInQuote = px;
      }
      continue;
    }
    const fxBar = quoteFx && lastPriceInQuote > 0 ? getQuoteFxBar(quoteFx, time, fxMaxAge) : undefined;
    if (fxBar) {
      const marked = markQuietBarFromQuoteFx(time, lastPriceInQuote, fxBar);
      out.push(marked);
      prev = marked;
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
 * Gapless staircase: one bar for every bucket from the first print to now.
 * Quiet buckets mark to quote FX (ETH, wStock, or USDG 1m USD). A perfect $1
 * peg still draws a doji; any USDG high/low becomes a micro-wick.
 */
export function forwardFillContinuous(
  bars: ChartBar[],
  bucketSec: number,
  nowSec?: number,
  fx?: ChartBar[],
): ChartBar[] {
  return fillEmptyBars(bars, bucketSec, nowSec, 2_000, fx);
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

/** AllonSol-style last-candle clock: `22:19:00 UTC`. */
export function formatLastCandleUtc(ts: number): string {
  if (!(ts > 0) || !Number.isFinite(ts)) return "";
  const d = new Date(ts * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} UTC`;
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

/** Refit only when buckets appear/disappear — not when live FDV drifts on the last bar. */
export function chartStructureSignature(bars: ChartBar[], interval?: ChartInterval, windowBars?: number): string {
  const slots = bars.map((b) => `${b.time}:${b.whitespace ? "w" : "f"}:${isTradedBar(b) ? "t" : "c"}`).join("|");
  return `${interval ?? ""}:${windowBars ?? ""}:${slots}`;
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
