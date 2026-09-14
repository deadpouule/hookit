import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateBars,
  barChangePct,
  barsForInterval,
  CHART_BAR_SPACING,
  CHART_RIGHT_OFFSET,
  chartPriceBand,
  chartVisibleLogicalRange,
  fillEmptyBars,
  formatChartAxis,
  formatChartUsd,
  liveCandlesToBars,
  chartHudBar,
  isSyntheticBar,
  pickChartBars,
  pinLiveMcap,
  priceBarsToMcap,
  scaleBars,
  seedLaunchBars,
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

test("liveCandlesToBars keeps the indexer close (live mcap is pinned later)", () => {
  const candles: LiveCandle[] = [{ t: 1_000, o: 10, h: 12, l: 9, c: 11, v: 50 }];
  const [bar] = liveCandlesToBars(candles, 1_000, 15);
  assert.equal(bar!.close, 11);
  assert.equal(bar!.high, 12);
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

test("pickChartBars does not splice Gecko onto a house tape", () => {
  const indexer = [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 0 }];
  const gecko = Array.from({ length: 8 }, (_, i) => ({
    time: i,
    open: 2,
    high: 2,
    low: 2,
    close: 2,
    volume: 1,
  }));
  const fromGecko = pickChartBars(indexer, gecko, "5m");
  assert.equal(fromGecko.length, 8);
  assert.ok(fromGecko.every((b) => b.close === 2));
  assert.equal(pickChartBars([], gecko, "ALL")[0]!.close, 2);
  const houseTape = Array.from({ length: 12 }, (_, i) => ({
    time: i,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 0,
  }));
  const houseOnly = pickChartBars(houseTape, gecko, "5m");
  assert.equal(houseOnly.length, 12);
  assert.ok(houseOnly.every((b) => b.close === 1));
});

test("pinLiveMcap pins the last real bar and carries synthetics", () => {
  const bars = [
    { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 4 },
    { time: 2, open: 11, high: 11, low: 11, close: 11, volume: 0 },
    { time: 3, open: 11, high: 11, low: 11, close: 11, volume: 0 },
  ];
  assert.equal(isSyntheticBar(bars[1]!), true);
  const pinned = pinLiveMcap(bars, 15);
  assert.equal(pinned[0]!.close, 15);
  assert.equal(pinned[0]!.high, 15);
  assert.equal(pinned[1]!.close, 15);
  assert.equal(pinned[1]!.volume, 0);
  assert.equal(pinned[2]!.close, 15);
});

test("chartHudBar prefers the last traded bar over a trailing fill", () => {
  const bars = [
    { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 40 },
    { time: 2, open: 11, high: 11, low: 11, close: 11, volume: 0 },
  ];
  assert.equal(chartHudBar(bars, null)?.volume, 40);
  assert.equal(chartHudBar(bars, bars[1]!)?.time, 2);
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

test("fillEmptyBars carries the last close across empty buckets", () => {
  const filled = fillEmptyBars(
    [
      { time: 960, open: 10, high: 11, low: 9, close: 12, volume: 4 },
      { time: 1_140, open: 12, high: 13, low: 11, close: 12.5, volume: 2 },
    ],
    60,
    1_260,
  );
  assert.equal(filled.length, 6);
  assert.equal(filled[1]!.time, 1_020);
  assert.equal(filled[1]!.close, 12);
  assert.equal(filled[1]!.volume, 0);
  assert.equal(filled[3]!.time, 1_140);
  assert.equal(filled[3]!.close, 12.5);
  assert.equal(filled[5]!.time, 1_260);
  assert.equal(filled[5]!.close, 12.5);
});

test("a single print grows into a tape up to now", () => {
  const seed = seedLaunchBars(1_700_000_000, 5_000);
  const filled = fillEmptyBars(seed, 900, 1_700_003_600);
  assert.ok(filled.length >= 4);
  assert.equal(filled[0]!.close, 5_000);
  assert.equal(filled[filled.length - 1]!.time, 1_700_002_800);
  assert.equal(filled[filled.length - 1]!.close, 5_000);
});

test("candles pin to the right axis at a fixed 9px pitch", () => {
  const one = chartVisibleLogicalRange(1, 720);
  assert.ok(one);
  assert.equal(one.to, 0 + CHART_RIGHT_OFFSET + 0.5);
  assert.equal(one.to - one.from, 80);
  assert.equal((one.to - one.from) * CHART_BAR_SPACING, 720);
  const many = chartVisibleLogicalRange(120, 720);
  assert.ok(many);
  assert.equal(many.to, 119 + CHART_RIGHT_OFFSET + 0.5);
  assert.equal(many.to - many.from, 80);
  assert.equal(chartVisibleLogicalRange(0), null);
});

test("chartPriceBand pads a live range and a flat print without empty headroom", () => {
  const band = chartPriceBand(100, 120);
  assert.ok(band);
  assert.equal(band.minValue, 97.6);
  assert.equal(band.maxValue, 123.2);
  const flat = chartPriceBand(0.000003, 0.000003);
  assert.ok(flat);
  assert.ok(flat.minValue < 0.000003);
  assert.ok(flat.maxValue > 0.000003);
  assert.equal(chartPriceBand(0, 0), null);
});

test("formatChartAxis uses TradingView subscript zeros for price", () => {
  assert.equal(formatChartAxis(0.00000308, "price"), "0.0₅30800");
  assert.equal(formatChartAxis(0.00000309, "price"), "0.0₅30900");
  assert.equal(formatChartAxis(0.0234, "price"), "0.0234");
  assert.equal(formatChartAxis(2.5, "price"), "2.5");
  assert.equal(formatChartAxis(12_500, "mcap"), "$12.50K");
  assert.equal(formatChartAxis(0, "price"), "");
});

test("formatChartUsd uses compact USD for mcap and subscript price", () => {
  assert.equal(formatChartUsd(12_500, "mcap"), "$12.50K");
  assert.equal(formatChartUsd(0.0001234, "price"), "0.0₃12340");
  assert.equal(formatChartUsd(0.000003001, "price"), "0.0₅30010");
});

test("barChangePct is the candle open-to-close move", () => {
  assert.equal(
    barChangePct({ time: 1, open: 100, high: 110, low: 90, close: 103.49, volume: 1 }).toFixed(2),
    "3.49",
  );
});
