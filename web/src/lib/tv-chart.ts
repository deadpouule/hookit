import type { ChartBar, ChartInterval } from "@/lib/token-chart";

/**
 * TradingView Advanced Charts (charting_library) glue - same shape as the
 * Tsunami token desk on Ink: five resolutions, a 72-bar opening window
 * clamped to the token's age, subscript-zero price labels, USD candles.
 */

export const TV_RESOLUTIONS = ["1", "5", "15", "60", "1D"] as const;
export type TvResolution = (typeof TV_RESOLUTIONS)[number];
export const TV_FAVORITE_INTERVALS: TvResolution[] = ["1", "5", "15", "60"];
export const TV_DEFAULT_RESOLUTION: TvResolution = "5";

/** Served from `web/public/charting_library/` (gitignored, licensed by TradingView). */
export const TV_LIBRARY_PATH = "/charting_library/";
export const TV_SCRIPT_URL = `${TV_LIBRARY_PATH}charting_library.standalone.js`;
/** Relative to `library_path`, loaded inside the widget iframe. */
export const TV_THEME_CSS_URL = "../tv-hookit-theme.css?v=1";

export const TV_CHART_BG = "#111111";
export const TV_CHART_GRID = "#232327";
export const TV_CHART_SCALE_TEXT = "#7f7f88";
export const TV_CANDLE_UP = "#2f9e7f";
export const TV_CANDLE_DOWN = "#f25a41";

/** Left toolbar and header chrome hidden on phones, like Tsunami's `(max-width: 760px)`. */
export const TV_MOBILE_MEDIA = "(max-width: 760px)";
export const TV_MOBILE_DISABLED_FEATURES = [
  "left_toolbar",
  "header_undo_redo",
  "header_screenshot",
  "header_saveload",
  "header_settings",
  "header_fullscreen_button",
  "timezone_menu",
] as const;
export const TV_DISABLED_FEATURES = [
  "header_symbol_search",
  "symbol_search_hot_key",
  "header_compare",
  "use_localstorage_for_settings",
  "create_volume_indicator_by_default",
] as const;

const RESOLUTION_TO_INTERVAL: Record<string, ChartInterval> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "60": "1h",
  "240": "4h",
  "1D": "1D",
  D: "1D",
};

const INTERVAL_TO_RESOLUTION: Record<ChartInterval, TvResolution> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "60",
  "1D": "1D",
  ALL: "1",
};

export function tvResolutionToInterval(resolution: string): ChartInterval {
  return RESOLUTION_TO_INTERVAL[resolution] ?? "5m";
}

export function intervalToTvResolution(interval: ChartInterval): TvResolution {
  return INTERVAL_TO_RESOLUTION[interval] ?? TV_DEFAULT_RESOLUTION;
}

export function tvResolutionSeconds(resolution: string): number {
  if (resolution === "1D" || resolution === "D") return 86_400;
  const minutes = Number(resolution);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : 300;
}

/**
 * Opening window: 72 bars back from now. A young token shows its whole life
 * instead of empty space, never fewer than 20 bars.
 */
export function tvInitialTimeframe(
  resolution: string,
  sinceMs: number | null,
  nowSec = Math.floor(Date.now() / 1000),
): { from: number; to: number } {
  const step = tvResolutionSeconds(resolution);
  let span = 72 * step;
  if (sinceMs !== null && Number.isFinite(sinceMs)) {
    const age = nowSec - Math.floor(sinceMs / 1000);
    if (age > 0 && age < span) span = Math.max(age, 20 * step);
  }
  return { from: nowSec - span, to: nowSec };
}

function significant(n: number): string {
  return n.toLocaleString("en-US", { maximumSignificantDigits: 6 });
}

/**
 * Sub-cent prices as `0.0₃85495`: the subscript is the run of zeros after the
 * point, followed by the next `digits + 1` significant digits.
 */
export function formatTvPrice(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return "-";
  if (value === 0) return "0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 0.001) return sign + significant(abs);
  let zeros = -Math.floor(Math.log10(abs)) - 1;
  let mantissa = Math.round(abs * 10 ** (zeros + 1 + digits));
  if (mantissa >= 10 ** (digits + 1)) {
    zeros -= 1;
    mantissa = Math.round(abs * 10 ** (zeros + 1 + digits));
  }
  if (zeros < 0) return sign + significant(abs);
  const sub = String(zeros)
    .split("")
    .map((d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)])
    .join("");
  return `${sign}0.0${sub}${mantissa}`;
}

