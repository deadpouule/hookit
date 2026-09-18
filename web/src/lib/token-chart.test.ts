import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeChartSeries,
  aggregateBars,
  applyTicksToBuckets,
  barChangePct,
  barsForInterval,
  buildContinuousOhlcv,
  calculateVolumeSma,
  carryQuoteFxBars,
  CHART_BAR_SPACING,
  CHART_MIN_BAR_SPACING,
  CHART_PRICE_DECIMALS,
  CHART_FIT_PAD_BARS,
  CHART_MIN_VISIBLE_BARS,
  CHART_PRICE_MIN_MOVE,
  CHART_RIGHT_OFFSET,
  CHART_SCALE_MARGIN_BOTTOM,
  CHART_SCALE_MARGIN_TOP,
  CHART_VOLUME_MARGIN_TOP,
  CHART_WINDOW_BARS,
  chartFitAnchorIndex,
  chartFitWindowBars,
  chartFitFirstRealIndex,
  chartPriceBand,
  chartSpanSec,
  candlePlotBar,
  candleSeriesData,
  chartRenderableCandle,
  carryFdvTape,
  definedFdvTape,
  flatFdvCandleOhlc,
  intervalBucketSec,
  linkBarOpens,
  repriceBarsWithQuoteFx,
  rollQuoteFxBars,
  chartVisibleLogicalRange,
  chartWindowBars,
  dropCarryForwardBars,
  visibleExtremes,
  visiblePriceBand,
  definedWhitespaceTape,
  ensureCurrentBar,
  fillEmptyBars,
  forwardFillContinuous,
  getQuoteFxBar,
  isVolatileQuoteFx,
  formatChartAxis,
  formatChartUsd,
  formatLastCandleUtc,
  liveCandlesToBars,
  chartHudBar,
  isSyntheticBar,
  isWhitespaceBar,
  pickChartBars,
  openFirstTradeFromLaunch,
  pinLiveMcap,
  priceBarsToMcap,
  scaleBars,
  seedLaunchBars,
  ticksToBars,
  tradesOnBars,
  visibleCandleOhlc,
  volumeHistogramData,
  volumeSma,
  VOLUME_DOWN,
  VOLUME_UP,
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

test("intervalBucketSec maps standard timeframes including D", () => {
  assert.equal(intervalBucketSec("1m"), 60);
  assert.equal(intervalBucketSec("5m"), 300);
  assert.equal(intervalBucketSec("15m"), 900);
  assert.equal(intervalBucketSec("1h"), 3_600);
  assert.equal(intervalBucketSec("4h"), 14_400);
  assert.equal(intervalBucketSec("D"), 86_400);
});

