"use client";

import { useEffect, useRef } from "react";

import {
  chartRangeSignature,
  chartVisibleLogicalRange,
  formatChartUsd,
  hasChartVolume,
  type ChartBar,
  type ChartInterval,
  type ChartScale,
  type ChartStyle,
} from "@/lib/token-chart";
import type { AutoscaleInfoProvider, IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

const UP = "#10b981";
const DOWN = "#ef4444";
const SURFACE = "#0a0a0a";
const GRID = "rgba(255,255,255,0.06)";
const AXIS = "#71717a";

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

/**
 * Sit candles toward the bottom of the pane (other launchpads): more headroom
 * above the wick than below the low. Flat dojis get a readable body.
 */
const padPriceRange: AutoscaleInfoProvider = (original) => {
  const res = original();
  if (!res?.priceRange) return res;
  const { minValue, maxValue } = res.priceRange;
  const mid = (minValue + maxValue) / 2;
  const span = Math.max(maxValue - minValue, 0);
  const minSpan = Math.max(Math.abs(mid) * 0.08, mid > 1 ? 0.01 : 1e-18);
  const lo = span >= minSpan ? minValue : mid - minSpan * 0.35;
  const hi = span >= minSpan ? maxValue : mid + minSpan * 0.65;
  const height = Math.max(hi - lo, minSpan);
  const floor = Math.max(lo - height * 0.08, 0);
  return { ...res, priceRange: { minValue: floor, maxValue: hi + height * 0.22 } };
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
    borderVisible: false,
    priceLineVisible: true,
    lastValueVisible: true,
    priceLineWidth: 1,
    priceLineStyle: tv.LineStyle.Dashed,
    priceFormat,
    autoscaleInfoProvider: padPriceRange,
  });
}

function fitChartView(chart: IChartApi, barCount: number) {
  const range = chartVisibleLogicalRange(barCount);
  if (!range) return;
  chart.timeScale().setVisibleLogicalRange(range);
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
      next.map((b) => ({
        time: b.time as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );
  }

  const showVolume = hasChartVolume(next);
  handle.price.priceScale().applyOptions({
    scaleMargins: { top: 0.06, bottom: showVolume ? 0.14 : 0.06 },
  });
  handle.volume.setData(
    showVolume
      ? next.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.volume,
          color: b.close >= b.open ? "rgba(16,185,129,0.28)" : "rgba(239,68,68,0.28)",
        }))
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
          attributionLogo: true,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        rightPriceScale: { borderColor: GRID },
        timeScale: {
          borderColor: GRID,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 6,
          barSpacing: 12,
          minBarSpacing: 4,
          maxBarSpacing: 36,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: false,
          shiftVisibleRangeOnNewBar: true,
        },
        localization: {
          priceFormatter: (price: number) => formatChartUsd(price, scaleRef.current),
        },
        crosshair: { mode: tv.CrosshairMode.Normal },
      });

      const price = await attachPriceSeries(chart, tv, styleRef.current, scaleRef.current, lineColorRef.current);
      const volume = chart.addSeries(tv.HistogramSeries, {
        priceScaleId: "volume",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      // Thin volume strip. fat histogram bars were being read as candles.
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.88, bottom: 0 },
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
        priceFormatter: (price: number) => formatChartUsd(price, scale),
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

  return <div ref={hostRef} className="absolute inset-0 z-[2]" />;
}
