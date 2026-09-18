"use client";

import { useEffect, useRef } from "react";

import {
  CHART_BAR_SPACING,
  CHART_MAX_BAR_SPACING,
  CHART_MIN_BAR_SPACING,
  CHART_PRICE_DECIMALS,
  CHART_PRICE_MIN_MOVE,
  CHART_RIGHT_OFFSET,
  CHART_SCALE_MARGIN_BOTTOM,
  CHART_SCALE_MARGIN_TOP,
  CHART_VOLUME_MARGIN_TOP,
  CHART_WINDOW_BARS,
  chartFitAnchorIndex,
  chartFitWindowBars,
  chartRangeSignature,
  chartStructureSignature,
  candleSeriesData,
  chartVisibleLogicalRange,
  formatChartAxis,
  isWhitespaceBar,
  visiblePriceBand,
  volumeHistogramData,
  type ChartBar,
  type ChartInterval,
  type ChartScale,
  type ChartStyle,
} from "@/lib/token-chart";
import {
  TV_CHART_BG,
  TV_CHART_GRID,
  TV_CHART_SCALE_TEXT,
  TV_CROSSHAIR,
  TV_CROSSHAIR_LABEL,
  TV_STAIR_DOWN,
  TV_STAIR_UP,
  TV_STAIR_WICK_DOWN,
  TV_STAIR_WICK_UP,
  tvAreaGradient,
} from "@/lib/tv-chart";
import type {
  AutoscaleInfoProvider,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";

const UP = TV_STAIR_UP;
const DOWN = TV_STAIR_DOWN;
const SURFACE = TV_CHART_BG;
const GRID = TV_CHART_GRID;
const AXIS = TV_CHART_SCALE_TEXT;
const CROSS = TV_CROSSHAIR;
const CROSS_LABEL = TV_CROSSHAIR_LABEL;
const FONT = "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace";
const LEGEND_UP = "#10B981";
const LEGEND_DOWN = "#EF4444";

type TokenLightweightPlotProps = {
  bars: ChartBar[];
  style: ChartStyle;
  scale: ChartScale;
  interval?: ChartInterval;
  symbol?: string;
  bucketSec?: number;
  windowBars?: number;
  anchorIndex?: number;
  lineColor?: string;
  fitNonce?: number;
  onHover: (bar: ChartBar | null) => void;
};

type LegendOhlc = { open: number; high: number; low: number; close: number };

function formatLegendPrice(val: number): string {
  if (!Number.isFinite(val)) return "0.00";
  if (val === 0) return "0.00";
  const abs = Math.abs(val);
  if (abs < 0.00001) return val.toFixed(9);
  if (abs < 1) return val.toFixed(6);
  return val.toFixed(2);
}

function isLegendOhlc(value: unknown): value is LegendOhlc {
  if (!value || typeof value !== "object") return false;
  const bar = value as Partial<LegendOhlc>;
  return (
    typeof bar.open === "number" &&
    typeof bar.high === "number" &&
    typeof bar.low === "number" &&
    typeof bar.close === "number"
  );
}

function escapeLegendHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function legendInnerHtml(symbol: string, interval: string, bar: LegendOhlc): string {
  const bullish = bar.close >= bar.open;
  const color = bullish ? LEGEND_UP : LEGEND_DOWN;
  const diff = bar.close - bar.open;
  const pct = bar.open > 0 ? (diff / bar.open) * 100 : 0;
  const sign = diff >= 0 ? "+" : "";
  return (
    `<span style="color:rgba(255,255,255,0.5);font-weight:500">${escapeLegendHtml(symbol)} · ${escapeLegendHtml(interval)}</span>` +
    `<span style="color:${color};font-weight:600;margin-left:8px">` +
    `O ${formatLegendPrice(bar.open)} ` +
    `H ${formatLegendPrice(bar.high)} ` +
    `L ${formatLegendPrice(bar.low)} ` +
    `C ${formatLegendPrice(bar.close)} ` +
    `${sign}${formatLegendPrice(diff)} (${sign}${pct.toFixed(2)}%)` +
    `</span>`
  );
}

type PriceSeries = ISeriesApi<"Candlestick"> | ISeriesApi<"Area">;

type ChartHandle = {
  chart: IChartApi;
  price: PriceSeries;
  volume?: ISeriesApi<"Histogram">;
  style: ChartStyle;
};

function visibleLogicalRangeOf(chart: IChartApi | null) {
  return chart?.timeScale().getVisibleLogicalRange() ?? null;
}

/** Scale Y to the candles on screen — Defined auto, not the whole history. */
function visiblePriceAutoscale(getBars: () => ChartBar[], getChart: () => IChartApi | null): AutoscaleInfoProvider {
  return () => {
    const vis = visibleLogicalRangeOf(getChart());
    const band = visiblePriceBand(getBars(), vis?.from, vis?.to);
    if (!band) return null;
    return { priceRange: band };
  };
}

function lookupBar(bars: ChartBar[], time: number): ChartBar | undefined {
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i]!.time === time) return bars[i];
  }
  return undefined;
}