export type TvBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function chartBarToTvBar(bar: ChartBar): TvBar {
  return {
    time: bar.time * 1000,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  };
}

/** `getBars` slice: bars in `[from, to)` seconds, oldest first, ms timestamps. */
export function tvBarsInRange(bars: ChartBar[], fromSec: number, toSec: number): TvBar[] {
  return bars.filter((b) => b.time >= fromSec && b.time < toSec).map(chartBarToTvBar);
}

export type TvSymbolInfo = {
  name: string;
  ticker: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  exchange: string;
  listed_exchange: string;
  format: "price";
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  has_seconds: boolean;
  has_daily: boolean;
  has_weekly_and_monthly: boolean;
  supported_resolutions: readonly string[];
  volume_precision: number;
  data_status: "streaming" | "endofday" | "pulsed" | "delayed_streaming";
};

export function tvSymbolInfo(ticker: string, name: string, timezone: string): TvSymbolInfo {
  return {
    name: ticker,
    ticker,
    description: name,
    type: "crypto",
    session: "24x7",
    timezone,
    exchange: "Ink",
    listed_exchange: "Ink",
    format: "price",
    minmov: 1,
    pricescale: 1e12,
    has_intraday: true,
    has_seconds: false,
    has_daily: false,
    has_weekly_and_monthly: false,
    supported_resolutions: TV_RESOLUTIONS,
    volume_precision: 6,
    data_status: "streaming",
  };
}

export type TvPeriodParams = { from: number; to: number; firstDataRequest?: boolean; countBack?: number };
export type TvHistoryCallback = (bars: TvBar[], meta: { noData: boolean }) => void;
export type TvErrorCallback = (reason: string) => void;
export type TvTickCallback = (bar: TvBar) => void;

export type TvDatafeed = {
  onReady: (cb: (config: Record<string, unknown>) => void) => void;
  searchSymbols: (
    input: string,
    exchange: string,
    type: string,
    cb: (items: Record<string, string>[]) => void,
  ) => void;
  resolveSymbol: (
    symbol: string,
    onResolve: (info: TvSymbolInfo) => void,
    onError?: TvErrorCallback,
  ) => void;
  getBars: (
    symbolInfo: TvSymbolInfo,
    resolution: string,
    period: TvPeriodParams,
    onResult: TvHistoryCallback,
    onError: TvErrorCallback,
  ) => void;
  subscribeBars: (
    symbolInfo: TvSymbolInfo,
    resolution: string,
    onTick: TvTickCallback,
    listenerGuid: string,
    onResetCacheNeeded: () => void,
  ) => void;
  unsubscribeBars: (listenerGuid: string) => void;
};

export type TvChartApi = {
  setResolution: (resolution: string, cb?: () => void) => void;
  resolution: () => string;
  resetData: () => void;
  onIntervalChanged: () => {
    subscribe: (
      obj: unknown,
      cb: (resolution: string, timeframe: unknown) => void,
    ) => void;
    unsubscribe?: (obj: unknown, cb: (resolution: string) => void) => void;
  };
};

export type TvWidget = {
  onChartReady: (cb: () => void) => void;
  activeChart: () => TvChartApi;
  remove: () => void;
};

export type TvWidgetOptions = Record<string, unknown>;

declare global {
  interface Window {
    TradingView?: { widget: new (options: TvWidgetOptions) => TvWidget };
  }
}

let libraryPromise: Promise<boolean> | null = null;

/**
 * Load the standalone bundle once. Resolves false when the licensed library
 * is not deployed, so callers can fall back to the in-house chart.
 */
export function loadTradingViewLibrary(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.TradingView?.widget) return Promise.resolve(true);
  if (libraryPromise) return libraryPromise;
  libraryPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TV_SCRIPT_URL}"]`);
    const script = existing ?? document.createElement("script");
    // A missing bundle stays missing for the session: no re-fetch per mount.
    const done = (ok: boolean) => {
      if (!ok) script.remove();
      resolve(ok && !!window.TradingView?.widget);
    };
    script.addEventListener("load", () => done(true), { once: true });
    script.addEventListener("error", () => done(false), { once: true });
    if (!existing) {
      script.src = TV_SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return libraryPromise;
}
