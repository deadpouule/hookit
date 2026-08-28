import { MOCK_METRICS, MOCK_POOLS, PROTOCOL_SHARE_BPS } from "@/lib/constants";
import { MASTER_HOOKS } from "@/lib/master-hooks";

export const NATIVE_TOKEN = "HOOK";
export const NATIVE_SUPPLY = 1_000_000_000;
export const NATIVE_BURNED = 24_180_440;

export const VOLUME_WINDOWS = ["24h", "7d", "30d", "all"] as const;
export type VolumeWindow = (typeof VOLUME_WINDOWS)[number];

export const CHART_WINDOWS = ["1d", "7d", "30d", "90d", "all"] as const;
export type ChartWindow = (typeof CHART_WINDOWS)[number];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface VolumeSnapshot {
  realVolumeUsd: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  buySellVolumeUsd: number;
  totalVolumeUsd: number;
  revenueUsd: number;
  buybackUsd: number;
  hookEarned: number;
}

export type ChartMetric = "buybacks" | "revenue" | "burns" | "fdv";

export interface SeriesPoint {
  label: string;
  buybackUsd: number;
  burnUsd: number;
  revenueUsd: number;
  fdvUsd: number;
}

const REVENUE_RATIO = 10_000 / PROTOCOL_SHARE_BPS;
export const HOOK_PRICE_USD = 0.0142;

export interface BuybackTx {
  hash: `0x${string}`;
  spentEth: number;
  hookOut: number;
  usd: number;
  ago: string;
}

export interface BurnEvent {
  hash: `0x${string}`;
  amount: number;
  ago: string;
}

export interface FeeBreakdown {
  hookEarned: number;
  sentToDead: number;
  classicLaunches: number;
  customLaunches: number;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function unit(n: number, salt = 1) {
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function hashFor(n: number, salt: number): `0x${string}` {
  const raw = `${n.toString(16)}${salt.toString(16)}deadhookitstats`.padEnd(64, "0");
  return `0x${raw.slice(0, 64)}`;
}

function dayLabel(offset: number) {
  const utc = Date.UTC(2026, 3, 30) + offset * 86_400_000;
  const d = new Date(utc);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function buildDaily(count: number): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const buy = 5_800 + unit(i) * 8_400 + (i % 7 === 3 ? 12_200 : 0) + i * 28;
    const burn = buy * (0.84 + unit(i, 2) * 0.14);
    const revenue = buy * REVENUE_RATIO;
    const fdv = 2_180_000 + i * 48_500 + unit(i, 5) * 320_000;
    points.push({
      label: dayLabel(i),
      buybackUsd: Math.round(buy),
      burnUsd: Math.round(burn),
      revenueUsd: Math.round(revenue),
      fdvUsd: Math.round(fdv),
    });
  }
  return points;
}

function buildHourly(): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (let h = 0; h < 24; h += 1) {
    const buy = 180 + unit(h, 3) * 520 + (h === 14 || h === 21 ? 640 : 0);
    const burn = buy * (0.82 + unit(h, 4) * 0.16);
    const revenue = buy * REVENUE_RATIO;
    const fdv = 7_420_000 + unit(h, 6) * 180_000;
    points.push({
      label: `${pad(h)}:00`,
      buybackUsd: Math.round(buy),
      burnUsd: Math.round(burn),
      revenueUsd: Math.round(revenue),
      fdvUsd: Math.round(fdv),
    });
  }
  return points;
}

const DAILY = buildDaily(120);
const HOURLY = buildHourly();

function sliceDaily(n: number) {
  return DAILY.slice(-n);
}

function toCumulative(points: SeriesPoint[]): SeriesPoint[] {
  let buy = 0;
  let burn = 0;
  let revenue = 0;
  return points.map((point) => {
    buy += point.buybackUsd;
    burn += point.burnUsd;
    revenue += point.revenueUsd;
    return {
      label: point.label,
      buybackUsd: buy,
      burnUsd: burn,
      revenueUsd: revenue,
      fdvUsd: point.fdvUsd,
    };
  });
}