function lastRealBar(bars: ChartBar[]): ChartBar | undefined {
  for (let i = bars.length - 1; i >= 0; i--) {
    if (!isWhitespaceBar(bars[i]!)) return bars[i];
  }
  return undefined;
}

function lastBarUp(bars: ChartBar[]): boolean {
  const last = lastRealBar(bars);
  if (!last) return true;
  return last.close >= last.open;
}

function priceFormatFor(scale: ChartScale) {
  if (scale === "price") {
    return {
      type: "price" as const,
      precision: CHART_PRICE_DECIMALS,
      minMove: CHART_PRICE_MIN_MOVE,
    };
  }
  return {
    type: "custom" as const,
    minMove: 0.01,
    formatter: (price: number) => formatChartAxis(price, scale),
  };
}

function asTime(bar: ChartBar): UTCTimestamp {
  return bar.time as UTCTimestamp;
}

async function attachPriceSeries(
  chart: IChartApi,
  tv: typeof import("lightweight-charts"),
  style: ChartStyle,
  scale: ChartScale,
  lineColor: string,
  autoscale: AutoscaleInfoProvider,
): Promise<PriceSeries> {
  const priceFormat = priceFormatFor(scale);

  if (style === "line") {
    const grad = tvAreaGradient(lineColor === UP);
    return chart.addSeries(tv.AreaSeries, {
      lineColor: grad.line,
      topColor: grad.top,
      bottomColor: grad.bottom,
      lineWidth: 2,
      lineType: tv.LineType.WithSteps,
      priceLineVisible: true,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: grad.line,
      crosshairMarkerBackgroundColor: TV_CHART_BG,
      priceLineColor: grad.line,
      priceLineWidth: 1,
      priceLineStyle: tv.LineStyle.Dotted,
      priceFormat,
      autoscaleInfoProvider: autoscale,
    });
  }

  return chart.addSeries(tv.CandlestickSeries, {
    upColor: TV_STAIR_UP,
    downColor: TV_STAIR_DOWN,
    wickUpColor: TV_STAIR_WICK_UP,
    wickDownColor: TV_STAIR_WICK_DOWN,
    borderVisible: false,
    priceLineVisible: true,
    lastValueVisible: true,
    priceLineWidth: 1,
    priceLineStyle: tv.LineStyle.Dotted,
    priceFormat,
    autoscaleInfoProvider: autoscale,
  });
}

/** Pin the newest candle against the right axis at Defined pitch. */
function resizeChartToHost(chart: IChartApi, host: HTMLElement | null) {
  if (!host) return false;
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (width < 8 || height < 8) return false;
  chart.resize(width, height);
  return true;
}

function fitChartView(
  chart: IChartApi,
  bars: ChartBar[],
  _windowBars: number,
  _bucketSec: number,
  anchorIndex?: number,
) {
  if (bars.length === 0) return;
  const timeScale = chart.timeScale();
  const width = timeScale.width();
  const anchor = anchorIndex ?? chartFitAnchorIndex(bars);
  const fittedWindow = chartFitWindowBars(bars.length, anchor, _windowBars);
  const range = chartVisibleLogicalRange(
    bars.length,
    width > 0 ? width : undefined,
    fittedWindow,
    CHART_RIGHT_OFFSET,
    anchor,
  );
  if (!range) return;
  timeScale.applyOptions({
    barSpacing: CHART_BAR_SPACING,
    minBarSpacing: CHART_MIN_BAR_SPACING,
    rightOffset: CHART_RIGHT_OFFSET,
  });
  timeScale.setVisibleLogicalRange({ from: range.from, to: range.to });
}

function lastBarOnlyUpdate(prev: ChartBar[], next: ChartBar[]): ChartBar | null {
  if (prev.length === 0 || next.length === 0 || prev.length !== next.length) return null;
  for (let i = 0; i < next.length - 1; i++) {
    const a = prev[i]!;
    const b = next[i]!;
    if (
      a.time !== b.time ||
      a.open !== b.open ||
      a.high !== b.high ||
      a.low !== b.low ||
      a.close !== b.close ||
      a.volume !== b.volume ||
      a.whitespace !== b.whitespace
    ) {
      return null;
    }
  }
  const last = next[next.length - 1]!;
  const old = prev[prev.length - 1]!;
  if (last.time !== old.time || isWhitespaceBar(last)) return null;
  return last;
}

