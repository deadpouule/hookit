"use client";

import { useEffect, useRef } from "react";

import {
  CHART_MAX_BAR_SPACING,
  CHART_MIN_BAR_SPACING,
  CHART_RIGHT_OFFSET,
  CHART_SCALE_MARGIN_BOTTOM,
  CHART_SCALE_MARGIN_TOP,
  CHART_VOLUME_MARGIN_TOP,
  CHART_WINDOW_BARS,
  chartFitAnchorIndex,
  chartRangeSignature,
  chartRenderableCandle,
  chartVisibleLogicalRange,
  formatChartAxis,
  isWhitespaceBar,
  visibleExtremes,
  visiblePriceBand,
  visibleVolumePeak,
  volumeSma,
  type ChartBar,
  type ChartInterval,
  type ChartScale,
  type ChartStyle,
} from "@/lib/token-chart";
import {
  TV_CANDLE_DOWN,
  TV_CANDLE_UP,
  TV_CHART_BG,
  TV_CHART_GRID,
  TV_CHART_SCALE_TEXT,
  TV_VOLUME_DOWN,
  TV_VOLUME_UP,
} from "@/lib/tv-chart";
import type {
  AutoscaleInfoProvider,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";

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
  bucketSec?: number;
  windowBars?: number;
  anchorIndex?: number;
  lineColor?: string;
  fitNonce?: number;
  onHover: (bar: ChartBar | null) => void;
};

type PriceSeries = ISeriesApi<"Candlestick"> | ISeriesApi<"Line">;

type ChartHandle = {
  chart: IChartApi;
  price: PriceSeries;
  volume: ISeriesApi<"Histogram">;
  volumeSma: ISeriesApi<"Line">;
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

function visibleVolumeAutoscale(getBars: () => ChartBar[], getChart: () => IChartApi | null): AutoscaleInfoProvider {
  return () => {
    const vis = visibleLogicalRangeOf(getChart());
    const peak = visibleVolumePeak(getBars(), vis?.from, vis?.to);
    if (!(peak > 0)) return null;
    return { priceRange: { minValue: 0, maxValue: peak } };
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
  return {
    type: "custom" as const,
    minMove: scale === "mcap" ? 0.01 : 1e-12,
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
      autoscaleInfoProvider: autoscale,
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
    autoscaleInfoProvider: autoscale,
  });
}

function attachVolumeSeries(
  chart: IChartApi,
  tv: typeof import("lightweight-charts"),
  autoscale: AutoscaleInfoProvider,
): { volume: ISeriesApi<"Histogram">; volumeSma: ISeriesApi<"Line"> } {
  const volume = chart.addSeries(tv.HistogramSeries, {
    priceScaleId: "volume",
    priceFormat: { type: "volume" },
    lastValueVisible: false,
    priceLineVisible: false,
    autoscaleInfoProvider: autoscale,
  });
  const volumeSmaSeries = chart.addSeries(tv.LineSeries, {
    priceScaleId: "volume",
    color: "#d97706",
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  });
  chart.priceScale("volume").applyOptions({
    visible: false,
    scaleMargins: { top: CHART_VOLUME_MARGIN_TOP, bottom: 0 },
  });
  return { volume, volumeSma: volumeSmaSeries };
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
  windowBars: number,
  bucketSec: number,
  anchorIndex?: number,
) {
  if (bars.length === 0) return;
  const timeScale = chart.timeScale();
  const width = timeScale.width();
  const range = chartVisibleLogicalRange(bars.length, width > 0 ? width : undefined, windowBars);
  if (!range) return;
  timeScale.applyOptions({ barSpacing: range.barSpacing, rightOffset: CHART_RIGHT_OFFSET });
  const anchor = bars[anchorIndex ?? chartFitAnchorIndex(bars)] ?? bars[bars.length - 1]!;
  const step = Math.max(bucketSec, 1);
  const fromTime = anchor.time - (Math.max(windowBars, 1) - 1) * step;
  const from = Math.max(fromTime, bars[0]!.time);
  const to = anchor.time + CHART_RIGHT_OFFSET * step;
  if (to > from) {
    timeScale.setVisibleRange({ from: from as UTCTimestamp, to: to as UTCTimestamp });
    return;
  }
  timeScale.setVisibleLogicalRange({ from: range.from, to: range.to });
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
  const ext = visibleExtremes(bars, vis?.from, vis?.to);
  if (!ext) return;
  const { ath, atl } = ext;
  const style = {
    color: "rgba(250,250,250,0.4)",
    lineWidth: 1 as const,
    lineStyle: tv.LineStyle.Dashed,
    axisLabelVisible: true,
  };
  handle.athLine = handle.price.createPriceLine({ ...style, price: ath, title: "ATH" });
  if (atl < ath) {
    handle.atlLine = handle.price.createPriceLine({ ...style, price: atl, title: "ATL" });
  }
}

function applyBars(
  handle: ChartHandle,
  tv: typeof import("lightweight-charts") | null,
  next: ChartBar[],
  lineColor: string,
  windowBars: number,
  bucketSec: number,
  anchorIndex: number,
  refit = true,
) {
  const up = lastBarUp(next);
  const line = up ? UP : DOWN;

  if (handle.style === "line") {
    const series = handle.price as ISeriesApi<"Line">;
    series.applyOptions({ color: lineColor, priceLineColor: lineColor });
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
      next.map((b) => {
        if (isWhitespaceBar(b)) return { time: asTime(b) };
        const c = chartRenderableCandle(b);
        return { time: asTime(b), open: c.open, high: c.high, low: c.low, close: c.close };
      }),
    );
  }

  handle.volume.setData(
    next.map((b) =>
      isWhitespaceBar(b) || !(b.volume > 0)
        ? { time: asTime(b) }
        : {
            time: asTime(b),
            value: b.volume,
            color: b.close >= b.open ? TV_VOLUME_UP : TV_VOLUME_DOWN,
          },
    ),
  );
  handle.volumeSma.setData(
    volumeSma(next).map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    })),
  );

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
  anchorIndex = 0,
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

      const priceAutoscale = visiblePriceAutoscale(
        () => pendingBarsRef.current,
        () => chart,
      );
      const volumeAutoscale = visibleVolumeAutoscale(
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
      const { volume, volumeSma: volumeSmaSeries } = attachVolumeSeries(chart, tv, volumeAutoscale);

      const handle: ChartHandle = {
        chart,
        price,
        volume,
        volumeSma: volumeSmaSeries,
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
        fitChartView(
          live.chart,
          pendingBarsRef.current,
          windowBarsRef.current,
          bucketSecRef.current,
          anchorIndexRef.current,
        );
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
    const signature = chartRangeSignature(bars, interval, windowBars);
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