export function metricValue(point: SeriesPoint, metric: ChartMetric): number {
  if (metric === "buybacks") return point.buybackUsd;
  if (metric === "revenue") return point.revenueUsd;
  if (metric === "burns") return point.burnUsd;
  return point.fdvUsd;
}

export function metricLabel(metric: ChartMetric): string {
  if (metric === "buybacks") return "Cumulative buybacks";
  if (metric === "revenue") return "Cumulative revenue";
  if (metric === "burns") return "Cumulative burns";
  return "$HOOK FDV";
}

export function metricSubtitle(metric: ChartMetric): string {
  if (metric === "buybacks") {
    return "Total USD deployed buying $HOOK on the open market, since launch.";
  }
  if (metric === "revenue") {
    return "Trading fees paid to the protocol, valued at claim time.";
  }
  if (metric === "burns") {
    return "USD value of $HOOK destroyed through buyback burns.";
  }
  return "Fully diluted valuation of $HOOK over the selected window.";
}

export function dailyBars(window: ChartWindow): SeriesPoint[] {
  if (window === "1d") return HOURLY;
  if (window === "7d") return sliceDaily(7);
  if (window === "30d") return sliceDaily(30);
  if (window === "90d") return sliceDaily(90);
  return DAILY;
}

export function cumulativeSeries(window: ChartWindow): SeriesPoint[] {
  return toCumulative(dailyBars(window));
}

export const VOLUME_BY_WINDOW: Record<VolumeWindow, VolumeSnapshot> = {
  "24h": {
    realVolumeUsd: 218_440,
    buyVolumeUsd: 94_210,
    sellVolumeUsd: 101_880,
    buySellVolumeUsd: 196_090,
    totalVolumeUsd: 414_530,
    revenueUsd: 3_523,
    buybackUsd: 1_057,
    hookEarned: 251_680,
  },
  "7d": {
    realVolumeUsd: 1_162_880,
    buyVolumeUsd: 488_410,
    sellVolumeUsd: 531_220,
    buySellVolumeUsd: 1_019_630,
    totalVolumeUsd: 2_182_510,
    revenueUsd: 18_551,
    buybackUsd: 5_565,
    hookEarned: 1_325_000,
  },
  "30d": {
    realVolumeUsd: 4_218_990,
    buyVolumeUsd: 1_774_200,
    sellVolumeUsd: 1_966_410,
    buySellVolumeUsd: 3_740_610,
    totalVolumeUsd: 7_959_600,
    revenueUsd: 67_656,
    buybackUsd: 20_297,
    hookEarned: 4_832_620,
  },
  all: {
    realVolumeUsd: MOCK_METRICS.totalVolume,
    buyVolumeUsd: 5_420_110,
    sellVolumeUsd: 6_018_440,
    buySellVolumeUsd: 11_438_550,
    totalVolumeUsd: MOCK_METRICS.totalVolume + 11_438_550,
    revenueUsd: 194_287,
    buybackUsd: 58_286,
    hookEarned: 13_877_620,
  },
};

export const LATEST_BUYBACKS: BuybackTx[] = [
  { hash: hashFor(1, 1), spentEth: 0.042, hookOut: 12_410, usd: 168.0, ago: "2m ago" },
  { hash: hashFor(2, 1), spentEth: 0.118, hookOut: 34_880, usd: 472.0, ago: "7m ago" },
  { hash: hashFor(3, 1), spentEth: 0.009, hookOut: 2_640, usd: 36.0, ago: "11m ago" },
  { hash: hashFor(4, 1), spentEth: 0.255, hookOut: 75_200, usd: 1_020.0, ago: "18m ago" },
  { hash: hashFor(5, 1), spentEth: 0.031, hookOut: 9_150, usd: 124.0, ago: "24m ago" },
  { hash: hashFor(6, 1), spentEth: 0.087, hookOut: 25_700, usd: 348.0, ago: "41m ago" },
  { hash: hashFor(7, 1), spentEth: 0.014, hookOut: 4_120, usd: 56.0, ago: "1h ago" },
  { hash: hashFor(8, 1), spentEth: 0.19, hookOut: 56_040, usd: 760.0, ago: "1h ago" },
  { hash: hashFor(9, 1), spentEth: 0.006, hookOut: 1_770, usd: 24.0, ago: "2h ago" },
  { hash: hashFor(10, 1), spentEth: 0.072, hookOut: 21_300, usd: 288.0, ago: "3h ago" },
  { hash: hashFor(11, 1), spentEth: 0.033, hookOut: 9_740, usd: 132.0, ago: "4h ago" },
  { hash: hashFor(12, 1), spentEth: 0.21, hookOut: 62_100, usd: 840.0, ago: "5h ago" },
];

