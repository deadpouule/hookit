"use client";

import { useEffect, useRef } from "react";

import {
  CHART_MAX_BAR_SPACING,
  CHART_MIN_BAR_SPACING,
  CHART_RIGHT_OFFSET,
  CHART_SCALE_MARGIN_BOTTOM,
  CHART_SCALE_MARGIN_TOP,
  CHART_WINDOW_BARS,
  chartPriceBand,
  chartRangeSignature,
  chartVisibleLogicalRange,
  formatChartAxis,
  visibleCandleOhlc,
  type ChartBar,
  type ChartInterval,
  type ChartScale,
  type ChartStyle,
} from "@/lib/token-chart";
import { TV_CANDLE_DOWN, TV_CANDLE_UP, TV_CHART_BG, TV_CHART_GRID, TV_CHART_SCALE_TEXT } from "@/lib/tv-chart";
import type { AutoscaleInfoProvider, IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

const UP = TV_CANDLE_UP;
const DOWN = TV_CANDLE_DOWN;
const SURFACE = TV_CHART_BG;
const GRID = TV_CHART_GRID;
const AXIS = TV_CHART_SCALE_TEXT;
const CROSS = "rgba(255,255,255,0.22)";
const CROSS_LABEL = "#27272a";
const FONT = "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

type TokenLightweightPlotProps = {
  bars: ChartBar[];
  style: ChartStyle;
  scale: ChartScale;
  interval?: ChartInterval;
  /** Bars stretched across the pane on (re)fit - TradingView `timeframe`. */
  windowBars?: number;
  lineColor?: string;
  fitNonce?: number;
  onHover: (bar: ChartBar | null) => void;
};

type PriceSeries = ISeriesApi<"Candlestick"> | ISeriesApi<"Line">;

type ChartHandle = {
  chart: IChartApi;
  price: PriceSeries;
  style: ChartStyle;
};

/** Candles fill the pane with a little pad for the last-value label. */
const padPriceRange: AutoscaleInfoProvider = (original) => {
  const res = original();
  if (!res?.priceRange) return res;
  const band = chartPriceBand(res.priceRange.minValue, res.priceRange.maxValue);
  if (!band) return res;
  return { ...res, priceRange: band };
};

function lookupBar(bars: ChartBar[], time: number): ChartBar | undefined {
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i]!.time === time) return bars[i];
  }
  return undefined;
}

function lastBarUp(bars: ChartBar[]): boolean {
  const last = bars[bars.length - 1];
  if (!last) return true;
  return last.close >= last.open;
}

async function attachPriceSeries(
  chart: IChartApi,
  tv: typeof import("lightweight-charts"),
  style: ChartStyle,
  scale: ChartScale,
  lineColor: string,
): Promise<PriceSeries> {
  const priceFormat =
    scale === "mcap"
      ? { type: "price" as const, precision: 2, minMove: 0.01 }
      : { type: "price" as const, precision: 12, minMove: 1e-12 };

  if (style === "line") {
    return chart.addSeries(tv.LineSeries, {
      color: lineColor,
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      priceLineColor: lineColor,
      priceLineWidth: 1,
      priceLineStyle: tv.LineStyle.Dashed,
      priceFormat,
      autoscaleInfoProvider: padPriceRange,
    });
  }

  return chart.addSeries(tv.CandlestickSeries, {
    upColor: UP,
    downColor: DOWN,
    wickUpColor: UP,
    wickDownColor: DOWN,
    borderVisible: true,
    borderUpColor: UP,
    borderDownColor: DOWN,
    priceLineVisible: true,
    lastValueVisible: true,
    priceLineWidth: 1,
    priceLineStyle: tv.LineStyle.Dashed,
    priceFormat,
    autoscaleInfoProvider: padPriceRange,
  });
}

/** Pin the newest candle against the right axis with the opening window across the pane. */
function fitChartView(chart: IChartApi, barCount: number, windowBars: number) {
  const timeScale = chart.timeScale();
  const width = timeScale.width();
  const range = chartVisibleLogicalRange(barCount, width > 0 ? width : undefined, windowBars);
  if (!range) return;
  timeScale.applyOptions({ barSpacing: range.barSpacing, rightOffset: CHART_RIGHT_OFFSET });
  timeScale.setVisibleLogicalRange({ from: range.from, to: range.to });
}

