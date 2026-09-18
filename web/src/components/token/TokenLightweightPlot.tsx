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
  CHART_WINDOW_BARS,
  chartFitAnchorIndex,
  chartFitWindowBars,
  chartRangeSignature,
  chartStructureSignature,
  candleSeriesData,
  chartVisibleLogicalRange,
  isCandleBar,
  formatChartAxis,
  isWhitespaceBar,
  visibleExtremes,
  visiblePriceBand,
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
  IPriceLine,
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

type TokenLightweightPlotProps = {
  bars: ChartBar[];
  style: ChartStyle;
  scale: ChartScale;
  interval?: ChartInterval;
  bucketSec?: number;
  windowBars?: number;
  anchorIndex?: number;
  lineColor?: string;
  fitNonce?: number;
  onHover: (bar: ChartBar | null) => void;
};

type PriceSeries = ISeriesApi<"Candlestick"> | ISeriesApi<"Area">;

type ChartHandle = {
  chart: IChartApi;
  price: PriceSeries;
  athLine: IPriceLine | null;
  atlLine: IPriceLine | null;
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

function fdvBarsInView(bars: ChartBar[], from?: number, to?: number): number {
  const start = Math.max(0, Math.floor(from ?? 0));
  const end = Math.min(bars.length - 1, Math.ceil(to ?? bars.length - 1));
  let n = 0;
  for (let i = start; i <= end; i++) {
    if (isCandleBar(bars[i]!)) n++;
  }
  return n;
}

function applyAthAtl(
  handle: ChartHandle,
  tv: typeof import("lightweight-charts"),
  bars: ChartBar[],
) {
  if (handle.athLine) {
    handle.price.removePriceLine(handle.athLine);
    handle.athLine = null;
  }
  if (handle.atlLine) {
    handle.price.removePriceLine(handle.atlLine);
    handle.atlLine = null;
  }
  const vis = visibleLogicalRangeOf(handle.chart);
  if (fdvBarsInView(bars, vis?.from, vis?.to) < 2) return;
  const ext = visibleExtremes(bars, vis?.from, vis?.to);
  if (!ext) return;
  const { ath, atl } = ext;
  const mid = (ath + atl) / 2;
  if (!(mid > 0) || (ath - atl) / mid < 0.008) return;
  const style = {
    color: "rgba(255, 255, 255, 0.22)",
    lineWidth: 1 as const,
    lineStyle: tv.LineStyle.Dotted,
    axisLabelVisible: true,
  };
  handle.athLine = handle.price.createPriceLine({ ...style, price: ath, title: "H" });
  if (atl < ath) {
    handle.atlLine = handle.price.createPriceLine({ ...style, price: atl, title: "L" });
  }
}

function applyBars(
  handle: ChartHandle,
  tv: typeof import("lightweight-charts") | null,
  next: ChartBar[],
  lineColor: string,
  windowBars: number,
  bucketSec: number,
  anchorIndex?: number,
  refit = true,
) {
  const up = lastBarUp(next);
  const line = up ? UP : DOWN;

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
    series.setData(
      next.map((b) =>
        isWhitespaceBar(b) ? { time: asTime(b) } : { time: asTime(b), value: b.close },
      ),
    );
  } else {
    (handle.price as ISeriesApi<"Candlestick">).applyOptions({
      priceLineColor: line,
    });
    (handle.price as ISeriesApi<"Candlestick">).setData(
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

  resizeChartToHost(handle.chart, handle.chart.chartElement());
  if (refit) fitChartView(handle.chart, next, windowBars, bucketSec, anchorIndex);
  if (tv) applyAthAtl(handle, tv, next);

  handle.price.priceScale().applyOptions({
    scaleMargins: { top: CHART_SCALE_MARGIN_TOP, bottom: CHART_SCALE_MARGIN_BOTTOM },
  });
}

export function TokenLightweightPlot({
  bars,
  style,
  scale,
  interval,
  bucketSec = 3_600,
  windowBars = CHART_WINDOW_BARS,
  anchorIndex,
  lineColor = UP,
  fitNonce = 0,
  onHover,
}: TokenLightweightPlotProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const handleRef = useRef<ChartHandle | null>(null);
  const pendingBarsRef = useRef(bars);
  pendingBarsRef.current = bars;
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
  useEffect(() => {
    windowBarsRef.current = windowBars;
  }, [windowBars]);
  useEffect(() => {
    bucketSecRef.current = bucketSec;
  }, [bucketSec]);
  useEffect(() => {
    anchorIndexRef.current = anchorIndex;
  }, [anchorIndex]);
  useEffect(() => {
    intervalRef.current = interval;
  }, [interval]);
  const rangeSigRef = useRef("");
  const tvRef = useRef<typeof import("lightweight-charts") | null>(null);

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
          attributionLogo: false,
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

      const handle: ChartHandle = {
        chart,
        price,
        athLine: null,
        atlLine: null,
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

      chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
        const live = handleRef.current;
        const lib = tvRef.current;
        if (!live || !lib) return;
        applyAthAtl(live, lib, pendingBarsRef.current);
      });

      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData.size) {
          onHoverRef.current(null);
          return;
        }
        const time = Number(param.time);
        const fromBars = lookupBar(pendingBarsRef.current, time);
        if (fromBars && !isWhitespaceBar(fromBars)) {
          onHoverRef.current(fromBars);
          return;
        }
        onHoverRef.current(null);
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
    handle.athLine = null;
    handle.atlLine = null;
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
    );
  }, [bars, lineColor, interval, windowBars, bucketSec, anchorIndex]);

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

  return <div ref={hostRef} className="token-chart-engine absolute inset-0 z-[2]" />;
}