test("barsForInterval rolls 5m prints into a 1h candle", () => {
  const bars = [
    { time: 0, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    { time: 300, open: 1, high: 2, low: 1, close: 2, volume: 1 },
  ];
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

test("1m 5m 15m keep different bucket counts on a sparse tape", () => {
  const bars = [0, 60, 300, 600, 900].map((time, i) => ({
    time,
    open: 10 + i,
    high: 11 + i,
    low: 9 + i,
    close: 10.5 + i,
    volume: 1,
  }));
  assert.equal(barsForInterval(bars, "1m").length, 5);
  assert.equal(barsForInterval(bars, "5m").length, 4);
  assert.equal(barsForInterval(bars, "15m").length, 2);
  assert.notEqual(barsForInterval(bars, "1m").length, barsForInterval(bars, "5m").length);
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

test("pickChartBars keeps the house tape even when Gecko is denser", () => {
  const indexer = [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 0 }];
  const gecko = Array.from({ length: 8 }, (_, i) => ({
    time: i,
    open: 2,
    high: 2,
    low: 2,
    close: 2,
    volume: 1,
  }));
  const fromHouse = pickChartBars(indexer, gecko, "5m");
  assert.equal(fromHouse.length, 1);
  assert.equal(fromHouse[0]!.close, 1);
  assert.equal(pickChartBars([], gecko, "D")[0]!.close, 2);
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

test("pinLiveMcap only rewrites the current bar so the plateau stays at last trade", () => {
  const bars = [
    { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 4 },
    { time: 2, open: 11, high: 11, low: 11, close: 11, volume: 0 },
    { time: 3, open: 11, high: 11, low: 11, close: 11, volume: 0 },
  ];
  assert.equal(isSyntheticBar(bars[1]!), true);
  const pinned = pinLiveMcap(bars, 15);
  assert.equal(pinned[0]!.close, 11);
  assert.equal(pinned[1]!.close, 11);
  assert.equal(pinned[2]!.open, 11);
  assert.equal(pinned[2]!.close, 15);
  assert.equal(pinned[2]!.high, 15);
  assert.equal(pinned[2]!.low, 11);
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

test("dropCarryForwardBars keeps real prints and drops empty buckets", () => {
  const bars = [
    { time: 60, open: 10, high: 12, low: 9, close: 11, volume: 4 },
    { time: 120, open: 11, high: 11, low: 11, close: 11, volume: 0 },
    { time: 180, open: 11, high: 11, low: 11, close: 11, volume: 0 },
    { time: 240, open: 11, high: 13, low: 11, close: 13, volume: 2 },
  ];
  const real = dropCarryForwardBars(bars);
  assert.equal(real.length, 2);
  assert.equal(real[0]!.time, 60);
  assert.equal(real[1]!.time, 240);
  assert.equal(real[1]!.close, 13);
});

test("visibleCandleOhlc gives a single print a small body", () => {
  const doji = visibleCandleOhlc({ time: 1, open: 100, high: 100, low: 100, close: 100, volume: 1 });
  assert.ok(doji.high - doji.low > 0);
  assert.equal((doji.high - doji.low).toFixed(1), "0.6");
  const real = visibleCandleOhlc({ time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1 });
  assert.equal(real.open, 100);
  assert.equal(real.high, 110);
});

test("opening window is wider on 1m/5m so thin books keep their spikes", () => {
  assert.equal(chartWindowBars(60), 360);
  assert.equal(chartWindowBars(300), 120);
  assert.equal(chartWindowBars(900), CHART_WINDOW_BARS);
  assert.equal(chartWindowBars(), CHART_WINDOW_BARS);
});

test("candles keep a 9px pitch so adjacent dojis join into a step", () => {
  const fresh = chartVisibleLogicalRange(1, 364, CHART_WINDOW_BARS);
  assert.ok(fresh);
  assert.equal(fresh.to, 0 + CHART_RIGHT_OFFSET + 0.5);
  assert.equal(fresh.barSpacing, CHART_BAR_SPACING);
  assert.equal(fresh.to - fresh.from, Math.floor(364 / CHART_BAR_SPACING));
  const desk = chartVisibleLogicalRange(120, 1038, CHART_WINDOW_BARS);
  assert.ok(desk);
  assert.equal(desk.to, 119 + CHART_RIGHT_OFFSET + 0.5);
  assert.equal(desk.barSpacing, CHART_BAR_SPACING);
  assert.equal(chartVisibleLogicalRange(0), null);
});

test("chartPriceBand pads the visible range like TradingView auto-scale", () => {
  const band = chartPriceBand(100, 120);
  assert.ok(band);
  assert.equal(band!.minValue, 96.4);
  assert.equal(band!.maxValue, 123.6);
  const micro = chartPriceBand(0.0000051, 0.0000051235);
  assert.ok(micro);
  assert.ok(micro!.minValue < 0.0000051);
  assert.ok(micro!.maxValue > 0.0000051235);
  const flat = chartPriceBand(0.000003, 0.000003);
  assert.ok(flat);
  assert.ok(flat.minValue < 0.000003);
  assert.ok(flat.maxValue > 0.000003);
  assert.equal(chartPriceBand(0, 0), null);
});

test("flatFdvCandleOhlc is a natural doji with no invented 0.012% floor", () => {
  const dash = flatFdvCandleOhlc({ time: 1, open: 5000, high: 5000, low: 5000, close: 5000, volume: 0 });
  assert.equal(dash.open, 5000);
  assert.equal(dash.close, 5000);
  assert.equal(dash.high, 5000);
  assert.equal(dash.low, 5000);
});

test("chartRenderableCandle uses a true doji for flat FDV carry and real wicks for moves", () => {
  const carry = chartRenderableCandle(
    { time: 1, open: 5000, high: 5000, low: 5000, close: 5000, volume: 0 },
    5000,
  );
  assert.equal(carry.open, 5000);
  assert.equal(carry.high, 5000);
  assert.equal(carry.low, 5000);
  assert.equal(carry.close, 5000);
  const drift = chartRenderableCandle(
    { time: 2, open: 5000, high: 5200, low: 4900, close: 5100, volume: 0 },
    5000,
  );
  assert.equal(drift.open, 5000);
  assert.equal(drift.close, 5100);
  assert.equal(drift.high, 5200);
  assert.equal(drift.low, 4900);
  const traded = chartRenderableCandle(
    { time: 3, open: 5000, high: 5200, low: 4900, close: 5100, volume: 4 },
    5000,
  );
  assert.equal(traded.open, 5000);
  assert.equal(traded.close, 5100);
  assert.equal(traded.high, 5200);
  assert.equal(traded.low, 4900);
});

test("chartRenderableCandle uses a true doji for flat FDV maintenance without volume", () => {
  const maintain = chartRenderableCandle({ time: 3, open: 5300, high: 5300, low: 5300, close: 5300, volume: 0 });
  assert.equal(maintain.open, 5300);
  assert.equal(maintain.high, 5300);
  assert.equal(maintain.low, 5300);
  assert.equal(maintain.close, 5300);
});

test("chartRenderableCandle keeps a flat trade print as a real doji", () => {
  const trade = chartRenderableCandle({ time: 3, open: 5300, high: 5300, low: 5300, close: 5300, volume: 2 });
  assert.equal(trade.open, 5300);
  assert.equal(trade.high, 5300);
  assert.equal(trade.low, 5300);
  assert.equal(trade.close, 5300);
});

test("candlePlotBar prints every FDV bucket in time", () => {
  const carry = { time: 2, open: 5300, high: 5300, low: 5300, close: 5300, volume: 0 };
  const first = { time: 1, open: 5300, high: 5300, low: 5300, close: 5300, volume: 0 };
  assert.equal(candlePlotBar(carry), true);
  assert.equal(candlePlotBar(first), true);
});

test("candleSeriesData draws thin maintenance dashes across flat FDV carry", () => {
  const tape = [
    { time: 1, open: 5300, high: 5300, low: 5300, close: 5300, volume: 2 },
    { time: 2, open: 5300, high: 5300, low: 5300, close: 5300, volume: 0 },
    { time: 3, open: 5300, high: 5300, low: 5300, close: 5300, volume: 0 },
  ];
  const plotted = candleSeriesData(tape).filter((p) => p.open != null);
  assert.equal(plotted.length, 3);
  const carrySpan = (plotted[1]!.high ?? 0) - (plotted[1]!.low ?? 0);
  assert.equal(carrySpan, 0);
});

test("pinLiveMcap leaves earlier seed bars at last close and stretches only the live bar", () => {
  const bars = [
    { time: 1, open: 5300, high: 5300, low: 5300, close: 5300, volume: 0 },
    { time: 2, open: 5300, high: 5310, low: 5300, close: 5310, volume: 0 },
  ];
  const pinned = pinLiveMcap(bars, 5310);
  assert.equal(pinned[0]!.close, 5300);
  assert.equal(pinned[1]!.open, 5300);
  assert.equal(pinned[1]!.close, 5310);
});

test("in-progress buckets without volume keep a live open-to-close body", () => {
  const live = chartRenderableCandle({
    time: 2,
    open: 5224,
    high: 5320,
    low: 5224,
    close: 5320,
    volume: 0,
  });
  assert.equal(live.open, 5224);
  assert.equal(live.close, 5320);
  assert.equal(live.high, 5320);
  assert.equal(live.low, 5224);
  assert.ok(live.high > live.low);
});

test("carryFdvTape fills empty buckets with last FDV instead of whitespace", () => {
  const tape = [
    { time: 0, open: 10, high: 12, low: 9, close: 11, volume: 2 },
    { time: 60, open: 0, high: 0, low: 0, close: 0, volume: 0, whitespace: true },
    { time: 120, open: 0, high: 0, low: 0, close: 0, volume: 0, whitespace: true },
  ];
  const carried = carryFdvTape(tape);
  assert.equal(carried.length, 3);
  assert.equal(carried[1]!.close, 11);
  assert.equal(carried[1]!.volume, 0);
  assert.equal(carried[2]!.close, 11);
  assert.ok(!carried[1]!.whitespace);
});

test("definedFdvTape keeps pre-launch buckets empty", () => {
  const tape = definedFdvTape(
    [{ time: 300, open: 5, high: 6, low: 4, close: 5.5, volume: 1 }],
    300,
    900,
    4,
  );
  assert.equal(tape.length, 4);
  assert.equal(tape[0]!.whitespace, true);
  assert.equal(tape[3]!.close, 5.5);
  assert.equal(tape[2]!.close, 5.5);
  assert.equal(tape[2]!.volume, 0);
});

test("repriceBarsWithQuoteFx scales the bar's own OHLC by quote FX", () => {
  const liveQuoteUsd = 131;
  const lee = [{ time: 100, open: 5000, high: 5200, low: 4800, close: 5000, volume: 10 }];
  const fx = [{ time: 100, open: 142, high: 142, low: 128, close: 128, volume: 1 }];
  const marked = repriceBarsWithQuoteFx(lee, fx, liveQuoteUsd);
  const factor = 128 / 131;
  assert.equal(marked[0]!.open, 5000 * factor);
  assert.equal(marked[0]!.high, 5200 * factor);
  assert.equal(marked[0]!.low, 4800 * factor);
  assert.equal(marked[0]!.close, 5000 * factor);
});

test("linkBarOpens chains each print to the previous close", () => {
  const bars = [
    { time: 60, open: 10, high: 12, low: 9, close: 11, volume: 1 },
    { time: 120, open: 11, high: 11, low: 11, close: 11, volume: 1 },
  ];
  const linked = linkBarOpens(bars, 60);
  assert.equal(linked[1]!.open, 11);
  assert.equal(linked[1]!.high, 11);
  assert.equal(linked[1]!.low, 11);
});

test("linkBarOpens opens at the previous close across a time gap", () => {
  const bars = [
    { time: 60, open: 10, high: 12, low: 9, close: 11, volume: 1 },
    { time: 600, open: 20, high: 22, low: 19, close: 21, volume: 1 },
  ];
  const linked = linkBarOpens(bars);
  assert.equal(linked[1]!.open, 11);
  assert.equal(linked[1]!.high, 22);
  assert.equal(linked[1]!.low, 11);
  assert.equal(linked[1]!.close, 21);
});

test("carryQuoteFxBars rolls every printed FX bar without a 12-bar cap", () => {
  const bars = [{ time: 0, open: 1000, high: 1000, low: 1000, close: 1000, volume: 5 }];
  const fx = Array.from({ length: 20 }, (_, i) => ({
    time: i * 300,
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100 + i,
    volume: 1,
  }));
  const carried = carryQuoteFxBars(bars, fx, 100, 300, 19 * 300);
  assert.equal(carried.length, 20);
  assert.equal(carried[1]!.open, 1000);
  assert.equal(carried[19]!.open, carried[18]!.close);
});

test("chartVisibleLogicalRange pins to the last real bar not trailing whitespace", () => {
  const range = chartVisibleLogicalRange(100, 720, 16, CHART_RIGHT_OFFSET, 10);
  assert.ok(range);
  assert.equal(range.to, 10 + CHART_RIGHT_OFFSET + 0.5);
});

test("chartSpanSec uses launch time for the token lifetime", () => {
  const now = 1_700_014_400;
  const bars = [{ time: now - 600, open: 1, high: 1, low: 1, close: 1, volume: 1 }];
  const span = chartSpanSec(bars, now - 4 * 3_600, now);
  assert.equal(span, 4 * 3_600);
});

test("forwardFillContinuous writes a doji for every quiet 1m bucket", () => {
  const filled = forwardFillContinuous(
    [
      { time: 1_700_000_000, open: 10, high: 12, low: 9, close: 11, volume: 4 },
      { time: 1_700_000_600, open: 14, high: 15, low: 13, close: 14.5, volume: 2 },
    ],
    60,
    1_700_000_600,
  );
  assert.equal(filled.length, 11);
  assert.equal(filled[0]!.close, 11);
  for (let i = 1; i <= 9; i++) {
    assert.equal(filled[i]!.open, 11);
    assert.equal(filled[i]!.high, 11);
    assert.equal(filled[i]!.low, 11);
    assert.equal(filled[i]!.close, 11);
    assert.equal(filled[i]!.volume, 0);
  }
  const linked = linkBarOpens(filled);
  assert.equal(linked[10]!.open, 11);
  assert.equal(linked[10]!.close, 14.5);
  assert.equal(linked[10]!.low, 11);
});

test("micro-cap prices stay above 1e-9 and are not rounded to zero", () => {
  const px = 0.0000000816;
  const bars = [{ time: 60, open: px, high: px, low: px, close: px, volume: 1 }];
  const ohlc = chartRenderableCandle(bars[0]!);
  assert.equal(ohlc.close, px);
  assert.ok(ohlc.close > 0);
  assert.ok(ohlc.close > CHART_PRICE_MIN_MOVE);
  const band = chartPriceBand(px, px);
  assert.ok(band);
  assert.ok(band.minValue > 0);
  assert.ok(band.maxValue > px);
});

test("carryQuoteFxBars only marks buckets where quote FX printed", () => {
  const bars = [{ time: 0, open: 1000, high: 1000, low: 1000, close: 1000, volume: 5 }];
  const fx = [
    { time: 0, open: 100, high: 100, low: 100, close: 100, volume: 1 },
    { time: 300, open: 110, high: 115, low: 108, close: 112, volume: 2 },
    { time: 600, open: 112, high: 112, low: 112, close: 112, volume: 0 },
  ];
  const rolled = rollQuoteFxBars(fx, 300);
  const carried = carryQuoteFxBars(bars, rolled, 100, 300, 600);
  assert.equal(carried.length, 2);
  assert.equal(carried[1]!.time, 300);
  assert.equal(carried[1]!.open, 1000);
  assert.equal(carried[1]!.close, 1120);
  assert.ok(carried[1]!.high > carried[1]!.close);
});

test("chartFitAnchorIndex ignores whitespace and synthetic carry bars", () => {
  const bars = [
    { time: 0, open: 1, high: 1, low: 1, close: 1, volume: 1, whitespace: true },
    { time: 60, open: 2, high: 2, low: 2, close: 2, volume: 2 },
    { time: 120, open: 2, high: 2, low: 2, close: 2, volume: 0 },
    { time: 180, open: 0, high: 0, low: 0, close: 0, volume: 0, whitespace: true },
  ];
  assert.equal(chartFitAnchorIndex(bars), 1);
});

test("formatChartAxis uses TradingView subscript zeros for price", () => {
  assert.equal(formatChartAxis(0.00000308, "price"), "0.0₅30800");
  assert.equal(formatChartAxis(0.00000309, "price"), "0.0₅30900");
  assert.equal(formatChartAxis(0.0234, "price"), "0.0234");
  assert.equal(formatChartAxis(2.5, "price"), "2.5");
  assert.equal(formatChartAxis(12_500, "mcap"), "$12.50K");
  assert.equal(formatChartAxis(0, "price"), "");
});

test("formatLastCandleUtc prints the AllonSol last-candle clock", () => {
  assert.equal(formatLastCandleUtc(1_700_000_340), "22:19:00 UTC");
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

test("volumeSma is the TradingView 20-period overlay", () => {
  const bars = [10, 20, 30].map((volume, i) => ({
    time: i,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume,
  }));
  const sma = calculateVolumeSma(bars, 2);
  assert.equal(sma.length, 3);
  assert.equal(sma[0]!.value, 10);
  assert.equal(sma[1]!.value, 15);
  assert.equal(sma[2]!.value, 25);
  assert.deepEqual(volumeSma(bars, 2), sma);
});

test("tradesOnBars snaps swaps onto the candle they print in", () => {
  const bars = [
    { time: 600, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    { time: 900, open: 1, high: 1, low: 1, close: 1, volume: 1 },
  ];
  const marked = tradesOnBars(
    [
      { t: 610, side: "buy" },
      { t: 950, side: "sell" },
    ],
    bars,
  );
  assert.equal(marked.length, 2);
  assert.equal(marked[0]!.t, 600);
  assert.equal(marked[0]!.side, "buy");
  assert.equal(marked[1]!.t, 900);
  assert.equal(marked[1]!.side, "sell");
});

test("mergeChartSeries does not double count a trade present in both candles and swaps", () => {
  const candles = [{ time: 600, open: 100, high: 110, low: 95, close: 105, volume: 2.5 }];
  const swaps = [
    { time: 600, open: 105, high: 112, low: 105, close: 105, volume: 2.5 },
    { time: 660, open: 105, high: 108, low: 104, close: 108, volume: 1 },
  ];
  const merged = mergeChartSeries(candles, swaps);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]!.volume, 2.5);
  assert.equal(merged[0]!.high, 112);
  assert.equal(merged[0]!.low, 95);
  assert.equal(merged[0]!.close, 105);
  assert.equal(merged[1]!.volume, 1);
});

test("definedWhitespaceTape compacts young tokens instead of padding pre-launch hours", () => {
  const bucket = 300;
  const end = 1_789_586_100;
  const first = end - bucket;
  const tape = definedWhitespaceTape(
    [{ time: first, open: 5300, high: 5300, low: 5300, close: 5300, volume: 1 }],
    bucket,
    end,
  );
  assert.ok(tape.length < CHART_WINDOW_BARS);
  assert.ok(tape.length <= CHART_MIN_VISIBLE_BARS + CHART_FIT_PAD_BARS + 2);
  const trade = tape.find((bar) => !isWhitespaceBar(bar) && bar.volume > 0);
  assert.equal(trade?.close, 5300);
  assert.ok(tape.every((bar) => bar.time >= first - CHART_FIT_PAD_BARS * bucket));
});

test("definedWhitespaceTape stretches 72 Defined slots and keeps time gaps", () => {
  const bucket = 300;
  const end = 1_700_021_400;
  const first = end - 40 * bucket;
  const tape = definedWhitespaceTape(
    [
      { time: first, open: 10, high: 12, low: 9, close: 11, volume: 4 },
      { time: end, open: 11, high: 13, low: 10, close: 12, volume: 2 },
    ],
    bucket,
    end,
  );
  assert.equal(tape.length, CHART_WINDOW_BARS);
  assert.equal(tape[tape.length - 1]!.time, end);
  assert.equal(isWhitespaceBar(tape[tape.length - 1]!), false);
  const real = tape.filter((b) => !isWhitespaceBar(b));
  assert.equal(real.length, 2);
  const idx0 = tape.findIndex((b) => b.time === first);
  const idx1 = tape.findIndex((b) => b.time === end);
  assert.equal(idx1 - idx0, 40);
  assert.ok(tape.slice(idx0 + 1, idx1).every(isWhitespaceBar));
  assert.ok(isWhitespaceBar(tape[0]!));
});

test("definedWhitespaceTape does not pack hours-apart 5m prints as neighbors", () => {
  const bucket = 300;
  const t0 = 1_789_431_300;
  const t1 = t0 + 4 * 3600;
  const now = t1 + 15 * 60;
  const tape = definedWhitespaceTape(
    [
      { time: t0, open: 4810, high: 4810, low: 4810, close: 4810, volume: 1 },
      { time: t1, open: 4950, high: 4950, low: 4950, close: 4950, volume: 40 },
    ],
    bucket,
    now,
  );
  const a = tape.findIndex((b) => b.time === Math.floor(t0 / bucket) * bucket);
  const b = tape.findIndex((b) => b.time === Math.floor(t1 / bucket) * bucket);
  assert.ok(a >= 0 && b >= 0);
  assert.equal(b - a, (t1 - t0) / bucket);
  assert.ok(b - a > 1);
});

test("barsForInterval rolls sparse 5m prints into a 1h candle with a wick", () => {
  const bars = [
    { time: 0, open: 100, high: 100, low: 100, close: 100, volume: 1 },
    { time: 300, open: 102, high: 102, low: 102, close: 102, volume: 1 },
    { time: 1_200, open: 90, high: 90, low: 90, close: 90, volume: 2 },
  ];
  const hourly = barsForInterval(bars, "1h");
  assert.equal(hourly.length, 1);
  assert.equal(hourly[0]!.open, 100);
  assert.equal(hourly[0]!.high, 102);
  assert.equal(hourly[0]!.low, 90);
  assert.equal(hourly[0]!.close, 90);
  assert.equal(hourly[0]!.volume, 4);
});

test("applyTicksToBuckets opens a 1m slot instead of smearing onto the previous print", () => {
  const bars = [{ time: 600, open: 10, high: 10, low: 10, close: 10, volume: 1 }];
  const next = applyTicksToBuckets(bars, [{ t: 1_000, price: 12, volume: 2 }], 60);
  assert.equal(next.length, 2);
  assert.equal(next[0]!.time, 600);
  assert.equal(next[0]!.close, 10);
  assert.equal(next[1]!.time, 960);
  assert.equal(next[1]!.close, 12);
  assert.equal(next[1]!.volume, 2);
});

test("ensureCurrentBar draws the in-progress bucket from previous close to live", () => {
  const bars = [{ time: 1_700_000_040, open: 10, high: 11, low: 9, close: 10.5, volume: 4 }];
  const cur = ensureCurrentBar(bars, 60, 1_700_000_130, 12);
  assert.equal(cur.length, 2);
  assert.equal(cur[1]!.time, 1_700_000_100);
  assert.equal(cur[1]!.open, 10.5);
  assert.equal(cur[1]!.high, 12);
  assert.equal(cur[1]!.low, 10.5);
  assert.equal(cur[1]!.close, 12);
  assert.equal(cur[1]!.volume, 0);
});

test("ensureCurrentBar stretches a red live candle down to the current price", () => {
  const bars = [
    { time: 1_700_000_040, open: 5130, high: 5140, low: 5120, close: 5130, volume: 20 },
    { time: 1_700_000_100, open: 5130, high: 5130, low: 5130, close: 5130, volume: 0 },
  ];
  const cur = ensureCurrentBar(bars, 60, 1_700_000_130, 5070);
  assert.equal(cur.length, 2);
  assert.equal(cur[1]!.open, 5130);
  assert.equal(cur[1]!.close, 5070);
  assert.equal(cur[1]!.high, 5130);
  assert.equal(cur[1]!.low, 5070);
  const drawn = chartRenderableCandle(cur[1]!);
  assert.equal(drawn.open, 5130);
  assert.equal(drawn.close, 5070);
  assert.ok(drawn.high > drawn.low);
});

test("openFirstTradeFromLaunch turns a Hooktest single buy into a green candle", () => {
  const bars = [{ time: 60, open: 81.6, high: 81.6, low: 81.6, close: 81.6, volume: 40 }];
  const opened = openFirstTradeFromLaunch(bars, 40, "buy");
  assert.equal(opened[0]!.open, 40);
  assert.equal(opened[0]!.close, 81.6);
  assert.equal(opened[0]!.high, 81.6);
  assert.equal(opened[0]!.low, 40);
  const filled = forwardFillContinuous(opened, 60, 180);
  assert.equal(filled[0]!.open, 40);
  assert.equal(filled[0]!.close, 81.6);
  assert.ok(filled.slice(1).every((b) => b.open === 81.6 && b.close === 81.6 && b.volume === 0));
});

test("volumeHistogramData colors up and down bars for the overlay pane", () => {
  const data = volumeHistogramData([
    { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 4 },
    { time: 2, open: 11, high: 11, low: 10, close: 10, volume: 2 },
    { time: 3, open: 10, high: 10, low: 10, close: 10, volume: 0 },
  ]);
  assert.equal(data[0]!.value, 4);
  assert.equal(data[0]!.color, VOLUME_UP);
  assert.equal(data[1]!.value, 2);
  assert.equal(data[1]!.color, VOLUME_DOWN);
  assert.equal(data[2]!.value, 0);
});

test("Defined auto-fit keeps 5m at 72-bar pitch instead of squeezing the whole life", () => {
  const first = 0;
  const tapeLength = 156;
  assert.equal(chartFitWindowBars(tapeLength, first), CHART_WINDOW_BARS);
});

test("quiet 5m auto-fit zooms into the last print like Defined 1h", () => {
  const tape = Array.from({ length: 156 }, (_, i) => ({
    time: i,
    open: i === 155 ? 5 : 0,
    high: i === 155 ? 5 : 0,
    low: i === 155 ? 5 : 0,
    close: i === 155 ? 5 : 0,
    volume: i === 155 ? 2 : 0,
    whitespace: i !== 155,
  }));
  const first = chartFitFirstRealIndex(tape);
  assert.equal(first, 155);
  assert.equal(chartFitWindowBars(tape.length, first), CHART_MIN_VISIBLE_BARS);
});

test("visible Y-axis ignores off-screen history so a late doji fills the pane", () => {
  const morning = { time: 1, open: 1, high: 1, low: 1, close: 1, volume: 10 };
  const late = { time: 155, open: 5, high: 5, low: 5, close: 5, volume: 2 };
  const tape = Array.from({ length: 156 }, (_, i) =>
    i === 0 ? morning : i === 155 ? late : { time: i, open: 0, high: 0, low: 0, close: 0, volume: 0, whitespace: true as const },
  );
  const all = visibleExtremes(tape, 0, 155);
  assert.equal(all?.atl, 1);
  assert.equal(all?.ath, 5);
  const vis = visibleExtremes(tape, 84, 155);
  assert.equal(vis?.atl, 5);
  assert.equal(vis?.ath, 5);
  const band = visiblePriceBand(tape, 84, 155);
  assert.ok(band);
  assert.ok(band!.minValue < 5);
  assert.ok(band!.maxValue > 5);
});

test("quiet 15m auto-fit ignores morning empties and zooms the last prints", () => {
  const tape = Array.from({ length: 52 }, (_, i) => ({
    time: i,
    open: i === 0 || i === 51 ? 5 : 0,
    high: i === 0 || i === 51 ? 5 : 0,
    low: i === 0 || i === 51 ? 5 : 0,
    close: i === 0 || i === 51 ? 5 : 0,
    volume: i === 0 || i === 51 ? 2 : 0,
    whitespace: i !== 0 && i !== 51,
  }));
  const first = chartFitFirstRealIndex(tape);
  assert.equal(first, 0);
  assert.equal(chartFitWindowBars(tape.length, first), 52 + CHART_FIT_PAD_BARS);
});

test("Defined auto-fit zooms into two hourly prints instead of 72 empty hours", () => {
  const fitted = chartFitWindowBars(72, 59);
  assert.equal(fitted, 21);
  assert.ok(fitted < CHART_WINDOW_BARS);
});

test("1m auto-fit keeps Defined 72-bar pitch on a long tape", () => {
  assert.equal(chartFitWindowBars(780, 0), CHART_WINDOW_BARS);
});

test("buildContinuousOhlcv forward-fills empty 5m buckets as flat dojis", () => {
  const start = 1_700_000_100;
  const bars = buildContinuousOhlcv(
    [
      { timestamp: start + 30, priceUsd: 0.0000501, volumeUsd: 12.5 },
      { timestamp: start + 15 * 60 + 20, priceUsd: 0.0000497, volumeUsd: 8.2 },
    ],
    300,
    start,
    start + 15 * 60,
    0.0000498,
  );
  assert.equal(bars.length, 4);
  assert.equal(bars[0]!.time, start);
  assert.equal(bars[0]!.open, 0.0000501);
  assert.equal(bars[0]!.close, 0.0000501);
  assert.equal(bars[0]!.volume, 12.5);
  assert.equal(bars[1]!.time, start + 300);
  assert.equal(bars[1]!.open, 0.0000501);
  assert.equal(bars[1]!.high, 0.0000501);
  assert.equal(bars[1]!.low, 0.0000501);
  assert.equal(bars[1]!.close, 0.0000501);
  assert.equal(bars[1]!.volume, 0);
  assert.equal(bars[2]!.volume, 0);
  assert.equal(bars[2]!.close, 0.0000501);
  assert.equal(bars[3]!.time, start + 900);
  assert.equal(bars[3]!.open, 0.0000497);
  assert.equal(bars[3]!.low, 0.0000497);
  assert.equal(bars[3]!.close, 0.0000497);
  assert.equal(bars[3]!.volume, 8.2);
});

test("definedFdvTape then linkBarOpens builds an AllonSol staircase", () => {
  const bucket = 60;
  const t0 = 1_700_000_040;
  const tape = definedFdvTape(
    [
      { time: t0, open: 5_100, high: 5_120, low: 5_080, close: 5_100, volume: 12.5 },
      { time: t0 + 180, open: 4_970, high: 4_970, low: 4_950, close: 4_960, volume: 8.2 },
    ],
    bucket,
    t0 + 180,
    4,
  );
  const stair = linkBarOpens(tape, bucket);
  assert.ok(stair.length >= 4);
  const quiet = stair.filter((b) => b.volume === 0 && b.time > t0 && b.time < t0 + 180);
  assert.ok(quiet.length >= 2);
  assert.ok(quiet.every((b) => b.open === 5_100 && b.close === 5_100 && b.high === 5_100));
  const sell = stair.find((b) => b.time === t0 + 180);
  assert.equal(sell?.open, 5_100);
  assert.equal(sell?.close, 4_960);
  assert.equal(sell?.low, 4_950);
});

test("micro-cap price scale uses 9-decimal minMove and 20% pane margins", () => {
  assert.equal(CHART_PRICE_DECIMALS, 9);
  assert.equal(CHART_PRICE_MIN_MOVE, 1e-9);
  assert.equal(CHART_SCALE_MARGIN_TOP, 0.2);
  assert.equal(CHART_SCALE_MARGIN_BOTTOM, 0.2);
  assert.equal(CHART_VOLUME_MARGIN_TOP, 0.8);
  assert.equal(CHART_BAR_SPACING, 9);
  assert.equal(CHART_MIN_BAR_SPACING, 0.5);
  assert.equal(CHART_RIGHT_OFFSET, 8);
});

test("getQuoteFxBar returns the nearest preceding 1m bar within 5 minutes", () => {
  const fx = [
    { time: 1_700_000_040, open: 100, high: 101, low: 99, close: 100, volume: 1 },
    { time: 1_700_000_100, open: 100, high: 102, low: 99, close: 101, volume: 1 },
  ];
  assert.equal(getQuoteFxBar(fx, 1_700_000_100)?.close, 101);
  assert.equal(getQuoteFxBar(fx, 1_700_000_160)?.close, 101);
  assert.equal(getQuoteFxBar(fx, 1_700_000_100 + 301), undefined);
  assert.equal(getQuoteFxBar(fx, 1_700_000_000), undefined);
});

test("quiet buckets with volatile quote FX render micro-wicks instead of a flatline", () => {
  const t0 = 1_700_000_040;
  const bars = [{ time: t0, open: 5000, high: 5000, low: 5000, close: 5000, volume: 10 }];
  const fx = [
    { time: t0, open: 100, high: 100, low: 100, close: 100, volume: 1 },
    { time: t0 + 60, open: 100, high: 102, low: 99, close: 101, volume: 1 },
    { time: t0 + 120, open: 101, high: 103, low: 100, close: 102, volume: 1 },
  ];
  assert.equal(isVolatileQuoteFx(fx), true);
  const filled = forwardFillContinuous(bars, 60, t0 + 120, fx);
  assert.equal(filled.length, 3);
  assert.equal(filled[0]!.volume, 10);
  assert.equal(filled[1]!.volume, 0);
  assert.equal(filled[1]!.open, 5000);
  assert.equal(filled[1]!.high, 5100);
  assert.equal(filled[1]!.low, 4950);
  assert.equal(filled[1]!.close, 5050);
  assert.ok(filled[1]!.high > filled[1]!.low);
  assert.ok(filled[2]!.high > filled[2]!.low);
  const linked = linkBarOpens([
    ...filled,
    { time: t0 + 180, open: 5200, high: 5200, low: 5180, close: 5190, volume: 4 },
  ]);
  assert.equal(linked[3]!.open, filled[2]!.close);
});

test("USDG quote FX marks quiet buckets from the 1m USDG/USD tape", () => {
  const t0 = 1_700_000_040;
  const bars = [{ time: t0, open: 5000, high: 5000, low: 5000, close: 5000, volume: 10 }];
  const fx = [
    { time: t0, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    { time: t0 + 60, open: 1, high: 1.0002, low: 0.9998, close: 1, volume: 1 },
    { time: t0 + 120, open: 1, high: 1, low: 1, close: 1, volume: 1 },
  ];
  assert.equal(isVolatileQuoteFx(fx), false);
  const filled = forwardFillContinuous(bars, 60, t0 + 120, fx);
  assert.equal(filled.length, 3);
  assert.equal(filled[1]!.volume, 0);
  assert.equal(filled[1]!.open, 5000);
  assert.equal(filled[1]!.close, 5000);
  assert.equal(filled[1]!.high, 5001);
  assert.equal(filled[1]!.low, 4999);
});

test("a perfect $1 USDG peg still forward-fills as a doji", () => {
  const t0 = 1_700_000_040;
  const bars = [{ time: t0, open: 5000, high: 5000, low: 5000, close: 5000, volume: 10 }];
  const fx = [
    { time: t0, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    { time: t0 + 60, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    { time: t0 + 120, open: 1, high: 1, low: 1, close: 1, volume: 1 },
  ];
  const filled = forwardFillContinuous(bars, 60, t0 + 120, fx);
  assert.equal(filled[1]!.open, 5000);
  assert.equal(filled[1]!.high, 5000);
  assert.equal(filled[1]!.low, 5000);
  assert.equal(filled[1]!.close, 5000);
  assert.equal(filled[1]!.volume, 0);
});

test("chartHudBar ignores whitespace slots", () => {
  const bars = definedWhitespaceTape(
    [{ time: 1_700_000_000, open: 10, high: 12, low: 9, close: 11, volume: 4 }],
    300,
    1_700_000_000,
  );
  const hud = chartHudBar(bars, null);
  assert.equal(hud?.close, 11);
  assert.equal(hud?.volume, 4);
  assert.equal(isWhitespaceBar(bars[0]!), true);
  assert.equal(chartHudBar(bars, bars[0]!)?.close, 11);
});