function candlePoint(bar: ChartBar) {
  const point = candleSeriesData([bar])[0];
  if (!point || point.open == null) return { time: bar.time as UTCTimestamp };
  return {
    time: point.time as UTCTimestamp,
    open: point.open,
    high: point.high!,
    low: point.low!,
    close: point.close!,
  };
}

function volumePoint(bar: ChartBar) {
  const point = volumeHistogramData([bar])[0]!;
  return { time: point.time as UTCTimestamp, value: point.value, color: point.color };
}

function attachVolumeSeries(
  chart: IChartApi,
  tv: typeof import("lightweight-charts"),
): ISeriesApi<"Histogram"> {
  const volume = chart.addSeries(tv.HistogramSeries, {
    priceFormat: { type: "volume" },
    priceScaleId: "volume",
    lastValueVisible: false,
    priceLineVisible: false,
  });
  chart.priceScale("volume").applyOptions({
    scaleMargins: { top: CHART_VOLUME_MARGIN_TOP, bottom: 0 },
    borderVisible: false,
    visible: false,
  });
  return volume;
}

function applyBars(
  handle: ChartHandle,
  _tv: typeof import("lightweight-charts") | null,
  next: ChartBar[],
  lineColor: string,
  windowBars: number,
  bucketSec: number,
  anchorIndex?: number,
  refit = true,
  prev?: ChartBar[],
) {
  const up = lastBarUp(next);
  const line = up ? UP : DOWN;
  const liveBar = !refit && prev ? lastBarOnlyUpdate(prev, next) : null;

  if (handle.style === "line") {
    const series = handle.price as ISeriesApi<"Area">;
    const grad = tvAreaGradient(lineColor === UP);
    series.applyOptions({
      lineColor: grad.line,
      topColor: grad.top,
      bottomColor: grad.bottom,
      priceLineColor: grad.line,
      crosshairMarkerBorderColor: grad.line,
    });
    if (liveBar) {
      series.update({ time: asTime(liveBar), value: liveBar.close });
    } else {
      series.setData(
        next.map((b) =>
          isWhitespaceBar(b) ? { time: asTime(b) } : { time: asTime(b), value: b.close },
        ),
      );
    }
  } else {
    const candles = handle.price as ISeriesApi<"Candlestick">;
    candles.applyOptions({
      priceLineColor: line,
    });
    if (liveBar) {
      candles.update(candlePoint(liveBar));
    } else {
      candles.setData(
        candleSeriesData(next).map((point) =>
          point.open == null
            ? { time: point.time as UTCTimestamp }
            : {
                time: point.time as UTCTimestamp,
                open: point.open,
                high: point.high!,
                low: point.low!,
                close: point.close!,
              },
        ),
      );
    }
  }

  if (handle.volume) {
    if (liveBar) {
      handle.volume.update(volumePoint(liveBar));
    } else {
      handle.volume.setData(volumeHistogramData(next).map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.value,
        color: point.color,
      })));
    }
  }

  resizeChartToHost(handle.chart, handle.chart.chartElement());
  if (refit) fitChartView(handle.chart, next, windowBars, bucketSec, anchorIndex);

  handle.price.priceScale().applyOptions({
    scaleMargins: { top: CHART_SCALE_MARGIN_TOP, bottom: CHART_SCALE_MARGIN_BOTTOM },
  });
}

