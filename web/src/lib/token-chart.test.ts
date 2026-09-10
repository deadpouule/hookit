import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateBars,
  barsForInterval,
  fillEmptyBars,
  formatChartUsd,
  liveCandlesToBars,
  pickChartBars,
  priceBarsToMcap,
  scaleBars,
  ticksToBars,
} from "./token-chart";
import { TOTAL_SUPPLY } from "./token-live";
import type { LiveCandle } from "./token-live";

test("liveCandlesToBars drops untimed placeholder candles", () => {
  const candles: LiveCandle[] = [
    { o: 100, h: 110, l: 90, c: 105 },
    { o: 105, h: 120, l: 100, c: 118 },
  ];
  assert.equal(liveCandlesToBars(candles, 1_700_000_600).length, 0);
});

test("liveCandlesToBars keeps timed indexer candles", () => {
  const candles: LiveCandle[] = [
    { t: 1_700_000_300, o: 100, h: 110, l: 90, c: 105 },
    { t: 1_700_000_600, o: 105, h: 120, l: 100, c: 118 },
  ];
  const bars = liveCandlesToBars(candles, 1_700_000_600);
  assert.equal(bars.length, 2);
  assert.equal(bars[0]!.time, 1_700_000_300);
  assert.equal(bars[1]!.close, 118);
});

test("liveCandlesToBars pins the last close to live market cap", () => {
  const candles: LiveCandle[] = [{ t: 1_000, o: 10, h: 12, l: 9, c: 11, v: 50 }];
  const [bar] = liveCandlesToBars(candles, 1_000, 15);
  assert.equal(bar!.close, 15);
  assert.equal(bar!.high, 15);
  assert.equal(bar!.volume, 50);
});

test("aggregateBars rolls 5m into 1h OHLC + volume", () => {
  const bars = [
    { time: 0, open: 10, high: 11, low: 9, close: 10.5, volume: 1 },
    { time: 300, open: 10.5, high: 14, low: 10, close: 13, volume: 2 },
    { time: 3_600, open: 13, high: 13.2, low: 12, close: 12.5, volume: 4 },
  ];
  const hourly = aggregateBars(bars, 3_600);
  assert.equal(hourly.length, 2);
  assert.equal(hourly[0]!.time, 0);
  assert.equal(hourly[0]!.open, 10);
  assert.equal(hourly[0]!.high, 14);
  assert.equal(hourly[0]!.low, 9);
  assert.equal(hourly[0]!.close, 13);
  assert.equal(hourly[0]!.volume, 3);
  assert.equal(hourly[1]!.time, 3_600);
  assert.equal(hourly[1]!.volume, 4);
});

test("barsForInterval ALL keeps native buckets", () => {
  const bars = [
    { time: 0, open: 1, high: 1, low: 1, close: 1, volume: 0 },
    { time: 300, open: 1, high: 2, low: 1, close: 2, volume: 0 },
  ];
  assert.equal(barsForInterval(bars, "ALL").length, 2);
  assert.equal(barsForInterval(bars, "1h").length, 1);
});

test("barsForInterval rolls 5m into 15m and 4h", () => {
  const bars = [0, 300, 600, 900, 1_200].map((time, i) => ({
    time,
    open: i,
    high: i + 1,
    low: i,
    close: i + 0.5,
    volume: 1,
  }));
  const fifteen = barsForInterval(bars, "15m");
  assert.equal(fifteen.length, 2);
  assert.equal(fifteen[0]!.time, 0);
  assert.equal(fifteen[0]!.volume, 3);
  assert.equal(fifteen[1]!.time, 900);
  assert.equal(barsForInterval(bars, "4h").length, 1);
});

test("scaleBars converts market cap to per-token price", () => {
  const bars = [{ time: 1, open: TOTAL_SUPPLY, high: TOTAL_SUPPLY, low: TOTAL_SUPPLY, close: TOTAL_SUPPLY, volume: 9 }];
  const priced = scaleBars(bars, "price");
  assert.equal(priced[0]!.close, 1);
  assert.equal(priced[0]!.volume, 9);
  assert.equal(scaleBars(bars, "mcap")[0]!.close, TOTAL_SUPPLY);
});

test("priceBarsToMcap converts GeckoTerminal USD price into FDV", () => {
  const bars = [{ time: 1, open: 0.002, high: 0.003, low: 0.001, close: 0.002, volume: 50 }];
  const mcap = priceBarsToMcap(bars);
  assert.equal(mcap[0]!.close, 0.002 * TOTAL_SUPPLY);
  assert.equal(mcap[0]!.volume, 50);
});

test("pickChartBars prefers house swap series over GeckoTerminal", () => {
  const indexer = [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 0 }];
  const gecko = Array.from({ length: 8 }, (_, i) => ({
    time: i,
    open: 2,
    high: 2,
    low: 2,
    close: 2,
    volume: 1,
  }));
  assert.equal(pickChartBars(indexer, gecko, "5m")[0]!.close, 1);
  assert.equal(pickChartBars([], gecko, "ALL")[0]!.close, 2);
});

test("ticksToBars buckets swaps into 1m OHLC", () => {
  const bars = ticksToBars(
    [
      { t: 1_000, price: 10, volume: 1 },
      { t: 1_010, price: 14, volume: 2 },
      { t: 1_080, price: 12, volume: 1 },
    ],
    60,
  );
  assert.equal(bars.length, 2);
  assert.equal(bars[0]!.time, 960);
  assert.equal(bars[0]!.open, 10);
  assert.equal(bars[0]!.high, 14);
  assert.equal(bars[0]!.close, 14);
  assert.equal(bars[0]!.volume, 3);
  assert.equal(bars[1]!.time, 1_080);
});

test("fillEmptyBars forward-fills like Sentry empty minutes", () => {
  const filled = fillEmptyBars(
    [{ time: 1_000, open: 10, high: 11, low: 9, close: 12, volume: 4 }],
    60,
    1_180,
  );
  assert.equal(filled.length, 4);
  assert.equal(filled[0]!.time, 960);
  assert.equal(filled[0]!.close, 12);
  assert.equal(filled[1]!.volume, 0);
  assert.equal(filled[1]!.close, 12);
  assert.equal(filled[3]!.time, 1_140);
});

test("formatChartUsd uses compact USD for mcap and extra decimals for price", () => {
  assert.equal(formatChartUsd(12_500, "mcap"), "$12.50K");
  assert.equal(formatChartUsd(0.0001234, "price"), "$0.000123");
});