export const BUYBACK_BURNS: BurnEvent[] = [
  { hash: hashFor(1, 2), amount: 11_820, ago: "2m ago" },
  { hash: hashFor(2, 2), amount: 33_410, ago: "7m ago" },
  { hash: hashFor(3, 2), amount: 2_510, ago: "11m ago" },
  { hash: hashFor(4, 2), amount: 71_900, ago: "18m ago" },
  { hash: hashFor(5, 2), amount: 8_740, ago: "24m ago" },
  { hash: hashFor(6, 2), amount: 24_600, ago: "41m ago" },
  { hash: hashFor(7, 2), amount: 3_940, ago: "1h ago" },
  { hash: hashFor(8, 2), amount: 53_280, ago: "1h ago" },
  { hash: hashFor(9, 2), amount: 1_680, ago: "2h ago" },
  { hash: hashFor(10, 2), amount: 20_150, ago: "3h ago" },
  { hash: hashFor(11, 2), amount: 9_280, ago: "4h ago" },
  { hash: hashFor(12, 2), amount: 59_400, ago: "5h ago" },
];

export const LATEST_BURNS: BurnEvent[] = [
  ...BUYBACK_BURNS,
  { hash: hashFor(13, 2), amount: 14_220, ago: "6h ago" },
  { hash: hashFor(14, 2), amount: 7_110, ago: "8h ago" },
  { hash: hashFor(15, 2), amount: 42_800, ago: "9h ago" },
  { hash: hashFor(16, 2), amount: 3_050, ago: "11h ago" },
  { hash: hashFor(17, 2), amount: 18_640, ago: "14h ago" },
  { hash: hashFor(18, 2), amount: 27_900, ago: "18h ago" },
  { hash: hashFor(19, 2), amount: 6_440, ago: "22h ago" },
  { hash: hashFor(20, 2), amount: 31_200, ago: "1d ago" },
];

export const FEE_BREAKDOWN: FeeBreakdown = {
  hookEarned: 13_877_620,
  sentToDead: NATIVE_BURNED,
  classicLaunches: 8_210_000,
  customLaunches: 5_667_620,
};

export const PROTOCOL_BUYBACK_PCT = PROTOCOL_SHARE_BPS / 100;

export function protocolOverview() {
  const all = VOLUME_BY_WINDOW.all;
  const burnedPct = (NATIVE_BURNED / NATIVE_SUPPLY) * 100;
  const hookBought = LATEST_BUYBACKS.reduce((sum, tx) => sum + tx.hookOut, 0) * 116;
  const swapCount = LATEST_BUYBACKS.length * 116;
  const burnedUsd = Math.round(NATIVE_BURNED * HOOK_PRICE_USD);
  return {
    nativeToken: NATIVE_TOKEN,
    totalSupply: NATIVE_SUPPLY,
    burned: NATIVE_BURNED,
    burnedPct,
    burnedUsd,
    remaining: NATIVE_SUPPLY - NATIVE_BURNED,
    launchVolumeUsd: all.realVolumeUsd,
    launches: MOCK_POOLS.length,
    masterHooks: MASTER_HOOKS.length,
    buybacks: swapCount,
    hookBought,
    latestWindow: 100,
    buybackUsd: all.buybackUsd,
    revenueUsd: all.revenueUsd,
  };
}