export function TokenLightweightPlot({
  bars,
  style,
  scale,
  interval,
  symbol = "Token/USD",
  bucketSec = 3_600,
  windowBars = CHART_WINDOW_BARS,
  anchorIndex,
  lineColor = UP,
  fitNonce = 0,
  onHover,
}: TokenLightweightPlotProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const hoveringRef = useRef(false);
  const hoverBarRef = useRef<LegendOhlc | null>(null);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const handleRef = useRef<ChartHandle | null>(null);
  const pendingBarsRef = useRef(bars);
  pendingBarsRef.current = bars;
  const appliedBarsRef = useRef<ChartBar[]>([]);
  const styleRef = useRef(style);
  styleRef.current = style;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const lineColorRef = useRef(lineColor);
  lineColorRef.current = lineColor;
  const windowBarsRef = useRef(windowBars);
  const bucketSecRef = useRef(bucketSec);
  const anchorIndexRef = useRef(anchorIndex);
  const intervalRef = useRef(interval);
  intervalRef.current = interval;
  useEffect(() => {
    windowBarsRef.current = windowBars;
  }, [windowBars]);
  useEffect(() => {
    bucketSecRef.current = bucketSec;
  }, [bucketSec]);
  useEffect(() => {
    anchorIndexRef.current = anchorIndex;
  }, [anchorIndex]);
  const rangeSigRef = useRef("");
  const tvRef = useRef<typeof import("lightweight-charts") | null>(null);

  const paintLegend = (bar: LegendOhlc | null) => {
    const el = legendRef.current;
    if (!el) return;
    if (!bar || !(bar.close > 0 || bar.open > 0)) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = legendInnerHtml(symbolRef.current, intervalRef.current ?? "", bar);
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let resize: ResizeObserver | null = null;

    void (async () => {
      const tv = await import("lightweight-charts");
      if (disposed || !hostRef.current) return;
      tvRef.current = tv;

      const hostEl = hostRef.current;
      const chart = tv.createChart(hostEl, {
        autoSize: false,
        width: Math.max(hostEl.clientWidth, 320),
        height: Math.max(hostEl.clientHeight, 240),
        layout: {
          background: { type: tv.ColorType.Solid, color: SURFACE },
          textColor: AXIS,
          fontFamily: FONT,
          fontSize: 11,
          attributionLogo: true,
        },
        grid: {
          vertLines: { color: GRID, style: tv.LineStyle.Solid, visible: false },
          horzLines: { color: GRID, style: tv.LineStyle.Solid, visible: true },
        },
        rightPriceScale: {
          autoScale: true,
          borderVisible: false,
          ticksVisible: true,
          entireTextOnly: true,
          minimumWidth: 68,
          alignLabels: true,
          scaleMargins: { top: CHART_SCALE_MARGIN_TOP, bottom: CHART_SCALE_MARGIN_BOTTOM },
        },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
          secondsVisible: false,
          barSpacing: CHART_BAR_SPACING,
          rightOffset: CHART_RIGHT_OFFSET,
          minBarSpacing: CHART_MIN_BAR_SPACING,
          maxBarSpacing: CHART_MAX_BAR_SPACING,
          fixLeftEdge: true,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: false,
          shiftVisibleRangeOnNewBar: true,
          tickMarkFormatter: (time: number) => {
            const d = new Date(time * 1000);
            const h = d.getHours();
            const m = d.getMinutes();
            if (h === 0 && m === 0) {
              return d.toLocaleDateString([], { day: "numeric", month: "short" });
            }
            return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          },
        },
        localization: {
          priceFormatter: (price: number) => formatChartAxis(price, scaleRef.current),
        },
        crosshair: {
          mode: tv.CrosshairMode.Normal,
          vertLine: {
            color: CROSS,
            width: 1,
            style: tv.LineStyle.Dashed,
            labelBackgroundColor: CROSS_LABEL,
          },
          horzLine: {
            color: CROSS,
            width: 1,
            style: tv.LineStyle.Dashed,
            labelBackgroundColor: CROSS_LABEL,
          },
        },
      });

      const priceAutoscale = visiblePriceAutoscale(
        () => pendingBarsRef.current,
        () => chart,
      );
      const price = await attachPriceSeries(
        chart,
        tv,
        styleRef.current,
        scaleRef.current,
        lineColorRef.current,
        priceAutoscale,
      );

      const volume = attachVolumeSeries(chart, tv);
      const handle: ChartHandle = {
        chart,
        price,
        volume,
        style: styleRef.current,
      };
      handleRef.current = handle;
      resizeChartToHost(chart, hostRef.current);
      const next = pendingBarsRef.current;
      rangeSigRef.current = chartRangeSignature(next, interval, windowBarsRef.current);
      applyBars(
        handle,
        tv,
        next,
        lineColorRef.current,
        windowBarsRef.current,
        bucketSecRef.current,
        anchorIndexRef.current,
      );
      appliedBarsRef.current = next;
      paintLegend(lastRealBar(next) ?? null);

      chart.subscribeCrosshairMove((param) => {
        const latest = lastRealBar(pendingBarsRef.current) ?? null;
        if (!param.time || !param.seriesData.size) {
          hoveringRef.current = false;
          hoverBarRef.current = null;
          onHoverRef.current(null);
          paintLegend(latest);
          return;
        }
        const time = Number(param.time);
        const fromBars = lookupBar(pendingBarsRef.current, time);
        const series = handleRef.current?.price;
        const raw = series ? param.seriesData.get(series) : undefined;
        const fromSeries = isLegendOhlc(raw) ? raw : undefined;
        const hovered = fromSeries ?? (fromBars && !isWhitespaceBar(fromBars) ? fromBars : undefined);
        if (hovered && (hovered.close > 0 || hovered.open > 0)) {
          hoveringRef.current = true;
          hoverBarRef.current = hovered;
          if (fromBars && !isWhitespaceBar(fromBars)) onHoverRef.current(fromBars);
          paintLegend(hovered);
          return;
        }
        hoveringRef.current = false;
        hoverBarRef.current = null;
        onHoverRef.current(null);
        paintLegend(latest);
      });

      let lastWidth = 0;
      let lastHeight = 0;
      resize = new ResizeObserver(() => {
        const live = handleRef.current;
        const el = hostRef.current;
        if (!live || !el) return;
        const width = el.clientWidth;
        const height = el.clientHeight;
        if (width < 8 || height < 8) return;
        if (Math.abs(width - lastWidth) < 2 && Math.abs(height - lastHeight) < 2) return;
        lastWidth = width;
        lastHeight = height;
        resizeChartToHost(live.chart, el);
      });
      resize.observe(hostRef.current);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (disposed || !handleRef.current || !hostRef.current) return;
          lastWidth = hostRef.current.clientWidth;
          lastHeight = hostRef.current.clientHeight;
          resizeChartToHost(handleRef.current.chart, hostRef.current);
          fitChartView(
            handleRef.current.chart,
            pendingBarsRef.current,
            windowBarsRef.current,
            bucketSecRef.current,
            anchorIndexRef.current,
          );
        });
      });
    })();

    return () => {
      disposed = true;
      resize?.disconnect();
      onHoverRef.current(null);
      handleRef.current?.chart.remove();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handle = handleRef.current;
    const tv = tvRef.current;
    if (!handle || !tv) return;
    if (handle.style === style) return;
    handle.chart.removeSeries(handle.price);
    void attachPriceSeries(
      handle.chart,
      tv,
      style,
      scale,
      lineColor,
      visiblePriceAutoscale(
        () => pendingBarsRef.current,
        () => handle.chart,
      ),
    ).then((price) => {
      if (handleRef.current !== handle) return;
      handle.price = price;
      handle.style = style;
      applyBars(
        handle,
        tv,
        pendingBarsRef.current,
        lineColor,
        windowBarsRef.current,
        bucketSecRef.current,
        anchorIndexRef.current,
      );
    });
  }, [style, scale, lineColor]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.chart.applyOptions({
      localization: {
        priceFormatter: (price: number) => formatChartAxis(price, scale),
      },
    });
    handle.price.applyOptions({
      priceFormat: priceFormatFor(scale),
    });
  }, [scale]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const signature = chartStructureSignature(bars, interval, windowBars);
    const refit = rangeSigRef.current !== signature;
    const prev = appliedBarsRef.current;
    rangeSigRef.current = signature;
    applyBars(
      handle,
      tvRef.current,
      bars,
      lineColor,
      windowBars,
      bucketSec,
      anchorIndex,
      refit,
      prev,
    );
    appliedBarsRef.current = bars;
    if (!hoveringRef.current) paintLegend(lastRealBar(bars) ?? null);
  }, [bars, lineColor, interval, windowBars, bucketSec, anchorIndex]);

  useEffect(() => {
    paintLegend(
      hoveringRef.current
        ? hoverBarRef.current
        : lastRealBar(pendingBarsRef.current) ?? null,
    );
  }, [symbol, interval]);

  useEffect(() => {
    if (fitNonce === 0) return;
    const handle = handleRef.current;
    if (handle)
      fitChartView(
        handle.chart,
        pendingBarsRef.current,
        windowBarsRef.current,
        bucketSecRef.current,
        anchorIndexRef.current,
      );
  }, [fitNonce]);

  return (
    <div className="token-chart-engine absolute inset-0 z-[2]">
      <div ref={hostRef} className="absolute inset-0" />
      <div
        ref={legendRef}
        className="token-chart-ohlc-legend"
        style={{
          position: "absolute",
          top: 10,
          left: 12,
          zIndex: 20,
          pointerEvents: "none",
          fontFamily: FONT,
          fontSize: 12,
          display: "flex",
          gap: 6,
          alignItems: "center",
          userSelect: "none",
          whiteSpace: "nowrap",
          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
        }}
      />
    </div>
  );
}
