import { getAddress, isAddress } from "viem";

import { resolveHookitChainKey } from "@/lib/chains";
import type { ChartBar, ChartInterval } from "@/lib/token-chart";

const GT_API = "https://api.geckoterminal.com/api/v2";
const GT_ACCEPT = "application/json;version=20230203";
const GT_LIMIT = 500;

export type GeckoOhlcvPath = {
  timeframe: "minute" | "hour" | "day";
  aggregate: number;
};

/** Map chart TFs to GeckoTerminal OHLCV, same buckets Sentry uses. */
export function geckoOhlcvPath(interval: ChartInterval): GeckoOhlcvPath | null {
  switch (interval) {
    case "1m":
      return { timeframe: "minute", aggregate: 1 };
    case "5m":
      return { timeframe: "minute", aggregate: 5 };
    case "15m":
      return { timeframe: "minute", aggregate: 15 };
    case "1h":
      return { timeframe: "hour", aggregate: 1 };
    case "4h":
      return { timeframe: "hour", aggregate: 4 };
    case "1D":
      return { timeframe: "day", aggregate: 1 };
    default:
      return null;
  }
}

export function getGeckoTerminalNetwork(): "ink" | null {
  return resolveHookitChainKey() === "ink" ? "ink" : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function finiteNum(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** GeckoTerminal `ohlcv_list` rows: `[time, open, high, low, close, volume]` (newest first). */
export function parseOhlcvList(raw: unknown): ChartBar[] {
  if (!Array.isArray(raw)) return [];
  const parsed: ChartBar[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const time = finiteNum(row[0]);
    const open = finiteNum(row[1]);
    const high = finiteNum(row[2]);
    const low = finiteNum(row[3]);
    const close = finiteNum(row[4]);
    const volume = finiteNum(row[5]) ?? 0;
    if (time == null || time <= 0 || open == null || high == null || low == null || close == null) continue;
    parsed.push({
      time: Math.floor(time),
      open,
      high,
      low,
      close,
      volume: volume > 0 ? volume : 0,
    });
  }
  parsed.sort((a, b) => a.time - b.time);
  const deduped: ChartBar[] = [];
  for (const bar of parsed) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.time === bar.time) {
      prev.high = Math.max(prev.high, bar.high);
      prev.low = Math.min(prev.low, bar.low);
      prev.close = bar.close;
      prev.volume += bar.volume;
      continue;
    }
    deduped.push({ ...bar });
  }
  return deduped;
}

type GtPoolPick = {
  address: string;
  tokenSide: "base" | "quote";
  reserveUsd: number;
};

function tokenId(network: string, token: string): string {
  return `${network}_${token.toLowerCase()}`;
}

export function pickGeckoPoolForToken(payload: unknown, network: string, token: string): GtPoolPick | null {
  const root = asRecord(payload);
  const rows = root && Array.isArray(root.data) ? root.data : [];
  const want = tokenId(network, token);
  let best: GtPoolPick | null = null;

  for (const row of rows) {
    const rec = asRecord(row);
    const attrs = rec ? asRecord(rec.attributes) : null;
    const rel = rec ? asRecord(rec.relationships) : null;
    const address = readString(attrs?.address);
    if (!address || !isAddress(address)) continue;
    const baseId = readString(asRecord(asRecord(rel?.base_token)?.data)?.id)?.toLowerCase();
    const quoteId = readString(asRecord(asRecord(rel?.quote_token)?.data)?.id)?.toLowerCase();
    const tokenSide: "base" | "quote" | null =
      baseId === want ? "base" : quoteId === want ? "quote" : null;
    if (!tokenSide) continue;
    const reserveUsd = finiteNum(attrs?.reserve_in_usd) ?? 0;
    if (!best || reserveUsd > best.reserveUsd) {
      best = { address: getAddress(address), tokenSide, reserveUsd };
    }
  }
  return best;
}

async function gtGet(path: string): Promise<Response> {
  return fetch(`${GT_API}${path}`, {
    headers: { Accept: GT_ACCEPT },
    cache: "no-store",
  });
}

export async function fetchGeckoTerminalBars(
  tokenAddress: string,
  interval: ChartInterval,
): Promise<{ bars: ChartBar[]; pool: string | null }> {
  const network = getGeckoTerminalNetwork();
  const path = geckoOhlcvPath(interval);
  if (!network || !path || !isAddress(tokenAddress)) {
    return { bars: [], pool: null };
  }
  const token = getAddress(tokenAddress);

  const poolsRes = await gtGet(`/networks/${network}/tokens/${token}/pools?page=1`);
  if (poolsRes.status === 429) {
    const err = new Error("GeckoTerminal rate limited");
    (err as Error & { status: number }).status = 429;
    throw err;
  }
  if (!poolsRes.ok) return { bars: [], pool: null };

  const pick = pickGeckoPoolForToken(await poolsRes.json(), network, token);
  if (!pick) return { bars: [], pool: null };

  const qs = new URLSearchParams({
    aggregate: String(path.aggregate),
    limit: String(GT_LIMIT),
    currency: "usd",
    token: pick.tokenSide,
  });
  const ohlcvRes = await gtGet(
    `/networks/${network}/pools/${pick.address}/ohlcv/${path.timeframe}?${qs.toString()}`,
  );
  if (ohlcvRes.status === 429) {
    const err = new Error("GeckoTerminal rate limited");
    (err as Error & { status: number }).status = 429;
    throw err;
  }
  if (!ohlcvRes.ok) return { bars: [], pool: pick.address };

  const body = asRecord(await ohlcvRes.json());
  const attrs = body ? asRecord(asRecord(body.data)?.attributes) : null;
  return { bars: parseOhlcvList(attrs?.ohlcv_list), pool: pick.address };
}
