"use client";

import { useEffect, useRef, useState } from "react";

import type { ChartBar, ChartInterval } from "@/lib/token-chart";
import {
  TV_CANDLE_DOWN,
  TV_CANDLE_UP,
  TV_CHART_BG,
  TV_CHART_GRID,
  TV_CHART_SCALE_TEXT,
  TV_DISABLED_FEATURES,
  TV_FAVORITE_INTERVALS,
  TV_LIBRARY_PATH,
  TV_MOBILE_DISABLED_FEATURES,
  TV_MOBILE_MEDIA,
  TV_RESOLUTIONS,
  TV_THEME_CSS_URL,
  chartBarToTvBar,
  formatTvPrice,
  intervalToTvResolution,
  loadTradingViewLibrary,
  tvBarsInRange,
  tvInitialTimeframe,
  tvResolutionToInterval,
  tvSymbolInfo,
  type TvDatafeed,
  type TvTickCallback,
  type TvWidget,
} from "@/lib/tv-chart";

export type TvChartStatus = "loading" | "ready" | "unavailable";

type Subscription = {
  resolution: string;
  onTick: TvTickCallback;
  onReset: () => void;
  lastTime: number;
  lastCount: number;
  timer: number | null;
};

const TICK_THROTTLE_MS = 1000;

