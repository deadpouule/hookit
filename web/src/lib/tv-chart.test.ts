import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTvPrice,
  intervalToTvResolution,
  tvBarsInRange,
  tvInitialTimeframe,
  tvResolutionSeconds,
  tvResolutionToInterval,
  tvSymbolInfo,
  TV_RESOLUTIONS,
} from "./tv-chart";

test("TradingView resolutions mirror the Tsunami desk (1 5 15 60 1D)", () => {
  assert.deepEqual([...TV_RESOLUTIONS], ["1", "5", "15", "60", "1D"]);
  assert.equal(tvResolutionToInterval("1"), "1m");
  assert.equal(tvResolutionToInterval("5"), "5m");
  assert.equal(tvResolutionToInterval("15"), "15m");
  assert.equal(tvResolutionToInterval("60"), "1h");
  assert.equal(tvResolutionToInterval("1D"), "1D");
  assert.equal(tvResolutionToInterval("junk"), "5m");
  assert.equal(intervalToTvResolution("ALL"), "1");
  assert.equal(intervalToTvResolution("4h"), "60");
  assert.equal(intervalToTvResolution("15m"), "15");
});

test("resolution seconds: minutes for intraday, a day for 1D, 5m fallback", () => {
  assert.equal(tvResolutionSeconds("1"), 60);
  assert.equal(tvResolutionSeconds("60"), 3600);
  assert.equal(tvResolutionSeconds("1D"), 86_400);
  assert.equal(tvResolutionSeconds("x"), 300);
});

test("opening window is 72 bars, clamped to token age with a 20 bar floor", () => {
  const now = 1_800_000_000;
  assert.deepEqual(tvInitialTimeframe("5", null, now), { from: now - 72 * 300, to: now });
  const young = tvInitialTimeframe("5", (now - 1_000) * 1000, now);
  assert.deepEqual(young, { from: now - 20 * 300, to: now });
  const midlife = tvInitialTimeframe("5", (now - 40 * 300) * 1000, now);
  assert.deepEqual(midlife, { from: now - 40 * 300, to: now });
  const old = tvInitialTimeframe("5", (now - 10_000 * 300) * 1000, now);
  assert.deepEqual(old, { from: now - 72 * 300, to: now });
});

test("price labels use subscript zero runs below a tenth of a cent", () => {
  assert.equal(formatTvPrice(0), "0");
  assert.equal(formatTvPrice(Number.NaN), "-");
  assert.equal(formatTvPrice(0.00085495), "0.0₃85495");
  assert.equal(formatTvPrice(0.0000000097800216), "0.0₈97800");
  assert.equal(formatTvPrice(-0.00051883), "-0.0₃51883");
  assert.equal(formatTvPrice(0.0010147), "0.0010147");
  assert.equal(formatTvPrice(845_460), "845,460");
  assert.equal(formatTvPrice(0.00099999), "0.0₃99999");
  assert.equal(formatTvPrice(0.000999999), "0.0₂10000");
});

test("getBars slice converts seconds to ms and respects [from, to)", () => {
  const bars = [
    { time: 100, open: 1, high: 2, low: 0.5, close: 1.5, volume: 3 },
    { time: 200, open: 1.5, high: 2, low: 1, close: 1.8, volume: 4 },
    { time: 300, open: 1.8, high: 2, low: 1, close: 1.9, volume: 5 },
  ];
  const out = tvBarsInRange(bars, 200, 300);
  assert.deepEqual(out, [{ time: 200_000, open: 1.5, high: 2, low: 1, close: 1.8, volume: 4 }]);
});

test("symbol info is a 24x7 Ink crypto stream with 1e12 pricescale", () => {
  const info = tvSymbolInfo("STS", "santos", "UTC");
  assert.equal(info.session, "24x7");
  assert.equal(info.exchange, "Ink");
  assert.equal(info.pricescale, 1e12);
  assert.equal(info.has_intraday, true);
  assert.equal(info.has_daily, false);
  assert.equal(info.data_status, "streaming");
  assert.deepEqual([...info.supported_resolutions], [...TV_RESOLUTIONS]);
});
