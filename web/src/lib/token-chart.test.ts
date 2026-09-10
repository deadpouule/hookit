import assert from "node:assert/strict";
import test from "node:test";

import { aggregateBars, barsForInterval, liveCandlesToBars } from "./token-chart";
import type { LiveCandle } from "./token-live";

test("liveCandlesToBars fills missing timestamps backwards from now", () => {
  const candles: LiveCandle[] = [
    { o: 100, h: 110, l: 90, c: 105 },
    { o: 105, h: 120, l: 100, c: 118 },
  ];
  const bars = liveCandlesToBars(candles, 1_700_000_600);
  assert.equal(bars.length, 2);
  assert.equal(bars[0]!.time, 1_700_000_300);
  assert.equal(bars[1]!.time, 1_700_000_600);
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

test("barsForInterval ALL keeps 5m buckets", () => {
  const bars = [
    { time: 0, open: 1, high: 1, low: 1, close: 1, volume: 0 },
    { time: 300, open: 1, high: 2, low: 1, close: 2, volume: 0 },
  ];
  assert.equal(barsForInterval(bars, "ALL").length, 2);
  assert.equal(barsForInterval(bars, "1h").length, 1);
});
