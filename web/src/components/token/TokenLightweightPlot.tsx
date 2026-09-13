"use client";

import { useEffect, useRef } from "react";

import {
  CHART_BAR_SPACING,
  CHART_RIGHT_OFFSET,
  chartPriceBand,
  chartRangeSignature,
  chartVisibleLogicalRange,
  formatChartAxis,
  hasChartVolume,
  isSyntheticBar,
  type ChartBar,
  type ChartInterval,
  type ChartScale,
  type ChartStyle,
} from "@/lib/token-chart";
import type { AutoscaleInfoProvider, IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

const UP = "#22c55e";
const DOWN = "#f43f5e";
const UP_VOLUME = "rgba(34,197,94,0.42)";
const DOWN_VOLUME = "rgba(244,63,94,0.38)";
const SURFACE = "#111111";
const GRID = "rgba(255,255,255,0.055)";
const AXIS = "#71717a";
const CROSS = "rgba(255,255,255,0.22)";
const CROSS_LABEL = "#27272a";
const FONT = "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

type TokenLightweightPlotProps = {
  bars: ChartBar[];
  style: ChartStyle;
  scale: ChartScale;
  interval?: ChartInterval;
  lineColor?: string;
  fitNonce?: number;
  onHover: (bar: ChartBar | null) => void;
};

type PriceSeries = ISeriesApi<"Candlestick"> | ISeriesApi<"Line">;

type ChartHandle = {
  chart: IChartApi;
  price: PriceSeries;
  volume: ISeriesApi<"Histogram">;
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

/** Pin the newest candle against the right axis at the fixed Stonk pitch. */
function fitChartView(chart: IChartApi, barCount: number) {
  const timeScale = chart.timeScale();
  const width = timeScale.width();
  const range = chartVisibleLogicalRange(barCount, width > 0 ? width : undefined);
  if (!range) return;
  timeScale.applyOptions({ barSpacing: CHART_BAR_SPACING, rightOffset: CHART_RIGHT_OFFSET });
  timeScale.setVisibleLogicalRange(range);
}

function applyBars(handle: ChartHandle, next: ChartBar[], lineColor: string, refit = true) {
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
        if (isSyntheticBar(b)) {
          return { time: b.time as UTCTimestamp };
        }
        const mid = b.close || b.open;
        const span = Math.max(b.high - b.low, 0);
        const minSpan = mid > 0 ? mid * 0.002 : 0;
        const high = span >= minSpan ? b.high : mid + minSpan / 2;
        const low = span >= minSpan ? b.low : Math.max(mid - minSpan / 2, 0);
        return {
          time: b.time as UTCTimestamp,
          open: b.open,
          high,
          low,
          close: b.close,
        };
      }),
    );
  }

  const showVolume = hasChartVolume(next);
  handle.price.priceScale().applyOptions({
    scaleMargins: { top: 0.08, bottom: showVolume ? 0.2 : 0.08 },
  });
  handle.volume.setData(
    showVolume
      ? next.map((b) =>
          b.volume > 0
            ? {
                time: b.time as UTCTimestamp,
                value: b.volume,
                color: b.close >= b.open ? UP_VOLUME : DOWN_VOLUME,
              }
            : { time: b.time as UTCTimestamp },
        )
      : [],
  );
  if (refit) fitChartView(handle.chart, next.length);
}

export function TokenLightweightPlot({
  bars,
  style,
  scale,
  interval,
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
          vertLines: { color: GRID, style: tv.LineStyle.SparseDotted, visible: true },
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
          barSpacing: CHART_BAR_SPACING,
          minBarSpacing: 4,
          maxBarSpacing: 28,
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
      const volume = chart.addSeries(tv.HistogramSeries, {
        priceScaleId: "volume",
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: "volume" },
      });
      // Volume is a thin strip along the bottom edge, never competing with candles.
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.84, bottom: 0 },
        visible: false,
      });

      const handle: ChartHandle = { chart, price, volume, style: styleRef.current };
      handleRef.current = handle;
      const next = pendingBarsRef.current;
      rangeSigRef.current = chartRangeSignature(next, interval);
      applyBars(handle, next, lineColorRef.current);

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
      applyBars(handle, pendingBarsRef.current, lineColor);
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
    applyBars(handle, bars, lineColor, refit);
  }, [bars, lineColor, interval]);

  useEffect(() => {
    if (fitNonce === 0) return;
    const handle = handleRef.current;
    if (handle) fitChartView(handle.chart, pendingBarsRef.current.length);
  }, [fitNonce]);

  return <div ref={hostRef} className="token-chart-engine absolute inset-0 z-[2]" />;
}