function applyBars(handle: ChartHandle, next: ChartBar[], lineColor: string, windowBars: number, refit = true) {
  const up = lastBarUp(next);
  const line = up ? UP : DOWN;

  if (handle.style === "line") {
    const series = handle.price as ISeriesApi<"Line">;
    series.applyOptions({ color: lineColor, priceLineColor: lineColor });
    series.setData(
      next.map((b) => ({
        time: b.time as UTCTimestamp,
        value: b.close,
      })),
    );
  } else {
    (handle.price as ISeriesApi<"Candlestick">).applyOptions({
      priceLineColor: line,
    });
    (handle.price as ISeriesApi<"Candlestick">).setData(
      next.map((b) => {
        const ohlc = visibleCandleOhlc(b);
        return {
          time: b.time as UTCTimestamp,
          ...ohlc,
        };
      }),
    );
  }

  // No volume study on the pane (Advanced Charts desk default); volume lives in the legend.
  handle.price.priceScale().applyOptions({
    scaleMargins: { top: CHART_SCALE_MARGIN_TOP, bottom: CHART_SCALE_MARGIN_BOTTOM },
  });
  if (refit) fitChartView(handle.chart, next.length, windowBars);
}

export function TokenLightweightPlot({
  bars,
  style,
  scale,
  interval,
  windowBars = CHART_WINDOW_BARS,
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
  useEffect(() => {
    windowBarsRef.current = windowBars;
  }, [windowBars]);
  const rangeSigRef = useRef("");
  const tvRef = useRef<typeof import("lightweight-charts") | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    void (async () => {
      const tv = await import("lightweight-charts");
      if (disposed || !hostRef.current) return;
      tvRef.current = tv;

      const chart = tv.createChart(hostRef.current, {
        autoSize: true,
        layout: {
          background: { type: tv.ColorType.Solid, color: SURFACE },
          textColor: AXIS,
          fontFamily: FONT,
          fontSize: 11,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: GRID, style: tv.LineStyle.Solid, visible: true },
          horzLines: { color: GRID, style: tv.LineStyle.Solid, visible: true },
        },
        rightPriceScale: {
          borderVisible: false,
          ticksVisible: false,
          entireTextOnly: true,
          minimumWidth: 72,
        },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: CHART_RIGHT_OFFSET,
          minBarSpacing: CHART_MIN_BAR_SPACING,
          maxBarSpacing: CHART_MAX_BAR_SPACING,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: false,
          shiftVisibleRangeOnNewBar: true,
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

      const price = await attachPriceSeries(chart, tv, styleRef.current, scaleRef.current, lineColorRef.current);

      const handle: ChartHandle = { chart, price, style: styleRef.current };
      handleRef.current = handle;
      const next = pendingBarsRef.current;
      rangeSigRef.current = chartRangeSignature(next, interval);
      applyBars(handle, next, lineColorRef.current, windowBarsRef.current);

      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData.size) {
          onHoverRef.current(null);
          return;
        }
        const time = Number(param.time);
        const fromBars = lookupBar(pendingBarsRef.current, time);
        if (fromBars) {
          onHoverRef.current(fromBars);
          return;
        }
        onHoverRef.current(null);
      });
    })();

    return () => {
      disposed = true;
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
    void attachPriceSeries(handle.chart, tv, style, scale, lineColor).then((price) => {
      if (handleRef.current !== handle) return;
      handle.price = price;
      handle.style = style;
      applyBars(handle, pendingBarsRef.current, lineColor, windowBarsRef.current);
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
      priceFormat:
        scale === "mcap"
          ? { type: "price", precision: 2, minMove: 0.01 }
          : { type: "price", precision: 12, minMove: 1e-12 },
    });
  }, [scale]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const signature = chartRangeSignature(bars, interval);
    const refit = rangeSigRef.current !== signature;
    rangeSigRef.current = signature;
    applyBars(handle, bars, lineColor, windowBars, refit);
  }, [bars, lineColor, interval, windowBars]);

  useEffect(() => {
    if (fitNonce === 0) return;
    const handle = handleRef.current;
    if (handle) fitChartView(handle.chart, pendingBarsRef.current.length, windowBarsRef.current);
  }, [fitNonce]);

  return <div ref={hostRef} className="token-chart-engine absolute inset-0 z-[2]" />;
}