export function TokenTradingViewChart({
  ticker,
  name,
  interval,
  onInterval,
  sinceSec,
  barsFor,
  onStatus,
}: {
  ticker: string;
  name: string;
  interval: ChartInterval;
  onInterval: (next: ChartInterval) => void;
  sinceSec?: number;
  /**
   * USD-priced bars aggregated to the requested interval. A new function
   * identity means the underlying candles / swaps changed (realtime tick).
   */
  barsFor: (interval: ChartInterval) => ChartBar[];
  onStatus?: (status: TvChartStatus) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TvWidget | null>(null);
  const subsRef = useRef(new Map<string, Subscription>());
  const barsForRef = useRef(barsFor);
  const onIntervalRef = useRef(onInterval);
  const onStatusRef = useRef(onStatus);
  const intervalRef = useRef(interval);
  /** null until the media query has been read on the client. */
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    onIntervalRef.current = onInterval;
    onStatusRef.current = onStatus;
  }, [onInterval, onStatus]);

  useEffect(() => {
    const media = window.matchMedia(TV_MOBILE_MEDIA);
    const apply = () => setIsMobile(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (isMobile === null) return;
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const subs = subsRef.current;
    const sinceMs = sinceSec && sinceSec > 0 ? sinceSec * 1000 : null;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const resolution = intervalToTvResolution(intervalRef.current);

    const datafeed: TvDatafeed = {
      onReady(cb) {
        setTimeout(() =>
          cb({
            supported_resolutions: TV_RESOLUTIONS,
            supports_marks: false,
            supports_timescale_marks: false,
            supports_time: true,
          }),
        );
      },
      searchSymbols(_input, _exchange, _type, cb) {
        setTimeout(() =>
          cb([
            {
              symbol: ticker,
              full_name: ticker,
              ticker,
              description: name,
              exchange: "Ink",
              type: "crypto",
            },
          ]),
        );
      },
      resolveSymbol(_symbol, onResolve) {
        setTimeout(() => onResolve(tvSymbolInfo(ticker, name, timezone)));
      },
      getBars(_symbolInfo, res, period, onResult, onError) {
        try {
          const bars = barsForRef.current(tvResolutionToInterval(res));
          const slice = tvBarsInRange(bars, period.from, period.to);
          onResult(slice, { noData: slice.length === 0 });
        } catch (err) {
          onError(err instanceof Error ? err.message : "getBars failed");
        }
      },
      subscribeBars(_symbolInfo, res, onTick, guid, onReset) {
        datafeed.unsubscribeBars(guid);
        const bars = barsForRef.current(tvResolutionToInterval(res));
        const last = bars[bars.length - 1];
        subs.set(guid, {
          resolution: res,
          onTick,
          onReset,
          lastTime: last?.time ?? 0,
          lastCount: bars.length,
          timer: null,
        });
      },
      unsubscribeBars(guid) {
        const sub = subs.get(guid);
        if (sub?.timer) window.clearTimeout(sub.timer);
        subs.delete(guid);
      },
    };

    void loadTradingViewLibrary().then((ok) => {
      if (disposed || !hostRef.current) return;
      if (!ok || !window.TradingView?.widget) {
        onStatusRef.current?.("unavailable");
        return;
      }
      const widget = new window.TradingView.widget({
        symbol: ticker,
        datafeed,
        interval: resolution,
        timeframe: tvInitialTimeframe(resolution, sinceMs),
        container: hostRef.current,
        library_path: TV_LIBRARY_PATH,
        custom_css_url: TV_THEME_CSS_URL,
        locale: "en",
        timezone,
        autosize: true,
        theme: "dark",
        disabled_features: [...TV_DISABLED_FEATURES, ...(isMobile ? TV_MOBILE_DISABLED_FEATURES : [])],
        hide_side_toolbar: isMobile,
        loading_screen: { backgroundColor: TV_CHART_BG },
        toolbar_bg: TV_CHART_BG,
        overrides: {
          "paneProperties.background": TV_CHART_BG,
          "paneProperties.backgroundType": "solid",
          "paneProperties.vertGridProperties.color": TV_CHART_GRID,
          "paneProperties.horzGridProperties.color": TV_CHART_GRID,
          "scalesProperties.backgroundColor": TV_CHART_BG,
          "scalesProperties.lineColor": TV_CHART_GRID,
          "scalesProperties.textColor": TV_CHART_SCALE_TEXT,
          "mainSeriesProperties.showPriceLine": true,
          "paneProperties.legendProperties.showStudyTitles": !isMobile,
          "paneProperties.legendProperties.showStudyValues": !isMobile,
          "paneProperties.legendProperties.showStudyArguments": !isMobile,
          "mainSeriesProperties.candleStyle.upColor": TV_CANDLE_UP,
          "mainSeriesProperties.candleStyle.downColor": TV_CANDLE_DOWN,
          "mainSeriesProperties.candleStyle.borderUpColor": TV_CANDLE_UP,
          "mainSeriesProperties.candleStyle.borderDownColor": TV_CANDLE_DOWN,
          "mainSeriesProperties.candleStyle.wickUpColor": TV_CANDLE_UP,
          "mainSeriesProperties.candleStyle.wickDownColor": TV_CANDLE_DOWN,
        },
        favorites: { intervals: TV_FAVORITE_INTERVALS },
        custom_formatters: {
          priceFormatterFactory: () => ({ format: (value: number) => formatTvPrice(value) }),
        },
      });
      widgetRef.current = widget;
      widget.onChartReady(() => {
        if (disposed) return;
        onStatusRef.current?.("ready");
        widget.activeChart().onIntervalChanged().subscribe(null, (res) => {
          const next = tvResolutionToInterval(res);
          intervalRef.current = next;
          onIntervalRef.current(next);
        });
      });
    });

    return () => {
      disposed = true;
      for (const sub of subs.values()) if (sub.timer) window.clearTimeout(sub.timer);
      subs.clear();
      widgetRef.current?.remove();
      widgetRef.current = null;
    };
    // Rebuild only when the token or the phone/desktop chrome changes.
  }, [ticker, name, sinceSec, isMobile]);

  useEffect(() => {
    if (intervalRef.current === interval) return;
    intervalRef.current = interval;
    const widget = widgetRef.current;
    if (!widget) return;
    try {
      const chart = widget.activeChart();
      const res = intervalToTvResolution(interval);
      if (chart.resolution() !== res) chart.setResolution(res);
    } catch {
      /* chart not ready yet */
    }
  }, [interval]);

  useEffect(() => {
    barsForRef.current = barsFor;
    for (const sub of subsRef.current.values()) {
      if (sub.timer) continue;
      sub.timer = window.setTimeout(() => {
        sub.timer = null;
        const bars = barsForRef.current(tvResolutionToInterval(sub.resolution));
        const last = bars[bars.length - 1];
        if (!last) return;
        const rewound = last.time < sub.lastTime || bars.length < sub.lastCount;
        sub.lastTime = last.time;
        sub.lastCount = bars.length;
        if (rewound) {
          sub.onReset();
          try {
            widgetRef.current?.activeChart().resetData();
          } catch {
            /* chart gone */
          }
          return;
        }
        sub.onTick(chartBarToTvBar(last));
      }, TICK_THROTTLE_MS);
    }
  }, [barsFor]);

  return <div ref={hostRef} className="token-chart-tv" />;
}
