"use client";

import { useEffect, useRef } from "react";

import { formatCompactUsd } from "@/lib/format";
import { hasChartVolume, type ChartBar } from "@/lib/token-chart";
import type { AutoscaleInfoProvider } from "lightweight-charts";

const UP = "#26a69a";
const DOWN = "#ef5350";
const SURFACE = "#0a0a0a";
const GRID = "rgba(255,255,255,0.06)";
const AXIS = "#71717a";

type TokenLightweightPlotProps = {
  bars: ChartBar[];
  onHover: (bar: ChartBar | null) => void;
};

type ChartHandle = {
  chart: import("lightweight-charts").IChartApi;
  candles: import("lightweight-charts").ISeriesApi<"Candlestick">;
  volume: import("lightweight-charts").ISeriesApi<"Histogram">;
};

function applyBars(handle: ChartHandle, next: ChartBar[]) {
  const candleData = next.map((b) => ({
    time: b.time as import("lightweight-charts").UTCTimestamp,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
  }));
  handle.candles.setData(candleData);
  const showVolume = hasChartVolume(next);
  handle.candles.priceScale().applyOptions({
    scaleMargins: { top: 0.08, bottom: showVolume ? 0.28 : 0.08 },
  });
  handle.volume.setData(
    showVolume
      ? next.map((b) => ({
          time: b.time as import("lightweight-charts").UTCTimestamp,
          value: b.volume,
          color: b.close >= b.open ? "rgba(38,166,154,0.45)" : "rgba(239,83,80,0.45)",
        }))
      : [],
  );
  handle.chart.timeScale().fitContent();
}

export function TokenLightweightPlot({ bars, onHover }: TokenLightweightPlotProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const handleRef = useRef<ChartHandle | null>(null);
  const pendingBarsRef = useRef(bars);
  pendingBarsRef.current = bars;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    void (async () => {
      const tv = await import("lightweight-charts");
      if (disposed || !hostRef.current) return;

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
          rightOffset: 4,
        },
        localization: {
          priceFormatter: (price: number) => formatCompactUsd(price),
        },
        crosshair: { mode: tv.CrosshairMode.Normal },
      });

      const candles = chart.addSeries(tv.CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
        borderVisible: false,
        autoscaleInfoProvider: ((original) => {
          const res = original();
          if (!res?.priceRange) return res;
          const { minValue, maxValue } = res.priceRange;
          if (maxValue <= minValue) {
            const pad = Math.max(Math.abs(minValue) * 0.02, 1);
            return { ...res, priceRange: { minValue: minValue - pad, maxValue: minValue + pad } };
          }
          return res;
        }) satisfies AutoscaleInfoProvider,
      });
      const volume = chart.addSeries(tv.HistogramSeries, {
        priceScaleId: "volume",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
      });

      const handle = { chart, candles, volume };
      handleRef.current = handle;
      applyBars(handle, pendingBarsRef.current);

      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData.size) {
          onHoverRef.current(null);
          return;
        }
        const point = param.seriesData.get(candles) as
          | { open: number; high: number; low: number; close: number }
          | undefined;
        if (!point) {
          onHoverRef.current(null);
          return;
        }
        const volPoint = param.seriesData.get(volume) as { value: number } | undefined;
        onHoverRef.current({
          time: Number(param.time),
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
          volume: volPoint?.value ?? 0,
        });
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
    if (handle) applyBars(handle, bars);
  }, [bars]);

  return <div ref={hostRef} className="absolute inset-0 z-[2]" />;
}
