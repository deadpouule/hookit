"use client";

import { useEffect, useRef } from "react";

import {
  chartRangeSignature,
  formatChartUsd,
  hasChartVolume,
  type ChartBar,
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

const padPriceRange: AutoscaleInfoProvider = (original) => {
  const res = original();
  if (!res?.priceRange) return res;
  const { minValue, maxValue } = res.priceRange;
  const mid = (minValue + maxValue) / 2;
  const span = Math.max(maxValue - minValue, 0);
  const minSpan = Math.max(Math.abs(mid) * 0.08, mid > 1 ? mid * 0.004 : 1e-12);
  if (span >= minSpan) return res;
  const pad = minSpan / 2;
  return { ...res, priceRange: { minValue: mid - pad, maxValue: mid + pad } };
};

function lookupBar(bars: ChartBar[], time: number): ChartBar | undefined {
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i]!.time === time) return bars[i];
  }
  return undefined;
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
    priceFormat,
    autoscaleInfoProvider: padPriceRange,
  });
}

function pinLastBarRight(chart: IChartApi, barCount: number) {
  if (barCount <= 0) return;
  const rightPad = 2;
  const minVisible = 16;
  const last = barCount - 1;
  const visible = Math.max(minVisible, Math.min(barCount + rightPad, 48));
  chart.timeScale().setVisibleLogicalRange({
    from: last + rightPad - visible + 1,
    to: last + rightPad,
  });
}

function applyBars(handle: ChartHandle, next: ChartBar[], _fit: boolean, lineColor: string) {
  if (handle.style === "line") {
    const line = handle.price as ISeriesApi<"Line">;
    line.applyOptions({ color: lineColor });
    line.setData(
      next.map((b) => ({
        time: b.time as UTCTimestamp,
        value: b.close,
      })),
    );
  } else {
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
    scaleMargins: { top: 0.08, bottom: showVolume ? 0.28 : 0.08 },
  });
  handle.volume.setData(
    showVolume
      ? next.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.volume,
          color: b.close >= b.open ? "rgba(16,185,129,0.45)" : "rgba(239,68,68,0.45)",
        }))
      : [],
  );
  pinLastBarRight(handle.chart, next.length);
}

export function TokenLightweightPlot({
  bars,
  style,
  scale,
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
          vertLines: { color: GRID },
          horzLines: { color: GRID },
        },
        rightPriceScale: { borderColor: GRID },
        timeScale: {
          borderColor: GRID,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 12,
          barSpacing: 12,
          minBarSpacing: 6,
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
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
      });

      const handle: ChartHandle = { chart, price, volume, style: styleRef.current };
      handleRef.current = handle;
      const next = pendingBarsRef.current;
      rangeSigRef.current = chartRangeSignature(next);
      applyBars(handle, next, true, lineColorRef.current);

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
      applyBars(handle, pendingBarsRef.current, true, lineColor);
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
    const signature = chartRangeSignature(bars);
    const fit = signature !== rangeSigRef.current;
    rangeSigRef.current = signature;
    applyBars(handle, bars, fit, lineColor);
  }, [bars, lineColor]);

  useEffect(() => {
    if (fitNonce === 0) return;
    const handle = handleRef.current;
    if (handle) pinLastBarRight(handle.chart, pendingBarsRef.current.length);
  }, [fitNonce]);

  return <div ref={hostRef} className="absolute inset-0 z-[2]" />;
}
